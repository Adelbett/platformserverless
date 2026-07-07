# PlatformServerless

## Séparation client / admin (frontend)

Le portail client (`web-portal/`) servait auparavant à la fois le public ET les pages
d'administration globale (cluster, clients, revenue, audit log, incidents). Ces deux audiences
n'ont pas le même niveau de confiance — le client ne devrait jamais pouvoir accéder, même par
erreur de configuration RBAC, aux capacités d'administration de la plateforme (suspendre un client,
voir les revenus de tous les tenants, etc.). Elles sont maintenant deux applications séparées :

| | `web-portal/` | `admin-console/` |
|---|---|---|
| Audience | Clients (CLIENT_ADMIN / MEMBER) | Opérateurs plateforme (ADMIN) |
| Port dev (Vite) | 5173 (inchangé) | 3001 |
| Déploiement K8s | `platform-web`, `Service type: LoadBalancer` (IP publique MetalLB) | `platform-admin`, `Service type: ClusterIP` (interne uniquement — port-forward ou futur VPN) |
| Image Docker | `adelbettaieb/platform-web` | `adelbettaieb/platform-admin` |

### Ce qui a été déplacé

Les 6 pages sous `web-portal/src/pages/admin/` sont devenues les 6 seules pages de
`admin-console/` :

- `AdminDashboard` → `/dashboard`
- `ClusterManagement` → `/cluster`
- `AdminBilling` → `/billing`
- `AdminClients` → `/clients`
- `AdminAuditLog` → `/audit-log`
- `AdminIncidents` → `/incidents`

### Ce qui reste dans `web-portal/`

`/monitoring`, `/users`, `/kafka`, `/eventing`, `/logs` **restent dans web-portal** — ce sont des
pages **client**, pas admin-only : un client y gère ses propres topics Kafka, son eventing, monitore
ses propres apps, et gère son équipe. `Monitoring.jsx` et `Users.jsx` font un branchement interne
(`user.role === 'ADMIN'`) pour afficher une vue globale à un administrateur qui se connecterait sur
web-portal — ce comportement est conservé tel quel. `/admin/users` reste également dans web-portal
car il pointe vers ce même composant partagé `Users.jsx`, situé hors de `src/pages/admin/`.

Le lien "Admin Console" dans la barre latérale de web-portal (visible seulement pour le rôle ADMIN)
ouvre `admin-console` dans un nouvel onglet, via `VITE_ADMIN_CONSOLE_URL` (défaut :
`http://localhost:3001`).

### Corrections apportées à la demande initiale

La demande de séparation partait de l'hypothèse d'une app Next.js 14 avec `next.config.js`. Le
frontend réel est en **React + Vite** (`react-router-dom`, `vite.config.js`) — il n'y a jamais eu de
Next.js dans ce repo. Le plan a été adapté en conséquence :
- Le proxy `/api` est configuré dans `vite.config.js` (`server.proxy`), pas dans un `next.config.js`.
- Le port du backend Spring Boot est **8082**, pas 8080 (vérifié dans `application.yml`).
- Le port 3000/3001 ne s'applique qu'au serveur de dev Vite en local. **En production, les deux
  apps sont servies par nginx sur le port 80 à l'intérieur de leur conteneur** — l'isolation
  client/admin vient du fait que ce sont deux `Deployment`/`Service` Kubernetes distincts
  (`platform-web` vs `platform-admin`), pas d'un port de conteneur différent.
- `admin-console` réutilise le même client Keycloak (`platform-web` par défaut, configurable via
  `VITE_KEYCLOAK_CLIENT_ID`) que web-portal — créer un client Keycloak `platform-admin` dédié (avec
  ses propres règles de session/scope) est un travail de configuration Keycloak, hors périmètre de
  ce changement purement frontend, et reste une amélioration future recommandée avant d'exposer
  `admin-console` au-delà d'un port-forward.

### Fichiers ajoutés

- `admin-console/` — app Vite complète (copie de `web-portal/`, réduite aux 6 pages admin + login)
- `ci-cd/docker/admin.Dockerfile`, `ci-cd/docker/admin-kaniko.Dockerfile`
- `ci-cd/jenkins/pipelines/Jenkinsfile.admin`
- `k8s/admin/deployment.yaml` — `Deployment` + `Service` (`ClusterIP`)

### Aucun changement côté backend

`backend-api/` n'a pas été touché — le RBAC `ADMIN` existant sur `/api/admin/**` continue de
protéger tous les endpoints utilisés par `admin-console`, exactement comme il protégeait déjà
`/admin/*` dans web-portal.

### Prochaines étapes suggérées (non faites ici)

1. Créer un client Keycloak `platform-admin` dédié dans le realm `platform`.
2. Remplacer le port-forward par un accès VPN/réseau interne réel une fois l'infra prête (mentionné
   dans la demande initiale : "en attendant une vraie séparation réseau plus tard, client sur Google
   Cloud, admin en interne").
3. Ajouter `Jenkinsfile.admin` au job Jenkins (actuellement seul `Jenkinsfile.frontend` et
   `Jenkinsfile.backend` sont enregistrés comme pipelines actifs, à vérifier côté configuration
   Jenkins elle-même — hors périmètre de ce changement de code).
