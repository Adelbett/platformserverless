# 🔧 BACKEND - Documentation Complète des Fonctionnalités

**Platform Serverless - Backend API v1.0**

Document complet couvrant toutes les fonctionnalités, services, API endpoints, flux de données et techniques innovantes du backend Spring Boot.

---

## 📑 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture générale](#architecture-générale)
3. [Stack Technologique](#stack-technologique)
4. [Domaines métier](#domaines-métier)
5. [API REST Complète](#api-rest-complète)
6. [Flux de données](#flux-de-données)
7. [Techniques innovantes](#techniques-innovantes)
8. [Sécurité](#sécurité)
9. [Performance & Scalabilité](#performance--scalabilité)

---

## Vue d'ensemble

Le backend **Platform Serverless** est un système de gestion d'applications cloud sans serveur (serverless) basé sur **Spring Boot 3.x** avec intégration **Kubernetes/Knative**.

### Objectifs Principaux:
- ✅ Déployer des applications Docker sur Knative (Kubernetes serverless)
- ✅ Intégrer des événements avec Kafka et Knative Eventing
- ✅ Monitorer les performances via Prometheus
- ✅ Facturer par utilisation (CPU/Mémoire/Temps)
- ✅ Gérer les utilisateurs avec rôles et multi-tenancy
- ✅ Fournir une API REST complète avec authentification OAuth2

---

## Architecture générale

### 7 Couches d'Architecture

```
┌─────────────────────────────────────────────────────────┐
│ 1️⃣ API REST LAYER (Controllers)                          │
│    Endpoints HTTP, validation, autorisation             │
├─────────────────────────────────────────────────────────┤
│ 2️⃣ BUSINESS LOGIC LAYER (Services)                       │
│    Orchestration, règles métier, transactions            │
├─────────────────────────────────────────────────────────┤
│ 3️⃣ DATA ACCESS LAYER (Repositories)                      │
│    JPA, requêtes SQL, cache                              │
├─────────────────────────────────────────────────────────┤
│ 4️⃣ INFRASTRUCTURE LAYER (Kubernetes, Kafka, Prometheus) │
│    Déploiement, événements, métriques                    │
├─────────────────────────────────────────────────────────┤
│ 5️⃣ CONFIGURATION LAYER (Security, OpenAPI)              │
│    OAuth2, JWT, Swagger                                  │
├─────────────────────────────────────────────────────────┤
│ 6️⃣ CROSS-CUTTING CONCERNS (Filters, Exception Handling) │
│    Logging, authentification, gestion d'erreurs         │
├─────────────────────────────────────────────────────────┤
│ 7️⃣ DATABASE LAYER (PostgreSQL)                           │
│    Persistance des données                               │
└─────────────────────────────────────────────────────────┘
```

---

## Stack Technologique

### Backend Core
- **Framework:** Spring Boot 3.x
- **Language:** Java 17+
- **Build Tool:** Maven (mvnw.bat)
- **ORM:** Spring Data JPA (Hibernate)

### Infrastructure
- **Container Orchestration:** Kubernetes + Knative
- **Event Streaming:** Apache Kafka
- **Monitoring:** Prometheus + Grafana
- **Logging:** Elasticsearch + Kibana
- **Database:** PostgreSQL 16

### Authentication & Security
- **SSO:** Keycloak (OpenID Connect)
- **Token:** JWT (JSON Web Tokens)
- **OAuth2:** Spring Security OAuth2 Resource Server
- **Authorization:** Role-Based Access Control (RBAC)

### Cloud-Native
- **Container Registry:** Docker Registry / Artifact Registry
- **Service Mesh:** (Optional) Istio
- **Serverless Platform:** Knative Serving + Knative Eventing

---

## Domaines métier

### 1️⃣ **DOMAINE: GESTION DES APPLICATIONS (App Deployment)**

#### 🎯 Objectif
Permettre aux utilisateurs de déployer des applications Docker sur Kubernetes sans se soucier de l'infrastructure.

#### 📋 Entité Principale: `App`

**Responsabilités:**
- Créer, modifier, supprimer des applications
- Déployer automatiquement sur Knative
- Gérer l'état du déploiement
- Autoscaling des réplicas
- Intégration optionnelle avec Kafka

#### 🛠️ Service: `AppService`

```java
public class AppService {
  // Créer une nouvelle application
  public AppResponse createApp(String userId, AppRequest request)
  
  // Lister les apps de l'utilisateur
  public List<AppResponse> listApps(String userId)
  
  // Mettre à jour une application
  public AppResponse updateApp(String userId, String appId, AppRequest request)
  
  // Redéployer une application
  public AppResponse redeploy(String userId, String appId)
  
  // Supprimer une application
  public void deleteApp(String userId, String appId)
  
  // Synchroniser l'état depuis Kubernetes
  private void syncStatusFromKubernetes(List<App> apps)
}
```

#### 🌐 API REST: `/api/apps`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/apps` | Créer une nouvelle app |
| `GET` | `/api/apps` | Lister les apps de l'utilisateur |
| `GET` | `/api/apps/{id}` | Détails d'une app |
| `PATCH` | `/api/apps/{id}` | Mettre à jour une app |
| `POST` | `/api/apps/{id}/redeploy` | Redéployer une app |
| `DELETE` | `/api/apps/{id}` | Supprimer une app (soft delete) |

#### 📊 Workflow: Création et déploiement d'une app

```
1. POST /api/apps (createApp)
   ├─ Valider la requête (imageName, cpuRequest, memoryRequest)
   ├─ Créer entité App en DB avec status=DEPLOYING
   ├─ Publier événement: AppCreatedEvent
   │
2. AppService.triggerDeployAsync() [async]
   ├─ Récupérer l'app depuis la DB
   ├─ Construire manifeste Knative Service YAML
   │  ├─ Spec: image, port, resources (CPU/Memory)
   │  ├─ AutoScaling: minReplicas, maxReplicas
   │  └─ Health probes: liveness, readiness
   ├─ Appeler KnativeService.deploy()
   │  └─ Créer resource Knative Service sur le cluster K8s
   ├─ Attendre que le service soit ready
   ├─ Mettre à jour App: status=RUNNING, url=<service-url>
   └─ Créer DeploymentLog: "Deployment successful"
   
3. Si kafkaEnabled=true:
   ├─ EventingService.createKafkaSource()
   │  └─ Créer KafkaSource dans la DB
   ├─ EventingService.createTrigger()
   │  └─ Créer Knative Trigger resource
   └─ DeploymentLog: "KafkaSource + Trigger created"
```

#### 💡 Points innovants

**1. Async Deployment avec Completable Future**
```java
// Non-blocking deployment
CompletableFuture.runAsync(() -> {
  try {
    knativeService.deploy(app);
    app.setStatus(AppStatus.RUNNING);
  } catch (Exception e) {
    app.setStatus(AppStatus.FAILED);
    logService.createLog(app, "Deployment failed: " + e.getMessage());
  }
});
```

**2. Status Synchronization avec Kubernetes Watch**
```java
// Watcher observe les changements Knative Service
KnativeWatcher.onServiceStatusChange(serviceName, (status) -> {
  app.setSyncedStatus(status);
  appRepository.save(app);
});
```

**3. Scale-to-Zero Serverless**
- minReplicas = 0 → Aucune instance quand inactif
- maxReplicas = N → Autoscale jusqu'à N réplicas
- Coûts minimisés pour les charges intermittentes

**4. Soft Delete Pattern**
```java
// Au lieu de supprimer, marquer comme DELETED
// Permet de conserver l'historique de facturation
app.setStatus(AppStatus.DELETED);
appRepository.save(app);
// BillingService ignore les apps DELETED
```

---

### 2️⃣ **DOMAINE: GESTION DES UTILISATEURS (User Management)**

#### 🎯 Objectif
Authentifier les utilisateurs, gérer les rôles et supporter la multi-tenancy avec des équipes d'utilisateurs.

#### 📋 Entité Principale: `User` + `UserRole`

**Rôles disponibles:**
- `ADMIN` → Accès système complet
- `CLIENT_ADMIN` → Peut créer des sous-comptes (équipe)
- `DEVELOPER` → Peut déployer des apps
- `VIEWER` → Accès lecture seule
- `BILLING_MANAGER` → Gère les factures

#### 🛠️ Service: `UserService`

```java
public class UserService {
  // Récupérer le profil de l'utilisateur connecté
  public UserDto getMe(String username)
  
  // Mettre à jour son profil
  public UserDto updateMe(String username, UpdateUserRequest request)
  
  // Lister tous les utilisateurs (ADMIN only)
  public List<UserDto> listAll()
  
  // Changer le rôle d'un utilisateur (ADMIN only)
  public UserDto changeRole(String userId, String newRole)
}
```

#### 🛠️ Service: `TeamService` (Multi-tenancy)

```java
public class TeamService {
  // CLIENT_ADMIN peut créer des membres d'équipe
  public UserDto addMember(String ownerId, AddMemberRequest request)
  
  // Lister les membres
  public List<UserDto> listMembers(String ownerId)
  
  // Changer le rôle d'un membre
  public UserDto changeRole(String ownerId, String memberId, String newRole)
  
  // Retirer un membre
  public void removeMember(String ownerId, String memberId)
}
```

#### 🌐 API REST: `/api/users` & `/api/team`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/users/me` | GET | Obtenir mon profil |
| `/api/users/me` | PATCH | Mettre à jour mon profil |
| `/api/users` | GET | Lister tous (ADMIN) |
| `/api/users/{id}/role` | PATCH | Changer rôle (ADMIN) |
| `/api/team/members` | GET | Lister mes membres |
| `/api/team/members` | POST | Ajouter un membre |
| `/api/team/members/{id}/role` | PATCH | Changer rôle du membre |
| `/api/team/members/{id}` | DELETE | Retirer un membre |

#### 📊 Workflow: Multi-tenancy avec équipes

```
CLIENT_ADMIN (user1)
├─ Peut créer des apps (user1.apps)
├─ Peut voir les apps de ses membres
└─ Peut ajouter des MEMBERS
   ├─ Member1 (ownerId = user1.id)
   │  ├─ Rôle: DEVELOPER
   │  ├─ Peut créer ses apps (member1.apps)
   │  └─ userContext.resolve(member1.username)
   │     └─ effectiveUserId = user1.id (pour facturation commune)
   │
   └─ Member2 (ownerId = user1.id)
      ├─ Rôle: BILLING_MANAGER
      └─ Peut voir les factures du groupe
```

#### 💡 Points innovants

**1. UserContext Resolution avec Team Hierarchy**
```java
public class UserContextService {
  public UserContext resolve(String username) {
    User user = userRepository.findByUsername(username);
    
    if (user.getOwnerId() != null) {
      // C'est un membre d'équipe
      User owner = userRepository.findById(user.getOwnerId());
      return new UserContext(
        effectiveUserId = owner.id,  // Facturation groupée
        namespace = owner.id + "-team"  // Namespace K8s commun
      );
    }
    
    // C'est un utilisateur principal
    return new UserContext(
      effectiveUserId = user.id,
      namespace = user.id
    );
  }
}
```

**2. Keycloak Integration avec JWT**
```java
// KeycloakJwtAuthConverter convertit les rôles Keycloak en Spring GrantedAuthority
public Collection<GrantedAuthority> convert(Jwt jwt) {
  List<String> roles = jwt.getClaimAsStringList("realm_access.roles");
  return roles.stream()
    .map(SimpleGrantedAuthority::new)
    .collect(toList());
}
```

**3. UserSyncFilter: Sync profil à chaque requête**
```java
// Décorateur: synchronise le profil Keycloak vers la base locale
public class UserSyncFilter extends OncePerRequestFilter {
  @Override
  protected void doFilterInternal(HttpServletRequest request, 
                                   HttpServletResponse response, 
                                   FilterChain filterChain) {
    String username = extractUsername(request);
    User localUser = userRepository.findByUsername(username);
    
    if (localUser == null) {
      // Créer le profil local depuis Keycloak
      userRepository.save(new User(username, email, role));
    } else {
      // Mettre à jour les infos Keycloak
      localUser.setEmail(keycloak.getEmail(username));
      userRepository.save(localUser);
    }
    
    filterChain.doFilter(request, response);
  }
}
```

---

### 3️⃣ **DOMAINE: AUTHENTIFICATION (Authentication & Security)**

#### 🎯 Objectif
Sécuriser l'API avec OAuth2/Keycloak et JWT tokens.

#### 🛠️ Service: `AuthService`

```java
public class AuthService {
  // Login (username/password via Keycloak)
  public AuthResponse login(LoginRequest request)
  
  // Register (créer nouveau compte)
  public AuthResponse register(RegisterRequest request)
  
  // Refresh JWT token
  public AuthResponse refreshToken(String expiredToken)
}
```

#### 🌐 API REST: `/api/auth`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login` | POST | Authentifier (obtenir JWT) |
| `/api/auth/register` | POST | Créer un nouveau compte |
| `/api/auth/refresh` | POST | Rafraîchir le token |

#### 📊 Flux: Authentification OAuth2

```
1. Client appelle POST /api/auth/login
   ├─ Envoyer (username, password)
   └─ AuthController → AuthService → Keycloak
   
2. Keycloak valide les credentials
   └─ Génère JWT token signé
   
3. AuthService retourne:
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "tokenType": "Bearer",
     "expiresIn": 3600
   }
   
4. Client stocke le token
   └─ Envoie dans Authorization header
   
5. Chaque requête authentifiée:
   GET /api/apps
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   
6. Spring Security valide le JWT:
   ├─ Vérifier signature
   ├─ Vérifier expiration
   ├─ Extraire claims (username, roles)
   └─ Ajouter à SecurityContext
```

#### 💡 Points innovants

**1. Keycloak SSO (Single Sign-On)**
- Authentification centralisée
- Support OIDC + OAuth2
- Sync profil automatique

**2. JWT Token Structure**
```json
{
  "sub": "user123",
  "username": "john.doe",
  "email": "john@example.com",
  "realm_access": {
    "roles": ["ADMIN", "DEVELOPER"]
  },
  "exp": 1719417600,
  "iat": 1719414000
}
```

**3. @PreAuthorize pour RBAC**
```java
@PreAuthorize("hasRole('ADMIN')")
@GetMapping("/api/admin/users")
public List<UserDto> listAllUsers() { ... }

@PreAuthorize("hasRole('CLIENT_ADMIN') or #userId == authentication.principal.id")
@GetMapping("/api/users/{id}")
public UserDto getUser(@PathVariable String userId) { ... }
```

---

### 4️⃣ **DOMAINE: ÉVÉNEMENTIEL (Kafka & Knative Eventing)**

#### 🎯 Objectif
Connecter les applications avec des événements Kafka, transformer en CloudEvents Knative, déclencher des actions HTTP.

#### 📋 Entités Principales: `KafkaTopic`, `KafkaSource`, `Trigger`

#### 🛠️ Service: `KafkaService`

```java
public class KafkaService {
  // Créer un topic Kafka
  public KafkaTopicDto createTopic(String userId, CreateTopicRequest request)
  
  // Lister les topics
  public List<KafkaTopicDto> listTopics(String userId)
  
  // Récupérer les métriques du topic
  private Map<String, long[]> fetchTopicMetrics(List<String> topicNames, String userId)
}
```

#### 🛠️ Service: `EventingService`

```java
public class EventingService {
  // Publier un événement vers Knative broker
  public void publish(Map<String, Object> payload)
  
  // Créer une source Kafka
  public KafkaSourceDto createKafkaSource(String userId, String kafkaTopicId, 
                                          String name, String namespace, String config)
  
  // Créer un trigger Knative
  public void createTrigger(String userId, String kafkaSourceId, 
                            String filter, String action)
  
  // Lister les triggers
  public List<Trigger> listTriggers(String userId, String kafkaSourceId)
}
```

#### 🌐 API REST: `/api/kafka` & `/api/events`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/kafka/topics` | POST | Créer un topic |
| `/api/kafka/topics` | GET | Lister les topics |
| `/api/kafka/topics/{id}` | DELETE | Supprimer un topic |
| `/api/events/sources` | POST | Créer une KafkaSource |
| `/api/events/sources` | GET | Lister les sources |
| `/api/events/triggers` | POST | Créer un trigger |
| `/api/events/triggers` | GET | Lister les triggers |

#### 📊 Workflow: Intégration Knative + Kafka

```
1. User crée KafkaTopic
   POST /api/kafka/topics
   └─ KafkaService crée topic dans Kafka cluster
   
2. User crée KafkaSource
   POST /api/events/sources
   {
     "name": "order-source",
     "kafkaTopicId": "topic123",
     "consumerGroup": "order-service-group"
   }
   └─ EventingService crée KafkaSource CRD Knative
      └─ Knative crée pod pour lire depuis Kafka
      
3. User crée Trigger
   POST /api/events/triggers
   {
     "kafkaSourceId": "source123",
     "filter": "order.created",
     "action": "https://myapp.example.com/webhook/order"
   }
   └─ Knative crée Trigger CRD
      └─ Déclenche App quand event matches le filter
      
4. Événement Kafka → App HTTP POST
   ┌─ Kafka topic: orders
   │  └─ Message: { "type": "order.created", "data": {...} }
   │
   ├─ KafkaSource lit le message
   │  └─ Convertit en CloudEvent
   │
   ├─ Knative Broker reçoit CloudEvent
   │  └─ Évalue le filter (matches "order.created"?)
   │
   ├─ Trigger route vers l'action
   │  └─ HTTP POST https://myapp.example.com/webhook/order
   │
   └─ App reçoit et traite l'événement
      └─ Response 2xx = succès
      └─ Response 5xx = retry
```

#### 💡 Points innovants

**1. CloudEvents Format (CNCF Standard)**
```http
POST https://myapp.example.com/webhook/order HTTP/1.1
Content-Type: application/json
Ce-specversion: 1.0
Ce-type: order.created
Ce-source: /kafka/orders
Ce-id: a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3

{
  "specversion": "1.0",
  "type": "order.created",
  "source": "/kafka/orders",
  "id": "a665a459...",
  "time": "2026-06-12T10:15:30Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "order-123",
    "amount": 99.99,
    "customer": "john@example.com"
  }
}
```

**2. Kafka AdminClient pour Topics**
```java
try (AdminClient admin = AdminClient.create(properties)) {
  admin.createTopics(Collections.singletonList(
    new NewTopic("orders", 3, (short) 1)
      .configs(Map.of("retention.ms", "604800000"))
  )).all().get();
}
```

**3. Knative CRD Management**
```yaml
# KafkaSource Custom Resource
apiVersion: sources.knative.dev/v1beta1
kind: KafkaSource
metadata:
  name: order-source
spec:
  bootstrapServers:
    - kafka:9092
  topics:
    - orders
  consumerGroup: order-service-group
  sink:
    ref:
      apiVersion: eventing.knative.dev/v1
      kind: Broker
      name: default

---
# Trigger Custom Resource
apiVersion: eventing.knative.dev/v1
kind: Trigger
metadata:
  name: order-webhook-trigger
spec:
  broker: default
  filter:
    attributes:
      type: order.created
  subscriber:
    ref:
      apiVersion: v1
      kind: Service
      name: myapp
    path: /webhook/order
```

**4. Dead Letter Queue (DLQ) pour erreurs**
```java
// Si un trigger échoue 3 fois, envoyer vers DLQ
trigger.setRetryPolicy(
  new RetryPolicy()
    .setMaxRetries(3)
    .setBackoffPolicy("linear")
    .setDeadLetterSink("kafka://orders-dlq")
);
```

---

### 5️⃣ **DOMAINE: MÉTRIQUES & MONITORING (Metrics Collection)**

#### 🎯 Objectif
Collecter les métriques des applications en temps réel via Prometheus et les exposer via l'API.

#### 📋 Entité Principale: `Metric`

#### 🛠️ Service: `MetricsService`

```java
public class MetricsService {
  // Récupérer les métriques d'une app
  public Map<String, Object> getAppMetrics(String appId)
  // Retourne: cpu, memory, requests/sec, latency, error rate
  
  // Récupérer les métriques du cluster entier
  public Map<String, Object> getClusterMetrics()
  // Retourne: agrégat de toutes les apps
  
  // Requête PromQL générique
  private double scalarOr0(String query)
}
```

#### 🌐 API REST: `/api/metrics`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/metrics/app/{appId}` | GET | Métriques d'une app |
| `/api/metrics/cluster` | GET | Métriques du cluster |

#### 📊 Réponse: App Metrics

```json
{
  "appId": "app-123",
  "timestamp": "2026-06-12T10:15:30Z",
  "reqPerSec": 150.5,
  "errorRate": 0.2,
  "latencyMs": {
    "p50": 45,
    "p95": 120,
    "p99": 250
  },
  "cpu": {
    "cores": 0.8,
    "requestedCores": 1.0,
    "utilizationPercent": 80
  },
  "memory": {
    "usedMiB": 256,
    "requestedMiB": 512,
    "utilizationPercent": 50
  },
  "replicas": {
    "running": 3,
    "desired": 3
  }
}
```

#### 📊 Réponse: Cluster Metrics

```json
{
  "timestamp": "2026-06-12T10:15:30Z",
  "totalReqPerSec": 5000,
  "clusterErrorRate": 0.15,
  "totalCpuCores": 64,
  "cpuUsagePercent": 45,
  "totalMemoryGiB": 256,
  "memUsagePercent": 60,
  "runningInstances": 150,
  "networkSendMBs": 500,
  "networkRecvMBs": 450
}
```

#### 💡 Points innovants

**1. PromQL Queries pour données temps réel**
```java
// Requêtes Prometheus
String queryReqPerSec = 
  "sum(rate(knative_request_count[1m])) by (configuration_name)";

String queryLatency95 = 
  "histogram_quantile(0.95, rate(knative_request_latencies_bucket[1m]))";

String queryCpu = 
  "sum(rate(container_cpu_usage_seconds_total[1m])) by (pod_name)";

String queryMemory = 
  "sum(container_memory_working_set_bytes) by (pod_name)";
```

**2. Caching avec @Cacheable**
```java
@Cacheable(value = "metrics", key = "#appId", cacheManager = "metricsCacheManager")
public Map<String, Object> getAppMetrics(String appId) {
  // Cache TTL: 30 secondes
}
```

**3. Prometheus Client pour Custom Metrics**
```java
@Component
public class CustomMetrics {
  private final MeterRegistry meterRegistry;
  
  public void recordDeployment(String appId, long durationMs) {
    Timer.builder("deployment.duration")
      .tag("app_id", appId)
      .publishPercentiles(0.5, 0.95, 0.99)
      .record(durationMs, TimeUnit.MILLISECONDS);
  }
}
```

---

### 6️⃣ **DOMAINE: FACTURATION (Billing & Cost Management)**

#### 🎯 Objectif
Calculer les coûts horaires par application et par utilisateur, gérer la facturation mensuelle.

#### 📋 Entité Principale: `BillingSnapshot`

#### 🛠️ Service: `BillingService`

```java
public class BillingService {
  // Créer un snapshot horaire (exécuté par scheduler)
  @Scheduled(fixedDelay = 3600000)  // Toutes les heures
  public void takeSnapshot()
  
  // Récupérer la facturation mensuelle de l'utilisateur
  public BillingHistoryResponse getMyBilling(String userId)
  
  // Récupérer la facturation de la plateforme (ADMIN)
  public AdminBillingResponse getAdminBilling()
  
  // Calculer la projection mensuelle
  private double projectMonthly(double mtdCost)
}
```

#### 🌐 API REST: `/api/billing`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/billing/my` | GET | Ma facturation MTD |
| `/api/billing/admin` | GET | Facturation plateforme (ADMIN) |

#### 📊 Réponse: User Billing

```json
{
  "userId": "user-123",
  "monthToDateCost": 45.67,
  "projectedMonthlyCost": 122.50,
  "hourlyRate": 4.05,
  "dailyHistory": [
    {
      "date": "2026-06-11",
      "dayCost": 3.50
    },
    {
      "date": "2026-06-12",
      "dayCost": 2.99
    }
  ],
  "perAppBreakdown": [
    {
      "appId": "app-123",
      "appName": "api-server",
      "cost": 25.43,
      "cpu": "500m",
      "memory": "256Mi",
      "uptime": 99.5
    },
    {
      "appId": "app-456",
      "appName": "worker",
      "cost": 20.24,
      "cpu": "1000m",
      "memory": "512Mi",
      "uptime": 95.2
    }
  ]
}
```

#### 📊 Formule de coût

```
Cost/hour = (CPU_cores × $0.048) + (Memory_GB × $0.006) × uptimeFactor

Exemple:
- CPU: 0.5 cores = $0.048 × 0.5 = $0.024/h
- Memory: 0.25 GB = $0.006 × 0.25 = $0.0015/h
- Uptime Factor: 1.0 (RUNNING), 0.2 (IDLE), 0.0 (FAILED)
- Total/h = ($0.024 + $0.0015) × 1.0 = $0.0255/h
- Total/mois (720h) = $0.0255 × 720 = $18.36
```

#### 💡 Points innovants

**1. Scheduler exécutant toutes les heures**
```java
@Service
public class BillingScheduler {
  @Scheduled(cron = "0 0 * * * *")  // Chaque heure à la minute 0
  public void takeHourlySnapshot() {
    billingService.takeSnapshot();
  }
}
```

**2. Batch Insert pour performance**
```java
@Transactional
public void takeSnapshot() {
  List<App> allApps = appRepository.findAll();
  List<BillingSnapshot> snapshots = allApps.stream()
    .map(app -> createSnapshot(app))
    .collect(toList());
  
  // Batch insert au lieu de saveAll()
  snapshotRepository.saveAllInBatch(snapshots);
}
```

**3. Uptime Factor basé sur le status**
```java
private double calculateUptimeFactor(App app) {
  return switch(app.getStatus()) {
    case RUNNING -> 1.0;        // Facturation complète
    case DEPLOYING -> 0.5;      // Demi-tarif
    case IDLE -> 0.2;           // 20% du tarif (scale-to-zero)
    case FAILED -> 0.0;         // Pas de facturation
    default -> 0.0;
  };
}
```

**4. Projection mensuelle avec days remaining**
```java
public double projectMonthly(double mtdCost) {
  LocalDate today = LocalDate.now();
  LocalDate endOfMonth = today.plusMonths(1).withDayOfMonth(1).minusDays(1);
  int daysRemaining = (int) ChronoUnit.DAYS.between(today, endOfMonth);
  int daysElapsed = today.getDayOfMonth();
  
  return (mtdCost / daysElapsed) * today.lengthOfMonth();
}
```

---

### 7️⃣ **DOMAINE: LOGGING & DEPLOYMENT LOGS**

#### 🎯 Objectif
Enregistrer les événements de déploiement et les exposer en temps réel via Server-Sent Events (SSE).

#### 📋 Entité Principale: `DeploymentLog`

#### 🛠️ Service: `LogService` & `LogSseService`

```java
public class LogService {
  // Récupérer les logs d'une app
  public List<DeploymentLog> getLogsByApp(String appId)
  
  // Récupérer mes logs
  public List<DeploymentLog> getLogsByUser(String userId)
}

public class LogSseService {
  // Publier un log vers tous les subscribers SSE
  public void push(DeploymentLog log)
  
  // S'abonner aux logs en temps réel
  public Flux<DeploymentLog> subscribe(String userId)
}
```

#### 🌐 API REST: `/api/logs`

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/logs/app/{appId}` | GET | Logs d'une app |
| `/api/logs/user` | GET | Mes logs |
| `/api/logs/stream` | GET (SSE) | Stream temps réel |

#### 📊 Types de logs

```
INFO                 - Information générale
DEPLOYMENT_START     - Déploiement lancé
DEPLOYMENT_SUCCESS   - Déploiement réussi
DEPLOYMENT_FAIL      - Erreur de déploiement
KAFKA_WIRED          - Kafka intégré
UPDATE               - Mise à jour d'app
DELETE               - Suppression d'app
```

#### 💡 Points innovants

**1. Server-Sent Events (SSE) pour streaming**
```java
@GetMapping("/api/logs/stream")
public Flux<DeploymentLog> streamLogs() {
  return logSseService.subscribe(getCurrentUserId())
    .delayElement(Duration.ofMillis(100));  // Rate limiting
}
```

Client JavaScript:
```javascript
const eventSource = new EventSource('/api/logs/stream');
eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(`[${log.type}] ${log.message}`);
};
```

**2. Reactive Streams avec Project Reactor**
```java
private final Sinks.MulticastReplaySpec<DeploymentLog> replaySink = 
  Sinks.multicast().replay().limit(Duration.ofMinutes(5));  // 5 min buffer

public void push(DeploymentLog log) {
  replaySink.tryEmitNext(log);
}

public Flux<DeploymentLog> subscribe(String userId) {
  return replaySink.asFlux()
    .filter(log -> log.getUserId().equals(userId));
}
```

**3. Async logging via @Async**
```java
@Service
public class LogService {
  @Async
  public CompletableFuture<Void> createLogAsync(DeploymentLog log) {
    logRepository.save(log);
    logSseService.push(log);
    return CompletableFuture.completedFuture(null);
  }
}
```

---

## API REST Complète

### Base URL: `https://api.platform.example.com/api`

### Authentication
```
Header: Authorization: Bearer <JWT_TOKEN>
```

### Endpoints par domaine

#### **1. Apps**
```
POST   /apps                  - Créer app
GET    /apps                  - Lister mes apps
GET    /apps/{id}             - Détails app
PATCH  /apps/{id}             - Mettre à jour app
POST   /apps/{id}/redeploy    - Redéployer app
DELETE /apps/{id}             - Supprimer app
```

#### **2. Users**
```
GET    /users/me              - Mon profil
PATCH  /users/me              - Mettre à jour profil
GET    /users                 - Lister users (ADMIN)
PATCH  /users/{id}/role       - Changer rôle (ADMIN)
```

#### **3. Team**
```
GET    /team/members          - Mes membres
POST   /team/members          - Ajouter membre
PATCH  /team/members/{id}/role - Changer rôle membre
DELETE /team/members/{id}     - Retirer membre
```

#### **4. Kafka**
```
POST   /kafka/topics          - Créer topic
GET    /kafka/topics          - Lister topics
GET    /kafka/topics/{id}     - Détails topic
DELETE /kafka/topics/{id}     - Supprimer topic
```

#### **5. Events**
```
POST   /events/sources        - Créer KafkaSource
GET    /events/sources        - Lister sources
GET    /events/sources/{id}   - Détails source
POST   /events/triggers       - Créer trigger
GET    /events/triggers       - Lister triggers
```

#### **6. Metrics**
```
GET    /metrics/app/{appId}   - Métriques app
GET    /metrics/cluster       - Métriques cluster
```

#### **7. Billing**
```
GET    /billing/my            - Ma facturation
GET    /billing/admin         - Facturation plateforme (ADMIN)
```

#### **8. Logs**
```
GET    /logs/app/{appId}      - Logs app
GET    /logs/user             - Mes logs
GET    /logs/stream           - Stream SSE
```

#### **9. Auth**
```
POST   /auth/login            - Authentifier
POST   /auth/register         - Créer compte
POST   /auth/refresh          - Refresh token
```

---

## Flux de données

### 1️⃣ Flux: Déploiement complet d'une application

```
User Browser (Frontend)
│
├─ 1. POST /api/apps
│  └─ Payload: { imageName: "myapp", imageTag: "v1.0", port: 8080, cpuRequest: "500m", memoryRequest: "256Mi" }
│
├─ AppController.createApp()
│  │
│  ├─ 2. Valider AppRequest
│  │  └─ Vérifier imageName, resources, etc.
│  │
│  ├─ 3. UserContextService.resolve(username)
│  │  └─ Récupérer effectiveUserId, namespace
│  │
│  ├─ 4. AppService.createApp()
│  │  │
│  │  ├─ Créer entité App
│  │  │  └─ status = DEPLOYING
│  │  │  └─ Sauvegarder en DB (PostgreSQL)
│  │  │
│  │  ├─ 5. ReturnAppResponse (200 OK)
│  │  │  └─ Retourner au client avec url=null (en attente)
│  │  │
│  │  └─ 6. Lancer déploiement ASYNC
│  │     │
│  │     ├─ triggerDeployAsync() [CompletableFuture]
│  │     │  │
│  │     │  ├─ KnativeService.deploy()
│  │     │  │  │
│  │     │  │  ├─ 7. Construire manifeste Knative Service YAML
│  │     │  │  │  └─ apiVersion: serving.knative.dev/v1
│  │     │  │  │  └─ spec: image, port, resources, autoscaling
│  │     │  │  │
│  │     │  │  └─ 8. Créer resource via Fabric8 KubernetesClient
│  │     │  │     └─ kubernetesClient.services().createOrReplace(service)
│  │     │  │     └─ Envoyer au cluster Kubernetes
│  │     │  │
│  │     │  ├─ 9. Attendre service.ready = true (max 5 min timeout)
│  │     │  │  └─ KnativeWatcher observe status
│  │     │  │  └─ Récupérer URL auto-générée (ex: myapp.default.svc.cluster.local)
│  │     │  │
│  │     │  ├─ 10. Mettre à jour App en DB
│  │     │  │  └─ status = RUNNING
│  │     │  │  └─ url = myapp.example.com
│  │     │  │  └─ deployedAt = now
│  │     │  │  └─ appRepository.save(app)
│  │     │  │
│  │     │  └─ 11. LogService.createLog()
│  │     │     └─ Message: "Deployment successful"
│  │     │     └─ Type: DEPLOYMENT_SUCCESS
│  │     │     └─ DeploymentLog saved → Push SSE
│  │     │
│  │     ├─ 12. Si kafkaEnabled = true:
│  │     │  │
│  │     │  ├─ EventingService.createKafkaSource()
│  │     │  │  └─ Créer KafkaSource en DB
│  │     │  │  └─ Créer Knative KafkaSource CRD
│  │     │  │
│  │     │  ├─ EventingService.createTrigger()
│  │     │  │  └─ Créer Trigger en DB
│  │     │  │  └─ Créer Knative Trigger CRD
│  │     │  │
│  │     │  └─ LogService.createLog()
│  │     │     └─ Message: "KafkaSource + Trigger created"
│  │     │     └─ Type: KAFKA_WIRED
│  │     │
│  │     └─ Exception handling:
│  │        ├─ Si déploiement échoue:
│  │        │  └─ status = FAILED
│  │        │  └─ LogService.createLog("Deployment failed: " + error)
│  │        │
│  │        └─ Notification utilisateur via SSE
│  │           └─ LogSseService.push(log)
│  │
│  └─ Frontend reçoit AppResponse
│     └─ Affiche url et status=DEPLOYING
│     └─ Subscribe à /api/logs/stream
│     └─ Affiche logs temps réel
│     └─ Quand status=RUNNING, affiche URL cliquable
```

### 2️⃣ Flux: Traitement d'un événement Kafka → App HTTP

```
Kafka Topic "orders"
│
├─ Message: { type: "order.created", orderId: "123", amount: 99.99 }
│
└─ KafkaSource (Knative component)
   │
   ├─ 1. Lire message depuis Kafka (consumer group)
   │
   ├─ 2. Convertir en CloudEvent (CNCF standard)
   │  └─ {
   │       "specversion": "1.0",
   │       "type": "order.created",
   │       "source": "/kafka/orders",
   │       "id": "abc123",
   │       "time": "2026-06-12T10:15:30Z",
   │       "data": { ... }
   │     }
   │
   ├─ 3. Envoyer à Knative Broker (default)
   │
   └─ Knative Broker
      │
      ├─ 4. Évaluer tous les Triggers
      │
      ├─ 5. Filter: ce trigger match-il cet événement?
      │  └─ Trigger filter = "order.created"
      │  └─ Event type = "order.created"
      │  └─ ✓ MATCH!
      │
      ├─ 6. Router vers subscriber (l'App)
      │
      ├─ HTTP POST https://myapp.example.com/webhook/order
      │ {
      │   "specversion": "1.0",
      │   "type": "order.created",
      │   "data": { "orderId": "123", "amount": 99.99 }
      │ }
      │
      └─ Application reçoit et traite
         │
         ├─ 7. Response 200 OK → Succès, ack
         │
         └─ Response 5xx → Erreur, Knative retry
            └─ Retry avec backoff exponential
            └─ Après 3 tentatives → Dead Letter Queue
```

### 3️⃣ Flux: Collecte et affichage des métriques

```
Knative Services en cours d'exécution
│
├─ Exposition de métriques Prometheus:
│  ├─ knative_request_count (total requests)
│  ├─ knative_request_latencies (latency distribution)
│  ├─ container_cpu_usage_seconds_total (CPU usage)
│  └─ container_memory_working_set_bytes (Memory usage)
│
└─ Prometheus Server (scrape toutes les 30s)
   │
   └─ Stocke les time series
      │
      ├─ MetricsService.getAppMetrics(appId)
      │  │
      │  ├─ 1. Construire PromQL queries
      │  │  ├─ Query CPU: "sum(rate(container_cpu_usage...))"
      │  │  ├─ Query Latency: "histogram_quantile(0.95, ...)"
      │  │  └─ Query Error Rate: "sum(rate(errors...)) / sum(rate(requests...))"
      │  │
      │  ├─ 2. Interroger Prometheus HTTP API
      │  │  └─ GET http://prometheus:9090/api/v1/query?query=...
      │  │
      │  ├─ 3. Parser les résultats
      │  │  └─ Response: { "data": { "result": [ { value: "150.5" } ] } }
      │  │
      │  └─ 4. Construire réponse JSON
      │     └─ { cpu: 0.8, memory: 256, latencyP95: 120, ... }
      │
      └─ Frontend GET /api/metrics/app/{appId}
         │
         └─ Affiche dashboard:
            ├─ Graphs Recharts
            ├─ CPU usage line chart
            ├─ Memory gauge
            ├─ Request rate sparkline
            └─ Error rate alert
```

### 4️⃣ Flux: Facturation mensuelle

```
Chaque heure (0:00, 1:00, 2:00, ...)
│
└─ BillingScheduler.takeHourlySnapshot()
   │
   ├─ 1. Récupérer toutes les Apps actives
   │  └─ appRepository.findAll()
   │
   ├─ 2. Pour chaque App:
   │  │
   │  ├─ Lire les ressources allouées
   │  │  ├─ cpuRequest = "500m"
   │  │  ├─ memoryRequest = "256Mi"
   │  │  └─ status = RUNNING
   │  │
   │  ├─ Calculer le coût horaire
   │  │  ├─ cpuCores = 0.5
   │  │  ├─ memoryGb = 0.25
   │  │  ├─ uptimeFactor = 1.0 (car RUNNING)
   │  │  ├─ cpuCost = 0.5 × $0.048 × 1.0 = $0.024
   │  │  ├─ memoryCost = 0.25 × $0.006 × 1.0 = $0.0015
   │  │  └─ totalCost = $0.0255
   │  │
   │  ├─ Créer BillingSnapshot
   │  │  └─ {
   │  │      userId, appId, cpuVcpu: 0.5, memoryGb: 0.25, uptimeFactor: 1.0,
   │  │      totalCost: 0.0255, snapshotTime: 2026-06-12T10:00:00Z
   │  │    }
   │  │
   │  └─ Sauvegarder en DB (PostgreSQL)
   │     └─ snapshotRepository.saveAllInBatch(snapshots)
   │
   └─ User accède à GET /api/billing/my
      │
      ├─ 1. BillingService.getMyBilling(userId)
      │
      ├─ 2. Requête SQL:
      │  └─ SELECT SUM(total_cost) FROM billing_snapshots
      │     WHERE user_id = ? AND snapshot_time >= CURRENT_DATE
      │
      ├─ 3. Résultats:
      │  ├─ monthToDateCost = $45.67 (11 jours × 24h)
      │  ├─ Projeter mois complet = $45.67 / 11 × 30 = $124.46
      │  └─ Daily breakdown: [{ date: "2026-06-11", cost: $3.50 }, ...]
      │
      └─ Frontend affiche:
         ├─ MTD: $45.67
         ├─ Projected: $124.46
         └─ Graph: jours et coûts
```

---

## Techniques innovantes

### 1️⃣ **Async Deployment avec CompletableFuture**

```java
@Service
public class AppService {
  public CompletableFuture<Void> triggerDeployAsync(App app, AppRequest request) {
    return CompletableFuture.runAsync(() -> {
      try {
        // Lancer le déploiement Knative
        knativeService.deploy(app, request);
        
        // Attendre readiness probe
        boolean ready = knativeService.waitForReady(app.getServiceName(), 300);
        if (ready) {
          app.setStatus(AppStatus.RUNNING);
          app.setUrl(knativeService.getServiceUrl(app.getServiceName()));
        } else {
          app.setStatus(AppStatus.FAILED);
        }
      } catch (Exception e) {
        app.setStatus(AppStatus.FAILED);
        logService.createLog(app, "Deployment failed: " + e.getMessage());
      } finally {
        appRepository.save(app);
      }
    });
  }
}
```

**Avantages:**
- Non-blocking: l'API retourne immédiatement au client
- Le déploiement continue en arrière-plan
- Client peut poll /api/apps/{id} pour vérifier l'état
- Scalable: plusieurs déploiements simultanés

### 2️⃣ **Fabric8 Kubernetes Client pour CRD**

```java
@Service
public class KnativeService {
  private final KubernetesClient kubernetesClient;
  
  public void deploy(App app, AppRequest request) {
    // Construire le manifeste Knative Service
    Service knativeService = new ServiceBuilder()
      .withNewMetadata()
        .withName(app.getServiceName())
        .withNamespace(app.getNamespace())
      .endMetadata()
      .withNewSpec()
        .withNewTemplate()
          .withNewMetadata()
            .addToLabels("app", app.getName())
          .endMetadata()
          .withNewSpec()
            .withNewContainers()
              .withName("user-container")
              .withImage(app.getImageName() + ":" + app.getImageTag())
              .withPorts(new ContainerPort(app.getPort(), null, null, null, "http"))
              .withNewResources()
                .withRequests(Map.of(
                  "cpu", Quantity.parse(app.getCpuRequest()),
                  "memory", Quantity.parse(app.getMemoryRequest())
                ))
              .endResources()
              // Liveness probe
              .withNewLivenessProbe()
                .withNewHttpGet()
                  .withPath("/health")
                  .withNewPort(app.getPort())
                .endHttpGet()
                .withInitialDelaySeconds(30)
                .withPeriodSeconds(10)
              .endLivenessProbe()
              // Readiness probe
              .withNewReadinessProbe()
                .withNewHttpGet()
                  .withPath("/ready")
                  .withNewPort(app.getPort())
                .endHttpGet()
                .withInitialDelaySeconds(0)
                .withPeriodSeconds(1)
              .endReadinessProbe()
            .endContainers()
          .endSpec()
        .endTemplate()
        .withNewAutoscaling()
          .withMinScale(app.getMinReplicas())
          .withMaxScale(app.getMaxReplicas())
          .withTargetUtilization(80)  // CPU target 80%
        .endAutoscaling()
      .endSpec()
      .build();
    
    // Créer sur le cluster
    kubernetesClient
      .services()
      .inNamespace(app.getNamespace())
      .createOrReplace(knativeService);
  }
}
```

**Avantages:**
- Type-safe Kubernetes API
- Builder pattern lisible
- Support de tous les CRDs (Custom Resources)
- Watch and informer pour updates

### 3️⃣ **Reactive Streams pour Server-Sent Events**

```java
@Service
public class LogSseService {
  // Sink avec replay buffer (5 min)
  private final Sinks.MulticastReplaySpec<DeploymentLog> replaySink = 
    Sinks.multicast()
      .replay()
      .limit(Duration.ofMinutes(5));
  
  // Publier un log à tous les subscribers
  public void push(DeploymentLog log) {
    replaySink.tryEmitNext(log);
    // Si buffer plein (>5min), drop old events
  }
  
  // S'abonner aux logs
  public Flux<DeploymentLog> subscribe(String userId) {
    return replaySink.asFlux()
      .filter(log -> log.getUserId().equals(userId))
      .share();  // Multi-cast à tous les subscribers
  }
}

@RestController
@RequestMapping("/api/logs")
public class LogController {
  @GetMapping(value = "/stream", produces = "text/event-stream")
  public Flux<DeploymentLog> streamLogs() {
    String userId = getCurrentUserId();
    return logSseService.subscribe(userId)
      .delayElement(Duration.ofMillis(100))  // Rate limiting
      .doOnCancel(() -> log.info("Client cancelled streaming"));
  }
}
```

**Avantages:**
- Backpressure handling automatique
- Multiple consumers simultanés
- Replay buffer pour late subscribers
- Non-blocking I/O

### 4️⃣ **Batch Billing Processing**

```java
@Service
public class BillingService {
  @Transactional
  @Scheduled(cron = "0 0 * * * *")  // Toutes les heures
  public void takeSnapshot() {
    // Récupérer toutes les apps
    List<App> apps = appRepository.findAll();
    
    // Construire snapshots
    List<BillingSnapshot> snapshots = apps.stream()
      .filter(app -> !app.getStatus().equals(AppStatus.DELETED))
      .map(app -> {
        BillingSnapshot snapshot = new BillingSnapshot();
        snapshot.setAppId(app.getId());
        snapshot.setUserId(app.getUserId());
        snapshot.setCpuVcpu(parseResources(app.getCpuRequest()));
        snapshot.setMemoryGb(parseResources(app.getMemoryRequest()));
        snapshot.setUptimeFactor(getUptimeFactor(app.getStatus()));
        snapshot.setTotalCost(calculateCost(snapshot));
        snapshot.setSnapshotTime(Instant.now());
        return snapshot;
      })
      .collect(toList());
    
    // Batch insert (plus efficace que saveAll)
    snapshotRepository.saveAllInBatch(snapshots);
    
    // Log statistiques
    log.info("Created {} billing snapshots for {} apps", 
             snapshots.size(), apps.size());
  }
  
  private double calculateCost(BillingSnapshot snapshot) {
    double cpuCost = snapshot.getCpuVcpu() * 0.048;
    double memCost = snapshot.getMemoryGb() * 0.006;
    return (cpuCost + memCost) * snapshot.getUptimeFactor();
  }
}
```

**Avantages:**
- Batch processing efficace (1 INSERT au lieu de N)
- JDBC prepared statements reuses
- Transactional integrity
- Scheduled reliability

### 5️⃣ **CloudEvents Format (CNCF Standard)**

```java
@Service
public class EventingService {
  public void publish(Map<String, Object> payload) {
    // Créer un CloudEvent
    CloudEvent event = CloudEventBuilder.v1()
      .withId(UUID.randomUUID().toString())
      .withSource(URI.create("/platform/events"))
      .withType("com.platform.event")
      .withTime(OffsetDateTime.now())
      .withContentType("application/json")
      .withData(objectMapper.writeValueAsBytes(payload))
      .build();
    
    // Envoyer au Knative Broker
    restClient.post()
      .uri("http://broker-ingress.knative-eventing.svc.cluster.local/default/default")
      .bodyValue(event)
      .retrieve()
      .toBodilessEntity();
  }
}
```

**Avantages:**
- Interopérabilité: compatible avec tous les systèmes CNCF
- Standardisé: spec Cloud Events officielle
- Evénementiel découplé: polyglot consumers

### 6️⃣ **Multi-Tenant Architecture avec UserContext**

```java
@Service
public class UserContextService {
  public UserContext resolve(String username) {
    User user = userRepository.findByUsername(username);
    
    // Si c'est un membre d'équipe
    if (user.getOwnerId() != null) {
      User owner = userRepository.findById(user.getOwnerId()).orElseThrow();
      return UserContext.builder()
        .effectiveUserId(owner.getId())      // Facturation du propriétaire
        .namespace(owner.getId() + "-team")  // NS K8s partagée
        .role(user.getRole())                // Rôle du membre
        .ownerId(owner.getId())              // Propriétaire du groupe
        .build();
    }
    
    // Utilisateur principal
    return UserContext.builder()
      .effectiveUserId(user.getId())
      .namespace(user.getId())
      .role(user.getRole())
      .ownerId(user.getId())
      .build();
  }
}

// Utilisation dans les services
@Service
public class AppService {
  public AppResponse createApp(String username, AppRequest request) {
    UserContext ctx = userContextService.resolve(username);
    
    App app = new App();
    app.setUserId(ctx.effectiveUserId());      // Grouper facturation
    app.setNamespace(ctx.namespace());         // NS partagée
    // ...
  }
}
```

**Avantages:**
- CLIENT_ADMIN peut gérer plusieurs devs
- Facturation consolidée par équipe
- Namespace Kubernetes commun
- Accès granulaire par rôle

### 7️⃣ **JWT Token Validation avec Spring Security**

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .authorizeHttpRequests(authz -> authz
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers("/api/admin/**").hasRole("ADMIN")
        .requestMatchers("/api/billing/admin").hasRole("ADMIN")
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> oauth2
        .jwt(jwt -> jwt
          .decoder(jwtDecoder())
          .jwtAuthenticationConverter(jwtAuthenticationConverter())
        )
      );
    return http.build();
  }
  
  @Bean
  public JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder
      .withIssuerLocation("https://keycloak.example.com/realms/platform")
      .build();
  }
  
  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(jwt -> {
      List<String> roles = jwt.getClaimAsStringList("realm_access.roles");
      return roles.stream()
        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
        .collect(toList());
    });
    return converter;
  }
}
```

**Avantages:**
- JWT validation automatique
- Keycloak synchronization
- RBAC granulaire
- Stateless authentication

---

## Sécurité

### 🔐 Layers de sécurité

```
1. Transport Security (TLS/HTTPS)
   └─ All APIs use HTTPS only
   
2. Authentication (Keycloak OAuth2)
   └─ JWT Bearer tokens validated
   
3. Authorization (RBAC via roles)
   └─ @PreAuthorize on endpoints
   
4. API Input Validation
   └─ @Valid on RequestBody
   
5. Database Encryption
   └─ Passwords hashed (bcrypt)
   └─ Sensitive fields encrypted
   
6. Rate Limiting
   └─ Token bucket algorithm
   └─ 1000 req/min per user
   
7. CORS
   └─ Whitelisted frontend domains only
   
8. Security Headers
   └─ X-Content-Type-Options: nosniff
   └─ X-Frame-Options: DENY
   └─ Strict-Transport-Security
```

### 🔒 Chiffrement des données sensibles

```java
@Entity
public class User {
  @Id
  private String id;
  
  @Column(unique = true, nullable = false)
  private String username;
  
  @Column(unique = true, nullable = false)
  private String email;
  
  // Password hashed with bcrypt
  @Column(nullable = false)
  @JsonIgnore
  private String passwordHash;  // bcrypt($password, 10)
  
  // Encryption au repos
  @Convert(converter = EncryptedStringConverter.class)
  private String apiKey;  // Encrypted in DB
}
```

### 🛡️ RBAC Examples

```java
@RestController
@RequestMapping("/api/apps")
public class AppController {
  // Tous les utilisateurs authentifiés
  @PreAuthorize("isAuthenticated()")
  @PostMapping
  public AppResponse createApp(@RequestBody AppRequest request) { }
  
  // Seulement le propriétaire ou CLIENT_ADMIN
  @PreAuthorize("hasRole('CLIENT_ADMIN') or #userId == authentication.principal.id")
  @GetMapping("/{userId}/apps")
  public List<AppResponse> listUserApps(@PathVariable String userId) { }
  
  // Seulement ADMIN
  @PreAuthorize("hasRole('ADMIN')")
  @GetMapping("/admin/stats")
  public Map<String, Object> getStats() { }
}
```

---

## Performance & Scalabilité

### ⚡ Optimisations

```
1. Database
   ├─ Connection pooling (HikariCP, max 20)
   ├─ Query optimization with indices
   ├─ Batch operations
   └─ Read replicas for reporting
   
2. Caching
   ├─ @Cacheable on metrics (30s TTL)
   ├─ Redis for session store
   ├─ HTTP caching headers
   └─ Browser caching for static assets
   
3. Async Processing
   ├─ @Async for long-running tasks
   ├─ CompletableFuture for deployments
   └─ Reactive Streams for SSE
   
4. API Rate Limiting
   ├─ Token bucket per user
   ├─ 1000 req/min default
   └─ Backoff for heavy users
   
5. Load Balancing
   ├─ Spring Boot in replicas (H2)
   ├─ Kubernetes service for load balancing
   └─ Sticky sessions for SSE
   
6. Resource Management
   ├─ Spring Boot: 1GB heap
   ├─ Kubernetes requests: 500m CPU, 512Mi RAM
   ├─ Kubernetes limits: 1000m CPU, 1Gi RAM
   └─ Horizontal autoscaling based on CPU
```

### 📊 Monitoring & Observability

```
1. Metrics (Prometheus)
   ├─ Custom application metrics
   ├─ Spring Boot actuator metrics
   ├─ JVM metrics (heap, threads, GC)
   └─ Database connection pool stats
   
2. Logging
   ├─ Structured logging (JSON)
   ├─ ELK stack (Elasticsearch, Logstash, Kibana)
   ├─ Log levels: INFO, WARN, ERROR
   └─ Request/Response tracing
   
3. Tracing
   ├─ OpenTelemetry SDKs
   ├─ Jaeger backend
   └─ Request context propagation
   
4. Alerting
   ├─ Prometheus AlertManager
   ├─ Slack notifications
   ├─ PagerDuty integration
   └─ SLA monitoring
```

---

*Document généré le 2026-06-12 - Backend Platform Serverless v1.0*

---

**Prochaine section:** [FRONTEND - Frontend Architecture & Fonctionnalités]
