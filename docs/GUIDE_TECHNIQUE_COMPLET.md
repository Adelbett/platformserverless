 # Guide Technique Complet — Plateforme Serverless NextStep

> Basé **uniquement** sur le code source réel du projet (backend-api + web-portal).  
> Toute référence à un fichier indique le vrai fichier dans le dépôt.

---

## 1. Gestion des API Keys (Token Utilisateur)

### C'est quoi, exactement ?

La **fonctionnalité "Generate Token"** dans la section **Settings/Profile** n'est **pas** le token JWT de login.

| | Token JWT (login) | API Key (Generate Token) |
|---|---|---|
| **Créé par** | Keycloak automatiquement lors du login | L'utilisateur depuis la plateforme |
| **Durée** | Expire en ~5 min / ~1h (paramètre Keycloak) | Permanent jusqu'à révocation |
| **Format** | `eyJhbGciOiJSUzI1NiJ9...` (JWT signé) | `plat_<40 chars base64url>` |
| **Usage** | Navigateur → plateforme | Scripts CI/CD, curl, API externe |
| **Stockage** | Non stocké (stateless JWT) | Hash SHA-256 en base de données |

### À quoi sert l'API Key ?

L'API Key permet à un développeur d'**appeler les endpoints de la plateforme depuis un script ou un pipeline CI/CD**, sans avoir à se connecter à Keycloak et sans passer par l'interface web.

**Exemple concret :**
```bash
# Déployer une app depuis un script CI/CD sans navigateur
curl -X POST http://10.9.21.224:31088/api/apps \
  -H "X-Api-Key: plat_ABC123..." \
  -H "Content-Type: application/json" \
  -d '{"name":"order-service","imageName":"adelbettaieb/order-service","imageTag":"v2","port":8080}'
```

### Comment ça fonctionne dans le code

#### 1. Génération — `ApiKeyService.java`
```
POST /api/apikeys  →  ApiKeyController  →  ApiKeyService.generate()
```

```java
// ApiKeyService.java — étapes clés :

// 1. Génère 30 octets aléatoires cryptographiquement sûrs
byte[] bytes = new byte[30];
RANDOM.nextBytes(bytes);                           // SecureRandom

// 2. Construit la clé brute : "plat_" + base64url (40 chars)
String rawKey = "plat_" + Base64.getUrlEncoder()
    .withoutPadding().encodeToString(bytes);
// Exemple : plat_X7kQmP2vNjAsBtYcRdWoUeLpFzGhIi

// 3. Calcule le hash SHA-256 (jamais stocker la clé brute)
String hash   = sha256(rawKey);

// 4. Sauvegarde UNIQUEMENT le hash + préfixe (12 premiers chars)
ApiKey key = ApiKey.builder()
    .userId(userId)
    .name(name)
    .keyHash(hash)          // stocké en DB
    .keyPrefix(rawKey.substring(0, 12))  // "plat_X7kQmP" — affiché dans UI
    .build();
repository.save(key);

// 5. Retourne la clé brute UNE SEULE FOIS — jamais récupérable après
return Map.of("rawKey", rawKey, "prefix", prefix, ...);
```

**Table PostgreSQL `api_keys` :**
```
id          | UUID
user_id     | VARCHAR  (propriétaire)
name        | VARCHAR  ("My CI Key")
key_hash    | CHAR(64) (SHA-256 hex — clé de recherche)
key_prefix  | VARCHAR  ("plat_X7kQmP")
active      | BOOLEAN
last_used_at| TIMESTAMP
created_at  | TIMESTAMP
```

#### 2. Utilisation — `ApiKeyFilter.java`
Toutes les requêtes HTTP passent par ce filtre **avant** Spring Security :

```java
// ApiKeyFilter.java
String rawKey = request.getHeader("X-Api-Key");

if (rawKey != null && SecurityContextHolder.getContext().getAuthentication() == null) {
    apiKeyService.validate(rawKey).ifPresent(userId -> {
        // Injecte une authentification avec le rôle CLIENT_ADMIN
        var auth = new UsernamePasswordAuthenticationToken(
            userId, null,
            List.of(new SimpleGrantedAuthority("ROLE_CLIENT_ADMIN"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    });
}
```

**Validation :**
```java
// ApiKeyService.validate()
public Optional<String> validate(String rawKey) {
    if (!rawKey.startsWith("plat_")) return Optional.empty();
    String hash = sha256(rawKey);                         // recalcule le hash
    return repository.findByKeyHashAndActiveTrue(hash)    // cherche en DB
        .map(k -> {
            k.setLastUsedAt(LocalDateTime.now());         // met à jour last_used
            repository.save(k);
            return k.getUserId();                          // retourne l'userId
        });
}
```

#### 3. Révocation
```
DELETE /api/apikeys/{id}  →  ApiKeyService.revoke()
// Met active=false — le hash reste en DB pour audit
```

### Sécurité par conception

- La clé brute `rawKey` **n'est jamais stockée** — seulement son hash SHA-256.
- Si la base de données est compromise, les clés sont inutilisables (SHA-256 non réversible).
- Si une clé est volée, l'utilisateur peut la révoquer depuis Settings.
- `last_used_at` permet de détecter les clés inactives ou compromises.

---

## 2. Workflow de Déploiement — Écran par Écran

### Vue globale

```
[Utilisateur]                [Frontend React]           [Backend Spring]        [Kubernetes]
     │                            │                           │                      │
     │── clic "Deploy" sidebar ──>│                           │                      │
     │                        navigate /apps/new              │                      │
     │                            │──── GET /kafka/topics ───>│                      │
     │                            │<─── [liste topics] ───────│                      │
     │                            │                           │                      │
     │── remplit formulaire ──────│                           │                      │
     │── clic "Deploy to Cluster"─│                           │                      │
     │                            │──── POST /api/apps ──────>│                      │
     │                            │         + Bearer JWT       │                      │
     │                            │                           │── save App (DEPLOYING)│
     │                            │<─── 201 AppResponse ──────│                      │
     │                            │                           │                      │
     │                        navigate /apps/{id}             │ [ASYNC THREAD]       │
     │                            │                           │── KnativeService.deploy()
     │                            │                           │                      │── create KService CR
     │                            │                           │                      │<─ 201 Created
     │                            │                           │── buildServiceUrl()  │
     │                            │                           │                      │── polling /status.url
     │                            │                           │<─ URL ready ──────────│
     │                            │                           │── save App (RUNNING, url)
     │                            │                           │                      │
     │                            │── GET /apps/{id} (polling)│                      │
     │                            │<─── AppResponse(RUNNING) ─│                      │
     │<── affiche URL + badge ────│                           │                      │
```

### Étape 1 — Onglet "Basic Config"

L'utilisateur accède à `/apps/new` (sidebar → "Deploy").

**Champs :**
- **App Name** (obligatoire) : ex. `order-processor`  
  → L'UI génère un aperçu de l'URL : `order-processor.default.nextstep.com`
- **Namespace** : défaut `default` (sera préfixé `user-{userId}` côté backend)
- **Docker Image** (obligatoire) : ex. `adelbettaieb/order-processor:v1`
  - Bouton "Validate" : simple vérification front (non-vide), **pas de pull Docker réel**
- **Container Port** : défaut `8080`
- **Description** : optionnel

### Étape 2 — Onglet "Scale & Resources"

**Sliders :**
- **Min Replicas** : 0–5 (défaut `0` = scale-to-zero activé, coût nul au repos)
- **Max Replicas** : 1–20 (défaut `5`)

**Champs ressources :**
- `cpuRequest` : défaut `100m`, `cpuLimit` : `500m`
- `memoryRequest` : défaut `128Mi`, `memoryLimit` : `512Mi`

Ces valeurs deviennent des annotations Kubernetes :
```yaml
autoscaling.knative.dev/minScale: "0"
autoscaling.knative.dev/maxScale: "5"
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
```

### Étape 3 — Onglet "Environment Variables"

Tableau de variables clé/valeur avec case "Secret" (masque la valeur).

**Exemple :**
```
DATABASE_URL  =  postgresql://db:5432/orders  [secret: true]
NODE_ENV      =  production                   [secret: false]
```

Ces variables sont envoyées dans `envVars: { "DATABASE_URL": "...", "NODE_ENV": "..." }`.

> **Note :** Le backend injecte automatiquement 5 variables Kafka (`KAFKA_BOOTSTRAP_SERVERS`, `SPRING_KAFKA_BOOTSTRAP_SERVERS`, etc.) dans chaque container, même si l'utilisateur n'en déclare aucune — voir `KnativeService.buildKnativeManifest()`.

### Étape 4 — Onglet "Kafka Trigger" (optionnel)

Toggle pour activer l'intégration event-driven :
- **Kafka Topic** : liste déroulante des topics existants de l'utilisateur (chargée via `GET /kafka/topics`)
- **Consumer Group** : ex. `order-processor-group` (auto-généré si vide)
- **Event Type Filter** : ex. `order.created` (CloudEvent `ce-type`)
- **Filter Mode** : exact / prefix / suffix / none

### Clic sur "Deploy to Cluster"

**Frontend — `DeployApp.jsx`, fonction `handleDeploy()` :**

```javascript
const response = await appsApi.create({
    name: form.appName,
    imageName,          // "adelbettaieb/order-processor"
    imageTag,           // "v1"
    port: 8080,
    namespace: "default",
    minReplicas: 0,
    maxReplicas: 5,
    cpuRequest: "100m",
    memoryRequest: "128Mi",
    envVars: { "DATABASE_URL": "..." },
    kafkaEnabled: false,
    // si kafka activé :
    kafkaTopicId: "uuid-du-topic",
    consumerGroup: "order-processor-group",
    filterEventType: "order.created",
});
// Requête HTTP :
// POST http://10.9.21.224:31088/api/apps
// Headers: Authorization: Bearer eyJhbGciO...
// Body: { "name":"order-processor", "imageName":"adelbettaieb/order-processor", ... }
```

---

### Ce qui se passe côté Backend

#### Couche 1 — Spring Security

**1. Extraction du JWT :**  
`KeycloakJwtAuthConverter` lit `realm_access.roles` dans le JWT Keycloak et extrait le rôle (`ADMIN`, `CLIENT_ADMIN`, `MEMBER`).

**2. Vérification des permissions :**  
```java
// AppController.java
@PostMapping
@PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
public ResponseEntity<AppResponse> createApp(...) { ... }
```

`PermissionService.has()` vérifie :
- Si le user est `ADMIN` ou `CLIENT_ADMIN` → autorisé directement
- Si `MEMBER` → vérifie que `DEPLOY_APP` est dans sa liste de permissions en DB

#### Couche 2 — AppService.createApp()

```java
// 1. Résolution du contexte utilisateur
UserContextService.UserContext ctx = userContextService.resolve(username);
// Si MEMBER → effectiveUserId = ID de son CLIENT_ADMIN
// Si CLIENT_ADMIN → effectiveUserId = son propre ID
String effectiveUserId = ctx.effectiveUserId();
String namespace       = ctx.namespace();  // "user-{effectiveUserId}"

// 2. Vérification des quotas (TenantQuota en DB)
quotaService.assertCanCreateApp(effectiveUserId);
// Lance QuotaExceededException si déjà au max

// 3. Nom de service Kubernetes (sans espaces ni majuscules)
String serviceName = generateServiceName(req.getImageName(), effectiveUserId);
// Ex: "order-processor-a3f7b2"

// 4. Sauvegarde immédiate en DB avec status="DEPLOYING"
App app = App.builder()
    .name(req.getName())
    .userId(effectiveUserId)
    .serviceName(serviceName)
    .status("DEPLOYING")
    ...
    .build();
appRepository.save(app);

// 5. Log initial
addLog(app.getId(), effectiveUserId, "Deployment triggered", "DEPLOYMENT_START");

// 6. Lancement async (thread séparé) — retourne immédiatement 201
triggerDeployAsync(app, req);
return toResponse(app);   // status=DEPLOYING, url=null
```

#### Couche 3 — KnativeService.deploy() (thread async)

```java
// 1. Vérifie/crée le namespace Kubernetes
ensureNamespaceExists("user-a3f7b2");

// 2. Construit le manifest Knative Service (KService)
GenericKubernetesResource manifest = buildKnativeManifest(serviceName, ns, req);
// Résultat YAML :
// apiVersion: serving.knative.dev/v1
// kind: Service
// metadata:
//   name: order-processor-a3f7b2
//   namespace: user-a3f7b2
// spec:
//   template:
//     metadata:
//       annotations:
//         autoscaling.knative.dev/minScale: "0"
//         autoscaling.knative.dev/maxScale: "5"
//     spec:
//       containers:
//         - image: adelbettaieb/order-processor:v1
//           ports: [{containerPort: 8080}]
//           env:
//             - {name: KAFKA_BOOTSTRAP_SERVERS, value: my-cluster-kafka-bootstrap...}
//             - [+ 4 autres variables Kafka auto-injectées]
//           resources:
//             requests: {cpu: "100m", memory: "128Mi"}

// 3. Envoi à l'API Kubernetes via Fabric8
kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
    .inNamespace(ns).resource(manifest).create();
// Si 409 (déjà existant) : delete puis recreate

// 4. Attente de l'URL (polling jusqu'à 20 tentatives × 3s = 60s max)
return buildServiceUrl(serviceName, ns);
// Lit ksvc.status.url depuis l'API Kubernetes
// Ex: "http://order-processor-a3f7b2.user-a3f7b2.10.9.21.224.sslip.io"
```

#### Couche 4 — Retour dans AppService après deploy

```java
// Thread async — suite de triggerDeployAsync()
app.setUrl(url);
app.setStatus("RUNNING");
appRepository.save(app);
addLog(app.getId(), ..., "Deployment successful. URL: " + url, "DEPLOYMENT_SUCCESS");

// Si Kafka activé :
var source = eventingService.createKafkaSource(userId, kafkaTopicId, sourceName, ns, null);
eventingService.createTrigger(userId, source.getId(), filter, url);
addLog(..., "KafkaSource + Trigger created for topic " + kafkaTopicId, "KAFKA_WIRED");
```

#### Couche 5 — KnativeWatcher (temps réel)

En parallèle du flow ci-dessus, `KnativeWatcher` écoute en permanence l'API Kubernetes en mode **Watch** (WebSocket/long-polling) :

```java
// KnativeWatcher.java — démarre au boot avec @PostConstruct
kubernetesClient
    .genericKubernetesResources("serving.knative.dev/v1", "Service")
    .inAnyNamespace()
    .watch(new Watcher<>() {
        public void eventReceived(Action action, GenericKubernetesResource resource) {
            // Filtre uniquement les namespaces "user-*"
            // Lit conditions[Ready].status pour déterminer le statut
            // → "RUNNING", "IDLE", "DEPLOYING", "FAILED"
            // Met à jour la table `apps` en DB
        }
        public void onClose(WatcherException e) {
            // Auto-reconnexion après 5s si erreur
        }
    });
```

**Statuts possibles :**
| Condition Knative | Pods actifs | Statut DB |
|---|---|---|
| Ready=True | >0 | `RUNNING` |
| Ready=True | 0 | `IDLE` (scale-to-zero) |
| Ready=False (NoTraffic/ScaledToZero) | 0 | `IDLE` |
| Ready=False (Deploying/Updating) | — | `DEPLOYING` |
| Ready=False (autre) | — | `FAILED` |
| Action=DELETED | — | `DELETED` |

### Rôle du Token dans ce workflow

Le JWT Keycloak est utilisé **à deux endroits précis** :

1. **`POST /api/apps`** — dans le header `Authorization: Bearer <jwt>`  
   → Spring Security valide la signature RSA via les clés publiques Keycloak (JWKS)  
   → `KeycloakJwtAuthConverter` extrait `preferred_username` et le rôle  
   → `@PreAuthorize` vérifie la permission `DEPLOY_APP`

2. **SSE (Server-Sent Events) pour les logs en temps réel**  
   → `EventSource` du navigateur ne peut pas envoyer de headers  
   → `SseTokenFilter` lit `?token=<jwt>` dans l'URL et le convertit en header `Authorization`  
   ```
   GET /api/logs/apps/{id}/stream?token=eyJhbGciO...
   ```

---

## 3. Pipeline Knative + Kafka + KafkaSource (Event-Driven)

### Vue d'ensemble

Quand un utilisateur active l'intégration Kafka pour son app, la plateforme construit automatiquement un pipeline complet qui permet à l'app d'être **réveillée depuis zéro replica** dès qu'un message arrive dans le topic Kafka.

### Composants créés automatiquement

Pour une app `order-processor` connectée au topic `orders` :

```
Table apps         → { serviceName: "order-processor-a3f7b2", ... }
Table kafka_sources → { name: "order-processor-a3f7b2-source", kafkaTopicId: "uuid", ... }
Table triggers     → { name: "order-processor-a3f7b2-source-trigger", filter: "order.created", ... }

Kubernetes (cluster):
  serving.knative.dev/v1/Service          → "order-processor-a3f7b2"  (namespace: user-a3f7b2)
  sources.knative.dev/v1beta1/KafkaSource → "order-processor-a3f7b2-source" (namespace: user-a3f7b2)
  eventing.knative.dev/v1/Trigger         → "order-processor-a3f7b2-source-trigger" (namespace: default)
  eventing.knative.dev/v1/Broker          → "default" (namespace: default)
```

### Construction du KafkaSource — `EventingService.createKafkaSource()`

```java
// Résout le nom réel du topic depuis son UUID
String topicName = kafkaTopicRepository.findById(kafkaTopicId)
    .map(t -> t.getName())
    .orElse(kafkaTopicId);   // ex: "orders"

// Crée le CR Kubernetes
KafkaSource CR = {
  apiVersion: "sources.knative.dev/v1beta1",
  kind: "KafkaSource",
  metadata: { name: "order-processor-a3f7b2-source", namespace: "user-a3f7b2" },
  spec: {
    bootstrapServers: ["my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092"],
    topics: ["orders"],
    consumerGroup: "order-processor-a3f7b2-source-group",
    sink: {
      ref: {
        apiVersion: "eventing.knative.dev/v1",
        kind: "Broker",
        name: "default",
        namespace: "default"
      }
    }
  }
}
```

### Construction du Trigger — `EventingService.createTrigger()`

```java
// subscriberUrl = URL de l'app Knative (retournée par KnativeService.deploy)
// Ex: "http://order-processor-a3f7b2.user-a3f7b2.10.9.21.224.sslip.io"
// e fait ca 
Trigger CR = {
  apiVersion: "eventing.knative.dev/v1",
  kind: "Trigger",
  metadata: { name: "order-processor-a3f7b2-source-trigger", namespace: "default" },
  spec: {
    broker: "default",
    filter: {
      attributes: { type: "order.created" }
    },
    subscriber: {
      uri: "http://order-processor-a3f7b2.user-a3f7b2.10.9.21.224.sslip.io"
    }
  }
}
```

### Trajet complet d'un message — De la publication au réveil de l'app

```
PRODUCTEUR (externe)
  │
  │  kafka-producer.send("orders", {orderId: "123", total: 59.99})
  ▼
STRIMZI KAFKA (namespace: kafka)
  Pod: my-cluster-kafka-0
  Topic: "orders"
  Partition: 0 | Offset: 42
  │
  │  Le KafkaSource est un consumer Kafka dédié
  │  consumer-group: "order-processor-a3f7b2-source-group"
  │  LAG détecté → 1 message non consommé (offset 42 > committed 41)
  ▼
KAFKA-SOURCE-DISPATCHER (Knative Eventing — namespace: user-a3f7b2)
  Pod: order-processor-a3f7b2-source-dispatcher
  Rôle: consomme le message Kafka, l'enveloppe en CloudEvent
  │
  │  CloudEvent créé :
  │  ce-specversion: 1.0
  │  ce-type: order.created          ← extrait du message Kafka
  │  ce-source: /apis/v1/namespaces/user-a3f7b2/kafkasources/order-processor-a3f7b2-source
  │  ce-id: uuid-v4-random
  │  Content-Type: application/json
  │  Body: {orderId: "123", total: 59.99}
  │
  │  Envoie en HTTP POST au Broker (sink défini dans le KafkaSource CR)
  ▼
BROKER-INGRESS (Knative Eventing — namespace: default)
  URL interne: http://broker-ingress.knative-eventing.svc.cluster.local/default/default
  Rôle: reçoit le CloudEvent, le publie dans le canal interne
  │
  ▼
INMEMORYCHANNEL / BROKER-FILTER (namespace: default)
  Évalue chaque Trigger enregistré :
  → Trigger "order-processor-a3f7b2-source-trigger"
    filter.attributes.type == "order.created"  → MATCH ✓
  │
  │  Forward le CloudEvent vers le subscriber du Trigger :
  │  POST http://order-processor-a3f7b2.user-a3f7b2.10.9.21.224.sslip.io
  ▼
KNATIVE NET-KOURIER / ACTIVATOR (namespace: knative-serving)
  L'app est à 0 replicas (IDLE) → le trafic est intercepté par l'Activator
  Rôle: met en file d'attente la requête et demande à l'Autoscaler de scale-up
  │
  ▼
KNATIVE AUTOSCALER (HPA / KPA)
  Reçoit la demande → scale 0→1
  Lance le pod : order-processor-a3f7b2-deployment-xxxxx
  │
  │  [Cold Start : 2–10 secondes selon la taille de l'image]
  │  Pull de l'image (si pas en cache)
  │  Démarrage du container
  │  Readiness probe OK
  ▼
APP (Pod démarré — namespace: user-a3f7b2)
  Reçoit le CloudEvent HTTP POST :
  Headers:
    ce-type: order.created
    ce-id: uuid
    Content-Type: application/json
  Body: {orderId: "123", total: 59.99}
  │
  │  Traite la commande
  │  Répond 200 OK
  ▼
AUTOSCALER (post-traitement)
  Si pas de nouveau trafic pendant ~60s → scale 1→0 (scale-to-zero)
  Pod supprimé, ressources libérées, coût = 0
```

### Schéma texte bout en bout

```
[Kafka Producer]
       │ produce("orders", msg)
       ▼
[Strimzi Kafka] ──topic: orders──┐
                                 │ consume (consumer-group: ...-source-group)
                                 ▼
                    [KafkaSource CR] ──HTTP CloudEvent──►[Broker Ingress]
                    (namespace: user-X)                  (namespace: default)
                                                                │
                                                         [Broker Filter]
                                                         filter: type=order.created
                                                                │ MATCH
                                                         [Trigger CR] ──HTTP POST──►[Activator]
                                                                                    (si 0 replicas)
                                                                                           │ scale-up
                                                                                    [KPA/Autoscaler]
                                                                                           │
                                                                                     [App Pod]
                                                                                     (cold start 2-10s)
                                                                                           │
                                                                                     [200 OK]
                                                                                           │ inactivité 60s
                                                                                     [Scale to 0]
```

### Publication manuelle d'un CloudEvent (via la plateforme)

La plateforme expose aussi un endpoint pour publier directement :
```bash
POST /api/events
Authorization: Bearer <jwt>
Body: { "type": "order.created", "orderId": "123" }
```

Cela appelle `EventService.publish()` qui envoie en HTTP vers le broker Knative :
```
http://broker-ingress.knative-eventing.svc.cluster.local/default/default
```
Ce broker déclenchera tous les Triggers dont le filtre correspond à `type=order.created`.

### Synchronisation de l'état (ready)

La plateforme maintient une copie de l'état `ready` des KafkaSources et Triggers en base de données. À chaque appel de liste (`GET /eventing/sources` ou `GET /eventing/triggers`), `EventingService` re-vérifie l'état réel depuis Kubernetes :

```java
// syncKafkaSourceReadiness() — appelé à chaque listKafkaSources()
Boolean realReady = checkReady("sources.knative.dev/v1beta1", "KafkaSource", namespace, name);
if (realReady != null && !realReady.equals(source.getReady())) {
    source.setReady(realReady);
    kafkaSourceRepository.save(source);   // maintient la cohérence DB/cluster
}
```

---

## Points à vérifier

### Bug 1 — Validation du "Validate" bouton (cosmétique, non fonctionnel)
**Fichier :** `web-portal/src/pages/DeployApp.jsx`, ligne ~309
```jsx
onClick={() => { if (form.image) setImageValidated(true); }}
```
Ce bouton met juste `setImageValidated(true)` si le champ n'est pas vide. **Il ne fait aucun appel Docker Hub** pour vérifier que l'image existe réellement. L'utilisateur peut saisir une image inexistante et le déploiement échouera côté Kubernetes avec `ErrImagePull`. Le badge vert "Valid" est donc trompeur.

**Recommandation :** ajouter un appel `GET https://hub.docker.com/v2/repositories/{image}/` côté backend ou afficher un avertissement "non vérifié".

### Bug 2 — Pas de `cpuLimit` dans le manifest Knative
**Fichier :** `backend-api/.../app/KnativeService.java`, `buildKnativeManifest()`, ligne ~398
```java
"resources", Map.of(
    "requests", Map.of(
        "cpu",    req.getCpuRequest(),
        "memory", req.getMemoryRequest()
    )
    // PAS de "limits" !
)
```
L'utilisateur configure `cpuLimit` et `memoryLimit` dans le formulaire (`DeployApp.jsx`), mais le backend **ne les inclut pas** dans le manifest Kubernetes. Les containers sont créés sans `limits`, ce qui peut entraîner du CPU throttling et de l'OOM kill.

**Recommandation :** ajouter le bloc `limits` dans `buildKnativeManifest()`.

### Bug 3 — Namespace ignoré côté client pour le Trigger
**Fichier :** `backend-api/.../eventing/EventingService.java`, `createTrigger()`
```java
// Le Trigger est TOUJOURS créé dans le namespace "default"
kubernetesClient.genericKubernetesResources("eventing.knative.dev/v1", "Trigger")
    .inNamespace("default")   // hardcodé
    .resource(knativeTrigger)
    .create();
```
C'est volontaire (le Broker est dans `default`) mais la table `triggers` ne stocke pas de champ `namespace`. Si on migre vers un broker par namespace dans le futur, il faudra faire une migration de données.

### Manque 1 — Pas de vérification réelle du pull Docker avant déploiement
Le backend appelle directement `kubernetesClient...create()` avec l'image fournie. Si l'image n'existe pas sur le registry, Kubernetes crée le pod puis il passe en `ErrImagePull` / `ImagePullBackOff`. Le statut en DB passe à `FAILED` via le `KnativeWatcher` mais l'utilisateur ne sait pas que c'est un problème d'image.

### Manque 2 — `buildServiceUrl()` a un timeout de 60s non configurable
**Fichier :** `KnativeService.java` — `buildServiceUrl()` : 20 tentatives × 3s = 60s max. Si le cluster est lent (image volumineuse), le déploiement passe en `FAILED` avant que le pod soit prêt, alors que le pod finira par démarrer. Heureusement, `KnativeWatcher` le détectera et remettra le statut à `RUNNING` — mais le log `DEPLOYMENT_FAIL` sera enregistré à tort.

### Manque 3 — `envVars` utilisateur non injectées dans le manifest
**Fichier :** `KnativeService.java`, `buildKnativeManifest()` — Le champ `envVars` de `AppRequest` est reçu par le backend mais **les variables de l'utilisateur ne sont pas ajoutées** dans la liste `env` du container (seulement les 5 variables Kafka auto-injectées). Toutes les variables custom saisies dans l'onglet "Environment Variables" du formulaire sont silencieusement perdues.

**Impact :** app déployée sans ses variables d'environnement → crashe probable si elle en a besoin (ex: `DATABASE_URL`).

---

## 4. Fixes appliqués en cours de session

### Fix 1 — Container Logs bloqué sur CONNECTING (RÉSOLU)
**Fichier modifié :** `backend-api/src/main/java/com/platform/api/logs/PodLogService.java`

**Problème :** Les pods Knative contiennent toujours **2 containers** :
- `user-container` → ton app
- `queue-proxy` → sidecar Knative (gère scale-to-zero)

Le code appelait `.watchLog()` sans préciser le container. Kubernetes refusait car il ne savait pas lequel choisir → SSE fermé immédiatement → frontend bloqué sur CONNECTING.

**Avant :**
```java
LogWatch watch = kubernetesClient.pods()
    .inNamespace(namespace)
    .withName(podName)
    .tailingLines(100)
    .watchLog();  // ← Kubernetes : "lequel des 2 ?" → ERREUR
```

**Après :**
```java
LogWatch watch = kubernetesClient.pods()
    .inNamespace(namespace)
    .withName(podName)
    .inContainer("user-container")  // ← container utilisateur Knative (toujours ce nom)
    .tailingLines(100)
    .watchLog();
```

---

### Fix 2 — Message d'erreur Knative affiché dans l'UI (RÉSOLU)
**Fichiers modifiés :**
- `backend-api/.../app/dto/AppResponse.java` — ajout du champ `failureMessage`
- `backend-api/.../app/KnativeService.java` — ajout de `getFailureMessage()`
- `backend-api/.../app/AppService.java` — population du champ dans `toResponse()`
- `web-portal/src/pages/AppDetails.jsx` — affichage du message sous le badge FAILED

**Problème :** Quand une app passe en `FAILED` (image introuvable, crash, etc.), l'utilisateur voyait juste le badge rouge `FAILED` sans aucune explication. Il devait aller dans le cluster avec `kubectl describe ksvc ...` pour comprendre.

**Exemple d'erreur maintenant visible dans l'UI :**
```
● FAILED
⚠ Deployment Error
  Unable to fetch image "gcr.io/knative-samples/event-display:latest":
  failed to resolve image to digest: 404 Not Found
```

**Code ajouté dans `KnativeService.java` :**
```java
public String getFailureMessage(String serviceName, String namespace) {
    // Lit les conditions du KService
    // Trouve Ready=False et retourne son message
    for (Map<?, ?> cond : conditions) {
        if ("Ready".equals(cond.get("type")) && "False".equals(cond.get("status"))) {
            return String.valueOf(cond.get("message"));
        }
    }
    return null;
}
```

**Code ajouté dans `AppService.toResponse()` :**
```java
.failureMessage("FAILED".equals(app.getStatus())
    ? knativeService.getFailureMessage(app.getServiceName(), app.getNamespace())
    : null)
```

**Code ajouté dans `AppDetails.jsx` :**
```jsx
{appData.status === 'FAILED' && appData.failureMessage && (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', ... }}>
        <AlertTriangle /> Deployment Error
        <p>{appData.failureMessage}</p>
    </div>
)}
```

---

### Fix 3 — Jenkins spawn helper (CPU throttling) — Historique complet

**Problème :** `Failed to exec spawn helper: error=0, exit value: 1` à chaque build Jenkins après le premier.

**Cause racine :** Le JVM Jenkins lance ~46 threads. Quand le CPU limit est trop bas (500m), le kernel Linux throttle les processus via cgroup. Le throttling se produit exactement pendant la fenêtre `fork()` / `posix_spawn()` du `jspawnhelper` → le process fils ne démarre pas → IOException.

**Solution finale :**
```bash
# requests bas (pour que le pod puisse scheduler sur le nœud)
# limits haut (pour que le pod puisse utiliser du CPU pendant les builds)
kubectl patch deployment jenkins -n jenkins --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources",
        "value":{"requests":{"cpu":"100m","memory":"256Mi"},
                 "limits":{"cpu":"2","memory":"3Gi"}}}]'
```

**Règle :** `requests` = place réservée au démarrage. `limits` = maximum utilisable pendant le build. Toujours mettre `limits` ≥ 2 CPU pour Jenkins.

**Recommandation :** boucler sur `req.getEnvVars()` et les ajouter à la liste `env`.
