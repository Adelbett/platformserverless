# Work Log — Mise à niveau de l'Espace Admin

Journal des livraisons pour la mission "Mise à niveau de l'Espace Admin" (audit du 2026-07-07).
Chaque section correspond à un commit séparé sur `main`. Ordre : P0 → P1 → P2 → P3.

---

## P0.1 — Audit log des actions admin ✅ livré

**Commit** : `feat(admin): add audit log for sensitive admin actions (P0.1)`

### Problème
Aucune action admin (suspension client, force-delete, restauration) n'était tracée dans
`AdminController`. Impossible de savoir qui a fait quoi, quand, et pourquoi.

### Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `backend-api/.../audit/AdminAction.java` | Enum des actions traçables (`SUSPEND_CLIENT`, `RESTORE_CLIENT`, `SUSPEND_APP`, `RESTORE_APP`, `FORCE_DELETE_APP`, `FORCE_DELETE_TOPIC`, `UPDATE_QUOTA`, `SCALE_APP`) |
| `backend-api/.../audit/AdminAuditLog.java` | Entité JPA (`admin_audit_log`) — acteur, action, cible, payload avant/après en JSON, raison, IP, timestamp. Suit la convention du repo (`@Id` UUID string, Lombok `@Builder`, `@CreationTimestamp`) |
| `backend-api/.../audit/AdminAuditLogRepository.java` | `JpaRepository` + `JpaSpecificationExecutor` pour le filtrage dynamique |
| `backend-api/.../audit/AdminAuditLogService.java` | `record(...)` — **ne lève jamais d'exception** : un échec d'écriture de l'audit est loggé en `ERROR` mais ne bloque ni n'annule l'action métier. `search(...)` — recherche paginée avec filtres optionnels (acteur, cible, action, plage de dates) |
| `backend-api/.../audit/dto/AdminAuditLogResponse.java` | DTO de réponse (mapping manuel, comme le reste du repo — pas de MapStruct) |
| `backend-api/.../admin/AdminController.java` | Endpoints `suspendApp`, `restoreApp`, `suspendClient`, `restoreClient`, `forceDeleteApp`, `forceDeleteTopic` instrumentés ; nouvel endpoint `GET /api/admin/audit-log` (paginé, filtrable) |
| `web-portal/src/pages/admin/AdminAuditLog.jsx` | Page admin — table paginée, filtres (action / target ID / acteur), badges colorés par type d'action, dans le même style que `AdminClients.jsx` |
| `web-portal/src/api/index.js`, `App.jsx`, `Sidebar.jsx` | Câblage `adminApi.getAuditLog`, route `/admin/audit-log`, entrée de menu |
| `backend-api/src/test/.../AdminAuditLogServiceTest.java` | Cas nominal (payloads sérialisés correctement) + cas d'erreur (le repository qui échoue ne remonte jamais d'exception) |

### Comment le vérifier
```bash
cd backend-api
mvn -Dtest=AdminAuditLogServiceTest test   # 2/2 tests OK, BUILD SUCCESS
```
Puis dans l'UI admin : suspendre un client depuis "Clients", ouvrir "Audit Log" → l'action apparaît immédiatement avec l'avant/après.

### Non traité dans cet item (volontairement)
- La granularité RBAC sur `GET /api/admin/audit-log` reste celle de `AdminController` (`hasRole('ADMIN')` global) — sera affinée en P1.4.
- Pas d'aspect AOP : appels explicites dans le controller, pour rester cohérent avec le reste du code (aucun autre module n'utilise Spring AOP, pas de dépendance `spring-boot-starter-aop` avant cet ajout — donc je ne l'ai pas introduite).

---

## P0.2 — Prometheus + Grafana + Alertmanager ✅ livré

**Commit** : `feat(observability): activate Prometheus/Grafana/Alertmanager (P0.2)`

### Problème
`micrometer-registry-prometheus` et Actuator étaient déclarés (pom + `application.yml`) mais rien
ne scrapait, stockait ou affichait les métriques. Le `docker-compose.yml` local montait même un
`prometheus.yml` qui n'existait pas — Prometheus ne pouvait pas démarrer localement.

### Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `prometheus.yml` (racine) | Config manquante pour le Prometheus du `docker-compose.yml` local — scrape `backend-api:8082/actuator/prometheus` |
| `backend-api/src/main/resources/application.yml` | `management.metrics.tags.application=backend-api` + histogrammes de percentiles activés sur `http.server.requests` (nécessaire pour les p50/p95/p99 du dashboard) |
| `k8s/backend/deployment.yaml` | Port du Service nommé `http` (requis par `ServiceMonitor.endpoints[].port`) |
| `k8s/monitoring/service-monitor.yaml` | `ServiceMonitor` pour un cluster avec Prometheus Operator |
| `k8s/monitoring/scrape-config.yaml` | Alternative pour un Prometheus auto-géré (sans CRDs) |
| `k8s/monitoring/alert-rules.yaml` | `PrometheusRule` : taux de 5xx > 5 % sur 5 min, pod en crash-loop (> 3 redémarrages / 15 min) |
| `k8s/monitoring/alertmanager-config.yaml` | Route Alertmanager vers un webhook générique (URL à injecter via `envsubst`/Kustomize/Helm — jamais commitée en clair) |
| `k8s/grafana/platform-tenant-dashboard.json` | Dashboard Grafana : requêtes/erreurs par endpoint, latence p50/p95/p99, CPU/RAM/redémarrages par namespace tenant (variable `$namespace`), et taux d'actions admin |
| `backend-api/.../audit/AdminAuditLogService.java` | Nouveau compteur Micrometer `admin_audit_actions_total{action=...}`, incrémenté à chaque audit réussi — alimente le panneau "Admin actions" du dashboard |

### Comment le vérifier
```bash
cd backend-api
mvn -Dtest=AdminAuditLogServiceTest test   # vérifie aussi l'incrément du compteur
```
En local : `docker compose up prometheus` (le fichier manquant est maintenant présent) puis
http://localhost:9090/targets pour voir `backend-api` en `UP`.
En cluster : appliquer soit `service-monitor.yaml` (si Prometheus Operator est déjà présent — **vérifier
avant d'appliquer pour ne pas dupliquer un stack existant**), soit fusionner `scrape-config.yaml`
dans la config d'un Prometheus auto-géré.

### Décision produit prise sans confirmation explicite
Percentiles histogram activé uniquement sur `http.server.requests` (pas globalement) pour limiter le
volume de séries temporielles généré — ajustable si besoin.

---

## P1.5 — Fix statut Ready Knative + erreurs masquées frontend ✅ livré

**Commit** : `fix(admin): correct Knative Ready status and stop hiding API errors (P1.5)`

### Problème
`getKnativeServices()` considérait un service "ready" dès que `status.conditions` existait, sans
vérifier la valeur réelle. Un service coincé en échec (ex : `RoutesReady=True`, `Ready=False`)
s'affichait comme sain. Côté frontend, `ClusterManagement.jsx` et `Monitoring.jsx` avalaient toute
erreur d'appel API (`.catch(() => ({ data: [] }))`) et l'affichaient comme un état vide/normal — une
vraie panne cluster était indiscernable d'un simple "pas encore de données".

### Ce qui a été corrigé

| Fichier | Changement |
|---|---|
| `backend-api/.../admin/AdminController.java` | Extraction de la logique dans `resolveReadyStatus(Object statusObj)` (record `ReadyStatus(ready, url, message)`) — parcourt réellement `conditions[]` à la recherche de `type="Ready"` et lit son `status` (`True`/`False`/`Unknown`) et son `message`. Fini le raccourci "conditions non-null ⇒ ready" |
| `backend-api/src/test/.../AdminControllerReadyStatusTest.java` | 4 tests : ready=True, ready=False malgré d'autres conditions présentes (cas de régression du bug original), aucune condition Ready trouvée, status absent |
| `web-portal/src/pages/admin/ClusterManagement.jsx` | Chaque appel (`getStats`/`getNodes`/`getNamespaces`) capture désormais son échec individuellement et affiche un bandeau rouge avec le libellé de l'appel + le message d'erreur (HTTP xxx ou erreur réseau), au lieu de rendre silencieusement une liste vide. Bouton "Refresh" ajouté |
| `web-portal/src/pages/Monitoring.jsx` | Même traitement pour les 10 appels admin (`getClusterOverview`, `getAllApps`, `getNodes`, `getPods`, `getKnativeServices`, etc.) — bandeau listant précisément quels appels ont échoué. Icône Ready Knative distingue maintenant `False` (rouge) de `Unknown` (ambre), avec le message d'erreur en tooltip |

### Comment le vérifier
```bash
cd backend-api
mvn "-Dtest=AdminControllerReadyStatusTest,AdminAuditLogServiceTest" test   # 6/6 tests, BUILD SUCCESS
```
Côté UI : couper temporairement l'accès au cluster (ou arrêter le backend) → "Cluster Management" et
"Monitoring" affichent désormais un bandeau d'erreur explicite au lieu d'un tableau vide silencieux.

---

## P1.3 — Quotas & limites par tenant ✅ livré

**Commit** : `feat(admin): add per-tenant CPU/memory/app quotas (P1.3)`

### Problème
Aucune limite de ressources par tenant : un client pouvait déployer un nombre illimité d'apps sans
plafond CPU/mémoire au niveau du cluster.

### Décision produit (tranchée avec l'utilisateur)
Il n'existe **aucun système de plans/abonnements** dans le code — la facturation est à l'usage par
app (`BillingSnapshot`/`AppInvoice`), pas par palier. Les quotas sont donc **fixés manuellement par
client par l'admin**, pas dérivés d'un plan.

### Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `backend-api/.../quota/TenantQuota.java` | Entité JPA (`tenant_quotas`) — `maxCpu`/`maxMemory` (format K8s `"2000m"`/`"4Gi"`, même convention que `App.cpuRequest`), `maxApps` |
| `backend-api/.../quota/QuotaService.java` | `getQuota` (retourne les défauts — 2 CPU/4Gi/10 apps — si jamais configuré) ; `updateQuota` (persiste + synchronise un `ResourceQuota` K8s dans le namespace du tenant, best-effort : un échec de sync ne fait pas rollback de la BDD) ; `assertCanCreateApp` (409 `ConflictException` si quota d'apps atteint) |
| `backend-api/.../app/AppService.java` | `createApp()` appelle `assertCanCreateApp()` avant tout déploiement — un dépassement de quota est un 409 explicite, jamais un 500 générique |
| `backend-api/.../admin/AdminController.java` | `GET`/`PUT /api/admin/clients/{userId}/quota`, tracé dans l'audit log (`UPDATE_QUOTA`) |
| `backend-api/src/test/.../QuotaServiceTest.java` | 6 tests : défauts, sous quota, quota atteint, apps `DELETED` non comptées, mise à jour persistée, 404 si client inconnu |
| `web-portal/src/pages/admin/AdminClients.jsx` | Bouton "Quota" par ligne client → panneau expandable (CPU/mémoire/max apps + usage actuel), sauvegarde avec confirmation visuelle |

### Comment le vérifier
```bash
cd backend-api
mvn -Dtest=QuotaServiceTest test   # 6/6 tests, BUILD SUCCESS
cd ../web-portal && npx vite build --mode production   # build frontend OK
```
Dans l'UI admin : "Clients" → bouton "Quota" sur une ligne → modifier et sauvegarder → le panneau
confirme "Saved and synced to cluster."

---

## P2.7 — Rollback de déploiement ✅ déjà implémenté (vérifié, aucun changement nécessaire)

En explorant le code avant de coder, j'ai trouvé que ce chantier existait déjà intégralement :
- `KnativeService.listRevisions()` / `rollbackToRevision()` — lit les Revisions Knative et repointe la
  `Route` vers une révision antérieure.
- `AppController` : `GET /api/apps/{id}/revisions`, `POST /api/apps/{id}/rollback/{revisionName}`.
- `AppService.rollback()` trace l'action dans `DeploymentLog` (journal de déploiement existant).
- `web-portal/src/pages/AppDetails.jsx` : composant `RevisionHistory` + `RollbackModal` avec
  confirmation avant rollback.

Aucun changement n'était nécessaire — item validé tel quel.

---

## P2.6 — Status page publique + incidents ✅ livré

**Commit** : `feat(status): add public status page and incident history (P2.6)`

### Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `backend-api/.../status/StatusService.java` | Vérifie DB (`SELECT 1`), cluster K8s (`namespaces().list()`), calcule l'uptime 24h par `avg_over_time(up{job="backend-api"}[24h]) * 100` via Prometheus (branché en P0.2 — la métrique `up` existe pour toute cible scrappée, aucune métrique custom nécessaire) |
| `backend-api/.../status/StatusController.java` | `GET /api/status` (statut global + par composant), `GET /api/status/incidents` — **publics, non authentifiés** |
| `backend-api/.../status/AdminIncidentController.java` | `POST`/`PUT`/`DELETE /api/admin/incidents` — `hasRole('ADMIN')`, incidents saisis manuellement pour l'instant (pas encore reliés à Alertmanager) |
| `backend-api/.../status/StatusRateLimitFilter.java` | Rate limit basique en mémoire (30 req/min/IP) sur `/api/status/**` — seule surface non authentifiée de l'API, donc protégée même sans WAF/CDN devant |
| `backend-api/.../security/SecurityConfig.java` | `GET /api/status/**` ajouté à la whitelist ; filtre de rate limit branché avant `BasicAuthenticationFilter` |
| `backend-api/src/test/.../StatusRateLimitFilterTest.java` | 3 tests : sous la limite, au-dessus (429), endpoint hors `/api/status` non affecté |
| `web-portal/src/pages/StatusPage.jsx` | Page publique autonome (`/status`, hors authentification) — statut global, uptime par composant, historique d'incidents |
| `web-portal/src/pages/admin/AdminIncidents.jsx` | Formulaire de création + gestion du statut des incidents affichés publiquement |

### Comment le vérifier
```bash
cd backend-api
mvn test   # 15/15 tests, BUILD SUCCESS (aucune régression)
```
Ouvrir `/status` sans être connecté → statut + incidents visibles. Depuis l'admin, "Incidents" →
créer un incident → il apparaît immédiatement sur `/status`.

### Limite connue
Le rate limiter est en mémoire, par instance — il ne protège pas contre un abus distribué sur
plusieurs pods. Suffisant pour une seule instance ; à remplacer par une solution partagée (Redis) si
le service est scalé horizontalement.

---

## Prochaines étapes (P2.8, P3 — non traitées dans cette session)

RBAC multi-rôles (P1.4) écarté à la demande de l'utilisateur — pas de granularité de sous-rôles sous
ADMIN pour l'instant.

1. **P2.8 — Sauvegarde automatisée + DR** (S3-compatible générique, décidé)
2. **P3.9 — Anomaly detection coûts/trafic**
3. **P3.10 — Assistant admin en langage naturel**

Aucune régression constatée sur le module billing ni sur le module eventing.
