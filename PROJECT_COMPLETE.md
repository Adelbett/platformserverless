# NEXTSTEP Serverless OS — Documentation Complète du Projet

> **Projet de Fin d'Études — NextStep IT**
> Plateforme PaaS Serverless Multi-Tenant sur Kubernetes + Knative

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture globale](#2-architecture-globale)
3. [Acteurs et Rôles](#3-acteurs-et-rôles)
4. [Entités de données](#4-entités-de-données)
5. [Backend — Spring Boot](#5-backend--spring-boot)
6. [Frontend — React](#6-frontend--react)
7. [Infrastructure Kubernetes](#7-infrastructure-kubernetes)
8. [Serverless avec Knative](#8-serverless-avec-knative)
9. [Messagerie — Kafka Strimzi](#9-messagerie--kafka-strimzi)
10. [Sécurité — Keycloak](#10-sécurité--keycloak)
11. [Observabilité](#11-observabilité)
12. [Facturation](#12-facturation)
13. [CI/CD — Jenkins + Kaniko](#13-cicd--jenkins--kaniko)
14. [API REST complète](#14-api-rest-complète)
15. [Fonctionnalités par rôle](#15-fonctionnalités-par-rôle)
16. [États d'une application](#16-états-dune-application)

---

## 1. Vue d'ensemble

**NEXTSTEP Serverless OS** est une plateforme PaaS (Platform as a Service) serverless multi-tenant qui permet à des équipes de déployer, monitorer et gérer des applications Docker sur un cluster Kubernetes, sans avoir à manipuler directement les ressources Kubernetes.

| Propriété | Valeur |
|---|---|
| Organisme | NextStep IT, Charguia 2, Tunis |
| Type | PaaS Serverless Multi-Tenant |
| Cluster | Kubernetes 3 nœuds (kubeadm) |
| Serverless | Knative Serving + Eventing |
| Messagerie | Apache Kafka (Strimzi) |
| Auth | Keycloak OAuth2/OIDC |
| Backend | Spring Boot 3.2 / Java 21 |
| Frontend | React 18 / Vite |
| CI/CD | Jenkins + Kaniko |
| Monitoring | Prometheus + Grafana |

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                              │
│         CLIENT_ADMIN  │  MEMBER  │  ADMIN                       │
└────────────┬──────────────────────────────┬─────────────────────┘
             │                              │
     ┌───────▼──────────┐         ┌─────────▼──────────┐
     │   React 18       │         │    Keycloak         │
     │   Web Portal     │◄────────│    OAuth2/OIDC      │
     │   (Vite/MUI)     │         │    JWT RS256        │
     └───────┬──────────┘         └─────────────────────┘
             │ HTTPS / JWT
     ┌───────▼──────────────────────────────────────────┐
     │              Spring Boot 3 API                    │
     │  AppController │ BillingController │ KafkaCtrl   │
     │  MetricsController │ LogController │ AdminCtrl   │
     │  SseTokenFilter │ UserSyncFilter │ SecurityConfig│
     └────┬──────────────┬───────────────┬──────────────┘
          │              │               │
    ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
    │ PostgreSQL │ │  Knative   │ │   Kafka    │
    │  (JPA)     │ │  Serving   │ │  Strimzi   │
    └────────────┘ └─────┬──────┘ └─────┬──────┘
                         │              │
                  ┌──────▼──────┐ ┌─────▼──────────┐
                  │  KService   │ │ Knative Eventing│
                  │  (Pods)     │ │ KafkaSource     │
                  └─────────────┘ │ Trigger/Broker  │
                                  └─────────────────┘
```

---

## 3. Acteurs et Rôles

### Rôles définis

| Rôle | Description |
|---|---|
| `ADMIN` | Administrateur de la plateforme (NextStep IT) |
| `CLIENT_ADMIN` | Responsable d'une organisation client, gère son équipe |
| `MEMBER` | Membre de l'équipe d'un CLIENT_ADMIN |

### Héritage UML

```
CLIENT_ADMIN ──▷ MEMBER
(CLIENT_ADMIN hérite de toutes les capacités de MEMBER + gestion d'équipe)
```

### Droits par rôle

#### MEMBER — peut :
- Déployer, modifier, supprimer ses applications Docker
- Consulter la liste et le détail de ses applications
- Consulter les métriques temps réel (CPU, mémoire, Req/s, latences)
- Consulter les logs de déploiement (SSE)
- Consulter sa facturation (coûts MTD)
- Exporter son rapport Excel de consommation
- Gérer ses topics Kafka (créer, modifier, supprimer)
- Configurer l'Eventing Knative (KafkaSources, Triggers)

#### CLIENT_ADMIN — tout ce que MEMBER peut faire, plus :
- Ajouter des membres à son équipe
- Assigner des rôles aux membres
- Supprimer des membres de son équipe
- Voir les applications de son équipe

#### ADMIN — peut :
- Consulter et gérer tous les utilisateurs (activer/désactiver)
- Surveiller le cluster Kubernetes (nœuds, pods, KServices)
- Gérer les comptes clients (suspendre, restaurer)
- Suspendre/restaurer des applications individuelles
- Gérer les quotas clients (CPU/RAM)
- Voir la facturation globale de tous les clients
- Exporter les rapports de consommation globaux
- Gérer les ressources matérielles

---

## 4. Entités de données

### 4.1 User

Table : `users`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant unique |
| `username` | VARCHAR(50) UNIQUE | Nom d'utilisateur |
| `email` | VARCHAR(100) UNIQUE | Email |
| `password_hash` | TEXT | Hash BCrypt du mot de passe |
| `role` | VARCHAR(20) | `ADMIN`, `CLIENT_ADMIN`, `MEMBER` |
| `owner_id` | UUID (FK → users) | CLIENT_ADMIN propriétaire (null si ADMIN/CLIENT_ADMIN) |
| `suspended` | BOOLEAN | Compte suspendu |
| `created_at` | TIMESTAMP | Date de création |

### 4.2 App

Table : `apps`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant unique |
| `name` | VARCHAR | Nom de l'application |
| `user_id` | UUID (FK → users) | Propriétaire |
| `image_name` | VARCHAR | Image Docker (ex: `nginx`) |
| `image_tag` | VARCHAR | Tag Docker (défaut: `latest`) |
| `url` | VARCHAR | URL publique Knative |
| `status` | VARCHAR | `PENDING`, `DEPLOYING`, `RUNNING`, `FAILED`, `SCALED_TO_ZERO`, `SUSPENDED`, `DELETED` |
| `service_name` | VARCHAR | Nom du KService Knative |
| `namespace` | VARCHAR | Namespace Kubernetes |
| `description` | TEXT | Description |
| `port` | INTEGER | Port exposé par le conteneur |
| `min_replicas` | INTEGER | Minimum de réplicas (défaut: 0) |
| `max_replicas` | INTEGER | Maximum de réplicas (défaut: 10) |
| `cpu_request` | VARCHAR | CPU demandé (défaut: `100m`) |
| `memory_request` | VARCHAR | Mémoire demandée (défaut: `128Mi`) |
| `deployed_at` | TIMESTAMP | Date de déploiement |
| `updated_at` | TIMESTAMP | Dernière modification |

### 4.3 BillingSnapshot

Table : `billing_snapshots`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `user_id` | UUID (FK → users) | Propriétaire |
| `app_id` | UUID (FK → apps) | Application |
| `service_name` | VARCHAR | Nom du KService |
| `namespace` | VARCHAR | Namespace |
| `cpu_vcpu` | DOUBLE | CPU consommé en vCPU |
| `memory_gb` | DOUBLE | Mémoire consommée en GB |
| `replicas` | INTEGER | Nombre de réplicas actifs |
| `uptime_factor` | DOUBLE | Facteur uptime (1.0 / 0.2 / 0.0) |
| `cpu_cost` | DOUBLE | Coût CPU pour cette heure |
| `memory_cost` | DOUBLE | Coût mémoire pour cette heure |
| `total_cost` | DOUBLE | Coût total pour cette heure |
| `snapshot_time` | TIMESTAMP | Horodatage du snapshot |

### 4.4 KafkaTopic

Table : `kafka_topics`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `name` | VARCHAR UNIQUE | Nom du topic Kafka |
| `partitions` | INTEGER | Nombre de partitions (défaut: 3) |
| `replicas` | INTEGER | Facteur de réplication (défaut: 1) |
| `config` | TEXT | Configuration JSON additionnelle |
| `user_id` | UUID (FK → users) | Propriétaire |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Dernière modification |

### 4.5 KafkaSource

Table : `kafka_sources`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `name` | VARCHAR | Nom de la source |
| `user_id` | UUID (FK → users) | Propriétaire |
| `kafka_topic_id` | UUID (FK → kafka_topics) | Topic source |
| `consumer_group` | VARCHAR | Groupe consommateur Kafka |
| `bootstrap_servers` | VARCHAR | Adresses des brokers Kafka |
| `namespace` | VARCHAR | Namespace Kubernetes |
| `ready` | BOOLEAN | État de la source |
| `config` | TEXT | Configuration JSON |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Dernière modification |

### 4.6 Trigger

Table : `triggers`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `name` | VARCHAR | Nom du trigger |
| `user_id` | UUID (FK → users) | Propriétaire |
| `kafka_source_id` | UUID (FK → kafka_sources) | Source associée |
| `subscriber_name` | VARCHAR | Nom du service abonné (KService) |
| `broker_name` | VARCHAR | Broker Knative (défaut: `default`) |
| `filter_type` | VARCHAR | Type de filtre CloudEvent |
| `filter` | TEXT | Filtre JSON |
| `action` | TEXT | Action JSON à exécuter |
| `ready` | BOOLEAN | État du trigger |
| `active` | BOOLEAN | Trigger activé/désactivé |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Dernière modification |

### 4.7 DeploymentLog

Table : `deployment_logs`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `app_id` | UUID (FK → apps) | Application |
| `app_name` | VARCHAR | Nom de l'application |
| `user_id` | UUID (FK → users) | Propriétaire |
| `message` | TEXT | Message du log |
| `type` | VARCHAR | `INFO`, `SUCCESS`, `ERROR`, `WARNING` |
| `created_at` | TIMESTAMP | Horodatage |

### Schéma de relations

```
users ──< apps
users ──< billing_snapshots
users ──< kafka_topics
users ──< kafka_sources
users ──< triggers
users ──< deployment_logs
apps ──< billing_snapshots
apps ──< deployment_logs
kafka_topics ──< kafka_sources
kafka_sources ──< triggers
users >── users (owner_id self-référence)
```

---

## 5. Backend — Spring Boot

### Stack technique

| Composant | Technologie |
|---|---|
| Framework | Spring Boot 3.2 |
| Langage | Java 21 |
| ORM | Spring Data JPA / Hibernate |
| Base de données | PostgreSQL 15 |
| Sécurité | Spring Security + OAuth2 Resource Server |
| Auth | Keycloak JWT RS256 |
| Kubernetes client | Fabric8 Kubernetes Client |
| Streaming | Server-Sent Events (SSE) |
| Facturation export | Apache POI (Excel) |
| Build | Maven |
| Docs API | SpringDoc OpenAPI 3 (Swagger) |

### Structure des packages

```
com.platform.api
├── app/                    # Gestion des applications + KService
│   ├── App.java            # Entité JPA
│   ├── AppService.java     # Logique métier déploiement
│   ├── AppController.java  # REST /api/apps
│   ├── AppRepository.java
│   ├── KnativeService.java # Opérations Knative (create/delete/suspend)
│   ├── KnativeServiceHelper.java
│   └── KnativeWatcher.java # Watcher K8s (mise à jour statut)
├── auth/                   # Authentification locale
│   ├── AuthController.java # /api/auth/register, /login
│   └── AuthService.java
├── billing/                # Facturation
│   ├── BillingSnapshot.java
│   ├── BillingService.java
│   ├── BillingController.java
│   ├── BillingScheduler.java  # @Scheduled toutes les heures
│   └── BillingExportService.java  # Export Excel Apache POI
├── eventing/               # Knative Eventing
│   ├── KafkaSource.java
│   ├── Trigger.java
│   ├── EventingService.java
│   └── EventingController.java
├── kafka/                  # Topics Kafka
│   ├── KafkaTopic.java
│   ├── KafkaService.java   # Admin API Kafka
│   └── KafkaController.java
├── logs/                   # Logs de déploiement
│   ├── DeploymentLog.java
│   ├── LogService.java
│   ├── LogSseService.java  # SSE streaming
│   └── LogController.java
├── metrics/                # Métriques Prometheus
│   ├── MetricsService.java # Requêtes PromQL
│   └── MetricsController.java
├── security/
│   ├── SecurityConfig.java
│   ├── KeycloakJwtAuthConverter.java
│   ├── SseTokenFilter.java    # JWT via ?token= query param
│   └── UserSyncFilter.java    # Sync Keycloak → DB locale
├── user/
│   ├── User.java
│   ├── UserService.java
│   ├── UserController.java
│   └── UserContextService.java
├── team/
│   ├── TeamService.java
│   └── TeamController.java
└── admin/
    └── AdminController.java
```

### Sécurité — Filtres de la chaîne

```
Request
  │
  ▼
SseTokenFilter          ← Extrait JWT depuis ?token= (pour SSE)
  │
  ▼
BearerTokenAuthFilter   ← Valide JWT Keycloak (RS256)
  │
  ▼
UserSyncFilter          ← Sync utilisateur Keycloak → DB locale
  │
  ▼
Controllers (@PreAuthorize)
```

### Cycle de vie d'un déploiement

```
POST /api/apps
  │
  ├── AppService.deploy()
  │     ├── Créer App (PENDING) en DB
  │     ├── KnativeService.createKService()  → kubectl apply KService
  │     └── LogService.log(DEPLOYING)
  │
  ├── KnativeWatcher (background)
  │     ├── Watch KService ready=true
  │     ├── App.status = RUNNING
  │     └── LogService.log(SUCCESS)
  │
  └── SSE /api/logs/stream?appId=X&token=JWT
        └── LogSseService → émission temps réel
```

### Formule de facturation

```
CPU_COST    = cpu_vcpu × 0.048 × uptime_factor
MEMORY_COST = memory_gb × 0.006 × uptime_factor
TOTAL_COST  = CPU_COST + MEMORY_COST

uptime_factor:
  RUNNING         → 1.0
  SCALED_TO_ZERO  → 0.2
  SUSPENDED       → 0.0
```

---

## 6. Frontend — React

### Stack technique

| Composant | Technologie |
|---|---|
| Framework | React 18 |
| Build | Vite |
| UI | Material-UI (MUI) v5 |
| Graphiques | Recharts |
| Animations | Framer Motion |
| HTTP | Axios |
| State | Context API |
| Routing | React Router v6 |

### Pages de l'application

#### Pages communes (MEMBER + CLIENT_ADMIN)

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Authentification Keycloak |
| Register | `/register` | Inscription |
| Dashboard | `/` | Vue d'ensemble KPIs |
| AppsList | `/apps` | Liste des applications avec statuts |
| AppDetails | `/apps/:id` | Détail app + métriques + logs |
| DeployApp | `/deploy` | Formulaire de déploiement |
| Monitoring | `/monitoring` | Graphiques CPU/RAM/Req/s temps réel |
| LogsView | `/logs` | Logs SSE en temps réel |
| KafkaTopics | `/kafka` | CRUD topics Kafka |
| Eventing | `/eventing` | Gestion KafkaSources + Triggers |
| Billing | `/billing` | Facturation + export Excel |
| Team | `/team` | Gestion équipe (CLIENT_ADMIN seulement) |
| Settings | `/settings` | Paramètres profil |

#### Pages Admin

| Page | Route | Description |
|---|---|---|
| AdminDashboard | `/admin` | Tableau de bord admin global |
| AdminClients | `/admin/clients` | Gestion des clients |
| AdminBilling | `/admin/billing` | Facturation globale |
| ClusterManagement | `/admin/cluster` | Nœuds, pods, KServices |
| Users | `/admin/users` | Gestion des utilisateurs |

### Structure des composants

```
web-portal/src/
├── App.jsx              # Routes + auth guard
├── main.jsx             # Point d'entrée
├── api/                 # Clients Axios par domaine
├── auth/                # Keycloak adapter
├── context/             # AuthContext, ThemeContext
├── components/          # Composants réutilisables
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   ├── AppCard.jsx
│   ├── MetricChart.jsx
│   └── StatusBadge.jsx
└── pages/               # Pages (voir tableau ci-dessus)
```

### Fonctionnement SSE (logs temps réel)

```javascript
// Le frontend ouvre une connexion SSE avec le JWT en query param
const url = `/api/logs/stream?appId=${appId}&token=${jwt}`;
const evtSource = new EventSource(url);
evtSource.onmessage = (e) => setLogs(prev => [...prev, JSON.parse(e.data)]);
```

---

## 7. Infrastructure Kubernetes

### Cluster

| Nœud | Rôle | IP |
|---|---|---|
| master | Control Plane | 192.168.1.10 |
| worker-1 | Worker | 192.168.1.11 |
| worker-2 | Worker | 192.168.1.12 |

### Setup

```bash
# Master
kubeadm init --pod-network-cidr=10.244.0.0/16
kubectl apply -f flannel.yaml           # CNI

# Load Balancer
kubectl apply -f metallb-native.yaml
kubectl apply -f metallb-ippool.yaml    # Pool: 192.168.1.200-220

# Workers
kubeadm join 192.168.1.10:6443 --token ...
```

### Namespaces

| Namespace | Contenu |
|---|---|
| `platform-system` | Spring Boot API, PostgreSQL |
| `knative-serving` | Knative Serving (activator, controller, autoscaler) |
| `knative-eventing` | Knative Eventing (broker, controller) |
| `kafka` | Strimzi operator + cluster Kafka |
| `keycloak` | Keycloak IAM |
| `monitoring` | Prometheus + Grafana |
| `jenkins` | Jenkins CI/CD |
| `tenant-*` | Un namespace par client (isolation) |

### NetworkPolicies (isolation multi-tenant)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cross-tenant
  namespace: tenant-abc
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: tenant-abc    # Seul ce namespace peut communiquer
```

---

## 8. Serverless avec Knative

### Knative Serving

**Mécanisme scale-to-zero :**
```
Trafic entrant → Activator → KPA détecte activité
  → Scale up pods → Servir requêtes
  → 60s sans trafic → Scale down → 0 pods
  → Prochaine requête → Activator bufferise → Scale up
```

**Suspension administrative (maxScale=0) :**
```java
// KnativeService.java
patchData.put("autoscaling.knative.dev/maxScale", "0");
// → Knative ne peut plus créer de pods → App figée
```

**Structure d'un KService déployé :**
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: app-{uuid}
  namespace: tenant-{userId}
  annotations:
    autoscaling.knative.dev/minScale: "0"
    autoscaling.knative.dev/maxScale: "10"
spec:
  template:
    spec:
      containers:
      - image: {imageName}:{imageTag}
        ports:
        - containerPort: {port}
        resources:
          requests:
            cpu: {cpuRequest}
            memory: {memoryRequest}
```

### Knative Eventing

| Composant | Rôle |
|---|---|
| `Broker` | Bus de messages CloudEvents |
| `KafkaSource` | Lit un topic Kafka → émet vers Broker |
| `Trigger` | Filtre les CloudEvents → route vers un KService |

---

## 9. Messagerie — Kafka Strimzi

### Cluster Kafka

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: nextstep-kafka
  namespace: kafka
spec:
  kafka:
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
  zookeeper:
    replicas: 3
```

### Création programmatique de topics

```java
// KafkaService.java
AdminClient adminClient = AdminClient.create(props);
NewTopic topic = new NewTopic(topicName, partitions, (short) replicas);
adminClient.createTopics(List.of(topic)).all().get();
```

---

## 10. Sécurité — Keycloak

### Configuration Realm

| Paramètre | Valeur |
|---|---|
| Realm | `nextstep` |
| Client | `nextstep-backend` |
| Access Type | `confidential` |
| Algorithm | `RS256` |
| Token expiry | 300s |

### Rôles Keycloak

```
nextstep realm roles:
  ├── ADMIN
  ├── CLIENT_ADMIN
  └── MEMBER
```

### JwtAuthConverter

```java
// KeycloakJwtAuthConverter.java
// Extrait les rôles depuis: realm_access.roles[]
Collection<GrantedAuthority> authorities = jwt
    .getClaimAsStringList("realm_access.roles")
    .stream()
    .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
    .collect(toList());
```

### SseTokenFilter

```java
// Permet le JWT via ?token= query param pour les EventSource
String token = request.getParameter("token");
if (token != null && request.getRequestURI().contains("/logs/stream")) {
    request.setAttribute("Authorization", "Bearer " + token);
}
```

---

## 11. Observabilité

### Stack

| Outil | Rôle |
|---|---|
| Prometheus | Scraping métriques Kubernetes + Knative |
| Grafana | Dashboards visuels |
| Actuator | Health, info, métriques Spring Boot |

### Installation

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

### Métriques exposées via API

| Métrique | PromQL |
|---|---|
| Requêtes/s | `rate(revision_request_count[1m])` |
| Latence P50 | `histogram_quantile(0.50, revision_request_latencies_bucket)` |
| Latence P99 | `histogram_quantile(0.99, revision_request_latencies_bucket)` |
| CPU pod | `rate(container_cpu_usage_seconds_total[1m])` |
| Mémoire pod | `container_memory_working_set_bytes` |

### Streaming SSE des métriques

```java
// MetricsController.java
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamMetrics(@RequestParam String appId) {
    SseEmitter emitter = new SseEmitter(300_000L);
    // Push métriques toutes les 5s
    scheduler.scheduleAtFixedRate(() -> {
        MetricDto metrics = metricsService.getMetrics(appId);
        emitter.send(SseEmitter.event().data(metrics));
    }, 0, 5, TimeUnit.SECONDS);
    return emitter;
}
```

---

## 12. Facturation

### Fonctionnement

- **Snapshot horaire** : `@Scheduled(cron = "0 0 * * * *")` — collecte l'état de chaque application
- **Facteur uptime** : pondère le coût selon l'état (RUNNING=1.0, SCALED_TO_ZERO=0.2, SUSPENDED=0.0)
- **Export Excel** : Apache POI génère un `.xlsx` avec 3 feuilles

### Structure du rapport Excel

| Feuille | Contenu |
|---|---|
| **Résumé** | Total coût MTD, coût CPU, coût mémoire |
| **Détail par application** | Coût par app, CPU/RAM consommés |
| **Historique horaire** | Timeline des snapshots |

### API Billing

```
GET  /api/billing/summary          → Résumé coûts (MEMBER/CLIENT_ADMIN)
GET  /api/billing/history          → Historique snapshots
GET  /api/billing/export           → Télécharger Excel (.xlsx)
GET  /api/admin/billing            → Vue globale tous clients (ADMIN)
GET  /api/admin/billing/export     → Export global Excel
```

---

## 13. CI/CD — Jenkins + Kaniko

### Architecture

```
Git push
  │
  ▼
Jenkins (Declarative Pipeline)
  ├── Stage: Checkout
  ├── Stage: Build (Maven / npm)
  ├── Stage: Test
  ├── Stage: Docker Build (Kaniko — sans Docker daemon)
  │     └── Pod: kaniko container → push vers registry
  └── Stage: Deploy
        └── kubectl rollout restart deployment/...
```

### Jenkinsfile Backend

```groovy
pipeline {
  agent {
    kubernetes {
      yaml """
        spec:
          containers:
          - name: kaniko
            image: gcr.io/kaniko-project/executor:latest
            command: ['sleep', '9999999']
      """
    }
  }
  stages {
    stage('Build') { steps { sh 'mvn clean package -DskipTests' } }
    stage('Docker') {
      steps {
        container('kaniko') {
          sh '/kaniko/executor --context=. --dockerfile=Dockerfile \
              --destination=registry.nextstep.local/backend:latest'
        }
      }
    }
    stage('Deploy') { steps { sh 'kubectl rollout restart deploy/backend-api' } }
  }
}
```

### Dockerfile Backend (multi-stage)

```dockerfile
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Dockerfile Frontend (multi-stage)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 14. API REST complète

Base URL : `http://api.nextstep.local/api`

### Authentification

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Inscription |
| POST | `/auth/login` | Public | Connexion (JWT) |

### Applications

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/apps` | MEMBER+ | Lister mes applications |
| POST | `/apps` | MEMBER+ | Déployer une application |
| GET | `/apps/{id}` | MEMBER+ | Détail d'une application |
| PUT | `/apps/{id}` | MEMBER+ | Modifier une application |
| DELETE | `/apps/{id}` | MEMBER+ | Supprimer une application |
| POST | `/apps/{id}/suspend` | CLIENT_ADMIN | Suspendre |
| POST | `/apps/{id}/resume` | CLIENT_ADMIN | Reprendre |

### Métriques

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/metrics/{appId}` | MEMBER+ | Métriques instantanées |
| GET | `/metrics/{appId}/stream` | MEMBER+ | Stream SSE métriques |

### Logs

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/logs/{appId}` | MEMBER+ | Historique logs |
| GET | `/logs/stream` | MEMBER+ | Stream SSE logs (`?appId=&token=`) |

### Kafka Topics

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/kafka/topics` | MEMBER+ | Lister les topics |
| POST | `/kafka/topics` | MEMBER+ | Créer un topic |
| PUT | `/kafka/topics/{id}` | MEMBER+ | Modifier un topic |
| DELETE | `/kafka/topics/{id}` | MEMBER+ | Supprimer un topic |

### Eventing

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/eventing/sources` | MEMBER+ | Lister KafkaSources |
| POST | `/eventing/sources` | MEMBER+ | Créer une KafkaSource |
| DELETE | `/eventing/sources/{id}` | MEMBER+ | Supprimer |
| GET | `/eventing/triggers` | MEMBER+ | Lister Triggers |
| POST | `/eventing/triggers` | MEMBER+ | Créer un Trigger |
| DELETE | `/eventing/triggers/{id}` | MEMBER+ | Supprimer |

### Facturation

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/billing/summary` | MEMBER+ | Résumé coûts MTD |
| GET | `/billing/history` | MEMBER+ | Historique snapshots |
| GET | `/billing/export` | MEMBER+ | Télécharger Excel |

### Team (CLIENT_ADMIN)

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/team/members` | CLIENT_ADMIN | Lister membres |
| POST | `/team/members` | CLIENT_ADMIN | Ajouter un membre |
| PUT | `/team/members/{id}/role` | CLIENT_ADMIN | Changer rôle |
| DELETE | `/team/members/{id}` | CLIENT_ADMIN | Supprimer membre |

### Admin

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/admin/users` | ADMIN | Tous les utilisateurs |
| PUT | `/admin/users/{id}/suspend` | ADMIN | Suspendre compte |
| PUT | `/admin/users/{id}/activate` | ADMIN | Activer compte |
| GET | `/admin/apps` | ADMIN | Toutes les applications |
| POST | `/admin/apps/{id}/suspend` | ADMIN | Suspendre application |
| GET | `/admin/cluster/nodes` | ADMIN | Nœuds K8s |
| GET | `/admin/cluster/pods` | ADMIN | Pods K8s |
| GET | `/admin/cluster/kservices` | ADMIN | KServices |
| GET | `/admin/billing` | ADMIN | Facturation globale |
| GET | `/admin/billing/export` | ADMIN | Export Excel global |

---

## 15. Fonctionnalités par rôle

### MEMBER

```
✅ S'authentifier (Keycloak OAuth2)
✅ Déployer une application Docker sur Knative
✅ Modifier les paramètres d'une application (CPU, RAM, replicas)
✅ Supprimer une application
✅ Consulter la liste de ses applications avec statuts en temps réel
✅ Voir le détail d'une application (URL, ressources, statut)
✅ Consulter les métriques temps réel via SSE (Req/s, P50, P99, CPU, RAM)
✅ Consulter les logs de déploiement via SSE
✅ Créer/modifier/supprimer des topics Kafka
✅ Créer des KafkaSources (connexion Kafka → Knative)
✅ Créer des Triggers (routage CloudEvents → KServices)
✅ Consulter sa facturation (coût MTD, par application)
✅ Exporter son rapport de consommation Excel
✅ Modifier ses paramètres de profil
```

### CLIENT_ADMIN (tout ce que MEMBER peut faire, plus :)

```
✅ Voir les applications de tous ses membres
✅ Ajouter des membres à son organisation
✅ Assigner/modifier les rôles des membres
✅ Supprimer des membres
✅ Suspendre une application d'un membre
```

### ADMIN (administrateur de la plateforme)

```
✅ Tableau de bord global (utilisateurs, applications, revenus)
✅ Consulter et gérer tous les utilisateurs
✅ Activer / suspendre des comptes clients
✅ Surveiller le cluster Kubernetes (nœuds, pods, KServices)
✅ Gérer les quotas CPU/RAM par client
✅ Suspendre / restaurer des applications individuelles
✅ Consulter la facturation globale de tous les clients
✅ Exporter les rapports de consommation globaux (Excel)
✅ Gérer les ressources matérielles du cluster
```

---

## 16. États d'une application

```
                    ┌─────────┐
              ──────► PENDING │
                    └────┬────┘
                         │ Knative crée le KService
                    ┌────▼──────┐
                    │ DEPLOYING │
                    └────┬──────┘
               ┌─────────┼──────────┐
               │ Succès  │          │ Erreur
        ┌──────▼─────┐   │   ┌──────▼──────┐
        │  RUNNING   │   │   │   FAILED    │
        └──────┬─────┘   │   └─────────────┘
               │         └──────────────────►
       ┌───────┼──────────────────┐
       │       │                  │
┌──────▼─────┐ │ Suspension admin │
│SCALED_TO   │ │                  │
│   ZERO     │ ▼                  │
└──────┬─────┘ ┌──────────────┐   │
       │       │  SUSPENDED   │   │
       │       └──────┬───────┘   │
       └───────┘      │           │
                 Résumé│     Suppression
                  ┌────▼─────┐   │
                  │ RUNNING  │◄──┘
                  └────┬─────┘
                       │ DELETE
                  ┌────▼─────┐
                  │ DELETED  │
                  └──────────┘
```

### Tableau des transitions

| De | Vers | Déclencheur |
|---|---|---|
| PENDING | DEPLOYING | Soumission à Knative |
| DEPLOYING | RUNNING | KService ready=true |
| DEPLOYING | FAILED | Timeout ou erreur image |
| RUNNING | SCALED_TO_ZERO | 60s sans trafic (Knative KPA) |
| SCALED_TO_ZERO | RUNNING | Nouvelle requête entrante |
| RUNNING | SUSPENDED | Admin/CLIENT_ADMIN → maxScale=0 |
| SUSPENDED | RUNNING | Admin/CLIENT_ADMIN → maxScale=10 |
| RUNNING | DELETED | DELETE /api/apps/{id} |
| FAILED | DELETED | DELETE /api/apps/{id} |

---

*Document généré le 2026-06-18 — NEXTSTEP Serverless OS — PFE Esprit*
