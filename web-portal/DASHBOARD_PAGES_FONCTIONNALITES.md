# Documentation des fonctionnalités du Dashboard

## 1) Vue d'ensemble

Le front-end du portail est une application React (Vite) avec routage protégé.

- Les routes privées passent par `ProtectedRoute`.
- Le layout global (sidebar + header + contenu) est géré par `Layout`.
- L'authentification est actuellement simplifiée/mockée dans `AuthContext` (utilisateur admin injecté par défaut).

## 2) Cartographie des pages

### `/dashboard` - Vue système

**Objectif**
- Donner un aperçu rapide de la plateforme (services, topics Kafka, télémétrie).

**Fonctionnalités**
- Chargement parallèle des données:
  - Liste des applications (`appsApi.list`)
  - Liste des topics Kafka (`kafkaApi.list`)
  - Logs cluster (`logsApi.getByApp('cluster')`)
- Affichage de métriques clés:
  - Active Services
  - Healthy Pods
  - Data Pipelines
  - Throughput (valeur visuelle statique)
- Cartes d'applications cliquables vers le détail (`/apps/:name`)
- Panneau Kafka (topics + lag simulé)
- Panneau télémétrie logs avec couleurs par niveau
- Génération de logs simulés toutes les 3 secondes (mode démo)

**Composants principaux**
- `MetricCard` (interne à la page)
- `AppCard` (interne à la page)

---

### `/apps/new` - Déploiement d'application

**Objectif**
- Créer et déployer un service Knative depuis une image Docker.

**Fonctionnalités**
- Assistant multi-onglets:
  - Basic Config
  - Scale & Resources
  - Environment Variables
  - Kafka Trigger
- Validation minimale: nom d'app + image obligatoires
- Parsing image Docker (`name:tag`) avec tag `latest` par défaut
- Appel API de création (`appsApi.create`) avec payload de déploiement
- Notification succès/erreur via Toast
- Redirection vers la page détail après création
- Prévisualisation de déploiement (résumé dynamique)
- Prévisualisation YAML Knative + copie presse-papier

**Composants principaux**
- `SectionCard`, `Label`, `Input`, `SliderRow`, `PillSelector` (internes à la page)
- `ToastProvider` / `useToast`

**Remarques**
- Le bouton "Save as Draft" est visuel (pas de logique backend associée).
- La validation d'image "Validate" est locale (pas d'appel registre).

---

### `/apps/:name` - Détail d'une application

**Objectif**
- Afficher l'état complet d'un service déployé.

**Fonctionnalités**
- Chargement parallèle:
  - Détail app (`appsApi.get(name)`)
  - Logs app (`logsApi.getByApp(name)`)
  - Metrics app (`metricsApi.getApp(name)`)
- Affichage des attributs techniques (image, namespace, port, replicas, ressources, dates)
- Lien vers URL publique de l'app (si disponible)
- Bloc logs récents
- Bloc payload metrics (JSON brut)
- Gestion d'erreur avec message affiché

**Composants principaux**
- Cartes de détail et panneaux logs/metrics (markup local)

**Remarques**
- Les boutons "Update Image" et "Delete App" sont désactivés (fonctionnalité non active côté UI).

---

### `/kafka` - Gestion des topics Kafka

**Objectif**
- Visualiser, créer et supprimer des topics.

**Fonctionnalités**
- Chargement de la liste (`kafkaApi.list`)
- Création topic (`kafkaApi.create`) avec:
  - name
  - partitions
  - replicationFactor
  - config (`retention.ms`, `cleanup.policy`)
- Suppression topic (`kafkaApi.delete`) avec confirmation
- Rafraîchissement automatique de la table après action
- Gestion d'erreurs d'API

**Composants principaux**
- Formulaire de création + table de topics (markup local)

---

### `/eventing` - Publication d'événements

**Objectif**
- Publier des événements (type CloudEvent) vers le backend.

**Fonctionnalités**
- Formulaire d'envoi:
  - type d'événement
  - appId (optionnel)
  - payload JSON
- Parsing JSON côté client avant envoi
- Publication via `eventApi.publish`
- Message de succès/erreur
- Historique local des derniers événements publiés (max 8)

**Composants principaux**
- Formulaire + panneau historique (markup local)

---

### `/logs` - Observabilité / Logs

**Objectif**
- Explorer les logs utilisateur avec filtres.

**Fonctionnalités**
- Chargement logs utilisateur (`logsApi.getByUser`)
- Filtres:
  - Application
  - Niveau (INFO/WARN/ERROR/FAILED)
  - Recherche texte
- Options d'affichage:
  - Word wrap on/off
  - Auto-scroll on/off
- Export des logs filtrés en fichier `.txt`
- Interface type terminal avec compteur de lignes

**Composants principaux**
- Sidebar de filtres + viewer logs (markup local)

---

### `/monitoring` - Monitoring cluster

**Objectif**
- Visualiser l'état global du cluster et des apps.

**Fonctionnalités**
- Chargement parallèle:
  - Applications (`appsApi.list`)
  - Metrics cluster (`metricsApi.getCluster`)
- Cartes KPI:
  - Total Apps
  - Running
  - Scale-to-zero
  - Cluster Metrics
- Affichage JSON du payload metrics cluster
- Table statut des applications (status, namespace, updated)
- Gestion d'erreur API

**Composants principaux**
- `MetricCard` (interne à la page)
- Table statut (markup local)

---

### `/login` - Authentification

**Objectif**
- Ouvrir une session utilisateur.

**Fonctionnalités**
- Formulaire username/password
- Affichage/masquage du mot de passe
- Appel `login` via `AuthContext`
- Fallback démo: `admin/admin` stocke un token fake puis redirige
- Lien vers inscription

**Composants principaux**
- `Logo`

---

### `/register` - Création de compte

**Objectif**
- Créer un nouvel utilisateur.

**Fonctionnalités**
- Formulaire username/email/password/confirm
- Validation mot de passe = confirmation
- Appel `register` via `AuthContext`
- Redirection dashboard après succès
- Affichage erreurs backend

**Composants principaux**
- `Logo`

## 3) Composants transverses

### `Layout`
- Structure principale des pages privées:
  - Sidebar à gauche
  - Header top (titre dynamique + greeting + avatar)
  - Zone de contenu (`Outlet`)
- Calcule le titre selon la route active (incluant route détail app)

### `Sidebar`
- Navigation principale vers les modules
- Bloc management (settings/users)
- Affichage infos utilisateur
- Déconnexion (`logout` + redirection login)

### `Toast`
- Système global de notifications (success/error/warning/info)
- Disparition auto (sauf erreurs)
- API simple via hook `useToast`

### `Terminal`
- Viewer de logs générique avec auto-scroll
- Coloration des niveaux de logs
- Composant présent mais non branché directement dans les pages actuelles de logs (qui ont leur propre viewer)

### `Logo` / `Card`
- `Logo`: identité visuelle NextStep
- `Card`: wrapper visuel réutilisable (peu utilisé dans les pages actuelles)

## 4) Routes avec redirection (fonctionnalité non exposée)

Ces routes existent mais redirigent vers `/dashboard`:
- `/apps`
- `/settings`
- `/users`

## 5) APIs front consommées

- `authApi`: login/register/me
- `appsApi`: create/list/get/deploy/delete
- `metricsApi`: app/cluster
- `logsApi`: by app / by user
- `kafkaApi`: list/create/get/delete
- `eventApi`: publish

## 6) État actuel important

- Le contexte d'authentification est en mode simplifié (user admin local par défaut).
- Plusieurs écrans sont pleinement connectés backend (dashboard, app details, kafka, monitoring, logs).
- Certaines actions restent UI-only ou incomplètes (save draft, update/delete app dans le détail).
