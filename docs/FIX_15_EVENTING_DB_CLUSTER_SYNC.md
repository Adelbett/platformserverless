# FIX 15 — Désynchronisation DB ↔ Cluster : KafkaSource / Trigger

Suite à un audit complet (voir conversation) confirmant un vrai décalage entre les entités JPA `KafkaSource`/`Trigger` et les ressources Kubernetes réellement créées. `KafkaTopic`/`KafkaService` s'est avéré sain (utilise l'API Kafka directement, transactionnel, pas de bug). Les bugs critiques trouvés concernent uniquement `EventingService`/`EventingController`.

## Bugs corrigés

### 🔴 1. Exceptions fabric8 avalées silencieusement

`createKnativeKafkaSource()` et `createKnativeTrigger()` avaient un `catch (Exception e) { log.error(...); }` sans `throw` — si la création de la CR échouait (cluster injoignable, RBAC insuffisant, etc.), la méthode retournait normalement et l'utilisateur recevait un `201 Created` avec un objet valide en DB, **alors qu'aucune ressource n'avait été créée dans le cluster**.

**Fix** : les deux méthodes laissent maintenant l'exception se propager (sauf le cas `409 Conflict`, qui reste géré comme un no-op légitime). `createKafkaSource()` et `createTrigger()` sont maintenant `@Transactional` : si la création cluster échoue, la ligne DB est annulée automatiquement — plus de désynchronisation possible.

### 🔴 2. Namespace `KafkaSource` toujours codé en dur à `"default"`

Le paramètre `appNamespace` était accepté par `createKnativeKafkaSource()` mais jamais utilisé — la CR était toujours créée dans `default`, alors que l'entité DB stockait correctement le vrai namespace du tenant.

**Fix** : `metadata.namespace` et `.inNamespace(...)` utilisent maintenant le vrai `appNamespace`. Le `sink.ref` vers le Broker reste `default`/`default` (référence cross-namespace valide en Knative Eventing) puisqu'il n'existe qu'un seul Broker global sur ce cluster.

**Note importante** : pour `Trigger`, ce même changement de namespace **n'a pas été appliqué**, volontairement — `Trigger.spec.broker` est une simple chaîne (pas une référence namespace-qualifiée), et Knative **exige** que le Trigger vive dans le même namespace que son Broker. Comme il n'y a qu'un Broker global (`default`), garder `Trigger` dans `default` est correct et nécessaire, pas un bug.

### 🔴 3. `DELETE /api/eventing/triggers/{id}` ne supprimait que la ligne DB

L'endpoint appelait directement `triggerRepository.delete(t)` sans jamais toucher au cluster — le Trigger continuait de router des événements indéfiniment après suppression côté utilisateur.

**Fix** : nouvelle méthode `EventingService.deleteTrigger(triggerId, userId)` qui supprime d'abord la CR Knative Trigger (avec gestion `404 = déjà absent`, sinon propagation de l'erreur pour garder la ligne DB et permettre un retry), puis la ligne DB. Le contrôleur délègue maintenant à cette méthode.

### 🔴 4. (trouvé en creusant le fix #3) La CR `KafkaSource` n'était jamais supprimée à la suppression d'une app

`deleteByServiceName()` (appelée lors de la suppression d'une app entière) supprimait bien la CR `Trigger`, mais jamais la CR `KafkaSource` elle-même — seulement sa ligne DB.

**Fix** : ajout de la suppression fabric8 de la CR `KafkaSource` dans `deleteByServiceName()`, en best-effort (log, pas de rethrow) puisque cette méthode est un nettoyage en cascade après suppression réussie du Knative Service — une erreur ici ne doit pas bloquer la suppression de l'app elle-même.

## Bug mineur corrigé au passage

`kafkaBootstrapServers` était codé en dur en chaîne littérale (`"my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"`) dupliqué à deux endroits dans `EventingService.java`, au lieu d'être injecté via `@Value("${app.kafka.bootstrap-servers}")` comme dans `KafkaService`. Corrigé — un seul point de configuration désormais.

## Bugs identifiés mais NON corrigés (reportés)

- 🟡 `KafkaSource.ready` / `Trigger.ready` ne sont jamais resynchronisés depuis le statut réel de la CR (contrairement à `App` qui a `AppService.syncStatusFromKubernetes()`). Nécessiterait un job de réconciliation dédié.
- 🟡 `createTrigger()` ne vérifie pas que le `subscriberName`/URL cible existe réellement avant de créer la CR.
- 🟡 `KafkaService.createTopic()` vérifie l'unicité du nom de topic par utilisateur, pas globalement (les noms Kafka sont uniques cluster-wide) — un conflit entre deux utilisateurs choisissant le même nom produit une erreur 500 générique au lieu d'un message clair.
- 🟡 Gestion du conflit `409` incohérente entre `createKnativeKafkaSource` (skip silencieux) et `createKnativeTrigger` (delete + recreate).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/eventing/EventingService.java`
- `backend-api/src/main/java/com/platform/api/eventing/EventingController.java`
