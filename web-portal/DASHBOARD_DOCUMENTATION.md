# NEXTSTEP — Serverless OS : Documentation du Dashboard

## Vue d'ensemble

**NEXTSTEP** est une plateforme de déploiement serverless basée sur Kubernetes/Knative.
Le dashboard est une interface web (React + Vite) qui permet de gérer des applications conteneurisées
déployées dans un cluster Knative, avec gestion des namespaces par client, des topics Kafka,
des logs et des métriques en temps réel.

---

## Structure de navigation (Sidebar)

La barre latérale gauche est divisée en deux sections :

### CORE SYSTEMS
| Lien | Page | Description |
|------|------|-------------|
| Services | `/apps` | Liste de toutes les apps déployées |
| Pipelines | `/kafka` | Gestion des topics Kafka |
| Automations | `/eventing` | Envoi d'événements vers le cluster |
| Observability | `/logs` | Visualisation des logs de déploiement |
| Realtime Monitor | `/monitoring` | Métriques en temps réel |

### MANAGEMENT
| Lien | Page | Visible par |
|------|------|------------|
| Access Control | `/users` | ADMIN uniquement |
| Platform Settings | `/settings` | Tous les utilisateurs |

En bas de la sidebar :
- **Avatar** avec initiales de l'email + rôle de l'utilisateur
- **Terminate Session** : bouton de déconnexion (appelle Keycloak logout + vide le localStorage)

---

## Pages détaillées

---

### 1. Dashboard (`/dashboard`)

**Page d'accueil après connexion.**

#### Métriques en haut (4 cartes)
| Carte | Valeur affichée | Source |
|-------|----------------|--------|
| Active Services | Nombre total d'apps de l'utilisateur | `GET /api/apps` |
| Healthy Pods | Nombre d'apps avec status `RUNNING` | Filtré côté frontend |
| Data Pipelines | Nombre de topics Kafka | `GET /api/kafka/topics` |
| Throughput | `1.2M msg/s` (valeur statique) | Hardcodé |

#### Section "Critical Infrastructure"
- Affiche les **6 premières apps** de l'utilisateur sous forme de cartes cliquables
- Chaque carte montre : nom du service, image Docker, status, URL, heure de déploiement
- Clic sur une carte → navigue vers `/apps/{id}`
- Si aucune app → affiche un message + bouton "Initialize First Service"

#### Section "Message Queues"
- Liste des topics Kafka avec le nombre de partitions
- Lag affiché (valeur aléatoire, pas encore connectée à Kafka réel)
- Bouton "View All" → navigue vers `/kafka`

#### Section "Cluster Telemetry"
- Terminal en temps réel affichant les logs du cluster
- Les logs réels viennent de `GET /api/logs/apps/cluster`
- Un nouvel événement simulé est ajouté **toutes les 3 secondes** (pour l'effet temps réel)
- Couleurs des logs : INFO (cyan), SUCCESS (vert), WARNING (orange), ERROR (rouge)

---

### 2. Services / Apps List (`/apps`)

**Liste complète de toutes les applications de l'utilisateur.**

#### Barre de filtres
- **Recherche** : filtre par nom de service ou image Docker (recherche en temps réel côté frontend)
- **Filtre status** : All Status / Running / Scaling / Failed
- **Bouton Deploy Service** → navigue vers `/apps/new`

#### Tableau des services
Colonnes :
| Colonne | Contenu |
|---------|---------|
| Service Name | Nom + namespace + ID court (8 premiers chars de l'UUID) |
| Replicas | `min / max` avec une barre de progression |
| Resources | CPU Request + Memory Request |
| Status | Badge coloré (RUNNING=bleu, SCALING=orange, FAILED=rouge) |
| Actions | Apparaissent au hover : Logs, Edit, Stop |

Actions disponibles au survol d'une ligne :
- **Logs** → navigue vers `/apps/{id}`
- **Edit** → navigue vers `/apps/{id}`
- **Stop** → bouton présent mais sans action implémentée

#### Pagination
- Affiche le nombre de services filtrés vs total
- Pagination statique (boutons 1, 2 présents mais non fonctionnels)

---

### 3. Deploy App (`/apps/new`)

**Formulaire de déploiement d'une nouvelle application.**

Le formulaire est divisé en **4 onglets** :

#### Onglet 1 — Basic Config
| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| App Name | Oui | Nom de l'application |
| Namespace | Non | Namespace Kubernetes (défaut: `default`) |
| Docker Image | Oui | Image Docker (ex: `nginx:latest`) |
| Container Port | Oui | Port exposé par le conteneur (défaut: 8080) |
| Description | Non | Description libre |

- Bouton **Validate** : valide localement que le champ image n'est pas vide
- Aperçu URL générée automatiquement sous le champ App Name

#### Onglet 2 — Scale & Resources
| Champ | Description |
|-------|-------------|
| Min Replicas | Slider 0–5. `0` = scale-to-zero activé |
| Max Replicas | Slider 1–20. Maximum d'instances en cas de pic |
| CPU Request | CPU minimum garanti (ex: `100m`) |
| CPU Limit | CPU maximum autorisé (ex: `500m`) |
| Memory Request | RAM minimum garantie (ex: `128Mi`) |
| Memory Limit | RAM maximum autorisée (ex: `512Mi`) |

#### Onglet 3 — Environment Variables
- Tableau de variables d'environnement clé/valeur
- Option **Secret** : masque la valeur comme mot de passe
- Bouton **Add Variable** pour ajouter une ligne
- Bouton de suppression par ligne

#### Onglet 4 — Kafka Trigger
- Toggle ON/OFF pour activer le déclenchement Kafka
- Si activé :
  - **Kafka Topic** : sélection parmi les topics disponibles
  - **Consumer Group** : groupe de consommation
  - **Filter Type** : exact / prefix / suffix / none
- Message d'information sur le fonctionnement scale-to-zero avec Kafka

#### Panneau de droite — Deployment Preview
- Aperçu en temps réel de la configuration saisie
- Affiche : nom, namespace, image, port, replicas, CPU, mémoire, env vars count
- **YAML Preview** : accordéon qui affiche le manifest Knative généré
- Bouton copier le YAML dans le presse-papier

#### Navigation entre onglets
- Bouton **Back / Cancel** en bas à gauche
- Bouton **Next** ou **Deploy to Cluster** en bas à droite
- Bouton **Save as Draft** (présent mais non fonctionnel)

**Au clic sur "Deploy to Cluster"** :
1. Validation : App Name et Docker Image obligatoires
2. Appel `POST /api/apps` avec toutes les données du formulaire
3. Toast de succès → redirection vers `/apps/{id}` après 1 seconde
4. Toast d'erreur si le backend retourne une erreur

---

### 4. App Details (`/apps/:id`)

**Détail d'une application spécifique.**

#### En-tête
- Nom de l'app + badge status (RUNNING / FAILED / LOADING)
- URL du service (lien cliquable si disponible)
- Image Docker + namespace + nom du service Knative
- Boutons : **Update Image** et **Delete App** (présents mais désactivés)

#### Grille de détails (10 cartes)
| Carte | Valeur |
|-------|--------|
| Docker Image | imageName:imageTag |
| Namespace | Namespace Kubernetes |
| Status | RUNNING / FAILED / DEPLOYING |
| Port | Port du conteneur |
| Min Replicas | Minimum d'instances |
| Max Replicas | Maximum d'instances |
| CPU Request | CPU alloué |
| Memory Request | RAM allouée |
| Deployed At | Date/heure du premier déploiement |
| Updated At | Date/heure de la dernière mise à jour |

#### Section inférieure (2 panneaux côte à côte)

**Recent Logs** (gauche)
- Logs de déploiement triés par date décroissante
- Colonnes : timestamp, type (INFO/ERROR/WARN), message
- Scrollable (max 320px de hauteur)
- Source : `GET /api/logs/apps/{id}`

**Metrics Payload** (droite)
- JSON brut retourné par Prometheus via le backend
- Contient : cpu, memory, requests, latencyP95, errorRate
- Affiché dans un bloc `<pre>` scrollable
- Source : `GET /api/metrics/apps/{id}`

---

### 5. Kafka Topics (`/kafka`)

**Gestion des topics Kafka du cluster.**

#### Cartes de métriques (en haut)
- Total Topics
- Throughput total
- Consommateurs actifs
- Lag moyen

#### Liste des topics
- Chaque topic affiché avec :
  - Nom du topic
  - Nombre de partitions
  - Facteur de réplication
  - Sparkline (mini graphe d'activité généré dynamiquement)
  - Statut (ACTIVE / INACTIVE)
- Bouton de suppression par topic

#### Formulaire de création
- Nom du topic
- Nombre de partitions
- Facteur de réplication
- Bouton **Create Topic** → `POST /api/kafka/topics`

---

### 6. Automations / Eventing (`/eventing`)

**Envoi manuel d'événements vers le cluster.**

#### Formulaire d'événement
| Champ | Description |
|-------|-------------|
| Event Type | Type d'événement (ex: `PLATFORM_EVENT`) |
| Target App ID | UUID de l'application cible |
| Event Data | Corps JSON de l'événement (éditeur textarea) |

- Bouton **Send Event** → `POST /api/events`
- Toast de succès ou erreur après envoi

---

### 7. Observability / Logs (`/logs`)

**Visualisation de tous les logs de déploiement de l'utilisateur.**

#### Barre d'outils
| Outil | Fonction |
|-------|---------|
| Filtre App | Filtrer par application spécifique |
| INFO / WARN / ERROR / FAILED | Activer/désactiver les niveaux de logs |
| Recherche | Filtrer par contenu du message |
| Word Wrap | Activer/désactiver le retour à la ligne |
| Auto Scroll | Scroll automatique vers les derniers logs |
| Font Size | Augmenter/diminuer la taille du texte (`+` / `−`) |
| Refresh | Recharger les logs depuis le serveur |
| Download | Télécharger les logs en fichier texte |

#### Zone de logs (style terminal)
- Fond noir, police monospace
- Format : `timestamp | TYPE | message`
- Couleurs : ERROR=rouge, WARN=orange, INFO/autres=bleu
- Auto-scroll vers le bas si activé
- Source : `GET /api/logs/users/{userId}`

---

### 8. Realtime Monitor (`/monitoring`)

**Vue globale des métriques du cluster.**

#### KPI Cards (en haut)
| Carte | Contenu |
|-------|---------|
| Total Services | Nombre d'apps déployées |
| Running | Nombre d'apps avec status RUNNING |
| Failed | Nombre d'apps avec status FAILED |
| Avg CPU | CPU request moyen (calculé depuis les apps) |

#### Graphe de trafic
- Graphe à barres statique simulant l'activité réseau
- 20 barres avec hauteurs variables

#### Liste des services
- Tableau avec : nom, status, CPU, mémoire, namespace
- Clic sur une ligne → navigue vers `/apps/{id}`
- Source : `GET /api/apps` + `GET /api/metrics/cluster`

---

## Authentification

### Flux de connexion
1. L'utilisateur saisit username + password sur `/login`
2. Le frontend appelle directement **Keycloak** : `POST /realms/platform/protocol/openid-connect/token`
3. Keycloak retourne un `access_token` (JWT RS256) et un `refresh_token`
4. Les tokens sont stockés dans `localStorage`
5. Un refresh automatique tourne toutes les **55 secondes**
6. Au rechargement de page, un refresh immédiat est effectué si un `refreshToken` existe

### Protection des routes
- `ProtectedRoute` : redirige vers `/login` si l'utilisateur n'est pas connecté
- `PublicRoute` : redirige vers `/dashboard` si l'utilisateur est déjà connecté
- Le rôle `ADMIN` débloque la section "Access Control" dans la sidebar

### Envoi du token
- Toutes les requêtes API passent par `axios` avec un intercepteur global
- L'intercepteur ajoute automatiquement `Authorization: Bearer <token>` à chaque requête
- Si une réponse retourne `401` → déconnexion automatique

---

## Backend connecté

| Endpoint frontend | Appel backend |
|-------------------|--------------|
| Liste des apps | `GET /api/apps` |
| Détail d'une app | `GET /api/apps/{id}` |
| Déployer une app | `POST /api/apps` |
| Re-déployer | `POST /api/apps/{id}/deploy` |
| Supprimer | `DELETE /api/apps/{id}` |
| Topics Kafka | `GET /api/kafka/topics` |
| Créer topic | `POST /api/kafka/topics` |
| Logs par app | `GET /api/logs/apps/{appId}` |
| Logs par user | `GET /api/logs/users/{userId}` |
| Métriques app | `GET /api/metrics/apps/{appId}` |
| Métriques cluster | `GET /api/metrics/cluster` |
| Envoyer événement | `POST /api/events` |
