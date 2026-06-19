# 🛡️ VALIDATION TECHNIQUE - Q&A Complet du Projet

**Platform Serverless - Validation Architecture & Choix Technologiques**

Document de validation couvrant TOUTES les questions techniques possibles (A-Z) sur le projet avec réponses détaillées et justifications.

---

## 📑 Table des Matières

1. [Questions Générales du Projet](#questions-générales-du-projet)
2. [Architecture Kubernetes & Cluster](#architecture-kubernetes--cluster)
3. [Knative Serving & Eventing](#knative-serving--eventing)
4. [Kafka & Event Streaming](#kafka--event-streaming)
5. [Backend (Spring Boot)](#backend-spring-boot)
6. [Frontend (React)](#frontend-react)
7. [Authentication & Security](#authentication--security)
8. [Database & Data Persistence](#database--data-persistence)
9. [Monitoring & Observability](#monitoring--observability)
10. [Deployment & CI/CD](#deployment--cicd)
11. [Performance & Scalability](#performance--scalability)
12. [Décisions Architecturales (ADRs)](#décisions-architecturales-adrs)

---

## Questions Générales du Projet

### Q1: C'est quoi l'objectif général du projet Platform Serverless?

**Réponse:**
Platform Serverless est une **plateforme PaaS (Platform-as-a-Service)** qui permet aux utilisateurs de:
- Déployer des applications Docker sur Kubernetes/Knative
- Intégrer des événements Kafka/CloudEvents
- Monitorer les performances en temps réel
- Facturer à l'usage (pay-as-you-go)
- Gérer les utilisateurs et les équipes avec RBAC

**Cas d'usage:**
```
1. Developer: Deploy une API en 5 minutes
2. Platform Engineer: Multi-tenant SaaS pour petites équipes
3. Enterprise: On-premise Kubernetes deployment
```

---

### Q2: C'est quoi l'architecture générale du projet?

**Réponse:**
Architecture **3-tier** avec 4 composants principaux:

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Web Portal)                                   │
│ React 18 + TypeScript + Tailwind CSS                   │
│ - SPA (Single Page Application)                        │
│ - Real-time dashboards                                 │
│ - WebSocket/SSE for logs                               │
└─────────┬───────────────────────────────────────────────┘
          │ HTTP/REST + JWT Auth
          ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND (API Server)                                    │
│ Spring Boot 3.x + Java 17+                             │
│ - REST APIs                                             │
│ - Authentication (OAuth2/Keycloak)                      │
│ - Kubernetes Client (Fabric8)                           │
│ - Event Processing (Kafka)                              │
└─────────┬───────────────────────────────────────────────┘
          │ gRPC/Admin API
          ↓
┌─────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE (Kubernetes Cluster)                     │
│ - Knative Serving (App deployment)                      │
│ - Knative Eventing (Event routing)                      │
│ - Kafka Broker (Event streaming)                        │
│ - PostgreSQL (Data persistence)                         │
│ - Prometheus (Metrics collection)                       │
└─────────────────────────────────────────────────────────┘
```

---

### Q3: Combien de services/composants dans le projet?

**Réponse:**

| Composant | Type | Rôle |
|-----------|------|------|
| **Backend API** | Spring Boot | REST APIs, business logic |
| **Frontend Web** | React | User interface |
| **PostgreSQL** | Database | Data persistence |
| **Kafka** | Message Broker | Event streaming |
| **Knative Service** | Serverless Container | App deployments |
| **Knative Broker** | Event Routing | CloudEvents routing |
| **Prometheus** | Monitoring | Metrics collection |
| **Grafana** | Dashboards | Metrics visualization |
| **Keycloak** | Identity Provider | Authentication/Authorization |
| **Redis** (optional) | Cache | Session/cache layer |

**Total: 10 composants principaux**

---

### Q4: Quel est le modèle de déploiement?

**Réponse:**

```
Option 1: DOCKER COMPOSE (Development)
  └─ Single machine
  └─ All services in containers
  └─ Kafka + PostgreSQL + Backend + Frontend

Option 2: KUBERNETES (Production)
  ├─ Multi-node cluster
  ├─ Knative for serverless apps
  ├─ StatefulSet for Kafka
  ├─ Deployment for Backend API
  ├─ Managed PostgreSQL (Azure Database for PostgreSQL)
  ├─ Prometheus + Grafana
  └─ Keycloak

Option 3: CLOUD (Azure)
  ├─ AKS (Azure Kubernetes Service)
  ├─ Azure Database for PostgreSQL
  ├─ Azure Container Registry (ACR)
  ├─ Azure Event Hubs (alternative to Kafka)
  ├─ Application Insights (monitoring)
  └─ Managed identity + Azure AD
```

**Choix recommandé: Option 2 (Kubernetes bare metal ou Option 3 (Azure AKS))**

---

## Architecture Kubernetes & Cluster

### Q5: Pourquoi Kubernetes au lieu de Docker Swarm?

**Réponse:**

| Aspect | Kubernetes | Docker Swarm |
|--------|-----------|------------|
| **Maturation** | Production-ready (12+ ans) | Moins mature |
| **Écosystème** | MASSIVE (Helm, Operators, CNI, CSI) | Limité |
| **Auto-scaling** | Native horizontal + vertical | Basique |
| **Multi-cloud** | Anywhere (on-premise, cloud) | Moins portable |
| **Community** | ÉNORME (1M+ devs) | Petit |
| **Production use** | Google, Netflix, Airbnb, Spotify | Minor projects |
| **CNCF Adoption** | Standard industrie | Minority |

**Conclusion: Kubernetes = industrie standard pour production**

---

### Q6: Quelle version de Kubernetes?

**Réponse:**
**v1.24+ (recommandé: v1.26-v1.28)**

Raisons:
- ✅ Deprecation de Dockershim (plus besoin Docker daemon)
- ✅ API stability (GA pour most features)
- ✅ Security features (Pod Security Standards)
- ✅ Knative compatibility
- ✅ Azure AKS support

```yaml
# Vérifier version cluster
kubectl version --short
# Client Version: v1.28.0
# Server Version: v1.27.3

# Knative requires: k8s >= 1.22
# Kafka requires: k8s >= 1.16
# PostgreSQL Operator requires: k8s >= 1.20
```

---

### Q7: Combien de nodes dans le cluster?

**Réponse:**

| Environnement | Nœuds | Configuration |
|---------------|-------|-------------------|
| **Development** | 1-2 | minikube ou local (4 CPU, 8GB RAM) |
| **Staging** | 3 | 4 CPU, 16GB RAM per node |
| **Production** | 3-5+ | 8 CPU, 32GB RAM per node |

**Recommandations:**
```
Développement: minikube (1 node)
  - Suffisant pour testing local
  - 4 CPU, 8GB RAM minimum

Staging: 3 nodes
  - Pod diversity
  - Quorum for etcd
  - High availability testing

Production: 5+ nodes
  - Master: 3 nodes (control plane)
  - Worker: 3+ nodes (app workloads)
  - Total: 6-10 nodes minimum
  
Scaling:
  - Horizontal Pod Autoscaling (HPA) → scale pods
  - Cluster Autoscaler → scale nodes (on cloud)
```

---

### Q8: Quelle CNI (Container Network Interface)?

**Réponse:**

**Choix: Calico OU Flannel**

| CNI | Type | Avantages | Inconvénients |
|-----|------|----------|---------------|
| **Calico** | Layer 3 | Performance, NetworkPolicy support, eBPF | Complex, heavier |
| **Flannel** | Layer 3 | Simple, lightweight, stable | Limited features |
| **Cilium** | eBPF | Ultra-fast, security policies | Complex, newer |
| **Weave** | Layer 2 | Works everywhere | Slower, memory-hungry |

**Recommandation: Flannel (simple & stable)**

```bash
# Installer Flannel
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml

# Vérifier
kubectl get pods -n kube-flannel
kubectl get nodes -o wide
```

---

### Q9: Quelle CSI (Container Storage Interface) pour persistence?

**Réponse:**

**Choix: Longhorn OU Cloud Provider CSI**

| CSI | Type | Use Case |
|-----|------|----------|
| **Longhorn** | Distributed block storage | On-premise Kubernetes |
| **Azure Disk CSI** | Cloud managed | Azure AKS |
| **EBS CSI** | Cloud managed | AWS EKS |
| **GCE Persistent Disk CSI** | Cloud managed | GCP GKE |

**Pour PostgreSQL (stateful):**

```yaml
# PersistentVolume using Longhorn (on-premise)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: longhorn  # ou "default"
  resources:
    requests:
      storage: 100Gi

---
# PostgreSQL StatefulSet avec PVC
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: longhorn
      resources:
        requests:
          storage: 100Gi
```

---

### Q10: Comment gérer le networking cluster?

**Réponse:**

```
1. SERVICE DISCOVERY
   ├─ Service DNS: <service>.<namespace>.svc.cluster.local
   ├─ Exemple: backend-api.default.svc.cluster.local:8080
   └─ Automatic load balancing

2. INGRESS CONTROLLER
   ├─ Traefik OU Nginx Ingress
   ├─ Routes external → internal services
   └─ TLS termination

3. NETWORK POLICIES
   ├─ Restrict pod-to-pod communication
   ├─ Default: DENY all ingress
   ├─ Allow: specific namespaces/labels
   └─ Security best practice

4. LOAD BALANCING
   ├─ Internal: Service → Endpoints (iptables/ipvs)
   ├─ External: LoadBalancer or Ingress
   └─ Session affinity if needed
```

**Configuration recommandée:**

```yaml
# NetworkPolicy: Deny all, allow specific
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Allow Frontend → Backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  podSelector:
    matchLabels:
      app: backend-api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
```

---

## Knative Serving & Eventing

### Q11: Pourquoi Knative au lieu de simple Deployment?

**Réponse:**

| Aspect | Knative | Kubernetes Deployment |
|--------|---------|----------------------|
| **Auto-scaling** | Scale-to-zero (0 pods) | Min 1 pod always |
| **Scaling target** | Requests per pod | CPU/Memory % |
| **Traffic splitting** | Blue/green native | Requires Istio |
| **Revisions** | Automatic versioning | Manual management |
| **Traffic management** | Built-in | Manual via Services |
| **Cost efficiency** | Pay per request | Pay per pod runtime |
| **Cold start** | First request slower | Fast always |
| **CNCF standard** | Yes | Kubernetes native |

**Use cases Knative:**
```
✅ Event-driven applications
✅ Batch processing
✅ Request-driven services
✅ Cost-sensitive workloads
✅ Multi-tenancy (namespaces per app)
```

---

### Q12: Comment Knative scale à zéro?

**Réponse:**

```
1. IDLE STATE (no requests for 5 min)
   ├─ All pods terminated
   ├─ Activator Service ready
   └─ Cost = 0

2. NEW REQUEST ARRIVES
   ├─ Request hits Activator
   ├─ Activator signals scaler
   ├─ Scaler creates new pods (5-30s)
   └─ Request queued or failed

3. COLD START PENALTY
   ├─ First request: 5-10s latency
   ├─ Mitigation:
   │  ├─ Set minReplicas: 1
   │  ├─ Use fast container images
   │  └─ Optimize app startup

4. PRICING IMPACT
   ├─ Scale-to-zero: 90% cost reduction
   ├─ Trade-off: cold start latency
   └─ Best for: async/background jobs
```

**Configuration pour Platform Serverless:**

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-app
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"  # Scale to zero
        autoscaling.knative.dev/maxScale: "10"
        autoscaling.knative.dev/target: "100"  # RPS per pod
        autoscaling.knative.dev/targetUtilizationPercentage: "70"
    spec:
      containers:
      - image: registry/app:v1
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
```

---

### Q13: Knative Eventing vs Kafka vs message queue?

**Réponse:**

| Aspect | Knative Eventing | Apache Kafka | RabbitMQ |
|--------|-----------------|-------------|----------|
| **Protocol** | CloudEvents | Binary/Avro | AMQP |
| **Durability** | Minutes | Days/weeks | Days |
| **Throughput** | High (in-memory) | Ultra-high (disk) | Medium |
| **Retention** | No (can add backend) | Yes (configurable) | Yes |
| **Replay** | No | Yes (consumer group offset) | Limited |
| **Ordering** | No | Yes (per partition) | Yes (per queue) |
| **Multi-protocol** | CloudEvents only | Multiple | Multiple |
| **Scaling** | Horizontal (pods) | Horizontal (brokers) | Horizontal |
| **Use case** | Kubernetes-native event routing | Durable event streaming | RPC messaging |

**Architecture Platform Serverless:**

```
Application Events → Kafka Topic
                      ↓
              KafkaSource (Knative)
                      ↓
              Knative Broker
                      ↓
                  Trigger
                      ↓
              Subscriber App (HTTP POST)
```

**Pourquoi cette architecture:**
- ✅ Kafka = durable event storage
- ✅ Knative Eventing = flexible routing + CloudEvents standard
- ✅ Combination = best of both worlds

---

### Q14: Comment Knative Broker filtre les événements?

**Réponse:**

```yaml
apiVersion: eventing.knative.dev/v1
kind: Trigger
metadata:
  name: order-trigger
spec:
  broker: default
  subscriber:
    ref:
      apiVersion: serving.knative.dev/v1
      kind: Service
      name: my-app
    uri: /webhook
  filter:
    attributes:
      type: "com.example.order.created"  # CloudEvent type
      source: "kafka/order-topic"         # CloudEvent source
      # Add more filters as needed
```

**Filter attributes (CloudEvents):**
```json
{
  "specversion": "1.0",
  "type": "com.example.order.created",
  "source": "kafka/order-topic",
  "id": "event-123",
  "time": "2026-06-12T10:15:30Z",
  "data": { "order": {...} }
}
```

---

## Kafka & Event Streaming

### Q15: Pourquoi Kafka et pas Redis Streams?

**Réponse:**

| Aspect | Kafka | Redis Streams |
|--------|-------|---------------|
| **Throughput** | 1M+ msgs/sec | 100K msgs/sec |
| **Durability** | Disk-based | Memory-based |
| **Retention** | Days/weeks configurable | Limited by RAM |
| **Consumer groups** | Yes, sophisticated | Basic |
| **Partitioning** | Native for parallelism | Single key-ordered |
| **Replication** | Multi-broker HA | Replication possible |
| **Operational overhead** | Higher (but worth it) | Simpler |
| **Industry standard** | Enterprise/FAANG | Cache layer mainly |

**Kafka best practices:**
- 3 brokers minimum (HA)
- Replication factor = 3
- Retention = 7 days (configurable)
- Topic partitions = number of consumers

---

### Q16: Kafka broker configuration pour Platform Serverless?

**Réponse:**

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: platform-kafka
spec:
  kafka:
    replicas: 3
    listeners:
    - name: plain
      port: 9092
      type: internal
      tls: false
    - name: tls
      port: 9093
      type: internal
      tls: true
    storage:
      type: persistent-claim
      size: 100Gi
    config:
      log.retention.hours: 168        # 7 days
      log.retention.bytes: 1073741824 # 1GB
      num.network.threads: 8
      num.io.threads: 8
      num.replica.fetchers: 4
      auto.create.topics.enable: "false"
      
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
```

---

### Q17: Kafka consumer group offset management?

**Réponse:**

```java
// Backend: KafkaService.java
public class KafkaService {
  
  public void createKafkaSource(KafkaSourceRequest request) {
    // Auto-generate consumer group from KafkaSource name
    String consumerGroup = "kafkasource-" + request.getName();
    
    // Offset strategy
    Properties props = new Properties();
    props.put("bootstrap.servers", request.getBootstrapServers());
    props.put("group.id", consumerGroup);
    props.put("auto.offset.reset", "latest");  // Start from end
    // OR "earliest" for replay
    props.put("enable.auto.commit", true);
    props.put("auto.commit.interval.ms", 5000);
    
    AdminClient admin = AdminClient.create(props);
    admin.createTopics(...);
  }
}

// Knative:
// - Automatically manages offset in Knative Broker
// - Offset stored in Kafka __consumer_offsets topic
// - Can reset offset: kn events offset reset <trigger>
```

---

### Q18: Event format CloudEvents vs Kafka native?

**Réponse:**

```
KAFKA NATIVE MESSAGE:
{
  "orderId": "order-123",
  "amount": 99.99,
  "timestamp": "2026-06-12T10:15:30Z"
}

CLOUDEVENTS STANDARD (v1.0):
{
  "specversion": "1.0",
  "type": "com.example.order.created",
  "source": "kafka/order-topic",
  "id": "event-123",
  "time": "2026-06-12T10:15:30Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "order-123",
    "amount": 99.99
  }
}
```

**Why CloudEvents:**
- ✅ Standard industry format
- ✅ Language/platform agnostic
- ✅ Polyglot compatibility
- ✅ Routing + filtering support
- ✅ CNCF standard (like gRPC, Kubernetes)

**Platform Serverless converts:**
```
Kafka message → CloudEvent wrapper → Knative Broker → Trigger → App
```

---

## Backend (Spring Boot)

### Q19: Pourquoi Spring Boot 3.x et pas 2.7?

**Réponse:**

| Aspect | Spring Boot 3.x | Spring Boot 2.7 |
|--------|---|---|
| **Java minimum** | Java 17+ (LTS) | Java 8+ |
| **Jakarta EE** | Yes (standard) | Javax EE (legacy) |
| **GraalVM support** | Native compilation ready | Limited |
| **Spring Cloud support** | Full | Limited |
| **Performance** | 10-20% faster | Baseline |
| **Security updates** | Active until 2026 | 2023 EOL |
| **Support** | Long-term | Declining |
| **New features** | Yes (virtual threads, etc.) | Backports only |

**Spring Boot 3.x benefits:**
```
✅ Jakarta EE (standard)
✅ Native images (GraalVM compilation)
✅ Virtual threads (Project Loom)
✅ Better cloud-native support
✅ Faster startup + lower memory
✅ Modern dependency versions
```

**Recommandation: Spring Boot 3.2+ pour production**

---

### Q20: Pourquoi Java 17 et pas Java 21?

**Réponse:**

```
JAVA VERSIONS:

Java 17 (LTS, Sept 2021)
├─ Records (immutable data carriers)
├─ Sealed classes (domain modeling)
├─ Text blocks (multi-line strings)
├─ Support jusqu'à Sept 2029
└─ Industry adoption HIGH

Java 21 (LTS, Sept 2023)
├─ Virtual threads (Project Loom - GAME CHANGER)
├─ Structured concurrency
├─ Record patterns
├─ Support jusqu'à Sept 2031
└─ Still adoption LOW but increasing

RECOMMENDATION FOR 2026:
┌─────────────────────────────────────────┐
│ NEW PROJECTS: Java 21                   │
│ MIGRATION: Java 17 → 21 gradually       │
│ PRODUCTION: Java 17 (stability)         │
└─────────────────────────────────────────┘
```

**Virtual threads (Java 21) game-changing:**
```java
// Traditional threads: 10K concurrent users = 10K threads = 10GB RAM
Thread thread = new Thread(() -> {
  // Handle request
});

// Virtual threads: 10K concurrent users = same memory footprint
Thread vThread = Thread.ofVirtual().start(() -> {
  // Handle request
});

// Platform Serverless can benefit from virtual threads:
// - More concurrent requests with less memory
// - Simple async model without CompletableFuture complexity
// - Easier debugging
```

**Choice for Platform Serverless: Java 17 now, upgrade to Java 21 in 2026**

---

### Q21: Spring Boot dependencies version strategy?

**Réponse:**

```yaml
# pom.xml
<properties>
  <java.version>17</java.version>
  <spring-boot.version>3.2.0</spring-boot.version>
  <spring-cloud.version>2023.0.0</spring-cloud.version>
</properties>

DEPENDENCY VERSIONS FOR 2026:
├─ Spring Boot 3.2.x (latest in 3.2.x line)
├─ Spring Cloud 2023.0.x (matches Boot 3.2.x)
├─ Kubernetes Java Client 19.0.x
├─ Kafka 3.6.x
├─ PostgreSQL driver 42.7.x
├─ Prometheus micrometer 1.12.x
└─ Jackson 2.16.x

RELEASE CADENCE:
├─ Minor releases every 3 months
├─ Patch releases as needed
├─ Major versions every ~2 years
├─ Security updates within 2 weeks
└─ Always update within 2-4 weeks of release
```

---

### Q22: Spring Boot async processing avec CompletableFuture?

**Réponse:**

```java
// AppService.java
@Service
public class AppService {
  
  @Async  // ← Runs in separate thread pool
  public CompletableFuture<Void> deployApp(App app) {
    return CompletableFuture.runAsync(() -> {
      try {
        // Step 1: Create container image
        String imageId = dockerService.buildImage(app);
        log("Image created: " + imageId);
        
        // Step 2: Create Knative service
        knativeService.deployService(app, imageId);
        log("Knative service deployed");
        
        // Step 3: Wait for ready
        knativeService.waitForReady(app.getName());
        
        // Step 4: Update app status
        app.setStatus(AppStatus.RUNNING);
        appRepository.save(app);
        
      } catch (Exception e) {
        app.setStatus(AppStatus.FAILED);
        app.setErrorMessage(e.getMessage());
        appRepository.save(app);
        log("Deployment failed: " + e.getMessage());
      }
    })
    .handle((result, exception) -> {
      if (exception != null) {
        log("Async deployment failed: " + exception);
      }
      return null;
    });
  }
}

// Usage:
CompletableFuture<Void> deploymentTask = appService.deployApp(app);

// Non-blocking: API returns immediately
// Deployment happens in background
// Frontend polls GET /api/apps for status changes
```

**Why CompletableFuture:**
```
✅ Non-blocking deployment (user doesn't wait)
✅ Multiple concurrent deployments
✅ Exception handling with .handle()
✅ Composable with other futures
✅ Better than raw threads

Alternatives in Java 21:
├─ Virtual threads (simpler, more scalable)
├─ Project Reactor (reactive, steeper learning curve)
└─ Coroutines (if using Kotlin)
```

---

### Q23: Spring Boot security configuration JWT?

**Réponse:**

```java
// SecurityConfiguration.java
@Configuration
@EnableWebSecurity
public class SecurityConfiguration {
  
  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .cors(cors -> cors.configurationSource(corsConfigurationSource()))
      .csrf(csrf -> csrf.disable())  // JWT stateless
      .sessionManagement(session -> 
        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
      )
      .authorizeHttpRequests(authz -> authz
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers("/health").permitAll()
        .requestMatchers("/api/admin/**").hasRole("ADMIN")
        .requestMatchers("/api/apps/**").hasAnyRole("DEVELOPER", "CLIENT_ADMIN")
        .requestMatchers("/api/billing/**").hasRole("BILLING_MANAGER")
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> 
        oauth2.jwt(jwt -> jwt.decoder(jwtDecoder()))
      )
      .exceptionHandling(eh -> 
        eh.authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint())
           .accessDeniedHandler(new BearerTokenAccessDeniedHandler())
      );
    
    return http.build();
  }
  
  @Bean
  public JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
  }
  
  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(new KeycloakJwtAuthoritiesConverter());
    return converter;
  }
}

// KeycloakJwtAuthoritiesConverter.java
public class KeycloakJwtAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {
  
  @Override
  public Collection<GrantedAuthority> convert(Jwt jwt) {
    Map<String, Object> realmAccess = (Map<String, Object>) jwt.getClaims().get("realm_access");
    
    if (realmAccess == null) {
      return Collections.emptyList();
    }
    
    Collection<String> roles = (Collection<String>) realmAccess.get("roles");
    return roles.stream()
      .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
      .collect(Collectors.toList());
  }
}
```

**JWT Structure from Keycloak:**
```json
{
  "sub": "user-123",
  "preferred_username": "john.doe",
  "email": "john@example.com",
  "realm_access": {
    "roles": ["developer", "viewer"]
  },
  "resource_access": {
    "platform-api": {
      "roles": ["manage-deployments"]
    }
  },
  "exp": 1686574530,
  "iat": 1686570930
}
```

---

### Q24: Spring Data JPA with eager/lazy loading?

**Réponse:**

```java
// User.java
@Entity
@Table(name = "users")
public class User {
  
  @Id
  @GeneratedValue
  private UUID id;
  
  @OneToMany(mappedBy = "owner", fetch = FetchType.LAZY)
  private List<App> ownedApps;  // Only load when accessed
  
  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "team_id")
  private Team team;  // Always load with User
}

// App.java
@Entity
public class App {
  
  @Id
  @GeneratedValue
  private UUID id;
  
  @ManyToOne(fetch = FetchType.EAGER)
  @JoinColumn(name = "owner_id")
  private User owner;  // Always load
  
  @OneToMany(mappedBy = "app", fetch = FetchType.LAZY)
  private List<Metric> metrics;  // Only if needed
  
  @OneToMany(mappedBy = "app", fetch = FetchType.LAZY)
  private List<KafkaSource> kafkaSources;  // Lazy
}

// N+1 PROBLEM EXAMPLE:
List<App> apps = appRepository.findAll();  // 1 query

for (App app : apps) {
  System.out.println(app.getOwner().getName());  // N queries! (1 per app)
}
// Total: 1 + N queries

// SOLUTION: Use join fetch
@Repository
public interface AppRepository extends JpaRepository<App, UUID> {
  
  @Query("SELECT a FROM App a JOIN FETCH a.owner WHERE a.ownerId = :userId")
  List<App> findByOwnerWithFetch(@Param("userId") UUID userId);
}

// Or use EntityGraph:
public interface AppRepository extends JpaRepository<App, UUID> {
  
  @EntityGraph(attributePaths = {"owner", "team"})
  List<App> findAll();
}

// Now: 1 query with joins (no N+1)
```

**Rule of thumb:**
```
EAGER loading: Use when object is always needed
LAZY loading:  Use when object is sometimes not needed

Platform Serverless pattern:
├─ App → Owner: EAGER (always show owner)
├─ App → Metrics: LAZY (only if viewing metrics page)
├─ App → KafkaSources: LAZY (only if configuring)
└─ User → Apps: LAZY (only when listing user's apps)
```

---

### Q25: Spring Boot validation dengan @Valid?

**Réponse:**

```java
// AppRequest.java (DTO)
@Data
public class AppRequest {
  
  @NotBlank(message = "App name is required")
  @Size(min = 2, max = 50, message = "Name must be 2-50 characters")
  @Pattern(regexp = "^[a-z0-9-]+$", message = "Only lowercase, numbers, hyphens")
  private String name;
  
  @NotBlank(message = "Image name is required")
  @Pattern(regexp = "^[a-z0-9-./]+:[a-zA-Z0-9._-]+$", 
           message = "Invalid image format: registry/image:tag")
  private String imageName;  // e.g., myregistry.azurecr.io/app:v1.0
  
  @NotNull(message = "Port is required")
  @Min(value = 1024, message = "Port must be >= 1024")
  @Max(value = 65535, message = "Port must be <= 65535")
  private Integer port;
  
  @NotBlank(message = "CPU request is required")
  @Pattern(regexp = "^[0-9]+(m|)$", message = "E.g., 500m or 1")
  private String cpuRequest;
  
  @NotBlank(message = "Memory request is required")
  @Pattern(regexp = "^[0-9]+(Mi|Gi|M|G)$", message = "E.g., 256Mi or 1Gi")
  private String memoryRequest;
  
  @Min(value = 0)
  private Integer minReplicas = 0;
  
  @Min(value = 1)
  private Integer maxReplicas = 10;
  
  @AssertTrue(message = "maxReplicas must be >= minReplicas")
  private boolean isValidReplicaRange() {
    return maxReplicas >= minReplicas;
  }
}

// Controller
@RestController
@RequestMapping("/api/apps")
public class AppController {
  
  @PostMapping
  public ResponseEntity<AppResponse> createApp(
    @Valid @RequestBody AppRequest request,
    BindingResult bindingResult,
    @AuthenticationPrincipal Jwt jwt
  ) {
    if (bindingResult.hasErrors()) {
      // Return 400 Bad Request with error details
      return ResponseEntity.badRequest().build();
    }
    
    App app = appService.createApp(request, getUserFromJwt(jwt));
    return ResponseEntity.created(URI.create("/api/apps/" + app.getId()))
      .body(AppResponse.fromApp(app));
  }
}

// ERROR RESPONSE:
{
  "status": 400,
  "timestamp": "2026-06-12T10:15:30Z",
  "errors": {
    "name": "Only lowercase, numbers, hyphens",
    "cpuRequest": "E.g., 500m or 1",
    "maxReplicas": "maxReplicas must be >= minReplicas"
  }
}
```

---

## Frontend (React)

### Q26: Pourquoi React 18 et pas Vue 3?

**Réponse:**

| Aspect | React 18 | Vue 3 |
|--------|----------|-------|
| **Job market** | 90% of JS job postings | 10% of JS job postings |
| **Ecosystem** | MASSIVE (Next.js, Remix, libraries) | Good but smaller |
| **Community** | 1M+ developers | 500K developers |
| **Learning curve** | Moderate (JSX, hooks) | Easier (templates) |
| **TypeScript** | Excellent support | Good support |
| **State management** | Redux, Zustand, Jotai | Pinia, Vuex |
| **Mobile** | React Native | No equivalent |
| **Enterprise adoption** | Airbnb, Netflix, Facebook | Smaller enterprises |
| **Long-term career** | Safer bet | Riskier |

**Decision: React 18 is industry standard for 2026**

---

### Q27: Pourquoi TypeScript et pas JavaScript?

**Réponse:**

```
JAVASCRIPT:
├─ Flexible, dynamic typing
├─ Fast to prototype
├─ No compile step
└─ Runtime errors

TYPESCRIPT:
├─ Static typing (catches errors early)
├─ IDE autocomplete + IntelliSense
├─ Self-documenting code
├─ Refactoring safety
├─ Compile-time error detection
└─ Industry standard in 2026

PLATFORM SERVERLESS USE CASES:

Example 1: Without TypeScript (JavaScript)
function createApp(data) {
  // What's in data? IDE doesn't know
  // What should I return?
  return appService.save(data);
}

// Runtime error: appService.save is not a function
// OR: data.name is undefined

Example 2: With TypeScript
function createApp(data: AppRequest): Promise<AppResponse> {
  // IDE knows: AppRequest has name, imageName, port, etc.
  // IDE knows: appService.save returns Promise<AppResponse>
  // Compile-time error if function signature wrong
  return appService.save(data);
}
```

**Recommendation: TypeScript for all new projects**

---

### Q28: Tailwind CSS vs Material-UI vs Chakra?

**Réponse:**

| Framework | Type | Customization | Bundle size | Learning |
|-----------|------|---|---|---|
| **Tailwind CSS** | Utility-first | Extreme | 5-10KB gzip | High |
| **Material-UI** | Component-driven | Medium | 40-60KB | Medium |
| **Chakra UI** | Component-driven | Good | 30-40KB | Low |
| **Bootstrap** | Component-driven | Low | 25-50KB | Low |

**For Platform Serverless: Tailwind CSS**

Reasons:
- ✅ Smallest bundle (critical for web perf)
- ✅ Maximum customization (brand design)
- ✅ Industry standard in 2026
- ✅ Great with Headless UI (unstyled components)
- ✅ All modern projects using Tailwind

```jsx
// Tailwind example (from Platform Serverless)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
  <StatCard icon={Activity} title="Apps" value={12} />
  <StatCard icon={Cpu} title="CPU Usage" value="45%" />
  <StatCard icon={HardDrive} title="Memory" value="62%" />
  <StatCard icon={DollarSign} title="MTD Cost" value="$123.45" />
</div>

// Responsive:
// 1 column on mobile
// 2 columns on tablet (md: breakpoint)
// 4 columns on desktop (lg: breakpoint)
```

---

### Q29: React Router v6 navigation strategy?

**Réponse:**

```jsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected routes */}
        <Route 
          element={<PrivateRoute />}
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/apps" element={<AppsManagement />} />
          <Route path="/apps/:appId" element={<AppDetails />} />
          <Route path="/kafka" element={<KafkaEvents />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/users" element={<Users />} />
          <Route path="/logs" element={<Logs />} />
          
          {/* Admin only */}
          <Route 
            path="/admin" 
            element={<AdminRoute />}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>
        
        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// PrivateRoute.tsx
function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <Outlet />;  // Render nested routes
}

// Usage in components:
function NavigateExample() {
  const navigate = useNavigate();
  
  const handleCreateApp = async (data) => {
    const response = await appService.create(data);
    navigate(`/apps/${response.id}`);  // Programmatic navigation
  };
  
  return <button onClick={() => handleCreateApp(data)}>Create</button>;
}
```

---

### Q30: Redux vs Zustand for state management?

**Réponse:**

| Aspect | Redux | Zustand |
|--------|-------|---------|
| **Setup** | Boilerplate (actions, reducers, selectors) | Minimal |
| **Dev tools** | Redux DevTools (excellent) | Basic |
| **Middleware** | Rich ecosystem (thunk, saga) | Custom |
| **Bundle size** | 8-10KB | 2-3KB |
| **Learning curve** | Steep | Gentle |
| **Maturity** | 8+ years, battle-tested | Newer, growing |
| **Async handling** | Redux Thunk or Redux Saga | Built-in async/await |
| **Time travel debug** | Yes | Limited |

**For Platform Serverless: Zustand (simpler choice)**

```typescript
// store/appStore.ts (Zustand)
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  apps: App[];
  selectedApp: App | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setApps: (apps: App[]) => void;
  selectApp: (app: App) => void;
  fetchApps: () => Promise<void>;
  createApp: (request: AppRequest) => Promise<App>;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        apps: [],
        selectedApp: null,
        isLoading: false,
        error: null,
        
        setApps: (apps) => set({ apps }),
        
        selectApp: (app) => set({ selectedApp: app }),
        
        fetchApps: async () => {
          set({ isLoading: true });
          try {
            const response = await appService.listApps();
            set({ apps: response, error: null });
          } catch (error) {
            set({ error: error.message });
          } finally {
            set({ isLoading: false });
          }
        },
        
        createApp: async (request) => {
          try {
            const newApp = await appService.createApp(request);
            set((state) => ({
              apps: [...state.apps, newApp],
              error: null
            }));
            return newApp;
          } catch (error) {
            set({ error: error.message });
            throw error;
          }
        }
      }),
      {
        name: 'app-store',  // localStorage key
        partialize: (state) => ({
          apps: state.apps,  // Persist only certain state
        })
      }
    )
  )
);

// Usage in component
function Apps() {
  const { apps, isLoading, fetchApps } = useAppStore();
  
  useEffect(() => {
    fetchApps();
  }, [fetchApps]);
  
  if (isLoading) return <Spinner />;
  return <AppsList apps={apps} />;
}
```

---

### Q31: Vite vs Create React App (CRA)?

**Réponse:**

| Aspect | Vite | Create React App |
|--------|------|-----------------|
| **Build speed** | <300ms hot reload | >3s hot reload |
| **Bundle time** | 100ms (esbuild) | 1-2s (webpack) |
| **Configuration** | Minimal | Hidden webpack config |
| **Customization** | Easy | Requires eject |
| **Maturity** | Production-ready (3+ years) | Declining (unmaintained) |
| **Community** | Growing rapidly | Shrinking |
| **Industry adoption** | 90% of new projects | Legacy only |

**Status 2026: CRA is legacy, Vite is standard**

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,  // No source maps in production
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.platform.example.com',
        changeOrigin: true,
      }
    }
  }
})
```

---

## Authentication & Security

### Q32: Pourquoi Keycloak et pas Auth0?

**Réponse:**

| Aspect | Keycloak | Auth0 |
|--------|----------|-------|
| **Model** | Open-source, self-hosted | SaaS |
| **Cost** | Free (self-hosted) | $250-500/month |
| **Control** | 100% control | Vendor lock-in |
| **Privacy** | On-premise data | Auth0 stores data |
| **Customization** | Unlimited | Limited |
| **Features** | Full OIDC/OAuth2/SAML | All included |
| **Scaling** | Your infrastructure | Managed |
| **SLA** | Your responsibility | 99.99% guaranteed |

**For Platform Serverless (self-hosted product):**
- ✅ Keycloak = customers own their auth
- ✅ No monthly fees per customer
- ✅ Enterprise-grade
- ✅ SAML + OAuth2 + OIDC support
- ✅ Full customization

---

### Q33: Keycloak realm vs client setup?

**Réponse:**

```yaml
KEYCLOAK TOPOLOGY:

Realm: platform-serverless
├─ Client: web-portal (frontend SPA)
│  ├─ Client ID: platform-web
│  ├─ Client Secret: (secret-key-here)
│  ├─ Redirect URIs: 
│  │  ├─ http://localhost:3000/*
│  │  ├─ https://web.platform.example.com/*
│  │  └─ https://platform.example.com/*
│  ├─ Valid Redirect URIs: (same)
│  └─ Web Origins: (CORS)
│
├─ Client: backend-api (REST API)
│  ├─ Client ID: platform-api
│  ├─ Client Secret: (different-secret)
│  ├─ Access Type: Bearer-only
│  ├─ Service Account Enabled: true
│  └─ Role: manage-apps, read-metrics, etc.
│
├─ Client: admin-panel
│  └─ (For backend administration)
│
├─ Roles
│  ├─ ADMIN
│  ├─ CLIENT_ADMIN
│  ├─ DEVELOPER
│  ├─ VIEWER
│  └─ BILLING_MANAGER
│
├─ User Mapper
│  ├─ realm_access.roles (maps to RBAC)
│  ├─ resource_access (app-specific roles)
│  ├─ email
│  └─ email_verified
│
└─ User Federation (optional)
   ├─ LDAP (corporate directory)
   ├─ SAML (enterprise SSO)
   └─ OAuth2 (social login: Google, GitHub)
```

---

### Q34: JWT token refresh strategy?

**Réponse:**

```typescript
// Frontend: Axios interceptor
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If 401 Unauthorized and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Call backend refresh endpoint
        const response = await axios.post(
          '/api/auth/refresh',
          { token: localStorage.getItem('auth_token') },
          { skipRefreshInterceptor: true }  // Avoid infinite loop
        );
        
        const newToken = response.data.token;
        localStorage.setItem('auth_token', newToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
        
      } catch (refreshError) {
        // Refresh failed: logout
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Backend: RefreshToken endpoint
@PostMapping("/api/auth/refresh")
public ResponseEntity<TokenResponse> refreshToken(
  @RequestBody RefreshTokenRequest request
) {
  try {
    // Validate old token (even if expired)
    Jwt jwt = jwtDecoder.decode(request.getToken());
    String userId = jwt.getSubject();
    
    // Get new token from Keycloak
    TokenResponse newToken = keycloakService.refreshToken(userId);
    
    return ResponseEntity.ok(newToken);
  } catch (JwtException e) {
    return ResponseEntity.status(401).build();
  }
}
```

**Token lifecycle:**
```
1. User login
   └─ Get access_token (15 min expiry) + refresh_token (7 day expiry)

2. Make API request with access_token
   └─ If valid: proceed
   └─ If expired (401): silently refresh

3. Refresh token
   └─ Use refresh_token to get new access_token
   └─ If refresh_token also expired: redirect to login

4. Logout
   └─ Clear tokens from localStorage
   └─ Call /logout endpoint
```

---

### Q35: CORS configuration for frontend-backend?

**Réponse:**

```java
// Backend: CorsConfiguration.java
@Configuration
public class WebConfiguration {
  
  @Bean
  public WebMvcConfigurer corsConfigurer() {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
          .allowedOrigins(
            "http://localhost:3000",  // Development
            "https://web.platform.example.com",  // Production
            "https://platform.example.com"  // Fallback
          )
          .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
          .allowedHeaders("*")
          .allowCredentials(true)
          .maxAge(3600);
      }
    };
  }
}

// Frontend: axios config
axiosInstance.defaults.withCredentials = true;  // Send cookies if needed
```

**CORS headers in response:**
```
Access-Control-Allow-Origin: https://web.platform.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 3600
```

---

## Database & Data Persistence

### Q36: Pourquoi PostgreSQL et pas MongoDB?

**Réponse:**

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| **Data model** | Relational (ACID) | Document (flexible) |
| **Schema** | Strict schema | Flexible/schemaless |
| **Transactions** | ACID compliant | Multi-doc ACID (newer) |
| **Relationships** | Foreign keys | References (manual) |
| **Query language** | SQL (universal) | MongoDB query language |
| **Performance** | Excellent for structured | Better for unstructured |
| **Scaling** | Vertical primarily | Horizontal sharding |
| **Use case** | ERP, Finance, E-commerce | Content, Logs, Analytics |

**For Platform Serverless:**
- ✅ Structured data (User, App, Metrics)
- ✅ Relationships (User → Apps → Metrics)
- ✅ ACID transactions (billing, deployments)
- ✅ Strong consistency required
- ✅ PostgreSQL is perfect fit

---

### Q37: Database schema design decision?

**Réponse:**

```sql
-- 8 Entities designed for Platform Serverless

-- 1. Users (RBAC)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'DEVELOPER',
  -- ENUM: ADMIN, CLIENT_ADMIN, DEVELOPER, VIEWER, BILLING_MANAGER
  owner_id UUID REFERENCES users(id),  -- Team member's team lead
  suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Apps (Kubernetes Knative Services)
CREATE TABLE apps (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  -- ENUM: PENDING, DEPLOYING, RUNNING, IDLE, FAILED, DELETED
  image_name VARCHAR(255) NOT NULL,
  image_tag VARCHAR(50) DEFAULT 'latest',
  port INT DEFAULT 8080,
  cpu_request VARCHAR(10) NOT NULL,  -- e.g., "500m"
  memory_request VARCHAR(10) NOT NULL,  -- e.g., "256Mi"
  min_replicas INT DEFAULT 0,
  max_replicas INT DEFAULT 10,
  service_name VARCHAR(100),  -- Knative service name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_app_per_owner UNIQUE (owner_id, name)
);

-- 3. Kafka Topics
CREATE TABLE kafka_topics (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) UNIQUE NOT NULL,
  partitions INT DEFAULT 3,
  replicas INT DEFAULT 1,
  config TEXT,  -- JSON configuration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Kafka Sources (Knative integration)
CREATE TABLE kafka_sources (
  id UUID PRIMARY KEY,
  kafka_topic_id UUID NOT NULL REFERENCES kafka_topics(id) ON DELETE CASCADE,
  consumer_group VARCHAR(100) NOT NULL,
  bootstrap_servers VARCHAR(255) NOT NULL,
  namespace VARCHAR(50) DEFAULT 'default',
  ready BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Triggers (Knative Broker triggers)
CREATE TABLE triggers (
  id UUID PRIMARY KEY,
  kafka_source_id UUID NOT NULL REFERENCES kafka_sources(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  filter TEXT,  -- CloudEvent filter (e.g., type, source)
  action VARCHAR(255) NOT NULL,  -- webhook URL
  broker_name VARCHAR(100) DEFAULT 'default',
  ready BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Metrics (Prometheus scrape results)
CREATE TABLE metrics (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  cpu_percent NUMERIC(5,2),  -- 0-100
  memory_percent NUMERIC(5,2),
  request_rate NUMERIC(10,2),  -- req/sec
  error_rate NUMERIC(5,2),  -- %
  latency_p95 INT,  -- ms
  latency_p99 INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metrics_app_time (app_id, recorded_at)
);

-- 7. Billing Snapshots (hourly)
CREATE TABLE billing_snapshots (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  hour_date DATE NOT NULL,
  cpu_vcpu NUMERIC(6,2),  -- CPU cores
  memory_gb NUMERIC(6,2),  -- GB
  uptime_factor NUMERIC(3,2),  -- 0.0 to 1.0
  cpu_cost NUMERIC(10,6),
  memory_cost NUMERIC(10,6),
  total_cost NUMERIC(10,6),
  INDEX idx_billing_user_time (app_id, hour_date),
  INDEX idx_billing_time (hour_date)
);

-- 8. Deployment Logs (SSE streaming)
CREATE TABLE deployment_logs (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  -- ENUM: INFO, DEPLOYMENT_START, DEPLOYMENT_SUCCESS, 
  --       DEPLOYMENT_FAIL, KAFKA_WIRED, UPDATE, DELETE
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_app (app_id)
);
```

**Design decisions:**
```
✅ No denormalization: All data normalized (3NF)
✅ Soft deletes not used: Hard delete with CASCADE
✅ Timestamps: created_at, updated_at standard
✅ Indices: On foreign keys + frequent queries
✅ Partitioning: Consider for metrics/logs if >1B rows
✅ ENUM fields: Represented as VARCHAR (better for migrations)
```

---

### Q38: Connection pooling strategy?

**Réponse:**

```properties
# application.properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000  # 30s
spring.datasource.hikari.idle-timeout=600000  # 10 min
spring.datasource.hikari.max-lifetime=1800000  # 30 min
spring.datasource.hikari.auto-commit=true

# Read replicas (optional)
spring.datasource.primary.url=jdbc:postgresql://primary:5432/platform
spring.datasource.replica.url=jdbc:postgresql://replica:5432/platform
```

**HikariCP configuration:**
```
┌─────────────────────────────────────┐
│ Connection Pool (HikariCP)          │
│                                     │
│ Available: 5-20 connections         │
│ Busy: API requests using them       │
│ Closed idle: > 10 min (recycled)    │
│ Max lifetime: 30 min (restart)      │
└─────────────────────────────────────┘

Rules of thumb:
- pool_size = (core_count * 2) + spare_connections
- For 4 CPU: pool_size = 10-15
- Monitor: pool_size should stay 70-90% utilized
```

---

## Monitoring & Observability

### Q39: Prometheus scrape interval?

**Réponse:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s  # Default
  scrape_timeout: 10s
  evaluation_interval: 15s

scrape_configs:

  - job_name: 'knative-services'
    static_configs:
      - targets: ['localhost:8080']  # Knative metrics
    scrape_interval: 30s  # Custom: less frequent for cost

  - job_name: 'backend-api'
    static_configs:
      - targets: ['backend-api:8080/actuator/prometheus']
    scrape_interval: 15s

  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  - job_name: 'kafka'
    static_configs:
      - targets: ['kafka-exporter:9308']
    scrape_interval: 30s
```

**Storage retention:**
```
Retention period: 15 days (balance cost vs history)
Retention size: 50GB

For high-scale production:
├─ Short-term storage: 15 days (hot)
├─ Long-term storage: 1 year (cold)
└─ Archive: historical analysis
```

---

### Q40: Key metrics to monitor Platform Serverless?

**Réponse:**

```
APPLICATION METRICS:
├─ knative_request_count (requests per app)
├─ knative_request_latencies (response time distribution)
├─ knative_request_sizes (request body size)
├─ knative_response_sizes (response body size)

POD METRICS:
├─ container_cpu_usage_seconds_total (CPU time)
├─ container_memory_usage_bytes (memory)
├─ container_network_receive_bytes (network I/O)
├─ container_network_transmit_bytes
├─ pod_restart_total (crashes)

KUBERNETES METRICS:
├─ kube_pod_status_phase (running, pending, failed)
├─ kube_deployment_replicas (desired vs actual)
├─ kube_node_status_condition (node health)

CUSTOM BUSINESS METRICS:
├─ app_deployments_total (total deployments)
├─ app_deployment_duration_seconds (time to deploy)
├─ app_deployment_success_rate (% successful)
├─ billing_cost_monthly (MTD cost)
├─ billing_cost_per_app (per-app breakdown)
├─ kafka_messages_consumed_total (event rate)
├─ kafka_lag (consumer lag)

ALERTING RULES:
├─ Pod restart rate > 5/hour
├─ Error rate > 5%
├─ Latency p95 > 1000ms
├─ Memory usage > 80%
├─ Disk usage > 85%
├─ Deployment success rate < 95%
```

---

## Deployment & CI/CD

### Q41: GitHub Actions workflow for Platform Serverless?

**Réponse:**

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy to AKS

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build-backend:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: maven
    
    - name: Build with Maven
      run: mvn clean package -DskipTests
    
    - name: Run tests
      run: mvn test
    
    - name: Login to ACR
      uses: docker/login-action@v2
      with:
        registry: myregistry.azurecr.io
        username: ${{ secrets.ACR_USERNAME }}
        password: ${{ secrets.ACR_PASSWORD }}
    
    - name: Build & push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./backend-api
        push: true
        tags: myregistry.azurecr.io/backend-api:${{ github.sha }}
        cache-from: type=registry,ref=myregistry.azurecr.io/backend-api:buildcache
        cache-to: type=registry,ref=myregistry.azurecr.io/backend-api:buildcache,mode=max

  build-frontend:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run lint
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
    
    - name: Build & push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./web-portal
        push: true
        tags: myregistry.azurecr.io/web-portal:${{ github.sha }}

  deploy:
    runs-on: ubuntu-latest
    needs: [build-backend, build-frontend]
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.27.0'
    
    - name: Login to AKS
      uses: azure/aks-set-context@v3
      with:
        resource-group: 'myResourceGroup'
        cluster-name: 'myCluster'
        admin: 'false'
    
    - name: Update Kubernetes manifests
      run: |
        sed -i "s|<backend_image>|myregistry.azurecr.io/backend-api:${{ github.sha }}|g" k8s/backend/deployment.yaml
        sed -i "s|<frontend_image>|myregistry.azurecr.io/web-portal:${{ github.sha }}|g" k8s/frontend/deployment.yaml
    
    - name: Deploy to AKS
      run: |
        kubectl apply -f k8s/backend/
        kubectl apply -f k8s/frontend/
        kubectl rollout status deployment/backend-api -n default
        kubectl rollout status deployment/web-portal -n default
    
    - name: Verify deployment
      run: |
        kubectl get pods -l app=backend-api
        kubectl get pods -l app=web-portal
```

---

### Q42: Canary deployment strategy for Apps?

**Réponse:**

```yaml
# Knative traffic splitting
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-app
spec:
  template:
    metadata:
      name: my-app-v2
    spec:
      containers:
      - image: registry/app:v2.0
  traffic:
  - tag: current
    revisionName: my-app-v1
    percent: 90  # 90% traffic to v1
  - tag: candidate
    revisionName: my-app-v2
    percent: 10  # 10% traffic to v2 (canary)
  - tag: latest
    latestRevision: true
    percent: 0   # No direct traffic, but available

# After canary validation:
# - Shift 50% to v2
# - Shift 100% to v2
# - Delete v1
```

---

## Performance & Scalability

### Q43: Horizontal vs Vertical scaling?

**Réponse:**

```
VERTICAL SCALING (Scale up)
├─ Increase CPU/Memory per pod
├─ Single large pod
├─ Limits: 8 CPU, 64GB RAM per pod
├─ Fast deployment (seconds)
└─ Not recommended: single point of failure

HORIZONTAL SCALING (Scale out) ✅ RECOMMENDED
├─ Increase number of pods
├─ Multiple small pods + load balancer
├─ Better fault tolerance
├─ Better performance distribution
├─ Kubernetes-native (HPA)
└─ Scales automatically based on metrics

Platform Serverless setup:
├─ Minimum: 1 pod (dev), 3 pods (prod)
├─ Maximum: 10-100 pods (based on resources)
├─ Target: 70% CPU utilization (HPA trigger)
├─ Scale down: if CPU < 50% for 5 minutes
└─ Cold start: 5-30s on new pod
```

---

### Q44: Caching strategy?

**Réponse:**

```
CACHE LAYERS:

1. FRONTEND CACHE
   ├─ Browser cache (HTTP headers)
   ├─ LocalStorage (JWT tokens)
   ├─ Service Worker (offline support)
   └─ Cache strategy: Cache-first OR Network-first

2. API RESPONSE CACHE
   ├─ HTTP Cache-Control headers
   ├─ Browser remembers: GET /api/apps → 5 min cache
   └─ Conditional requests: ETag, Last-Modified

3. BACKEND APPLICATION CACHE
   ├─ Spring @Cacheable annotation
   ├─ TTL: 30 seconds (metrics)
   ├─ Invalidation: on update
   └─ Backend method-level caching

4. DATABASE QUERY CACHE
   ├─ Redis for hot data
   ├─ TTL: varies by data
   ├─ Invalidation strategy: TTL-based
   └─ Use for: user sessions, app status

5. CDN CACHE (if applicable)
   ├─ Static assets: images, CSS, JS
   ├─ TTL: 30 days
   ├─ Invalidation: on new deployment
   └─ Provider: CloudFlare, Azure CDN
```

---

## Décisions Architecturales (ADRs)

### ADR-001: Serverless + Containers (Knative) vs VM-based deployment?

**Status:** ✅ ACCEPTED

**Decision:** Use Knative Serving for application deployments

**Context:**
- Users want quick app deployment
- Cost efficiency important (pay per request)
- Multi-tenancy requirements
- Scale-to-zero capability needed

**Consequences:**
```
✅ Pros:
- Cost reduction (no idle pods)
- Automatic scaling (0 to N)
- Kubernetes-native
- CloudEvents standard support

⚠️ Cons:
- Cold start latency (5-10s first request)
- Stateless only (no persistent connections)
- Complexity vs simple VMs

Mitigation:
- Minimize container image size
- Fast startup (no heavy frameworks)
- Set minReplicas: 1 for critical services
```

---

### ADR-002: OAuth2/OIDC with Keycloak vs internal auth?

**Status:** ✅ ACCEPTED

**Decision:** Use Keycloak for authentication/authorization

**Context:**
- Multi-tenant SaaS platform
- RBAC required (ADMIN, DEVELOPER, VIEWER, BILLING_MANAGER)
- Future integration: corporate LDAP, SAML
- Security best practices: don't build auth yourself

**Consequences:**
```
✅ Pros:
- Battle-tested (production-grade)
- OAuth2 standard (interoperable)
- Token refresh automatic
- Audit logs built-in
- No password storage risk

⚠️ Cons:
- Additional service to maintain
- Learning curve
- Operational overhead

Mitigation:
- Use managed Keycloak (AzureAD, cloud provider)
- Automate backups
```

---

### ADR-003: Kafka for event streaming vs pub-sub model?

**Status:** ✅ ACCEPTED

**Decision:** Use Apache Kafka for durable event streaming

**Context:**
- Need event replay capability
- Multi-subscriber support
- Consumer group coordination needed
- Audit trail for events important

**Consequences:**
```
✅ Pros:
- Durability (events persist)
- Consumer groups (parallel processing)
- Replay capability
- Industry standard

⚠️ Cons:
- Operational complexity (3+ brokers)
- Higher latency than in-memory queues
- Storage requirements (100GB+)

Alternative considered:
- Redis Streams: Simpler, but no durability
- RabbitMQ: Works, but Kafka more scalable
```

---

### ADR-004: PostgreSQL for everything vs polyglot persistence?

**Status:** ✅ ACCEPTED

**Decision:** Use PostgreSQL as primary datastore; consider Redis for caching

**Context:**
- Relational data structure clear
- ACID transactions required
- Strong consistency important
- Operational simplicity valued

**Consequences:**
```
✅ Single source of truth
✅ No data synchronization issues
✅ Easier operations

⚠️ Considerations:
- Metrics might overflow PostgreSQL
- Consider TimescaleDB extension for high-volume metrics
- Or: InfluxDB for metrics (if > 1M points/min)
- Keep: User/App/Billing data in PostgreSQL
```

---

### ADR-005: React SPA vs Server-side rendering?

**Status:** ✅ ACCEPTED (SPA)

**Decision:** Build Single Page Application with React

**Context:**
- Rich interactive dashboard
- Real-time updates (SSE)
- Mobile-responsive needed
- Modern developer experience

**Consequences:**
```
✅ Pros:
- Best UX (fast interactions)
- Easier to maintain
- JavaScript/TypeScript full-stack
- Works offline (with Service Worker)

⚠️ Cons:
- SEO not great (but internal app, not public)
- Initial bundle larger
- Client-side security exposure

Alternative considered:
- Next.js SSR: Good, but added complexity for internal app
```

---

### ADR-006: JWT in localStorage vs HttpOnly cookies?

**Status:** ⚠️ PARTIALLY ACCEPTED

**Decision:** Use JWT in localStorage (with HTTPS)

**Context:**
- JWT tokens needed for API auth
- CORS requests require custom headers
- HTTPS enforced (no HTTP)
- Frontend controls token lifecycle

**Consequences:**
```
⚠️ Security trade-offs:
- localStorage: Vulnerable to XSS
- HttpOnly: Better (prevents XSS), but CORS complexity
- Solution: Both (localStorage for offline, HttpOnly for API)

Mitigation:
- Never trust user input (sanitize all)
- Use CSP headers (Content-Security-Policy)
- Regular security audits
- HTTPS only (no HTTP)
- Short token expiry (15 min)
```

---

### ADR-007: Monolithic backend vs microservices?

**Status:** ✅ ACCEPTED (Monolith now, microservices later)

**Decision:** Single Spring Boot backend for MVP

**Context:**
- MVP needs to launch quickly
- Team size: 3-5 developers
- Microservices add operational complexity
- Knative handles app isolation (users don't need service mesh)

**Migration path:**
```
Phase 1 (Now): Monolithic Backend
├─ User Management
├─ App Deployment
├─ Metrics Collection
├─ Billing
└─ Kafka Integration (all in one JAR)

Phase 2 (Later): Microservices
├─ User Service (separate)
├─ Deployment Service (separate)
├─ Metrics Service (separate)
├─ Billing Service (separate)
└─ Event Router (separate)

Decision: Stay monolith if scaling fine
         Split if service bottlenecks appear
```

---

### Résumé des Justifications Technologiques

```
╔════════════════════════════════════════════════════════════╗
║         TECHNOLOGY STACK JUSTIFICATION SUMMARY             ║
╚════════════════════════════════════════════════════════════╝

FRONTEND:
├─ React 18 → Industry standard (90% market share)
├─ TypeScript → Type safety at scale
├─ Tailwind CSS → Best performance + customization
├─ Vite → Fastest build tool (ESM native)
├─ Recharts → Lightweight charting
└─ Redux/Zustand → State management (Zustand simpler)

BACKEND:
├─ Spring Boot 3.x → Most mature Java framework
├─ Java 17 → LTS, modern features (upgrade to 21 soon)
├─ PostgreSQL 16 → Relational + ACID guarantees
├─ Kafka 3.6 → Durable event streaming
├─ Knative Serving → Serverless on Kubernetes
├─ Keycloak → Battle-tested auth/authz
└─ Prometheus → Industry standard monitoring

INFRASTRUCTURE:
├─ Kubernetes 1.27+ → Standard container orchestration
├─ Knative Eventing → CloudEvents routing
├─ Calico/Flannel → Network policy + simplicity
├─ Longhorn → Distributed storage on-premise
└─ Docker → Container standard

SECURITY:
├─ OAuth2/OIDC (Keycloak) → Standard, flexible
├─ JWT tokens → Stateless auth
├─ HTTPS/TLS → Transport encryption
├─ Network policies → Pod isolation
└─ RBAC → Fine-grained access control

METHODOLOGY:
├─ Async deployment (CompletableFuture) → Non-blocking
├─ Event-driven architecture → Loose coupling
├─ CloudEvents standard → Polyglot compatibility
└─ Infrastructure-as-code (manifests) → GitOps-ready
```

---

*Document de Validation Technique - 2026-06-12*
*Tous les choix technologiques justifiés et documentés*
