# PlatformServerless — Documentation Complète

## Vue d'ensemble

PlatformServerless est une plateforme PaaS (Platform as a Service) permettant à des clients de déployer des applications Docker sur Kubernetes/Knative sans connaissances infrastructure. Elle gère automatiquement le scaling, le routage, les événements Kafka et la surveillance.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT / ADMIN                        │
│                    Navigateur Web (React)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST + SSE
┌──────────────────────────▼──────────────────────────────────┐
│                   BACKEND API (Spring Boot)                  │
│              Port 8082 — Namespace: platform                 │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
Keycloak  PostgreSQL  Fabric8   Kafka      Knative
(Auth)    (DB)        K8s Client (Strimzi)  Eventing
```

---

## Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | React + Vite | 18 |
| Backend | Spring Boot | 3.x |
| Base de données | PostgreSQL | 15 |
| Auth / IAM | Keycloak | 23 |
| Container Orchestration | Kubernetes | 1.28 |
| Serverless Runtime | Knative Serving + Eventing | 1.x |
| Message Broker | Apache Kafka (Strimzi) | 3.x |
| Ingress | Kourier + MetalLB + sslip.io | — |
| CI/CD | Jenkins + Kaniko | — |
| K8s Client (Java) | Fabric8 | 6.x |

---

## Rôles utilisateurs

| Rôle | Description |
|------|-------------|
| **ADMIN** | Accès global — monitoring cluster, gestion tous les tenants |
| **developer** | Client — déploie ses propres apps, gère ses topics Kafka |

---

## Fonctionnalités

### Authentification
- Register / Login via Keycloak (OAuth2 / OpenID Connect)
- Tokens JWT RS256 validés par Spring OAuth2 Resource Server
- Redirection automatique selon le rôle (admin → `/admin/dashboard`, client → `/dashboard`)

### Gestion des Applications (Client)
- Déployer une app Docker depuis n'importe quel registry public
- Configurer : image tag, port, CPU, mémoire, min/max replicas
- Scale to zero automatique (Knative) — redémarre à la première requête
- Redéployer une app existante
- Modifier une app (image tag, replicas, ressources) → redéploiement automatique
- Supprimer une app → supprime le Knative Service + KafkaSource + Trigger associés
- Voir les logs en temps réel (SSE)
- Voir les métriques (req/sec, latence, error rate)

### Kafka & Eventing
- Créer / supprimer des topics Kafka
- Lors du déploiement avec `kafkaEnabled=true` :
  - Création automatique d'un **KafkaSource** (consumer group)
  - Création automatique d'un **Trigger Knative** sur le cluster (namespace `default`, broker `default`)
- Publier des **CloudEvents** vers le Knative Broker
- Le Broker route les events vers les apps via les Triggers (filtre par `type`)

### Flow Eventing complet
```
Client publie event
    → POST /api/events
    → Knative Broker (default/default)
    → InMemoryChannel
    → Trigger (filtre type=order.created)
    → App Knative (scale from zero si nécessaire)
```

### Monitoring (Admin)
- **Overview** : nodes, pods, namespaces, apps, topics, sources, triggers
- **Pods** : tous les pods du cluster groupés par namespace
- **Kafka** : broker pods + topics
- **Knative** : services par namespace tenant avec URLs
- **Eventing** : KafkaSources + Triggers de tous les tenants
- **Apps/Users** : toutes les apps avec tenant, image, CPU, memory

### Administration
- Voir toutes les apps de tous les tenants
- Force-delete n'importe quelle app
- Gérer les Kafka topics globalement
- Voir tous les logs de déploiement
- Voir l'état du cluster (nodes, namespaces, pods)

---

## Structure Backend

```
backend-api/src/main/java/com/platform/api/
│
├── BackendApiApplication.java          # Point d'entrée Spring Boot
│
├── security/
│   ├── SecurityConfig.java             # OAuth2 Resource Server, CORS, routes publiques
│   ├── KeycloakJwtAuthConverter.java   # Extrait les rôles Keycloak du JWT RS256
│   └── SseTokenFilter.java            # Auth SSE via query param token
│
├── app/
│   ├── App.java                        # Entité JPA — table `apps`
│   ├── AppController.java              # GET/POST/PUT/DELETE /api/apps
│   ├── AppService.java                 # Logique deploy, update, delete, redeploy
│   ├── AppRepository.java              # JPA repository
│   ├── KnativeService.java             # Fabric8 — create/update/delete Knative Service
│   ├── KnativeServiceHelper.java       # Helpers manifest Knative
│   └── dto/
│       ├── AppRequest.java             # Body deploy/update
│       └── AppResponse.java            # Response DTO
│
├── auth/
│   ├── AuthController.java             # POST /api/auth/register + /login
│   ├── AuthService.java                # Appels Keycloak Admin API
│   └── dto/                            # LoginRequest, RegisterRequest, AuthResponse
│
├── eventing/
│   ├── EventController.java            # POST /api/events (publish CloudEvent)
│   ├── EventingController.java         # CRUD /api/eventing/sources + /triggers
│   ├── EventingService.java            # createKafkaSource, createTrigger, deleteByServiceName
│   ├── EventService.java               # publish() vers Knative Broker via WebClient
│   ├── KafkaSource.java                # Entité JPA — table `kafka_sources`
│   ├── KafkaSourceRepository.java
│   ├── Trigger.java                    # Entité JPA — table `triggers`
│   ├── TriggerRepository.java
│   └── dto/                            # KafkaSourceDto, TriggerDto
│
├── kafka/
│   ├── KafkaController.java            # CRUD /api/kafka/topics
│   ├── KafkaService.java               # Admin Kafka API (Strimzi)
│   ├── KafkaTopic.java                 # Entité JPA
│   ├── KafkaTopicRepository.java
│   └── dto/CreateTopicRequest.java
│
├── logs/
│   ├── DeploymentLog.java              # Entité JPA — table `deployment_logs`
│   ├── DeploymentLogRepository.java
│   ├── LogController.java              # GET /api/logs/apps/{id} + SSE stream
│   ├── LogService.java
│   ├── LogSseService.java              # SSE broadcaster (Server-Sent Events)
│   └── dto/LogDto.java
│
├── metrics/
│   ├── Metric.java                     # Entité
│   ├── MetricRepository.java
│   └── dto/MetricDto.java
│
├── admin/
│   └── AdminController.java            # /api/admin/** — stats, apps, topics, cluster
│
├── user/
│   └── UserRepository.java
│
├── exception/
│   ├── GlobalExceptionHandler.java     # @ControllerAdvice
│   ├── NotFoundException.java
│   ├── UnauthorizedException.java
│   └── ConflictException.java
│
└── config/
    ├── KubernetesConfig.java           # Fabric8 KubernetesClient bean
    ├── OpenApiConfig.java              # Swagger / OpenAPI 3
    └── WebSocketConfig.java
```

### Endpoints API principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Login → token JWT |
| GET | `/api/apps` | Lister mes apps |
| POST | `/api/apps` | Déployer une app |
| GET | `/api/apps/{id}` | Détails app |
| PUT | `/api/apps/{id}` | Modifier + redéployer |
| POST | `/api/apps/{id}/deploy` | Redéployer |
| DELETE | `/api/apps/{id}` | Supprimer app |
| GET | `/api/kafka/topics` | Lister topics |
| POST | `/api/kafka/topics` | Créer topic |
| DELETE | `/api/kafka/topics/{id}` | Supprimer topic |
| GET | `/api/eventing/sources` | Lister KafkaSources |
| GET | `/api/eventing/triggers` | Lister Triggers |
| POST | `/api/events` | Publier CloudEvent |
| GET | `/api/logs/apps/{id}` | Logs d'une app |
| GET | `/api/logs/apps/{id}/stream` | SSE logs temps réel |
| GET | `/api/admin/stats` | Stats globales |
| GET | `/api/admin/cluster/overview` | État complet cluster |
| GET | `/api/admin/cluster/pods` | Tous les pods |
| GET | `/api/admin/cluster/nodes` | Nodes K8s |
| GET | `/api/admin/cluster/knative/services` | Knative Services |
| GET | `/api/admin/cluster/kafka/brokers` | Kafka broker pods |
| DELETE | `/api/admin/apps/{id}` | Force-delete app |

---

## Structure Frontend

```
web-portal/src/
│
├── main.jsx                            # Entrée React + providers
├── App.jsx                             # Router, guards AdminRoute, DashboardRedirect
│
├── api/
│   ├── client.js                       # Axios instance + intercepteur token
│   └── index.js                        # authApi, appsApi, kafkaApi, eventingApi, adminApi...
│
├── auth/
│   └── keycloak.js                     # Config Keycloak JS adapter
│
├── context/
│   ├── AuthContext.jsx                 # user, token, login, logout, isAdmin
│   └── ThemeContext.jsx                # dark/light mode
│
├── components/
│   ├── Layout.jsx                      # Shell avec Sidebar
│   ├── Sidebar.jsx                     # Navigation (sections admin vs client)
│   ├── Card.jsx                        # Composant carte réutilisable
│   ├── Terminal.jsx                    # Affichage logs terminal
│   ├── Toast.jsx                       # Notifications
│   └── Logo.jsx
│
└── pages/
    ├── Login.jsx                       # Page connexion
    ├── Register.jsx                    # Page inscription
    │
    ├── Dashboard.jsx                   # Dashboard client — KPIs, sparklines, area chart
    ├── AppsList.jsx                    # Liste apps (client + admin avec tenant column)
    ├── AppDetails.jsx                  # Détail app — métriques, logs SSE, Edit modal, Delete
    ├── DeployApp.jsx                   # Formulaire deploy — 4 onglets (config, scaling, resources, kafka)
    │
    ├── KafkaTopics.jsx                 # CRUD topics Kafka
    ├── Eventing.jsx                    # Pipelines + Publish CloudEvent
    ├── LogsView.jsx                    # Logs globaux de l'utilisateur
    ├── Monitoring.jsx                  # Monitoring (client: simple | admin: complet cluster)
    │
    ├── Users.jsx                       # Gestion utilisateurs (admin)
    │
    └── admin/
        ├── AdminDashboard.jsx          # Dashboard admin — stats globales, nodes
        └── ClusterManagement.jsx       # Cluster K8s — namespaces, nodes, pods
```

### Routes frontend

| Route | Page | Accès |
|-------|------|-------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/dashboard` | Dashboard | Client |
| `/apps` | AppsList | Client + Admin |
| `/apps/new` | DeployApp | Client |
| `/apps/:id` | AppDetails | Client |
| `/kafka` | KafkaTopics | Client |
| `/eventing` | Eventing | Client |
| `/logs` | LogsView | Client |
| `/monitoring` | Monitoring | Admin (complet) + Client (simplifié) |
| `/admin/dashboard` | AdminDashboard | Admin |
| `/admin/cluster` | ClusterManagement | Admin |
| `/admin/users` | Users | Admin |

---

## CI/CD — Jenkins + Kaniko

```
ci-cd/
├── docker/
│   ├── backend-kaniko.Dockerfile      # Build image backend pour Kaniko
│   ├── frontend-kaniko.Dockerfile     # Build image frontend pour Kaniko
│   ├── backend.Dockerfile             # Build standard Docker
│   ├── frontend.Dockerfile            # Build standard Docker
│   └── jenkins.Dockerfile             # Image Jenkins custom avec kubectl + Kaniko
│
└── jenkins/pipelines/
    ├── Jenkinsfile.backend             # Pipeline backend : mvn build → kaniko push → kubectl rollout
    ├── Jenkinsfile.frontend            # Pipeline frontend : npm build → kaniko push → kubectl rollout
    └── Jenkinsfile.microservices       # Pipeline microservices custom
```

### Pipeline backend
```
Fix JNA tmp → Checkout → Build JAR (Maven) → Docker Build & Push (Kaniko) → kubectl rollout
```

### Pipeline frontend
```
Fix JNA tmp → Checkout → npm install + build → Docker Build & Push (Kaniko) → kubectl rollout
```

> **Note** : Kaniko build les images sans Docker daemon (requis dans Kubernetes). Le stage `Fix JNA tmp` nettoie les fichiers JNA corrompus par Kaniko avant chaque build Maven.

---

## Déploiement Kubernetes

| Service | Namespace | Type |
|---------|-----------|------|
| platform-api | platform | Deployment |
| platform-web | platform | Deployment |
| keycloak | keycloak | Deployment |
| postgresql | platform | StatefulSet |
| kafka (strimzi) | kafka | Kafka CR |
| jenkins | jenkins | Deployment |
| kourier | kourier-system | LoadBalancer (MetalLB) |
| knative-eventing | knative-eventing | System |

### Namespaces tenants
Chaque utilisateur deploie dans son propre namespace : `user-{userId}`

---

## Modèle de données

### Table `apps`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Clé primaire |
| name | String | Nom de l'app |
| user_id | String | ID Keycloak |
| image_name | String | Image Docker |
| image_tag | String | Tag image |
| service_name | String | Nom Knative Service |
| namespace | String | Namespace K8s |
| status | String | RUNNING / FAILED / DEPLOYING / SCALED TO ZERO |
| url | String | URL sslip.io générée |
| port | Integer | Port container |
| min_replicas | Integer | Scale to zero = 0 |
| max_replicas | Integer | |
| cpu_request | String | ex: 100m |
| memory_request | String | ex: 128Mi |

### Table `kafka_topics`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | |
| name | String | Nom du topic |
| user_id | String | Propriétaire |
| partitions | Integer | |
| replicas | Integer | |

### Table `kafka_sources`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | |
| name | String | ex: app-service-source |
| user_id | String | |
| kafka_topic_id | UUID | FK → kafka_topics |
| consumer_group | String | |
| bootstrap_servers | String | Adresse Kafka cluster |
| namespace | String | Namespace de l'app |

### Table `triggers`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | |
| name | String | ex: app-service-source-trigger |
| user_id | String | |
| kafka_source_id | UUID | FK → kafka_sources |
| subscriber_name | String | Nom du subscriber |
| filter | String | ex: order.created |
| filter_type | String | exact |
| action | String | URL de l'app |
| active | Boolean | |

### Table `deployment_logs`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | |
| app_id | UUID | |
| app_name | String | |
| user_id | String | |
| message | String | Message du log |
| type | String | DEPLOYMENT_START / SUCCESS / FAIL / KAFKA_WIRED / DELETE |
| created_at | Timestamp | |

---

## Flux de déploiement d'une app

```
1. Client remplit le formulaire DeployApp
2. POST /api/apps → AppController → AppService.createApp()
3. App sauvegardée en DB avec status=DEPLOYING
4. triggerDeployAsync() lancé en background (@Async)
5. KnativeService.deploy() → Fabric8 → créer Knative Service sur K8s
6. Knative démarre le pod → URL sslip.io générée
7. App status=RUNNING, URL sauvegardée en DB
8. Si kafkaEnabled=true :
   - EventingService.createKafkaSource() → sauvegarde DB + nom consumer group
   - EventingService.createTrigger() → sauvegarde DB + crée Knative Trigger sur cluster
9. Logs temps réel streamés via SSE tout au long du processus
```

---

## Points techniques importants

- **Scale to zero** : `minReplicas=0` → le pod s'arrête après inactivité (~90s), redémarre à la première requête (cold start ~2-3s)
- **Knative Trigger namespace** : le Broker est dans `default`, les Triggers doivent aussi être dans `default` même si le service est dans `user-xxx`
- **Immutable annotations** : lors d'un redéploiement, `serving.knative.dev/creator` est immuable → solution : delete + recreate
- **SSE Auth** : les EventSource navigateur ne supportent pas les headers → token passé en query param `?token=xxx` intercepté par `SseTokenFilter`
- **JWT RS256** : Keycloak signe en RS256, Spring valide via JWKS endpoint — pas de secret partagé
