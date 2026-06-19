# Diagramme de Classes Complet - Backend Platform Serverless

## Analyse Complète du Backend Java - Backend API Module

Ce diagramme représente l'**architecture complète** du backend Spring Boot avec toutes les entités, services, contrôleurs, repositories et DTOs du projet.

### Structure du Projet:

**Domaines métier:**
- **User Management:** Gestion des utilisateurs avec rôles et multi-tenancy
- **App Deployment:** Déploiement d'applications sur Knative
- **Event Streaming:** Intégration Kafka/Knative pour l'événementiel
- **Monitoring:** Métriques de performance via Prometheus
- **Billing:** Facturation par utilisation de ressources
- **Logging:** Logs de déploiement et d'audit

---

## PlantUML Diagram

```plantuml
classDiagram
direction LR

class BackendApiApplication

class App {
  +String id
  +String name
  +String userId
  +String imageName
  +String imageTag
  +String url
  +String status
  +String serviceName
  +String namespace
  +String description
  +Integer port
  +Integer minReplicas
  +Integer maxReplicas
  +String cpuRequest
  +String memoryRequest
  +LocalDateTime deployedAt
  +LocalDateTime updatedAt
}

class User {
  +String id
  +String username
  +String email
  +String passwordHash
  +String role
  +String ownerId
  +boolean suspended
  +LocalDateTime createdAt
}

class KafkaTopic {
  +String id
  +String name
  +Integer partitions
  +Integer replicas
  +String config
  +String userId
  +LocalDateTime createdAt
  +LocalDateTime updatedAt
}

class KafkaSource {
  +String id
  +String kafkaTopicId
  +String userId
  +String name
  +String namespace
  +String bootstrapServers
  +String consumerGroup
  +String config
  +Boolean ready
  +LocalDateTime createdAt
  +LocalDateTime updatedAt
}

class Trigger {
  +String id
  +String name
  +String userId
  +String kafkaSourceId
  +String subscriberName
  +String brokerName
  +String filterType
  +String filter
  +String action
  +Boolean ready
  +Boolean active
  +LocalDateTime createdAt
  +LocalDateTime updatedAt
}

class Metric {
  +String id
  +String appId
  +String userId
  +Double cpu
  +Double memory
  +Double requests
  +Double latencyP95
  +Double errorRate
  +LocalDateTime timestamp
}

class BillingSnapshot {
  +String id
  +String userId
  +String appId
  +String serviceName
  +String namespace
  +double cpuVcpu
  +double memoryGb
  +int replicas
  +double uptimeFactor
  +double cpuCost
  +double memoryCost
  +double totalCost
  +LocalDateTime snapshotTime
}

class DeploymentLog {
  +String id
  +String appId
  +String appName
  +String userId
  +String message
  +String type
  +LocalDateTime createdAt
}

class UserRole {
  <<enum>>
  ADMIN
  CLIENT_ADMIN
  DEVELOPER
  VIEWER
  BILLING_MANAGER
}

class AppService
class UserService
class TeamService
class KafkaService
class EventingService
class MetricsService
class BillingService
class LogService

class AppRepository
class UserRepository
class KafkaTopicRepository
class KafkaSourceRepository
class TriggerRepository
class MetricRepository
class BillingSnapshotRepository
class DeploymentLogRepository

class KnativeService
class KnativeWatcher
class KnativeServiceHelper
class UserContextService
class LogSseService
class SecurityConfig
class OpenApiConfig
class KubernetesConfig
class WebSocketConfig

BackendApiApplication --> AppService
BackendApiApplication --> SecurityConfig
BackendApiApplication --> OpenApiConfig
BackendApiApplication --> KubernetesConfig
BackendApiApplication --> WebSocketConfig

AppService --> AppRepository
AppService --> DeploymentLogRepository
AppService --> KnativeService
AppService --> EventingService
AppService --> LogSseService
AppService --> KafkaSourceRepository
AppService --> TriggerRepository
AppService --> UserContextService

UserService --> UserRepository
TeamService --> UserRepository

KafkaService --> KafkaTopicRepository
KafkaService --> KafkaSourceRepository

EventingService --> KafkaSourceRepository
EventingService --> TriggerRepository

MetricsService --> AppRepository
BillingService --> BillingSnapshotRepository
BillingService --> AppRepository
LogService --> DeploymentLogRepository

AppController --> AppService
UserController --> UserService
TeamController --> TeamService
KafkaController --> KafkaService
EventController --> EventingService
EventingController --> EventingService
MetricsController --> MetricsService
BillingController --> BillingService
LogController --> LogService
AuthController --> AuthService
AdminController --> UserService

App "1" --> "0..*" BillingSnapshot : billed by
App "1" --> "0..*" Metric : monitored by
App "1" --> "0..*" DeploymentLog : deployment history
User "1" --> "0..*" App : owns
User "1" --> "0..*" KafkaTopic : owns
User "1" --> "0..*" KafkaSource : owns
User "1" --> "0..*" Trigger : owns
User "1" --> "0..*" BillingSnapshot : billed for
KafkaTopic "1" --> "0..*" KafkaSource : source topic
KafkaSource "1" --> "0..*" Trigger : drives
User --> UserRole
```

---

## 🏗️ Architecture Details

### **Couche 1: Entités JPA (Domain Model)**

| Classe | Responsabilité |
|--------|-----------------|
| `User` | Utilisateur système avec rôles (ADMIN, CLIENT_ADMIN, DEVELOPER, VIEWER, BILLING_MANAGER) |
| `App` | Application déployée sur Knative (état, ressources CPU/Mémoire) |
| `KafkaTopic` | Topic Kafka pour événements |
| `KafkaSource` | Binding entre topic Kafka et consumer group |
| `Trigger` | Declencheur Knative qui relie une source Kafka à un subscriber |
| `Metric` | Métrique de performance (CPU, mémoire, latence, taux erreur) |
| `BillingSnapshot` | Snapshot horaire des coûts de chaque application |
| `DeploymentLog` | Log du déploiement/mise à jour d'une app |

### **Couche 2: Services Métier**

| Service | Opérations |
|---------|-----------|
| `AppService` | CRUD app + déploiement async via Knative + wiring Kafka |
| `UserService` | CRUD user + gestion des rôles |
| `TeamService` | Gestion des membres d'équipe d'un CLIENT_ADMIN |
| `KafkaService` | CRUD topics Kafka + metrics (message count, consumer lag) |
| `EventingService` | CRUD KafkaSource + Trigger + publish CloudEvents |
| `MetricsService` | Récupération métriques depuis Prometheus |
| `BillingService` | Snapshots + calcul coûts MTD/projections |
| `LogService` | Récupération logs de déploiement |

### **Couche 3: Contrôleurs REST**

- `AppController` → `/api/apps` (CRUD + deploy/redeploy)
- `UserController` → `/api/users` (profile + admin)
- `TeamController` → `/api/team` (members management)
- `KafkaController` → `/api/kafka` (topics)
- `EventingController` + `EventController` → `/api/events` (sources + triggers)
- `MetricsController` → `/api/metrics` (per-app + cluster)
- `BillingController` → `/api/billing` (client + admin views)
- `LogController` → `/api/logs` (SSE + history)
- `AuthController` → `/api/auth` (login/register)
- `AdminController` → `/api/admin` (privileged ops)

### **Couche 4: Repositories (Data Access)**

Tous les repositories héritent de `JpaRepository<Entity, String>`:
- `UserRepository`
- `AppRepository`
- `KafkaTopicRepository`
- `KafkaSourceRepository`
- `TriggerRepository`
- `MetricRepository`
- `BillingSnapshotRepository`
- `DeploymentLogRepository`

### **Couche 5: Infrastructure & Config**

| Classe | Rôle |
|--------|------|
| `SecurityConfig` | OAuth2/Keycloak + JWT + RBAC |
| `OpenApiConfig` | Swagger/OpenAPI 3.0 documentation |
| `KubernetesConfig` | Fabric8 Kubernetes client |
| `WebSocketConfig` | WebSocket pour SSE (Server-Sent Events) |
| `KnativeService` | Déploiement Knative Service CRD |
| `KnativeWatcher` | Observateur d'état des Services Knative |
| `UserContextService` | Résolution du contexte utilisateur (membre vs owner) |
| `LogSseService` | Push logs en temps réel via SSE |

### **Couche 6: DTOs & Requests/Responses**

**Request DTOs:**
- `AppRequest`, `CreateTopicRequest`, `LoginRequest`, `RegisterRequest`, `AddMemberRequest`

**Response DTOs:**
- `AppResponse`, `UserDto`, `KafkaSourceDto`, `TriggerDto`, `MetricDto`, `LogDto`
- `BillingHistoryResponse`, `AdminBillingResponse`

### **Couche 7: Exceptions**

- `NotFoundException` → Resource introuvable (404)
- `UnauthorizedException` → Accès refusé (403)
- `ConflictException` → Conflit d'état (409)
- `GlobalExceptionHandler` → Centralisé

---

## 🔄 Flux de Données Principaux

### **1. Déploiement d'App avec intégration Kafka**

```
User → AppController.createApp() 
  ↓ AppService.createApp()
    ├─ Save App (status=DEPLOYING)
    ├─ Async: KnativeService.deploy()
    │         └─ Update App.url, status=RUNNING
    └─ If kafkaEnabled:
       ├─ EventingService.createKafkaSource()
       └─ EventingService.createTrigger()
          └─ Create Knative Trigger CR
```

### **2. Facturation par Heure**

```
BillingScheduler (tous les heures)
  ↓ BillingService.takeSnapshot()
    ├─ Pour chaque App:
    │  └─ Lire cpuRequest, memoryRequest, minReplicas
    │     └─ Calculer cost = (cpu + mem) × uptime_factor
    └─ Save BillingSnapshot
```

### **3. Métriques en Temps Réel**

```
User → MetricsController.getAppMetrics(appId)
  ↓ MetricsService.getAppMetrics()
    ├─ Prometheus PromQL queries
    │  ├─ revision_request_count → req/sec
    │  ├─ latency percentiles → p50, p95, p99
    │  └─ CPU/Memory usage
    └─ Retour Map<String, Object>
```

### **4. Événementiel Knative → App**

```
KafkaTopic (external) → KafkaSource → Trigger → App URL (HTTP POST)
```

---

## 📊 Multiplexing Tenant

- Chaque `User` a un `id` unique
- Les `CLIENT_ADMIN` créent des sous-comptes via `TeamService`
  - Ces sous-comptes ont `ownerId` pointant vers le CLIENT_ADMIN
  - Ils ne peuvent modifier que leurs propres ressources
- `AppService.userContextService.resolve(username)` → détermine l'effectiveUserId

---

## 🔐 Sécurité

- **Keycloak SSO:** OAuth2/OIDC pour authentification
- **JWT:** Bearer token en header Authorization
- **RBAC:** Rôles Keycloak mappés via `KeycloakJwtAuthConverter`
- **Filters:** `UserSyncFilter` (sync user profile), `SseTokenFilter` (validate SSE token)

---

## Mermaid Version (plus simple)