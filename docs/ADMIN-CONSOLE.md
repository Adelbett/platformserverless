# Admin Console — Fonctionnalités & Données

Documentation de l'application `admin-console/` — l'interface d'administration séparée du portail
client (`web-portal/`), réservée aux utilisateurs avec le rôle `ADMIN`.

- **Accès** : `http://10.9.21.224:30081` (NodePort, réseau du cluster uniquement — pas d'IP publique)
- **Backend** : `backend-api` (Spring Boot), toutes les routes sous `/api/admin/**` protégées par `hasRole('ADMIN')`
- **Authentification** : Keycloak (même client OIDC que `web-portal`, realm `platform`)

---

## Sommaire des pages

| Page | Route | Fichier |
|---|---|---|
| Login | `/login` | `src/pages/Login.jsx` |
| Overview | `/dashboard` | `src/pages/admin/AdminDashboard.jsx` |
| Cluster | `/cluster` | `src/pages/admin/ClusterManagement.jsx` |
| Clients | `/clients` | `src/pages/admin/AdminClients.jsx` |
| Revenue | `/billing` | `src/pages/admin/AdminBilling.jsx` |
| Audit Log | `/audit-log` | `src/pages/admin/AdminAuditLog.jsx` |
| Incidents | `/incidents` | `src/pages/admin/AdminIncidents.jsx` |
| Anomalies | `/anomalies` | `src/pages/admin/AdminAnomalies.jsx` |

---

## 1. Login (`/login`)

Page d'authentification, réutilise le même realm Keycloak (`platform`) et le même client OIDC
(`platform-web`) que `web-portal`. Un utilisateur qui n'a pas le rôle `ADMIN` est redirigé vers
`/login` s'il tente d'accéder à une page protégée (`AdminRoute` dans `App.jsx`).

---

## 2. Overview (`/dashboard`)

**But** : vue d'ensemble rapide de l'état global de la plateforme, point d'entrée après connexion.

**Données affichées** (cartes statistiques) :
| Carte | Source | Endpoint |
|---|---|---|
| Total Users | Nombre total d'utilisateurs enregistrés | `GET /api/admin/stats` |
| Total Apps | Nombre total d'applications déployées (tous tenants) | `GET /api/admin/stats` |
| Running Apps | Apps avec statut `RUNNING`, + % de santé | `GET /api/admin/stats` |
| Kafka Topics | Nombre total de topics Kafka (tous tenants) | `GET /api/admin/stats` |
| Active Namespaces | Nombre de namespaces tenant actifs | `GET /api/admin/stats` |
| K8s Nodes | Nœuds `Ready`/total du cluster | `GET /api/admin/cluster/nodes` |

**Actions rapides** (boutons) : liens directs vers Cluster Info, Clients, Revenue, Audit Log.

**Tableau Kubernetes Nodes** : liste des nœuds avec nom, statut (`Ready`/`NotReady`), rôle
(`control-plane`/`worker`), CPU, mémoire — `GET /api/admin/cluster/nodes`.

---

## 3. Cluster (`/cluster`)

**But** : monitoring de l'infrastructure Kubernetes — c'est la page qui fait office de
"Monitoring admin" (il n'y a pas de page "Monitoring" séparée dans admin-console, cette page en
tient lieu pour tout ce qui est infra).

### 3.1 Bandeau d'erreurs
Si un appel API échoue, un bandeau rouge liste précisément quel appel a échoué et pourquoi
(HTTP xxx ou erreur réseau) — jamais d'échec silencieux.

### 3.2 Statistiques plateforme
Mêmes cartes que Overview (Total Users, Total Apps, Running Apps, Kafka Topics, Active Namespaces)
— `GET /api/admin/stats`.

### 3.3 Critical System Components *(nouveau)*
Statut de santé des 4 namespaces système dont dépend toute la plateforme : `knative-serving`,
`knative-eventing`, `kourier-system`, `kafka`. Si l'un tombe, **tous les tenants sont affectés** —
c'est le signal le plus critique à surveiller.
- **Endpoint** : `GET /api/admin/cluster/system-components`
- **Données par namespace** : `totalPods`, `readyPods`, `status` (`HEALTHY` / `DEGRADED` / `UNKNOWN`)

### 3.4 Recent Warning Events *(nouveau)*
Flux des 200 derniers événements Kubernetes de type `Warning` (`OOMKilled`, `ImagePullBackOff`,
`CrashLoopBackOff`, etc.), tous namespaces confondus, triés du plus récent au plus ancien.
- **Endpoint** : `GET /api/admin/cluster/events`
- **Colonnes** : Last Seen, Reason, Object (kind/nom), Namespace, Message, Count (nb d'occurrences)

### 3.5 Kubernetes Nodes
Liste des nœuds du cluster — `GET /api/admin/cluster/nodes` (nom, statut, rôle, CPU, mémoire).

### 3.6 Tenant Namespaces
Tableau des namespaces `user-*` avec nom, tenant, nombre d'apps, statut —
`GET /api/admin/cluster/namespaces`.

---

## 4. Clients (`/clients`)

**But** : gestion des comptes clients (`CLIENT_ADMIN`) — suspension, restauration, quotas.

**Données affichées** (tableau) — `GET /api/admin/clients` :
username, email, namespace, nombre d'apps (+ nombre suspendues), statut (`ACTIVE`/`SUSPENDED`),
date d'inscription.

**Bandeau factures impayées** : liste des factures en retard non payées, avec bouton de suspension
directe de l'app concernée — `invoiceApi.adminOverdue()`.

**Actions par client** :
- **Suspend/Restore** : coupe ou restaure toutes les apps d'un client — `POST /api/admin/clients/{userId}/suspend|restore` (tracé dans l'Audit Log)
- **Quota** (panneau dépliable) : consulte/modifie CPU max, mémoire max, nombre max d'apps — `GET`/`PUT /api/admin/clients/{userId}/quota` (synchronisé en `ResourceQuota` Kubernetes réel, tracé dans l'Audit Log)

---

## 5. Revenue (`/billing`)

**But** : facturation globale de la plateforme (tous clients confondus).

**Données** : détail des revenus par client/service, factures, export — s'appuie sur le module
`billing` existant du backend (`BillingService`, `InvoiceService`), consommé via
`adminApi`/`invoiceApi`. Facturation à l'usage (CPU/mémoire × temps), pas d'abonnement à paliers.

---

## 6. Audit Log (`/audit-log`)

**But** : traçabilité de toutes les actions admin sensibles.

**Endpoint** : `GET /api/admin/audit-log` (paginé, filtrable par acteur, cible, action, plage de dates)

**Actions tracées** (enum `AdminAction`) :
- `SUSPEND_CLIENT`, `RESTORE_CLIENT`
- `SUSPEND_APP`, `RESTORE_APP`
- `FORCE_DELETE_APP`, `FORCE_DELETE_TOPIC`
- `UPDATE_QUOTA`, `SCALE_APP`

**Donnée par entrée** : acteur (qui), action, cible (type + id), payload avant/après (JSON),
raison (optionnelle), adresse IP, date.

⚠️ Le login/logout des utilisateurs **n'est pas tracé** ici — seulement les actions de gestion
effectuées par un admin.

---

## 7. Incidents (`/incidents`)

**But** : déclarer manuellement les pannes/incidents, visibles publiquement sur `web-portal` à
l'URL `/status` (page accessible sans connexion).

**Endpoints** :
- `POST /api/admin/incidents` — créer
- `PUT /api/admin/incidents/{id}` — modifier (notamment le statut)
- `DELETE /api/admin/incidents/{id}` — supprimer
- Lecture publique côté `web-portal` : `GET /api/status/incidents` (sans authentification)

**Données par incident** : titre, description (optionnelle), sévérité (`MINOR`/`MAJOR`/`CRITICAL`),
statut (`INVESTIGATING` → `IDENTIFIED` → `MONITORING` → `RESOLVED`), date de début, date de
résolution.

---

## 8. Anomalies (`/anomalies`)

**But** : détection proactive des dérives de coût ou de trafic, avant que le client ne les
remarque. Approche seuil/écart-type (pas de ML).

**Endpoints** :
- `GET /api/admin/anomalies` — liste paginée, plus récent d'abord
- `POST /api/admin/anomalies/{id}/acknowledge` — marquer comme traité

**Deux types de détection automatique** (tâches planifiées côté backend) :
| Type | Fréquence | Règle de déclenchement |
|---|---|---|
| `COST` | Quotidienne (08h30) | Coût journalier d'un tenant > 2,5× sa moyenne des jours précédents (minimum 5 jours d'historique, moyenne > 0,05$) |
| `TRAFFIC` | Horaire | Taux de requêtes (5 min) d'une app > 3× sa moyenne sur 1h (minimum 0,05 req/s) |

Un cooldown de 20h par `(tenant, type, app)` évite de recréer la même alerte en boucle.

**Donnée par anomalie** : type, tenant/app concerné, message explicatif, valeur mesurée, valeur de
référence (baseline), date de détection, statut acquitté ou non.

---

## Résumé — endpoints backend utilisés par admin-console

| Endpoint | Méthode | Page(s) |
|---|---|---|
| `/api/admin/stats` | GET | Overview, Cluster |
| `/api/admin/cluster/nodes` | GET | Overview, Cluster |
| `/api/admin/cluster/namespaces` | GET | Cluster |
| `/api/admin/cluster/system-components` | GET | Cluster |
| `/api/admin/cluster/events` | GET | Cluster |
| `/api/admin/cluster/pods` | GET | (disponible, non affiché en page dédiée) |
| `/api/admin/cluster/knative/services` | GET | (disponible, non affiché en page dédiée) |
| `/api/admin/cluster/kafka/brokers` | GET | (disponible, non affiché en page dédiée) |
| `/api/admin/cluster/overview` | GET | (disponible, non affiché en page dédiée) |
| `/api/admin/clients` | GET | Clients |
| `/api/admin/clients/{userId}/suspend`, `/restore` | POST | Clients |
| `/api/admin/clients/{userId}/quota` | GET/PUT | Clients |
| `/api/admin/apps` | GET | (disponible, non affiché en page dédiée) |
| `/api/admin/apps/{id}/suspend`, `/restore` | POST | (disponible, non affiché) |
| `/api/admin/apps/{id}` | DELETE | (disponible, non affiché) |
| `/api/admin/kafka/topics` | GET | (disponible, non affiché) |
| `/api/admin/kafka/topics/{id}` | DELETE | (disponible, non affiché) |
| `/api/admin/eventing/sources`, `/triggers` | GET | (disponible, non affiché) |
| `/api/admin/audit-log` | GET | Audit Log |
| `/api/admin/incidents` | POST/PUT/DELETE | Incidents |
| `/api/status/incidents` | GET (public) | Incidents (lecture web-portal) |
| `/api/admin/anomalies` | GET | Anomalies |
| `/api/admin/anomalies/{id}/acknowledge` | POST | Anomalies |
| `/api/admin/logs` | GET | (disponible, non affiché en page dédiée) |

**Note** : plusieurs endpoints admin existent côté backend mais ne sont pas encore affichés dans
une page dédiée d'`admin-console` (ex : liste complète des apps/topics tous tenants avec actions,
vue Knative/eventing globale, pods bruts, logs cross-tenant) — ils étaient historiquement dans
`web-portal/src/pages/Monitoring.jsx` côté client avec vue admin intégrée, non répliqués tels
quels dans `admin-console`.
