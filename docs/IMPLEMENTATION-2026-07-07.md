# Implémentation — Session du 2026-07-07

## 1. Résumé exécutif

Cette session a traité, dans l'ordre, **P0.1, P0.2, P1.5, P1.3, P2.7 (vérification), P2.6, P2.8, P3.9** —
tous **complets** — plus un chantier hors plan initial (séparation frontend client/admin, demandé en
cours de session). **P1.4 (RBAC multi-rôles) a été explicitement écarté** à la demande de
l'utilisateur ("j'ai pas besoin de ajouter des role sous admin") et **P3.10 (assistant en langage
naturel) n'a pas été commencé** — une décision produit (moteur par règles vs intégration LLM
payante) était en attente de réponse au moment de la rédaction de ce document.

Chaque item a fait l'objet d'un commit Git séparé, précédé d'une compilation/build réussie et,
quand applicable, d'une exécution réelle de la suite de tests avant de committer.

---

## P0.1 — Audit log des actions admin

### a) Ce qui a été ajouté

**Nouveaux fichiers (backend)** :
- `backend-api/src/main/java/com/platform/api/audit/AdminAction.java`
- `backend-api/src/main/java/com/platform/api/audit/AdminAuditLog.java`
- `backend-api/src/main/java/com/platform/api/audit/AdminAuditLogRepository.java`
- `backend-api/src/main/java/com/platform/api/audit/AdminAuditLogService.java`
- `backend-api/src/main/java/com/platform/api/audit/dto/AdminAuditLogResponse.java`
- `backend-api/src/test/java/com/platform/api/audit/AdminAuditLogServiceTest.java`

**Nouveaux fichiers (frontend)** :
- `web-portal/src/pages/admin/AdminAuditLog.jsx`

**Fichiers modifiés** :
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — instrumentation des endpoints sensibles
- `web-portal/src/App.jsx`, `web-portal/src/api/index.js`, `web-portal/src/components/Sidebar.jsx` — route, appel API, entrée de menu

### b) Détail technique

**`AdminAuditLog`** (entité JPA, table `admin_audit_log`) : `actorUserId`, `actorUsername`, `action`
(stocké en `String`, cohérent avec le reste du code qui n'utilise pas `@Enumerated`), `targetType`,
`targetId`, `payloadBefore`/`payloadAfter` (JSON sérialisé en `TEXT`), `reason` (nullable), `ipAddress`,
`createdAt`.

**`AdminAuditLogService.record(...)`** — point clé : la méthode est encapsulée dans un `try/catch`
qui **avale toute exception** et logue en `ERROR` au lieu de la laisser remonter. Choix délibéré :
un échec d'écriture de l'audit ne doit jamais annuler ou bloquer l'action métier qu'il documente
(ex. une suspension client ne doit pas échouer parce que la base d'audit est indisponible).

**Endpoints instrumentés dans `AdminController`** : `suspendApp`, `restoreApp`, `suspendClient`,
`restoreClient`, `forceDeleteApp`, `forceDeleteTopic` — chacun appelle `auditLogService.record(...)`
après l'action métier, avec l'acteur extrait de `Authentication.getName()` et l'IP extraite de
`X-Forwarded-For` ou `request.getRemoteAddr()`.

**Nouvel endpoint** : `GET /api/admin/audit-log` — paramètres `actorUserId`, `targetId`, `action`,
`from`, `to`, `page`, `size` (tous optionnels) ; réponse `Page<AdminAuditLogResponse>` ; rôle requis
`ADMIN` (hérité du `@PreAuthorize` de classe sur `AdminController`).

**Base de données** : table `admin_audit_log` créée automatiquement par Hibernate
(`ddl-auto: update`), avec index sur `actor_user_id`, `(target_type, target_id)`, `action`, `created_at`.

### c) Extraits de code significatifs

```java
public void record(String actorUserId, String actorUsername, AdminAction action,
                    String targetType, String targetId,
                    Object before, Object after, String reason, String ipAddress) {
    try {
        AdminAuditLog entry = AdminAuditLog.builder()
                .actorUserId(actorUserId).actorUsername(actorUsername)
                .action(action.name()).targetType(targetType).targetId(targetId)
                .payloadBefore(toJson(before)).payloadAfter(toJson(after))
                .reason(reason).ipAddress(ipAddress)
                .build();
        auditLogRepository.save(entry);
    } catch (Exception e) {
        log.error("Failed to record admin audit log [action={}, target={}:{}, actor={}]: {}",
                action, targetType, targetId, actorUsername, e.getMessage(), e);
    }
}
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `9c5e368`)

```
backend-api/.../admin/AdminController.java           |  76 +++++++-
backend-api/.../audit/AdminAction.java                |  12 ++
backend-api/.../audit/AdminAuditLog.java              |  57 ++++++
backend-api/.../audit/AdminAuditLogRepository.java    |   8 +
backend-api/.../audit/AdminAuditLogService.java       |  80 ++++++++
backend-api/.../audit/dto/AdminAuditLogResponse.java  |  40 ++++
backend-api/.../audit/AdminAuditLogServiceTest.java   |  59 ++++++
web-portal/src/App.jsx                                |   4 +
web-portal/src/api/index.js                           |   3 +-
web-portal/src/components/Sidebar.jsx                 |   3 +-
web-portal/src/pages/admin/AdminAuditLog.jsx          | 217 +++++++++++++++++++++
11 files changed, 551 insertions(+), 8 deletions(-)
```

### e) Tests

`backend-api/src/test/java/com/platform/api/audit/AdminAuditLogServiceTest.java` — 2 tests :
- `record_persistsEntryWithSerializedPayloads` : vérifie que l'entrée sauvegardée contient bien les
  bons champs et que les payloads avant/après sont correctement sérialisés en JSON.
- `record_neverThrowsWhenRepositoryFails` : simule un `repository.save()` qui lève une exception,
  vérifie qu'`assertThatCode(...).doesNotThrowAnyException()` — donc que l'appelant n'est jamais
  impacté.

**Résultat réel de l'exécution** (`mvn -Dtest=AdminAuditLogServiceTest test`) :
```
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.465 s
[INFO] BUILD SUCCESS
```

### f) Comment vérifier manuellement

1. Se connecter en ADMIN sur web-portal, aller sur "Clients", suspendre un client.
2. Aller sur "Audit Log" (`/admin/audit-log`) → l'action apparaît immédiatement avec avant/après.
3. Ou en direct : `GET /api/admin/audit-log?page=0&size=10` avec un Bearer token ADMIN → réponse
   `{ "content": [ { "action": "SUSPEND_CLIENT", "actorUsername": "...", ... } ], "totalPages": 1, ... }`.

---

## P0.2 — Prometheus + Grafana + Alertmanager

### a) Ce qui a été ajouté

**Nouveaux fichiers** :
- `prometheus.yml` (racine — config manquante, le `docker-compose.yml` local montait un fichier qui n'existait pas)
- `k8s/monitoring/service-monitor.yaml`, `k8s/monitoring/scrape-config.yaml`, `k8s/monitoring/alert-rules.yaml`, `k8s/monitoring/alertmanager-config.yaml`
- `k8s/grafana/platform-tenant-dashboard.json`

**Fichiers modifiés** :
- `backend-api/src/main/resources/application.yml` — tags de métriques + histogrammes de percentiles
- `backend-api/src/main/java/com/platform/api/audit/AdminAuditLogService.java` — compteur Micrometer
- `k8s/backend/deployment.yaml` — port du Service nommé `http` (requis par `ServiceMonitor`)

### b) Détail technique

`micrometer-registry-prometheus` et Actuator étaient déjà déclarés dans le `pom.xml`, mais rien ne
scrapait, stockait, ni n'affichait les métriques produites. Le compteur métier
`admin_audit_actions_total{action=...}` a été ajouté dans `AdminAuditLogService.record(...)` pour
alimenter un panneau du dashboard Grafana.

**`k8s/monitoring/alert-rules.yaml`** définit deux règles Prometheus (format `PrometheusRule`) :
taux de 5xx > 5 % sur 5 min, et pod en crash-loop (> 3 redémarrages en 15 min) — routées vers un
webhook Alertmanager générique (URL à injecter via `envsubst`, jamais committée en clair).

### c) Extraits de code significatifs

```java
Counter.builder("admin_audit_actions_total")
        .description("Admin actions recorded in the audit trail")
        .tag("action", action.name())
        .register(meterRegistry)
        .increment();
```

```yaml
management:
  metrics:
    tags:
      application: backend-api
    distribution:
      percentiles-histogram:
        http.server.requests: true
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `afd6789`)

```
backend-api/.../audit/AdminAuditLogService.java     |   8 ++
backend-api/src/main/resources/application.yml      |   6 ++
backend-api/.../audit/AdminAuditLogServiceTest.java  |   9 +-
k8s/backend/deployment.yaml                          |   3 +-
k8s/grafana/platform-tenant-dashboard.json           | 105 +++++++++++++++++++++
k8s/monitoring/alert-rules.yaml                       |  34 +++++++
k8s/monitoring/alertmanager-config.yaml               |  26 +++++
k8s/monitoring/scrape-config.yaml                     |  17 ++++
k8s/monitoring/service-monitor.yaml                   |  22 +++++
prometheus.yml                                        |   9 ++
10 files changed, 236 insertions(+), 3 deletions(-)
```

### e) Tests

Pas de nouveau fichier de test dédié — le test existant `AdminAuditLogServiceTest` a été étendu
(9 lignes modifiées) pour vérifier que le compteur `admin_audit_actions_total` s'incrémente
réellement, via un `SimpleMeterRegistry` réel (pas un mock) :

```
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.979 s
[INFO] BUILD SUCCESS
```

Les manifestes K8s (`ServiceMonitor`, `PrometheusRule`, etc.) n'ont **pas** de test automatisé —
uniquement une validation `kubectl apply --dry-run=client` (voir P2.8 pour le même type de
validation, sortie identique en substance : `created (dry run)` sans erreur).

### f) Comment vérifier manuellement

```bash
docker compose up prometheus   # le fichier prometheus.yml manquant est maintenant présent
# puis http://localhost:9090/targets → "backend-api" doit apparaître en état UP
```
En cluster, appliquer `k8s/monitoring/service-monitor.yaml` (si Prometheus Operator présent) ou
fusionner `scrape-config.yaml` dans un Prometheus auto-géré.

---

## P1.5 — Fix statut Ready Knative + erreurs masquées frontend

### a) Ce qui a été ajouté

**Nouveaux fichiers** :
- `backend-api/src/test/java/com/platform/api/admin/AdminControllerReadyStatusTest.java`

**Fichiers modifiés** :
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java`
- `web-portal/src/pages/Monitoring.jsx`
- `web-portal/src/pages/admin/ClusterManagement.jsx`

### b) Détail technique

**Bug corrigé** : `getKnativeServices()` considérait un service Knative "ready" dès que
`status.conditions` était non-null, sans vérifier la valeur réelle de la condition `Ready`. Un
service en échec de rollout (ex. `RoutesReady=True` mais `Ready=False`) s'affichait comme sain.

La logique a été extraite dans une méthode statique testable indépendamment de fabric8 :

```java
record ReadyStatus(String ready, String url, String message) {}

static ReadyStatus resolveReadyStatus(Object statusObj) {
    if (!(statusObj instanceof Map<?, ?> statusMap)) {
        return new ReadyStatus("Unknown", "", null);
    }
    String url = statusMap.get("url") != null ? statusMap.get("url").toString() : "";
    Object conditionsObj = statusMap.get("conditions");
    if (conditionsObj instanceof List<?> conditions) {
        for (Object c : conditions) {
            if (c instanceof Map<?, ?> condition && "Ready".equals(condition.get("type"))) {
                Object statusValue = condition.get("status");
                String ready = "True".equals(statusValue) ? "True"
                        : "False".equals(statusValue) ? "False" : "Unknown";
                Object msg = condition.get("message");
                return new ReadyStatus(ready, url, msg != null ? msg.toString() : null);
            }
        }
    }
    return new ReadyStatus("Unknown", url, null);
}
```

**Frontend** : `ClusterManagement.jsx` et `Monitoring.jsx` enveloppaient chaque appel API dans
`.catch(() => ({ data: [] }))`, rendant une vraie panne cluster indiscernable d'un simple "pas
encore de données". Chaque appel capture désormais son échec individuellement et un bandeau rouge
affiche le libellé de l'appel + le message d'erreur (HTTP xxx ou erreur réseau).

### c) Extraits de code significatifs

```javascript
const describeFailure = (label, err) => ({
    label,
    message: err.response?.status
        ? `HTTP ${err.response.status} — ${err.response.data?.detail || err.response.data?.title || err.message}`
        : `Network error — ${err.message}`,
});
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `609e730`)

```
backend-api/.../admin/AdminController.java                  | 46 ++++++++++++---
backend-api/.../admin/AdminControllerReadyStatusTest.java    | 61 ++++++++++++++++++++
web-portal/src/pages/Monitoring.jsx                          | 50 ++++++++++++----
web-portal/src/pages/admin/ClusterManagement.jsx             | 66 ++++++++++++++++++----
4 files changed, 192 insertions(+), 31 deletions(-)
```

### e) Tests

`AdminControllerReadyStatusTest` — 4 tests :
- `ready_whenReadyConditionIsTrue` : condition `Ready=True` → statut `"True"`.
- `notReady_whenReadyConditionIsFalse_evenThoughOtherConditionsExist` : **cas de régression exact
  du bug d'origine** — `RoutesReady=True` + `Ready=False` → doit renvoyer `"False"`, pas `"True"`.
- `unknown_whenNoReadyConditionPresent` : aucune condition `Ready` trouvée → `"Unknown"`.
- `unknown_whenStatusIsMissing` : `status` absent (`null`) → `"Unknown"`, URL vide.

**Résultat réel** (`mvn -Dtest=AdminControllerReadyStatusTest,AdminAuditLogServiceTest test`) :
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- AdminControllerReadyStatusTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0 -- AdminAuditLogServiceTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### f) Comment vérifier manuellement

Arrêter temporairement le backend, ouvrir "Cluster Management" ou "Monitoring" dans web-portal →
un bandeau rouge explicite doit apparaître au lieu d'un tableau vide silencieux.

---

## P1.3 — Quotas & limites par tenant

### a) Ce qui a été ajouté

**Nouveaux fichiers (backend)** :
- `backend-api/src/main/java/com/platform/api/quota/TenantQuota.java`
- `backend-api/src/main/java/com/platform/api/quota/TenantQuotaRepository.java`
- `backend-api/src/main/java/com/platform/api/quota/QuotaService.java`
- `backend-api/src/main/java/com/platform/api/quota/dto/TenantQuotaResponse.java`
- `backend-api/src/main/java/com/platform/api/quota/dto/UpdateQuotaRequest.java`
- `backend-api/src/test/java/com/platform/api/quota/QuotaServiceTest.java`

**Fichiers modifiés** :
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` (endpoints quota)
- `backend-api/src/main/java/com/platform/api/app/AppService.java` (vérification avant déploiement)
- `web-portal/src/api/index.js`, `web-portal/src/pages/admin/AdminClients.jsx` (UI)

### b) Détail technique

**Décision produit** : il n'existe aucun système de plans/abonnements dans le code (facturation à
l'usage, pas par palier) — les quotas sont donc **fixés manuellement par client par l'admin**, pas
dérivés d'un plan, suite à une clarification explicite avec l'utilisateur.

**`TenantQuota`** : `maxCpu`/`maxMemory` (format K8s `"2000m"`/`"4Gi"`, même convention que
`App.cpuRequest`), `maxApps` (int). Défauts appliqués si jamais configuré : 2 CPU / 4Gi / 10 apps.

**`QuotaService.assertCanCreateApp(userId)`** — appelée par `AppService.createApp()` avant tout
déploiement ; compte les apps actives (hors `DELETED`) et lève une `ConflictException` (→ 409, pas
un 500 générique) si le quota est atteint.

**`QuotaService.updateQuota(...)`** — persiste en base puis synchronise un `ResourceQuota`
Kubernetes réel dans le namespace du tenant (`requests.cpu`, `requests.memory`,
`count/services.serving.knative.dev`). La synchronisation cluster est **best-effort** : un échec ne
fait pas de rollback du changement en base (juste un `log.error`).

**Endpoints** : `GET /api/admin/clients/{userId}/quota`, `PUT /api/admin/clients/{userId}/quota`
(rôle `ADMIN`, tracé dans l'audit log via `AdminAction.UPDATE_QUOTA`).

### c) Extraits de code significatifs

```java
public void assertCanCreateApp(String userId) {
    TenantQuota quota = getOrCreateDefault(userId);
    long currentApps = countActiveApps(userId);
    if (currentApps >= quota.getMaxApps()) {
        throw new ConflictException(
                "App quota reached: " + currentApps + "/" + quota.getMaxApps()
                        + " apps. Contact your administrator to raise your quota.");
    }
}
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `fbc47ab`)

```
backend-api/.../admin/AdminController.java             |  26 ++++
backend-api/.../app/AppService.java                     |   4 +
backend-api/.../quota/QuotaService.java                 | 132 ++++++++++++++++++
backend-api/.../quota/TenantQuota.java                  |  45 ++++++
backend-api/.../quota/TenantQuotaRepository.java         |   9 ++
backend-api/.../quota/dto/TenantQuotaResponse.java       |  30 ++++
backend-api/.../quota/dto/UpdateQuotaRequest.java        |  19 +++
backend-api/.../quota/QuotaServiceTest.java              | 129 +++++++++++++++++
web-portal/src/api/index.js                              |   2 +
web-portal/src/pages/admin/AdminClients.jsx               | 154 ++++++++++++++++++---
10 files changed, 528 insertions(+), 22 deletions(-)
```

### e) Tests

`QuotaServiceTest` — 6 tests :
- `getQuota_returnsDefaultsWhenNoneSet`
- `assertCanCreateApp_doesNotThrow_whenUnderQuota`
- `assertCanCreateApp_throwsConflict_whenAtQuota`
- `assertCanCreateApp_ignoresDeletedApps` (les apps `DELETED` ne comptent pas dans le quota)
- `updateQuota_persistsNewLimits`
- `updateQuota_throwsNotFound_whenUserMissing`

**Résultat réel** (`mvn -Dtest=QuotaServiceTest test`) :
```
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.339 s
[INFO] BUILD SUCCESS
```

### f) Comment vérifier manuellement

Dans l'UI admin : "Clients" → bouton "Quota" sur une ligne → modifier les valeurs → sauvegarder →
le panneau affiche "Saved and synced to cluster."

---

## P2.7 — Rollback de déploiement (vérifié, aucun changement nécessaire)

**Aucun fichier créé ou modifié pour cet item.** En explorant le code avant de coder, ce chantier
s'est révélé **déjà entièrement implémenté** avant cette session :
- `KnativeService.listRevisions()` / `rollbackToRevision()` (backend, pré-existant)
- `AppController` : `GET /api/apps/{id}/revisions`, `POST /api/apps/{id}/rollback/{revisionName}` (pré-existant)
- `AppService.rollback()` trace l'action dans `DeploymentLog` (pré-existant)
- `web-portal/src/pages/AppDetails.jsx` : composant `RevisionHistory` + `RollbackModal` avec confirmation (pré-existant)

Aucun test n'a été ajouté puisqu'aucun code n'a été modifié.

---

## P2.6 — Status page publique + incidents

### a) Ce qui a été ajouté

**Nouveaux fichiers (backend)** :
- `backend-api/src/main/java/com/platform/api/status/Incident.java`
- `backend-api/src/main/java/com/platform/api/status/IncidentRepository.java`
- `backend-api/src/main/java/com/platform/api/status/StatusService.java`
- `backend-api/src/main/java/com/platform/api/status/StatusController.java`
- `backend-api/src/main/java/com/platform/api/status/AdminIncidentController.java`
- `backend-api/src/main/java/com/platform/api/status/StatusRateLimitFilter.java`
- `backend-api/src/main/java/com/platform/api/status/dto/IncidentRequest.java`
- `backend-api/src/main/java/com/platform/api/status/dto/PublicStatusResponse.java`
- `backend-api/src/test/java/com/platform/api/status/StatusRateLimitFilterTest.java`

**Nouveaux fichiers (frontend)** :
- `web-portal/src/pages/StatusPage.jsx`
- `web-portal/src/pages/admin/AdminIncidents.jsx`

**Fichiers modifiés** :
- `backend-api/src/main/java/com/platform/api/security/SecurityConfig.java` (whitelist `/api/status/**` en GET + filtre de rate limit)
- `web-portal/src/App.jsx`, `web-portal/src/api/index.js`, `web-portal/src/components/Sidebar.jsx`

### b) Détail technique

**`StatusService.getStatus()`** vérifie 3 composants : API (implicite, si la requête aboutit), base
de données (`SELECT 1` via `JdbcTemplate`), cluster Kubernetes (`kubernetesClient.namespaces().list()`).
L'uptime 24h par composant est calculé via une requête PromQL exploitant la métrique standard
`up{job="backend-api"}` (générée automatiquement par Prometheus pour toute cible scrapée depuis P0.2,
aucune métrique custom nécessaire) : `avg_over_time(up{job="backend-api"}[24h]) * 100`.

**`StatusRateLimitFilter`** : rate limit **en mémoire, par IP**, 30 requêtes/minute, appliqué
uniquement aux chemins `/api/status/**` — seule surface non authentifiée de l'API. Limite connue :
protège une seule instance, pas un déploiement multi-pods (pas de stockage partagé type Redis).

**Incidents** : saisis manuellement par un admin pour l'instant (pas encore reliés automatiquement à
Alertmanager). `GET /api/status` et `GET /api/status/incidents` sont publics ; `POST`/`PUT`/`DELETE
/api/admin/incidents` sont réservés `ADMIN`.

### c) Extraits de code significatifs

```java
@Override
protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
    if (!request.getRequestURI().startsWith("/api/status")) {
        chain.doFilter(request, response);
        return;
    }
    String ip = clientIp(request);
    long now = System.currentTimeMillis();
    Window window = buckets.compute(ip, (key, existing) -> {
        if (existing == null || now - existing.windowStart() > WINDOW_MILLIS) {
            return new Window(now, new AtomicInteger(1));
        }
        existing.count().incrementAndGet();
        return existing;
    });
    if (window.count().get() > MAX_REQUESTS_PER_WINDOW) {
        response.setStatus(429);
        response.getWriter().write("{\"detail\":\"Too many requests — try again in a minute.\"}");
        return;
    }
    chain.doFilter(request, response);
}
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `7e7a178`)

```
backend-api/.../security/SecurityConfig.java              |   4 +
backend-api/.../status/AdminIncidentController.java        |  60 ++++++++++
backend-api/.../status/Incident.java                        |  48 ++++++++
backend-api/.../status/IncidentRepository.java              |  12 ++
backend-api/.../status/StatusController.java                |  34 ++++++
backend-api/.../status/StatusRateLimitFilter.java           |  65 +++++++++++
backend-api/.../status/StatusService.java                   | 119 +++++++++++++++++++
backend-api/.../status/dto/IncidentRequest.java              |  26 +++++
backend-api/.../status/dto/PublicStatusResponse.java         |  16 +++
backend-api/.../status/StatusRateLimitFilterTest.java        |  63 ++++++++++
web-portal/src/App.jsx                                       |   6 +
web-portal/src/api/index.js                                  |   8 ++
web-portal/src/components/Sidebar.jsx                        |   3 +-
web-portal/src/pages/StatusPage.jsx                          | 127 +++++++++++++++++++++
web-portal/src/pages/admin/AdminIncidents.jsx                | 125 ++++++++++++++++++++
15 files changed, 715 insertions(+), 1 deletion(-)
```

### e) Tests

`StatusRateLimitFilterTest` — 3 tests :
- `allowsRequestsUnderTheLimit` : 30 requêtes sous la limite → toutes en 200.
- `blocksRequestsOverTheLimit` : 31e requête → 429.
- `ignoresRequestsOutsideStatusPath` : un chemin hors `/api/status` n'est jamais limité.

**Résultat réel** (`mvn -Dtest=StatusRateLimitFilterTest test`) :
```
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.383 s
[INFO] BUILD SUCCESS
```

Aucun test automatisé pour `StatusService` (dépendance directe à un client K8s et à Prometheus,
non mockés dans cette session) — vérifié manuellement uniquement (voir point f).

### f) Comment vérifier manuellement

Ouvrir `/status` sans être connecté → statut global + composants + historique d'incidents visibles.
Depuis l'admin, "Incidents" → créer un incident → il apparaît immédiatement sur `/status`.

---

## P2.8 — Sauvegarde automatisée + DR

### a) Ce qui a été ajouté

**Nouveaux fichiers** :
- `docs/BACKUP_AND_RESTORE.md`
- `k8s/backup/backup-secret.example.yaml`
- `k8s/backup/postgres-backup-cronjob.yaml`
- `k8s/backup/elasticsearch-snapshot-cronjob.yaml`

**Aucun fichier existant modifié.** Aucun code Java/JS touché — uniquement manifestes K8s et
documentation.

### b) Détail technique

**Décision produit** : provider **S3-compatible générique** (`AWS_ENDPOINT_URL` configurable), pas
figé sur AWS — fonctionne avec MinIO/OVH/Scaleway/etc.

**`postgres-backup-cronjob.yaml`** : `CronJob` quotidien (02h30). Un `initContainer`
`postgres:15-alpine` exécute `pg_dump` sur un volume `emptyDir` partagé (choisi plutôt que d'installer
`pg_dump` dans l'image `aws-cli` à l'exécution, plus fragile) ; le conteneur principal
`amazon/aws-cli` uploade le dump gzippé et purge les anciennes sauvegardes (7 quotidiens + 4
hebdomadaires, tagués par jour de la semaine via `date +%u`).

**`elasticsearch-snapshot-cronjob.yaml`** : `CronJob` quotidien (03h00) qui déclenche un snapshot
natif ES vers un repository S3 déjà enregistré, avec la même politique de rétention appliquée via
l'API `_snapshot` d'Elasticsearch.

### c) Extraits de code significatifs

```yaml
initContainers:
  - name: pg-dump
    image: postgres:15-alpine
    command: ["/bin/sh", "-c"]
    args:
      - |
        DATE=$(date +%Y-%m-%d)
        pg_dump --no-owner --no-privileges | gzip > "/dump/pg-${PGDATABASE}-${DATE}.sql.gz"
    volumeMounts:
      - { name: dump, mountPath: /dump }
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `247214d`)

```
docs/BACKUP_AND_RESTORE.md                       | 95 ++++++++++++++++++++++++++
k8s/backup/backup-secret.example.yaml            | 15 ++++
k8s/backup/elasticsearch-snapshot-cronjob.yaml    | 53 ++++++++++++++
k8s/backup/postgres-backup-cronjob.yaml           | 81 ++++++++++++++++++++++
4 files changed, 244 insertions(+)
```

### e) Tests

**Aucun test automatisé** — cet item ne contient que des manifestes YAML et de la documentation, il
n'y a pas de logique applicative à tester unitairement. Validation faite via :
```bash
kubectl apply --dry-run=client -f k8s/backup/postgres-backup-cronjob.yaml
kubectl apply --dry-run=client -f k8s/backup/elasticsearch-snapshot-cronjob.yaml
kubectl apply --dry-run=client -f k8s/backup/backup-secret.example.yaml
```
Résultat réel obtenu :
```
cronjob.batch/postgres-backup created (dry run)
cronjob.batch/elasticsearch-snapshot created (dry run)
secret/backup-s3-credentials created (dry run)
```
Ceci valide uniquement la syntaxe/structure des manifestes — **pas** l'exécution réelle du backup
(non testée faute d'accès à un vrai bucket S3 et un vrai cluster).

### f) Comment vérifier manuellement

Voir `docs/BACKUP_AND_RESTORE.md` — nécessite un vrai bucket S3-compatible et des identifiants
avant de pouvoir tester l'exécution réelle du `CronJob`.

---

## Séparation frontend client/admin (hors plan initial, demandée en cours de session)

### a) Ce qui a été ajouté

**Nouveau répertoire** : `admin-console/` — application Vite complète et autonome, copie réduite de
`web-portal/` ne contenant que : `Login.jsx` + les 6 pages sous `src/pages/admin/`
(`AdminDashboard`, `ClusterManagement`, `AdminBilling`, `AdminClients`, `AdminAuditLog`,
`AdminIncidents`), plus tous les composants transverses nécessaires (`Layout`, `Sidebar`,
`AuthContext`, etc.).

**Nouveaux fichiers CI/CD et K8s** :
- `ci-cd/docker/admin.Dockerfile`, `ci-cd/docker/admin-kaniko.Dockerfile`
- `ci-cd/jenkins/pipelines/Jenkinsfile.admin`
- `k8s/admin/deployment.yaml`
- `README.md` (nouveau, à la racine)

**Fichiers modifiés** :
- `web-portal/src/App.jsx` (retrait des 6 routes admin)
- `web-portal/src/components/Sidebar.jsx` (retrait des entrées de menu correspondantes, ajout d'un lien externe vers `admin-console`)

### b) Détail technique

**Correction factuelle importante** : la demande initiale partait de l'hypothèse d'une app Next.js
14. Le frontend réel est en **React + Vite** — il n'y a jamais eu de Next.js dans ce repo. Le plan a
été adapté (proxy `/api` via `vite.config.js`, pas de `next.config.js`).

**Correction de périmètre** : `/monitoring`, `/users`, `/kafka`, `/eventing`, `/logs` sont restés
dans `web-portal` — ce sont des pages **client**, pas admin-only (`Monitoring.jsx` et `Users.jsx`
font un branchement interne sur le rôle). Seules les 6 pages **exclusivement** admin (situées sous
`src/pages/admin/`) ont été déplacées. `/admin/users` reste dans web-portal car il pointe vers
`Users.jsx`, situé hors de `src/pages/admin/`.

**Déploiement K8s** : `platform-admin` est un `Service` de type `ClusterIP` (pas `LoadBalancer`,
pas exposé via l'IP MetalLB publique ni Kourier) — accessible uniquement en interne
(port-forward ou futur VPN).

### c) Extraits de code significatifs

```yaml
# k8s/admin/deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: platform-admin
  namespace: platform
spec:
  type: ClusterIP   # jamais LoadBalancer — pas d'exposition publique
  selector:
    app: platform-admin
  ports:
  - port: 80
    targetPort: 80
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `6134184`)

42 fichiers changés, **7370 insertions(+), 47 deletions(-)** au total (la majorité provient du
`package-lock.json` dupliqué, 4808 lignes à lui seul, et de la copie des composants transverses).
Fichiers métier clés :
```
README.md                                    |  81 +
web-portal/src/App.jsx                       |  38 +-
web-portal/src/components/Sidebar.jsx        |  36 +-
ci-cd/jenkins/pipelines/Jenkinsfile.admin     |  85 +
k8s/admin/deployment.yaml                    |  39 +
ci-cd/docker/admin.Dockerfile                |  18 +
ci-cd/docker/admin-kaniko.Dockerfile          |   9 +
```

### e) Tests

**Aucun test automatisé** (pas de suite de tests frontend dans ce projet). Vérification faite par
build réel des deux applications :
```
web-portal   : npx vite build --mode production → ✓ built in 5.69s (aucune erreur)
admin-console: npx vite build --mode production → ✓ built in 5.39s (aucune erreur)
```
Et validation du manifeste K8s : `kubectl apply --dry-run=client -f k8s/admin/deployment.yaml` →
`deployment.apps/platform-admin created (dry run)` / `service/platform-admin created (dry run)`.

**Incident pendant la session** : une commande `ln -s ../web-portal/node_modules node_modules`
suivie d'un `rm -rf node_modules` a accidentellement supprimé le vrai `node_modules` de
`web-portal` (comportement Windows/Git Bash sur les symlinks de dossier). Corrigé immédiatement par
un `npm install` complet, confirmé par un nouveau build réussi. Aucune perte de code source — seul
un répertoire de dépendances régénérable a été affecté.

### f) Comment vérifier manuellement

```bash
cd web-portal && npm run dev       # http://localhost:5173 — plus de pages /admin/*
cd admin-console && npm run dev    # http://localhost:3001 — uniquement les 6 pages admin, bandeau rouge visible
```

---

## P3.9 — Anomaly detection coûts/trafic

### a) Ce qui a été ajouté

**Nouveaux fichiers (backend)** :
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyAlert.java`
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyAlertRepository.java`
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyDetectionService.java`
- `backend-api/src/main/java/com/platform/api/anomaly/AnomalyScheduler.java`
- `backend-api/src/main/java/com/platform/api/anomaly/AdminAnomalyController.java`
- `backend-api/src/test/java/com/platform/api/anomaly/AnomalyDetectionServiceTest.java`

**Nouveaux fichiers (frontend)** :
- `admin-console/src/pages/admin/AdminAnomalies.jsx`

**Fichiers modifiés** :
- `admin-console/src/App.jsx`, `admin-console/src/api/index.js`, `admin-console/src/components/Layout.jsx`, `admin-console/src/components/Sidebar.jsx`

### b) Détail technique

**Approche volontairement simple (seuil/écart-type), pas de ML**, conformément au plan.

**Détection de coût** (`detectCostAnomalies`, quotidienne à 08h30) : exploite les données déjà
existantes `BillingSnapshotRepository.dailyPerUserRaw(...)` (rollups horaires déjà produits par le
module billing). Pour chaque tenant avec au moins 5 jours d'historique, calcule la moyenne des jours
précédents et flague le jour courant s'il dépasse **2,5× cette moyenne** (et que la moyenne dépasse
5 centimes, pour ignorer le bruit sur des baselines quasi nulles).

**Détection de trafic** (`detectTrafficAnomalies`, horaire) : pour chaque app `RUNNING`, compare le
taux de requêtes sur 5 minutes à sa propre moyenne sur 1 heure (deux requêtes PromQL), flague si le
ratio dépasse **3×**.

**Anti-spam** : un cooldown de 20h par `(userId, type, appId)` empêche de recréer la même alerte à
chaque exécution tant qu'elle n'a pas expiré.

### c) Extraits de code significatifs

```java
if (mean < MIN_MEANINGFUL_COST) continue;
if (today <= mean * COST_SPIKE_MULTIPLIER) continue;

recordIfNew("COST", userId, null, null,
        String.format("Daily cost $%.2f is %.1fx the %d-day average ($%.2f) for this tenant.",
                today, today / mean, baselineDays.size(), mean),
        today, mean);
```

```java
private void recordIfNew(String type, String userId, String appId, String appName,
                          String message, double value, double baseline) {
    LocalDateTime cooldownStart = LocalDateTime.now().minusHours(20);
    if (anomalyAlertRepository.existsByUserIdAndTypeAndAppIdAndDetectedAtAfter(userId, type, appId, cooldownStart)) {
        return; // déjà alerté récemment
    }
    ...
}
```

### d) Lignes de code ajoutées/modifiées (`git diff --stat`, commit `57a3fe6`)

```
admin-console/src/App.jsx                              |   2 +
admin-console/src/api/index.js                         |   2 +
admin-console/src/components/Layout.jsx                |   1 +
admin-console/src/components/Sidebar.jsx               |   3 +-
admin-console/src/pages/admin/AdminAnomalies.jsx       | 155 ++++++++++++++++++++
backend-api/.../anomaly/AdminAnomalyController.java     |  39 +++++
backend-api/.../anomaly/AnomalyAlert.java               |  53 +++++++
backend-api/.../anomaly/AnomalyAlertRepository.java     |  13 ++
backend-api/.../anomaly/AnomalyDetectionService.java    | 159 +++++++++++++++++++++
backend-api/.../anomaly/AnomalyScheduler.java           |  34 +++++
backend-api/.../anomaly/AnomalyDetectionServiceTest.java| 138 ++++++++++++++++++
11 files changed, 598 insertions(+), 1 deletion(-)
```

### e) Tests

`AnomalyDetectionServiceTest` — 6 tests :
- `detectCostAnomalies_flagsSpikeAboveBaseline` : coût du jour à 10× la moyenne de 5 jours → alerte créée avec les bonnes valeurs (`value=10.0`, `baseline=1.0`).
- `detectCostAnomalies_ignoresNormalVariance` : variation normale (1.3 vs moyenne ~1.0) → aucune alerte.
- `detectCostAnomalies_skipsWhenNotEnoughHistory` : seulement 2 jours de données → aucune alerte (seuil minimum non atteint).
- `detectCostAnomalies_respectsCooldown_doesNotDuplicateAlert` : une alerte déjà émise dans les 20h → pas de doublon.
- `detectTrafficAnomalies_skipsWhenNoRunningApps` : aucune app → aucune interaction avec le repository d'alertes.
- `detectTrafficAnomalies_ignoresNonRunningApps` : app `SUSPENDED` → ignorée.

**Résultat réel** (`mvn -Dtest=AnomalyDetectionServiceTest test`) :
```
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.879 s
[INFO] BUILD SUCCESS
```

### f) Comment vérifier manuellement

Pas de déclenchement manuel simple sans attendre le scheduler — vérifier via
`GET /api/admin/anomalies` (Bearer token ADMIN) après qu'un cycle horaire/quotidien se soit
écoulé, ou consulter la page "Anomalies" dans `admin-console`. Réponse attendue si des anomalies
existent :
```json
{ "content": [ { "type": "COST", "userId": "...", "message": "Daily cost $10.00 is 10.0x the 5-day average ($1.00) for this tenant.", "acknowledged": false } ], "totalPages": 1 }
```

---

## 3. Ce qui n'a PAS été fait / limites connues (dans cette session)

- **P1.4 (RBAC multi-rôles)** : explicitement écarté par l'utilisateur — pas de granularité de
  sous-rôles sous ADMIN implémentée.
- **P3.10 (assistant admin en langage naturel)** : non commencé. Une décision produit était en
  attente (moteur par règles/mots-clés sans API externe, vs intégration réelle d'un LLM avec gestion
  de clé API/secret) au moment de la rédaction de ce document.
- **P2.6 — `StatusService`** : aucun test automatisé (dépendances directes à `KubernetesClient` et
  Prometheus non mockées dans cette session) — seulement vérifié manuellement.
- **P2.8** : validé uniquement en syntaxe (`kubectl --dry-run=client`) — l'exécution réelle du
  backup vers un bucket S3 n'a pas pu être testée (pas d'accès à un vrai bucket dans cette session).
- **Keycloak** : `admin-console` réutilise le même client Keycloak `platform-web` que `web-portal`
  (pas de client `platform-admin` dédié créé — travail de configuration Keycloak, hors périmètre
  d'un changement purement frontend).
- **Bundle size** : les deux apps frontend génèrent un avertissement Vite "chunk > 500 kB" — non
  traité (pas demandé, aurait nécessité du code-splitting).

## 4. Impact sur l'existant

- **Module billing** : non touché dans cette session (uniquement lu pour P3.9, aucune modification
  de fichier). Aucune régression identifiée.
- **Module eventing** : non touché. Aucune régression identifiée.
- **Items des sessions précédentes** : la suite de tests complète (`mvn test`) a été relancée après
  chaque nouvel item de cette session, cumulant en fin de session **21 tests, 0 échec** (résultat
  réel après P3.9) :
  ```
  [INFO] Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
  [INFO] BUILD SUCCESS
  ```
  Ce total couvre : `AdminControllerReadyStatusTest` (4), `AnomalyDetectionServiceTest` (6),
  `AdminAuditLogServiceTest` (2), `QuotaServiceTest` (6), `StatusRateLimitFilterTest` (3).

### Changements de configuration nécessaires

- **Aucune nouvelle variable d'environnement backend obligatoire** — `app.prometheus.url` était
  déjà configuré (P0.2 le rend simplement utile pour de vrai).
- **Frontend** : `VITE_ADMIN_CONSOLE_URL` (optionnelle, défaut `http://localhost:3001`) dans
  `web-portal` pour le lien vers l'admin console.
- **P2.8** : nécessite la création manuelle d'un secret K8s `backup-s3-credentials` (voir
  `k8s/backup/backup-secret.example.yaml`) avant que les `CronJob` fonctionnent réellement.
- **Aucune dépendance Maven/npm ajoutée** dans cette session (tout est construit avec les
  dépendances déjà présentes : Micrometer, WebClient, Spring Data JPA, etc.).

## 5. Vue d'ensemble de l'avancement global du plan

| Item | Titre | Statut |
|---|---|---|
| P0.1 | Audit log des actions admin | ✅ Fait |
| P0.2 | Prometheus + Grafana + Alertmanager | ✅ Fait |
| P1.3 | Quotas & limites par tenant | ✅ Fait |
| P1.4 | RBAC multi-rôles | ⚪ Écarté (demande explicite de l'utilisateur) |
| P1.5 | Fix statut Ready Knative + erreurs masquées frontend | ✅ Fait |
| P2.6 | Status page publique + incidents | ✅ Fait |
| P2.7 | Rollback de déploiement | ✅ Déjà existant (vérifié, non recodé) |
| P2.8 | Sauvegarde automatisée + DR | ✅ Fait |
| P3.9 | Anomaly detection coûts/trafic | ✅ Fait |
| P3.10 | Assistant admin en langage naturel | ⚪ Pas commencé |

## 6. Prochaine étape suggérée

**P3.10 — Assistant admin en langage naturel**, à condition de trancher d'abord la décision produit
en attente : parseur par règles/mots-clés (rapide, sans coût, sans secret à gérer, mais limité aux
formulations proches des patterns supportés) vs intégration réelle d'un LLM (plus flexible, plus
impressionnant pour une soutenance, mais nécessite une clé API à sécuriser et un coût par requête).
C'est le seul item du plan encore réellement ouvert.
