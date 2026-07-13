# Audit complet + correctifs : synchronisation DB ↔ Cluster (Kafka / Eventing)

Rapport exhaustif de l'audit demandé sur la cohérence entre les entités JPA (`KafkaTopic`, `KafkaSource`, `Trigger`) et les ressources réellement créées dans le cluster Kubernetes (Strimzi/Knative via fabric8), avec **tout le code modifié**.

Commits concernés :
- `6d66cb5` — fix(eventing): stop silent DB/cluster desync for KafkaSource and Trigger
- `d72e3df` — fix(kafka): enforce cluster-wide topic name uniqueness
- `879e669` — fix(eventing): resync ready status from cluster, align 409 handling

---

## Sommaire de l'audit

| Module | Verdict |
|---|---|
| `KafkaService` (topics) | ✅ Sain — utilise l'API Kafka directement (`AdminClient`), transactionnel, pas de ligne fantôme possible |
| `EventingService` (KafkaSource) | 🔴 3 bugs critiques trouvés et corrigés |
| `EventingService`/`EventingController` (Trigger) | 🔴 1 bug critique + 2 bugs moyens trouvés et corrigés |

---

## 🔴 Bug 1 — Exceptions fabric8 avalées silencieusement

**Avant** — `createKnativeKafkaSource()` et `createKnativeTrigger()` :
```java
try {
    // ... construction + appel fabric8 .create() ...
} catch (Exception e) {
    log.error("Failed to create KafkaSource '{}': {}", name, e.getMessage());
    // ⚠️ pas de throw — la méthode retourne normalement
}
```
Et l'appelant `createKafkaSource()` (ni `@Transactional`, ni vérification du résultat) :
```java
public KafkaSourceDto createKafkaSource(...) {
    source = kafkaSourceRepository.save(source);   // DB écrite
    if (kubernetesEnabled && kafkaTopicId != null) {
        createKnativeKafkaSource(...);              // échec possible, ignoré
    }
    return toKafkaSourceDto(source);                // retourne succès quand même
}
```

**Impact** : si le cluster est injoignable ou le RBAC insuffisant, l'utilisateur recevait un `201 Created` avec un objet valide, la ligne existait en DB, **mais aucune ressource `KafkaSource`/`Trigger` n'existait jamais dans Kubernetes**. Rien ne l'indiquait.

**Après** — `createKafkaSource()` et `createTrigger()` :
```java
@Transactional
public KafkaSourceDto createKafkaSource(String userId, String kafkaTopicId, String name, String namespace, String config) {
    ...
    source = kafkaSourceRepository.save(source);
    if (kubernetesEnabled && kafkaTopicId != null) {
        String topicName = kafkaTopicRepository.findById(kafkaTopicId)
                .map(t -> t.getName())
                .orElse(kafkaTopicId);
        // Let failures propagate — @Transactional rolls back the DB row above so
        // we never end up with a KafkaSource that "exists" in the DB but was
        // never actually created in the cluster.
        createKnativeKafkaSource(name, topicName, consumerGroup, ns);
    }
    return toKafkaSourceDto(source);
}
```
```java
@Transactional
public void createTrigger(String userId, String kafkaSourceId, String filter, String action) {
    ...
    triggerRepository.save(trigger);
    // Create the real Knative Trigger resource on the cluster. Let failures
    // propagate — @Transactional rolls back the DB row above so we never end
    // up with a Trigger that "exists" in the DB but was never actually created.
    if (kubernetesEnabled) {
        createKnativeTrigger(triggerName, filter, action);
    }
}
```
`createKnativeKafkaSource()` (le `catch (Exception e)` extérieur est supprimé, seul le `catch (KubernetesClientException e)` gérant le 409 subsiste, avec `throw e;` pour tout le reste) :
```java
private void createKnativeKafkaSource(String name, String topicName, String consumerGroup, String appNamespace) {
    GenericKubernetesResource kafkaSource = new GenericKubernetesResourceBuilder()
            .withApiVersion("sources.knative.dev/v1beta1")
            .withKind("KafkaSource")
            .withNewMetadata()
                .withName(name)
                .withNamespace(appNamespace)
            .endMetadata()
            .addToAdditionalProperties("spec", Map.of(
                "bootstrapServers", List.of(kafkaBootstrapServers),
                "topics", List.of(topicName),
                "consumerGroup", consumerGroup,
                "sink", Map.of(
                    "ref", Map.of(
                        "apiVersion", "eventing.knative.dev/v1",
                        "kind", "Broker",
                        "name", "default",
                        "namespace", "default"
                    )
                )
            ))
            .build();

    try {
        kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                .inNamespace(appNamespace)
                .resource(kafkaSource)
                .create();
        log.info("KafkaSource '{}' created in namespace '{}' → topic={}", name, appNamespace, topicName);
    } catch (KubernetesClientException e) {
        if (e.getCode() == 409) {
            // Delete + recreate (not a no-op skip) so the CR always reflects
            // the latest spec — consistent with createKnativeTrigger() below.
            kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                    .inNamespace(appNamespace)
                    .withName(name)
                    .delete();
            kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                    .inNamespace(appNamespace)
                    .resource(kafkaSource)
                    .create();
            log.info("KafkaSource '{}' recreated in namespace '{}'", name, appNamespace);
        } else {
            log.error("Failed to create KafkaSource '{}' in namespace '{}': {}", name, appNamespace, e.getMessage());
            throw e;
        }
    }
}
```

---

## 🔴 Bug 2 — Namespace `KafkaSource` toujours codé en dur à `"default"`

**Avant** : le paramètre `appNamespace` était accepté mais jamais utilisé — `withNamespace("default")` et `.inNamespace("default")` codés en dur, alors que l'entité DB stockait le vrai namespace du tenant (`ns` dans `createKafkaSource()`).

**Après** : `withNamespace(appNamespace)` et `.inNamespace(appNamespace)` (visible dans le bloc de code du Bug 1 ci-dessus). Le `sink.ref` vers le Broker reste `"default"`/`"default"` — référence cross-namespace valide en Knative Eventing, puisqu'il n'existe qu'un seul Broker global sur ce cluster (confirmé : aucun autre endroit du code ne provisionne de Broker par tenant).

**Note** : pour `Trigger`, ce changement n'a **volontairement pas** été appliqué — `Trigger.spec.broker` est une simple chaîne (pas une référence namespace-qualifiée), et Knative **exige** que le Trigger vive dans le même namespace que son Broker. `createKnativeTrigger()` garde donc `"default"` en dur, ce qui est correct :
```java
/**
 * Trigger and Broker must live in the same namespace (spec.broker is a bare
 * name, not a namespace-qualified ref) — always "default" since that's the
 * only Broker provisioned on this cluster.
 */
private void createKnativeTrigger(String triggerName, String eventType, String subscriberUrl) {
    GenericKubernetesResource knativeTrigger = new GenericKubernetesResourceBuilder()
            .withApiVersion("eventing.knative.dev/v1")
            .withKind("Trigger")
            .withNewMetadata()
                .withName(triggerName)
                .withNamespace("default")
            .endMetadata()
            .addToAdditionalProperties("spec", Map.of(
                "broker", "default",
                "filter", Map.of("attributes", Map.of("type", eventType)),
                "subscriber", Map.of("uri", subscriberUrl)
            ))
            .build();

    try {
        kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                .inNamespace("default")
                .resource(knativeTrigger)
                .create();
        log.info("Knative Trigger '{}' created in default namespace → {}", triggerName, subscriberUrl);
    } catch (KubernetesClientException e) {
        if (e.getCode() == 409) {
            kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                    .inNamespace("default").withName(triggerName).delete();
            kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                    .inNamespace("default").resource(knativeTrigger).create();
            log.info("Knative Trigger '{}' recreated", triggerName);
        } else {
            log.error("Failed to create Knative Trigger '{}': {}", triggerName, e.getMessage());
            throw e;
        }
    }
}
```

---

## 🔴 Bug 3 — `DELETE /api/eventing/triggers/{id}` ne supprimait que la ligne DB

**Avant** — `EventingController.java` :
```java
@DeleteMapping("/triggers/{id}")
public ResponseEntity<Void> deleteTrigger(@PathVariable String id, Authentication auth) {
    triggerRepository.findById(id).ifPresent(t -> {
        if (t.getUserId().equals(auth.getName())) {
            triggerRepository.delete(t);   // ⚠️ seulement la DB
        }
    });
    return ResponseEntity.noContent().build();
}
```
**Impact** : le Trigger Knative continuait de router des événements indéfiniment après suppression côté utilisateur.

**Après** — nouvelle méthode dédiée dans `EventingService.java` :
```java
/**
 * Deletes a Trigger the user owns, from both the database and the cluster.
 * The Trigger CR always lives in the "default" namespace alongside the single
 * global Broker — Knative requires a Trigger and its Broker to share a
 * namespace (spec.broker is a bare name, not a namespace-qualified ref).
 */
@Transactional
public void deleteTrigger(String triggerId, String userId) {
    Trigger trigger = triggerRepository.findById(triggerId)
            .orElseThrow(() -> new NotFoundException("Trigger not found: " + triggerId));
    if (!trigger.getUserId().equals(userId)) {
        throw new UnauthorizedException("Access denied to Trigger: " + triggerId);
    }

    if (kubernetesEnabled) {
        try {
            kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                    .inNamespace("default")
                    .withName(trigger.getName())
                    .delete();
            log.info("Knative Trigger '{}' deleted", trigger.getName());
        } catch (KubernetesClientException e) {
            if (e.getCode() == 404) {
                log.info("Knative Trigger '{}' already gone from the cluster, proceeding", trigger.getName());
            } else {
                // Propagate — @Transactional keeps the DB row so the user can
                // retry, instead of silently leaving an orphaned Trigger CR.
                log.error("Could not delete Knative Trigger '{}': {}", trigger.getName(), e.getMessage());
                throw e;
            }
        }
    }

    triggerRepository.delete(trigger);
}
```
`EventingController.java` délègue maintenant simplement :
```java
@DeleteMapping("/triggers/{id}")
public ResponseEntity<Void> deleteTrigger(@PathVariable String id, Authentication auth) {
    eventingService.deleteTrigger(id, auth.getName());
    return ResponseEntity.noContent().build();
}
```

---

## 🔴 Bug 4 (trouvé en corrigeant le bug 3) — CR `KafkaSource` jamais supprimée à la suppression d'une app

`deleteByServiceName()` (appelée par `AppService.deleteApp()` lors de la suppression d'une app entière) supprimait bien la CR `Trigger`, mais jamais la CR `KafkaSource` elle-même :

**Après** :
```java
/**
 * Best-effort cascade delete, called during app teardown (AppService.deleteApp)
 * after the Knative Service itself has already been deleted. Cluster cleanup
 * failures here are logged, not thrown, so a stuck Kafka/Trigger CR never
 * blocks deleting the app itself — unlike deleteTrigger()'s standalone path,
 * which fails loudly since there's no larger deletion already in progress.
 */
public void deleteByServiceName(String serviceName, String userId) {
    String sourceName = serviceName + "-source";
    kafkaSourceRepository.findByUserId(userId).stream()
            .filter(s -> s.getName().equals(sourceName))
            .forEach(source -> {
                String triggerName = source.getName() + "-trigger";
                triggerRepository.findByKafkaSourceId(source.getId())
                        .forEach(t -> {
                            if (kubernetesEnabled) {
                                try {
                                    kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
                                            .inNamespace("default")
                                            .withName(triggerName)
                                            .delete();
                                    log.info("Knative Trigger '{}' deleted", triggerName);
                                } catch (Exception e) {
                                    log.warn("Could not delete Knative Trigger '{}': {}", triggerName, e.getMessage());
                                }
                            }
                            triggerRepository.delete(t);
                        });
                if (kubernetesEnabled) {
                    try {
                        kubernetesClient.genericKubernetesResources("sources.knative.dev/v1beta1", "KafkaSource")
                                .inNamespace(source.getNamespace())
                                .withName(source.getName())
                                .delete();
                        log.info("Knative KafkaSource '{}' deleted", source.getName());
                    } catch (Exception e) {
                        log.warn("Could not delete Knative KafkaSource '{}': {}", source.getName(), e.getMessage());
                    }
                }
                kafkaSourceRepository.delete(source);
                log.info("KafkaSource '{}' and its triggers deleted", sourceName);
            });
}
```

---

## 🟡 Bug 5 — Bootstrap servers codé en dur (dupliqué)

**Avant** : `"my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"` en chaîne littérale à deux endroits, au lieu d'être injecté via config.

**Après** :
```java
@Value("${app.kafka.bootstrap-servers:localhost:9092}")
private String kafkaBootstrapServers;
```
Utilisé partout à la place de la chaîne littérale (`.bootstrapServers(kafkaBootstrapServers)`, `List.of(kafkaBootstrapServers)`) — un seul point de configuration désormais, cohérent avec `KafkaService`.

---

## 🟡 Bug 6 — Unicité de nom de topic vérifiée par utilisateur, pas globalement

**Avant** — `KafkaService.java` :
```java
if (topicRepository.existsByNameAndUserId(req.getName(), userId)) {
    throw new ConflictException("Topic already exists: " + req.getName());
}
```
Deux utilisateurs différents choisissant le même nom : le second passait cette vérification (scopée à lui), insérait sa ligne DB, puis échouait sur le vrai appel Kafka (`TopicExistsException`) avec un message générique — le rollback transactionnel fonctionnait déjà (pas de ligne fantôme), seul le message était confus.

**Après** — `KafkaTopicRepository.java` :
```java
public interface KafkaTopicRepository extends JpaRepository<KafkaTopic, String> {
    List<KafkaTopic> findByUserId(String userId);
    Optional<KafkaTopic> findByNameAndUserId(String name, String userId);
    boolean existsByNameAndUserId(String name, String userId);
    boolean existsByName(String name);   // ← nouveau
}
```
`KafkaService.java` :
```java
if (topicRepository.existsByNameAndUserId(req.getName(), userId)) {
    throw new ConflictException("Topic already exists: " + req.getName());
}
// Kafka topic names are unique cluster-wide, not per-user — without this
// check, a second user picking an already-taken name would pass the
// per-user check above, insert a DB row, then fail on the real Kafka
// AdminClient call with a generic 500 (TopicExistsException) instead of
// a clear conflict message.
if (topicRepository.existsByName(req.getName())) {
    throw new ConflictException("Topic name already in use by another tenant: " + req.getName());
}
```

---

## 🟡 Bug 7 — Champ `ready` jamais resynchronisé depuis le cluster

**Avant** : `KafkaSource.ready`/`Trigger.ready` restaient figés à leur valeur par défaut de création (`false`), sans jamais refléter le statut réel de la CR — contrairement à `App` qui a `AppService.syncStatusFromKubernetes()`.

**Après** — nouveau helper générique dans `EventingService.java`, sur le même modèle que `KnativeService.getRealStatus()` :
```java
/**
 * Reads a generic Knative-style CR's status.conditions and returns whether
 * its "Ready" condition is True. Returns null if the resource can't be read
 * (not found, cluster error) so callers can leave the stored value alone
 * rather than overwrite it with a guess.
 */
private Boolean checkReady(String apiVersion, String kind, String namespace, String name) {
    try {
        GenericKubernetesResource resource = kubernetesClient
                .genericKubernetesResources(apiVersion, kind)
                .inNamespace(namespace)
                .withName(name)
                .get();
        if (resource == null) return null;

        Object statusObj = resource.getAdditionalProperties().get("status");
        if (!(statusObj instanceof Map<?, ?> status)) return false;

        Object conditionsObj = status.get("conditions");
        if (!(conditionsObj instanceof List<?> conditions)) return false;

        for (Object cond : conditions) {
            if (cond instanceof Map<?, ?> condMap && "Ready".equals(condMap.get("type"))) {
                return "True".equals(String.valueOf(condMap.get("status")));
            }
        }
        return false;
    } catch (Exception e) {
        log.debug("Could not read readiness for {}/{} '{}': {}", apiVersion, kind, name, e.getMessage());
        return null;
    }
}
```
Appelé à chaque liste :
```java
public List<KafkaSourceDto> listKafkaSources(String userId) {
    List<KafkaSource> sources = kafkaSourceRepository.findByUserId(userId);
    syncKafkaSourceReadiness(sources);
    return sources.stream().map(this::toKafkaSourceDto).collect(Collectors.toList());
}

private void syncKafkaSourceReadiness(List<KafkaSource> sources) {
    if (!kubernetesEnabled) return;
    for (KafkaSource source : sources) {
        Boolean realReady = checkReady("sources.knative.dev/v1beta1", "KafkaSource",
                source.getNamespace(), source.getName());
        if (realReady != null && !realReady.equals(source.getReady())) {
            source.setReady(realReady);
            kafkaSourceRepository.save(source);
        }
    }
}
```
```java
public List<Trigger> listTriggers(String kafkaSourceId, String userId) {
    requireOwnedSource(kafkaSourceId, userId);
    List<Trigger> triggers = triggerRepository.findByKafkaSourceId(kafkaSourceId);
    syncTriggerReadiness(triggers);
    return triggers;
}

/** Used by GET /api/eventing/triggers — all of a user's triggers, readiness resynced. */
public List<Trigger> listTriggersForUser(String userId) {
    List<Trigger> triggers = triggerRepository.findByUserId(userId);
    syncTriggerReadiness(triggers);
    return triggers;
}

private void syncTriggerReadiness(List<Trigger> triggers) {
    if (!kubernetesEnabled) return;
    for (Trigger trigger : triggers) {
        Boolean realReady = checkReady("eventing.knative.dev/v1", "Trigger", "default", trigger.getName());
        if (realReady != null && !realReady.equals(trigger.getReady())) {
            trigger.setReady(realReady);
            triggerRepository.save(trigger);
        }
    }
}
```

### Bug additionnel trouvé en corrigeant celui-ci

`EventingController.listTriggers()` (l'endpoint `GET /api/eventing/triggers` **réellement utilisé par le frontend**) contournait `EventingService` entièrement :

**Avant** :
```java
private final TriggerRepository triggerRepository;   // injecté directement dans le contrôleur

@GetMapping("/triggers")
public ResponseEntity<List<TriggerDto>> listTriggers(Authentication auth) {
    List<TriggerDto> result = triggerRepository.findByUserId(auth.getName())
            .stream()
            .map(t -> TriggerDto.builder()
                    ...
                    .ready(t.getActive() != null ? t.getActive() : false)   // ⚠️ mappe "ready" depuis "active" !
                    ...
```
`ready` était donc mappé depuis le champ **`active`** (qui veut dire "l'utilisateur a activé ce trigger"), pas depuis le vrai champ **`ready`** (qui veut dire "le cluster confirme qu'il fonctionne") — deux notions confondues.

**Après** :
```java
@GetMapping("/triggers")
public ResponseEntity<List<TriggerDto>> listTriggers(Authentication auth) {
    List<TriggerDto> result = eventingService.listTriggersForUser(auth.getName())
            .stream()
            .map(t -> TriggerDto.builder()
                    ...
                    .ready(t.getReady() != null ? t.getReady() : false)   // ← vrai champ, resynchronisé
                    ...
```
Le champ `triggerRepository` a été retiré du contrôleur (plus nécessaire, tout passe par `eventingService`).

---

## 🟡 Bug 8 — Gestion du conflit 409 incohérente

**Avant** : `createKnativeKafkaSource` faisait un simple skip silencieux sur 409 (`log.info(...); ` sans mise à jour), alors que `createKnativeTrigger` faisait déjà un delete + recreate.

**Après** : harmonisé — `createKnativeKafkaSource` fait maintenant delete + recreate aussi (voir le code complet du Bug 1 ci-dessus), pour que la CR reflète toujours le dernier spec, cohérent avec le comportement de `createKnativeTrigger`.

---

## Bug identifié mais NON corrigé (reporté)

🟡 `createTrigger()` ne vérifie pas que le `subscriberName`/URL cible existe réellement (un `KnativeService` vivant) avant de créer la CR Trigger. Non corrigé — nécessiterait d'ajouter une vérification via `AppRepository`/fabric8 avant la création, changement de comportement fonctionnel à valider avec l'utilisateur au préalable.

---

## Fichiers modifiés (résumé)

| Fichier | Nature des changements |
|---|---|
| `backend-api/src/main/java/com/platform/api/eventing/EventingService.java` | `@Transactional` sur create*, rethrow des erreurs fabric8, namespace dynamique pour KafkaSource, nouvelle méthode `deleteTrigger()`, suppression de la CR KafkaSource dans `deleteByServiceName()`, `checkReady()` + resynchronisation `ready`, config `kafkaBootstrapServers`, harmonisation du traitement 409 |
| `backend-api/src/main/java/com/platform/api/eventing/EventingController.java` | `deleteTrigger()` délègue à `EventingService`, `listTriggers()` passe par `EventingService.listTriggersForUser()`, retrait de l'injection directe de `TriggerRepository` |
| `backend-api/src/main/java/com/platform/api/kafka/KafkaService.java` | Vérification d'unicité globale du nom de topic |
| `backend-api/src/main/java/com/platform/api/kafka/KafkaTopicRepository.java` | Nouvelle méthode `existsByName(String)` |
