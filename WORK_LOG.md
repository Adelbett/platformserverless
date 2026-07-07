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

## Prochaines étapes (P1 → P3, non traitées dans cette session)

Comme convenu, le reste est planifié pour les sessions suivantes, dans l'ordre :

1. **P1.3 — Quotas & limites par tenant** (`ResourceQuota`/`LimitRange` K8s générés par plan)
2. **P1.4 — RBAC multi-rôles** — ⚠️ **point à trancher avant de commencer** : les rôles réellement
   présents dans le code sont `ADMIN` / `CLIENT_ADMIN` / `MEMBER` (`UserRole.java`,
   `Sidebar.jsx` `allowedRoles`), pas `CLIENT_MEMBER` / `CLIENT_ADMIN` / `PLATFORM_ADMIN` comme
   indiqué dans la demande. Il faudra soit renommer `ADMIN` → `PLATFORM_ADMIN` et `MEMBER` →
   `CLIENT_MEMBER` (migration de données + tous les `@PreAuthorize`/`allowedRoles` à mettre à jour),
   soit garder les noms actuels et n'ajouter que la nouvelle granularité (super-admin / support /
   lecture seule) par-dessus. À confirmer avant d'implémenter pour éviter une migration inutile.
3. **P1.5 — Fix statut Ready Knative + erreurs masquées frontend**
4. **P2.6 — Status page publique + incidents**
5. **P2.7 — Rollback de déploiement**
6. **P2.8 — Sauvegarde automatisée + DR** (S3-compatible générique, décidé)
7. **P3.9 — Anomaly detection coûts/trafic**
8. **P3.10 — Assistant admin en langage naturel**

Aucune régression constatée sur le module billing ni sur le module eventing — non touchés par ces deux livraisons.
