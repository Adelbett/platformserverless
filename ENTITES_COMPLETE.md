# 📊 Entités et Données - Backend Platform Serverless

Document complet de toutes les entités JPA avec leurs attributs et données.

---

## 📋 Table des Matières

1. [Entités principales](#entités-principales)
2. [Énumérations](#énumérations)
3. [Relations entre entités](#relations-entre-entités)
4. [Résumé des bases de données](#résumé-des-bases-de-données)

---

## Entités Principales

### 1️⃣ **User** (Utilisateur)

**Table:** `users`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `username` | String | UNIQUE, NOT NULL | Nom d'utilisateur unique |
| `email` | String | UNIQUE, NOT NULL | Email unique |
| `passwordHash` | String | NOT NULL | Hash du mot de passe |
| `role` | ENUM | NOT NULL | Rôle utilisateur (ADMIN, CLIENT_ADMIN, DEVELOPER, VIEWER, BILLING_MANAGER) |
| `ownerId` | UUID | FK (nullable) | Propriétaire (pour les membres d'équipe) |
| `suspended` | boolean | DEFAULT: false | Compte suspendu |
| `createdAt` | LocalDateTime | NOT NULL | Date de création |

**Rôles disponibles:**
- `ADMIN` → Administrateur système (accès total)
- `CLIENT_ADMIN` → Admin client (peut créer des membres d'équipe)
- `DEVELOPER` → Développeur (peut déployer des apps)
- `VIEWER` → Lecteur (lecture seule)
- `BILLING_MANAGER` → Gestionnaire de facturation

---

### 2️⃣ **App** (Application Déployée)

**Table:** `apps`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `name` | String | NOT NULL | Nom de l'application |
| `userId` | UUID | FK → User | Propriétaire de l'app |
| `imageName` | String | NOT NULL | Nom de l'image Docker (ex: `myapp`) |
| `imageTag` | String | DEFAULT: "latest" | Tag de l'image (ex: `v1.0.0`) |
| `url` | String | Nullable | URL de l'app déployée |
| `status` | String | DEFAULT: "PENDING" | État de déploiement |
| `serviceName` | String | Nullable | Nom du service Knative |
| `namespace` | String | DEFAULT: "default" | Namespace Kubernetes |
| `description` | String | Nullable | Description |
| `port` | Integer | DEFAULT: 8080 | Port de l'application |
| `minReplicas` | Integer | DEFAULT: 0 | Réplicas minimum |
| `maxReplicas` | Integer | DEFAULT: 10 | Réplicas maximum |
| `cpuRequest` | String | DEFAULT: "100m" | Ressource CPU demandée |
| `memoryRequest` | String | DEFAULT: "128Mi" | Mémoire demandée |
| `deployedAt` | LocalDateTime | Nullable | Date de déploiement |
| `updatedAt` | LocalDateTime | Nullable | Dernière mise à jour |

**États de déploiement (status):**
- `PENDING` → En attente
- `DEPLOYING` → En cours de déploiement
- `RUNNING` → En cours d'exécution
- `IDLE` → Inactif (scale-to-zero)
- `FAILED` → Erreur de déploiement
- `DELETED` → Supprimé (archivé)

---

### 3️⃣ **KafkaTopic** (Topic Kafka)

**Table:** `kafka_topics`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `name` | String | UNIQUE, NOT NULL | Nom du topic (ex: `orders`, `users`) |
| `partitions` | Integer | DEFAULT: 3 | Nombre de partitions |
| `replicas` | Integer | DEFAULT: 1 | Facteur de réplication |
| `config` | TEXT (JSON) | Nullable | Configuration JSON supplémentaire |
| `userId` | UUID | FK → User | Propriétaire du topic |
| `createdAt` | LocalDateTime | NOT NULL | Date de création |
| `updatedAt` | LocalDateTime | Nullable | Dernière mise à jour |

**Exemple de config:**
```json
{
  "retention.ms": 604800000,
  "compression.type": "snappy"
}
```

---

### 4️⃣ **KafkaSource** (Source d'événements Kafka)

**Table:** `kafka_sources`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `name` | String | NOT NULL | Nom de la source (ex: `order-source`) |
| `userId` | UUID | FK → User | Propriétaire |
| `kafkaTopicId` | UUID | FK → KafkaTopic | Topic Kafka source |
| `consumerGroup` | String | NOT NULL | Groupe de consommation |
| `bootstrapServers` | String | NOT NULL | Serveurs Kafka (ex: `kafka:9092`) |
| `namespace` | String | DEFAULT: "default" | Namespace Knative |
| `ready` | Boolean | DEFAULT: false | Source prête |
| `config` | TEXT (JSON) | Nullable | Configuration supplémentaire |
| `createdAt` | LocalDateTime | NOT NULL | Date de création |
| `updatedAt` | LocalDateTime | Nullable | Dernière mise à jour |

---

### 5️⃣ **Trigger** (Déclencheur Knative)

**Table:** `triggers`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `name` | String | NOT NULL | Nom du trigger |
| `userId` | UUID | FK → User | Propriétaire |
| `kafkaSourceId` | UUID | FK → KafkaSource | Source Kafka déclencheur |
| `subscriberName` | String | NOT NULL | Nom du subscriber (base URL) |
| `brokerName` | String | DEFAULT: "default" | Broker Knative |
| `filterType` | String | Nullable | Type de filtre |
| `filter` | String | Nullable | Filtre d'événement (ex: `order.created`) |
| `action` | String | NOT NULL | URL d'action cible |
| `ready` | Boolean | DEFAULT: false | Trigger prêt |
| `active` | Boolean | DEFAULT: true | Trigger actif |
| `createdAt` | LocalDateTime | NOT NULL | Date de création |
| `updatedAt` | LocalDateTime | Nullable | Dernière mise à jour |

---

### 6️⃣ **Metric** (Métriques de Performance)

**Table:** `metrics`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `appId` | UUID | FK → App | Application |
| `userId` | UUID | FK → User | Utilisateur |
| `cpu` | Double | Nullable | Utilisation CPU (cores) |
| `memory` | Double | Nullable | Utilisation mémoire (GiB) |
| `requests` | Double | Nullable | Requêtes par seconde |
| `latencyP95` | Double | Nullable | Latence P95 (ms) |
| `errorRate` | Double | Nullable | Taux d'erreur (%) |
| `timestamp` | LocalDateTime | NOT NULL | Horodatage de la métrique |

**Source des données:** Prometheus (via PromQL)

---

### 7️⃣ **BillingSnapshot** (Snapshot de Facturation)

**Table:** `billing_snapshots`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `userId` | UUID | FK → User | Utilisateur facturé |
| `appId` | UUID | FK → App | Application |
| `serviceName` | String | NOT NULL | Nom du service |
| `namespace` | String | NOT NULL | Namespace Kubernetes |
| `cpuVcpu` | Double | NOT NULL | Ressource CPU (vCPU) |
| `memoryGb` | Double | NOT NULL | Mémoire (GB) |
| `replicas` | Integer | NOT NULL | Nombre de réplicas |
| `uptimeFactor` | Double | DEFAULT: 1.0 | Facteur de disponibilité (1.0=running, 0.2=idle, 0.0=failed) |
| `cpuCost` | Double | NOT NULL | Coût CPU horaire |
| `memoryCost` | Double | NOT NULL | Coût mémoire horaire |
| `totalCost` | Double | NOT NULL | Coût total horaire |
| `snapshotTime` | LocalDateTime | NOT NULL | Heure du snapshot (horaire) |

**Index:**
- `idx_billing_user_time` (userId, snapshotTime)
- `idx_billing_time` (snapshotTime)

**Formules de coût:**
- CPU/h = 0.048 $/vCPU
- Mémoire/h = 0.006 $/GB
- Mois = 720 heures

---

### 8️⃣ **DeploymentLog** (Logs de Déploiement)

**Table:** `deployment_logs`

| Champ | Type | Contrainte | Description |
|-------|------|-----------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `appId` | UUID | FK → App | Application |
| `appName` | String | NOT NULL | Nom de l'application (snapshot) |
| `userId` | UUID | FK → User | Utilisateur |
| `message` | TEXT | NOT NULL | Message de log |
| `type` | String | NOT NULL | Type de log |
| `createdAt` | LocalDateTime | NOT NULL | Date de création |

**Types de log:**
- `INFO` → Information générale
- `DEPLOYMENT_START` → Déploiement lancé
- `DEPLOYMENT_SUCCESS` → Déploiement réussi
- `DEPLOYMENT_FAIL` → Erreur de déploiement
- `KAFKA_WIRED` → Intégration Kafka ajoutée
- `UPDATE` → Mise à jour d'app
- `DELETE` → Suppression d'app

---

## Énumérations

### **UserRole** (Rôles d'utilisateur)

```java
enum UserRole {
  ADMIN,           // Accès système complet
  CLIENT_ADMIN,    // Gestionnaire de compte client
  DEVELOPER,       // Peut déployer des applications
  VIEWER,          // Accès lecture seule
  BILLING_MANAGER  // Gère la facturation
}
```

---

## Relations entre Entités

### Diagramme de Relations

```
User (1) ──owns──────→ (0..*) App
User (1) ──owns──────→ (0..*) KafkaTopic
User (1) ──owns──────→ (0..*) KafkaSource
User (1) ──owns──────→ (0..*) Trigger
User (1) ──generates──→ (0..*) Metric
User (1) ──billed for──→ (0..*) BillingSnapshot
User (1) ──creates──→ (0..*) DeploymentLog

App (1) ──generates──→ (0..*) Metric
App (1) ──tracked by──→ (0..*) BillingSnapshot
App (1) ──has logs──→ (0..*) DeploymentLog

KafkaTopic (1) ──produces──→ (0..*) KafkaSource
KafkaSource (1) ──drives──→ (0..*) Trigger
```

### Descriptions des Relations

| De | Vers | Cardinalité | Description |
|----|------|-----------|-------------|
| User | App | 1:M | Un utilisateur peut avoir plusieurs applications |
| User | KafkaTopic | 1:M | Un utilisateur peut créer plusieurs topics |
| User | KafkaSource | 1:M | Un utilisateur peut avoir plusieurs sources |
| User | Trigger | 1:M | Un utilisateur peut créer plusieurs triggers |
| User | Metric | 1:M | Métriques générées par les apps d'un user |
| User | BillingSnapshot | 1:M | Snapshots de facturation par user |
| User | DeploymentLog | 1:M | Logs de déploiement par user |
| App | Metric | 1:M | Une app génère plusieurs métriques |
| App | BillingSnapshot | 1:M | Une app a plusieurs snapshots de coûts |
| App | DeploymentLog | 1:M | Une app a plusieurs logs |
| KafkaTopic | KafkaSource | 1:M | Un topic peut avoir plusieurs sources |
| KafkaSource | Trigger | 1:M | Une source peut avoir plusieurs triggers |

---

## Résumé des Bases de Données

### Statistiques

| Entité | Table | Enregistrements (Approx.) | Clés Primaires | Clés Étrangères |
|--------|-------|--------------------------|-----------------|-----------------|
| User | users | < 1000 | 1 (id) | 1 (ownerId) |
| App | apps | < 10K | 1 (id) | 1 (userId) |
| KafkaTopic | kafka_topics | < 1K | 1 (id) | 1 (userId) |
| KafkaSource | kafka_sources | < 5K | 1 (id) | 2 (userId, kafkaTopicId) |
| Trigger | triggers | < 10K | 1 (id) | 2 (userId, kafkaSourceId) |
| Metric | metrics | > 1M | 1 (id) | 2 (appId, userId) |
| BillingSnapshot | billing_snapshots | > 500K | 1 (id) | 2 (userId, appId) |
| DeploymentLog | deployment_logs | > 100K | 1 (id) | 2 (appId, userId) |

---

## Index Importants

```sql
-- Billing
CREATE INDEX idx_billing_user_time ON billing_snapshots(user_id, snapshot_time);
CREATE INDEX idx_billing_time ON billing_snapshots(snapshot_time);

-- User
CREATE UNIQUE INDEX idx_user_username ON users(username);
CREATE UNIQUE INDEX idx_user_email ON users(email);

-- KafkaTopic
CREATE UNIQUE INDEX idx_kafka_topic_name ON kafka_topics(name);

-- Queries rapides
CREATE INDEX idx_app_user ON apps(user_id);
CREATE INDEX idx_metric_app ON metrics(app_id);
CREATE INDEX idx_deploylog_app ON deployment_logs(app_id);
CREATE INDEX idx_source_topic ON kafka_sources(kafka_topic_id);
CREATE INDEX idx_trigger_source ON triggers(kafka_source_id);
```

---

## Contraintes et Validations

### User
- ✅ `username` unique et NOT NULL
- ✅ `email` unique et NOT NULL
- ✅ `passwordHash` obligatoire
- ✅ `role` dans {ADMIN, CLIENT_ADMIN, DEVELOPER, VIEWER, BILLING_MANAGER}

### App
- ✅ `userId` référence User (FK)
- ✅ `imageName` obligatoire
- ✅ `status` dans {PENDING, DEPLOYING, RUNNING, IDLE, FAILED, DELETED}
- ✅ Port entre 1 et 65535
- ✅ minReplicas ≤ maxReplicas

### KafkaTopic
- ✅ `name` unique
- ✅ `userId` référence User
- ✅ Partitions ≥ 1

### KafkaSource
- ✅ `kafkaTopicId` référence KafkaTopic
- ✅ `userId` référence User
- ✅ `bootstrapServers` obligatoire

### Trigger
- ✅ `kafkaSourceId` référence KafkaSource
- ✅ `userId` référence User
- ✅ `action` URL valide

### Metric
- ✅ `appId` référence App
- ✅ `userId` référence User
- ✅ Valeurs numériques ≥ 0

### BillingSnapshot
- ✅ `userId` et `appId` référencent User et App
- ✅ `snapshotTime` unique par app
- ✅ Coûts ≥ 0
- ✅ uptimeFactor dans [0.0, 1.0]

### DeploymentLog
- ✅ `appId` référence App
- ✅ `userId` référence User
- ✅ `type` dans {INFO, DEPLOYMENT_START, DEPLOYMENT_SUCCESS, DEPLOYMENT_FAIL, KAFKA_WIRED, UPDATE, DELETE}

---

## Cycle de Vie des Données

### Création d'une Application
1. User crée App → App créée avec status=PENDING
2. AppService déclenche déploiement → status=DEPLOYING
3. Knative déploie → status=RUNNING (ou FAILED)
4. DeploymentLog enregistre l'événement
5. BillingSnapshot commence à enregistrer les coûts horaires

### Intégration Kafka
1. User crée KafkaTopic
2. User crée KafkaSource pour ce topic
3. User crée Trigger pour cette source
4. DeploymentLog enregistre "KAFKA_WIRED"

### Facturation
1. BillingScheduler exécute toutes les heures
2. Crée BillingSnapshot pour chaque App active
3. Calcule coûts = (CPU + Mémoire) × uptimeFactor
4. Archivé pour reporting

### Suppression d'une Application
1. User supprime App
2. status change à DELETED (soft delete)
3. K8s service est supprimé
4. BillingSnapshot arrête de se créer
5. DeploymentLog enregistre "DELETE"

---

## Notes Importantes

- 🔐 **Multi-tenant:** `ownerId` pour les équipes d'un CLIENT_ADMIN
- 🔄 **Soft delete:** Apps marquées DELETED au lieu d'être supprimées
- 📊 **Métriques en temps réel:** Poussées par Prometheus
- 💰 **Facturation horaire:** BillingSnapshot créé chaque heure
- 🚀 **Knative serverless:** Apps scale-to-zero quand idle
- 📝 **Logs en temps réel:** Server-Sent Events (SSE) pour les déploiements
- 🔗 **Événementiel:** KafkaTopic → KafkaSource → Trigger → App

---

*Document généré le 2026-06-12 - Backend Platform Serverless v1.0*
