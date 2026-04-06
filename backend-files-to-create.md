# Backend — Fichiers à créer
> PlatformServerless | Spring Boot 3.2.3 | Java 21
> Seuls les fichiers **non encore existants** sont listés ici.

---

## 📦 Package `app/`

### `AppController.java`
- `POST /api/apps` — reçoit `AppRequest`, appelle `AppService.deploy()`, retourne `AppResponse`
- `GET /api/apps` — liste toutes les apps de l'utilisateur connecté (depuis PostgreSQL)
- `GET /api/apps/{name}` — détails d'une app par son nom
- `GET /api/apps/{name}/status` — interroge le cluster K8s via fabric8, retourne statut pod (`RUNNING` / `PENDING` / `SCALED_TO_ZERO`), URL Knative, nombre de replicas actifs. Met en cache Redis (`status:{appName}` TTL 30s)
- `PUT /api/apps/{name}` — met à jour l'image Docker (re-deploy avec nouvelle revision Knative)
- `DELETE /api/apps/{name}` — supprime le KnativeService du cluster + enregistrement PostgreSQL

---

### `AppService.java`
- `deploy(AppRequest req, String userId)` — crée l'entité `App` en PostgreSQL (status=PENDING), appelle `KnativeServiceHelper.createKnativeService()`, met à jour l'URL et status=RUNNING, sauvegarde un `DeploymentLog` (type=DEPLOYMENT_START puis DEPLOYMENT_SUCCESS)
- `getStatus(String appName)` — vérifie d'abord Redis (`status:{appName}`), sinon interroge fabric8 `client.services().inNamespace(ns).withName(name).get()`, met en cache le résultat
- `updateImage(String name, String newImage, String userId)` — patch le KnativeService via fabric8 avec la nouvelle image, crée une nouvelle Knative Revision
- `delete(String name, String userId)` — appelle fabric8 pour supprimer le KnativeService, supprime l'entité PostgreSQL, log `DeploymentLog` type=DELETE
- `listByUser(String userId)` — requête PostgreSQL `AppRepository.findByUserId()`

---

### `KnativeServiceHelper.java`
> Classe utilitaire (non `@Service`) appelée par `AppService`

- `createKnativeService(App app)` — construit le YAML Knative via fabric8 `GenericKubernetesResource` :
  - `apiVersion: serving.knative.dev/v1`
  - `kind: Service`
  - annotations `autoscaling.knative.dev/minScale` et `maxScale`
  - container image, port, env vars, cpu/memory requests
- `deleteKnativeService(String name, String namespace)` — supprime via fabric8
- `patchImage(String name, String namespace, String newImage)` — patch JSON sur le champ image
- `getServiceUrl(String name, String namespace)` — lit l'URL dans `status.url` de la resource Knative

---

### `dto/AppRequest.java`
Champs reçus depuis le frontend :
- `name` (obligatoire, pattern `[a-z0-9-]+`)
- `imageName` (obligatoire)
- `imageTag` (défaut : `latest`)
- `port` (obligatoire, 1–65535)
- `namespace` (défaut : `default`)
- `description`
- `minReplicas` (défaut : 0)
- `maxReplicas` (défaut : 10)
- `cpuRequest` (défaut : `100m`)
- `memoryRequest` (défaut : `128Mi`)
- `envVars` (`Map<String, String>` — variables d'environnement)

---

### `dto/AppResponse.java`
Champs retournés au frontend :
- `id`, `name`, `imageName`, `imageTag`
- `url` (URL Knative publique)
- `status` (`PENDING` / `RUNNING` / `SCALED_TO_ZERO` / `ERROR`)
- `namespace`, `description`
- `minReplicas`, `maxReplicas`, `cpuRequest`, `memoryRequest`
- `deployedAt`, `updatedAt`
- `replicaCount` (nombre de pods actifs au moment de la requête)

---

## 📦 Package `kafka/`

### `KafkaController.java`
- `POST /api/kafka/topics` — reçoit `CreateTopicRequest`, appelle `KafkaService.createTopic()`
- `GET /api/kafka/topics` — liste tous les topics depuis PostgreSQL + vérifie leur existence dans le cluster
- `DELETE /api/kafka/topics/{name}` — supprime le topic du cluster Kafka + PostgreSQL
- `GET /api/kafka/topics/{name}/lag` — retourne le consumer lag du topic (offset actuel vs dernier message)

---

### `KafkaService.java`
- `createTopic(CreateTopicRequest req, String userId)` — exécute via fabric8 `exec` sur le pod `my-cluster-kafka-0` la commande `kafka-topics.sh --create`, sauvegarde `KafkaTopic` en PostgreSQL
- `listTopics()` — retourne les topics depuis PostgreSQL (avec enrichissement cluster si accessible)
- `deleteTopic(String name)` — exécute `kafka-topics.sh --delete` via fabric8 exec, supprime de PostgreSQL
- `getConsumerLag(String topicName)` — exécute `kafka-consumer-groups.sh --describe`, parse la sortie pour extraire `LAG`, `CURRENT-OFFSET`, `LOG-END-OFFSET` et retourne un objet `TopicLagInfo`

---

### `dto/CreateTopicRequest.java`
- `name` (obligatoire, pattern `[a-z0-9-_.]+`)
- `partitions` (défaut : 3, min 1, max 10)
- `replicationFactor` (défaut : 1)
- `config` (`Map<String, String>` — ex: `retention.ms=86400000`)

---

## 📦 Package `eventing/`

### `EventController.java`
- `POST /api/eventing/kafkasource` — crée un KafkaSource dans le cluster + sauvegarde PostgreSQL
- `GET /api/eventing/kafkasource` — liste les KafkaSources depuis PostgreSQL avec statut `READY` depuis le cluster
- `DELETE /api/eventing/kafkasource/{name}` — supprime du cluster + PostgreSQL
- `POST /api/eventing/triggers` — crée un Trigger Knative dans le cluster + sauvegarde PostgreSQL
- `GET /api/eventing/triggers` — liste les Triggers depuis PostgreSQL avec statut `READY`
- `DELETE /api/eventing/triggers/{name}` — supprime du cluster + PostgreSQL

---

### `EventService.java`
- `createKafkaSource(KafkaSource source, String userId)` — construit le YAML `KafkaSource` via fabric8 `GenericKubernetesResource` (bootstrapServers, topics, consumerGroup, sink→Broker), applique avec `client.resource().createOrReplace()`, sauvegarde en PostgreSQL
- `createTrigger(Trigger trigger, String userId)` — construit le YAML `Trigger` (broker, subscriber→KnativeService name, filter optionnel), applique via fabric8, sauvegarde en PostgreSQL
- `getKafkaSourceStatus(String name, String namespace)` — lit le champ `status.conditions[0].status` de la resource pour retourner `READY: true/false`
- `getTriggerStatus(String name, String namespace)` — idem pour les Triggers
- `deleteKafkaSource(String name, String namespace)` — supprime via fabric8 + PostgreSQL
- `deleteTrigger(String name, String namespace)` — supprime via fabric8 + PostgreSQL

---

## 📦 Package `logs/`

### `LogController.java`
- `GET /api/logs/{appName}` — historique des logs d'une app depuis Elasticsearch (paramètres query : `from`, `size`, `level`, `since`)
- `GET /api/logs/{appName}/search` — recherche full-text dans les logs (paramètre `q`)
- `WS /ws/logs/{podName}` — WebSocket : stream des logs en temps réel via Redis pub/sub (`logs:stream:{podName}`)

---

### `LogService.java`
- `getLogs(String appName, int from, int size, String level)` — requête Elasticsearch `match` sur le champ `appName`, filtres optionnels sur `level`, tri par `timestamp` DESC, retourne liste de `LogEntry`
- `searchLogs(String appName, String query)` — requête Elasticsearch `multi_match` sur `message` et `appName`
- `streamLogs(String podName, WebSocketSession session)` — souscrit au canal Redis pub/sub `logs:stream:{podName}`, forwarde chaque message reçu vers la session WebSocket
- `indexLog(String appName, String podName, String level, String message)` — indexe un log dans Elasticsearch (appelé en interne lors des déploiements)

---

## 📦 Package `metrics/`

### `MetricsController.java`
- `GET /api/monitoring/pods` — liste l'état de tous les pods du namespace de l'utilisateur (nom, statut, age, restarts)
- `GET /api/monitoring/metrics` — métriques CPU/RAM globales de tous les pods actifs
- `GET /api/monitoring/metrics/{appName}` — historique des métriques d'une app spécifique (depuis PostgreSQL table `metrics`)

---

### `MetricsService.java`
- `getPodStatuses(String namespace)` — interroge fabric8 `client.pods().inNamespace(ns).list()`, retourne liste de `PodStatus` (name, phase, ready, restarts, age)
- `getCurrentMetrics(String namespace)` — interroge `client.top().pods().inNamespace(ns).metrics()` via fabric8 (nécessite metrics-server installé), retourne CPU/RAM par pod
- `getMetricsHistory(String appId)` — requête PostgreSQL `MetricRepository.findByAppIdOrderByTimestampDesc()`, retourne les 100 derniers points
- `saveMetricSnapshot(String appId, String userId)` — collecte les métriques actuelles depuis fabric8 et persiste en PostgreSQL (`Metric` entity)

---

## 📦 Fichier de config complémentaire

### `config/WebSocketConfig.java`
- Déclare le endpoint WebSocket `/ws/logs/{podName}`
- Configure `SockJS` + `STOMP` ou WebSocket natif (selon choix)
- Autorise les origines `http://localhost:3000`

---

## Résumé des fichiers

| Fichier | Package | Priorité |
|---------|---------|----------|
| `AppController.java` | `app/` | 🔴 Haute |
| `AppService.java` | `app/` | 🔴 Haute |
| `KnativeServiceHelper.java` | `app/` | 🔴 Haute |
| `dto/AppRequest.java` | `app/dto/` | 🔴 Haute |
| `dto/AppResponse.java` | `app/dto/` | 🔴 Haute |
| `KafkaController.java` | `kafka/` | 🔴 Haute |
| `KafkaService.java` | `kafka/` | 🔴 Haute |
| `dto/CreateTopicRequest.java` | `kafka/dto/` | 🔴 Haute |
| `EventController.java` | `eventing/` | 🔴 Haute |
| `EventService.java` | `eventing/` | 🔴 Haute |
| `LogController.java` | `logs/` | 🟡 Normale |
| `LogService.java` | `logs/` | 🟡 Normale |
| `MetricsController.java` | `metrics/` | 🟡 Normale |
| `MetricsService.java` | `metrics/` | 🟡 Normale |
| `config/WebSocketConfig.java` | `config/` | 🟡 Normale |

---

*Généré pour PlatformServerless — ESPRIT 5ème année | Adel Bettaieb*
