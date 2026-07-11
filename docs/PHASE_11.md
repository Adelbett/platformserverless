# Phase 11 : Export d'audit enrichi

Phase 11 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : IMPLÉMENTÉE — en attente de déploiement/vérification en prod

## Objectif

Le journal d'audit admin (`GET /admin/audit-log`, paginé, filtrable) existe déjà, mais sans export téléchargeable — ajout d'un bouton "Export CSV" qui télécharge l'historique complet (respectant les filtres actifs), pas juste la page affichée.

## Design

Réutilise `AdminAuditLogService.search()` déjà existant (mêmes filtres : `actorUserId`, `targetId`, `action`, `from`, `to`) avec une pagination `Integer.MAX_VALUE` au lieu de la page de 20 affichée à l'écran, pour exporter tout l'historique filtré d'un coup. Export en **CSV** (pas Excel/POI comme `BillingExportService`) car le journal d'audit est une table plate sans besoin de mise en forme/feuilles multiples.

## Fichiers créés

- `backend-api/src/main/java/com/platform/api/audit/AdminAuditLogExportService.java` — `exportCsv(actorUserId, targetId, action, from, to)`, génère le CSV avec échappement standard (virgules, guillemets, retours à la ligne).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — nouvel endpoint `GET /admin/audit-log/export` (mêmes paramètres de filtre que `/admin/audit-log`), retourne le CSV en pièce jointe téléchargeable (`Content-Disposition: attachment`).
- `admin-console/src/api/index.js` — `adminApi.exportAuditLog(params)` (`responseType: 'blob'`).
- `admin-console/src/pages/admin/AdminAuditLog.jsx` — bouton "Export CSV" à côté de "Refresh", déclenche le téléchargement du fichier avec les filtres actifs de la page (action/target/actor).

## Prochaine étape

Push + déploiement, puis sur la page Audit Log d'admin-console : cliquer "Export CSV" (avec et sans filtres actifs) et vérifier que le fichier téléchargé contient bien les colonnes attendues (Timestamp, Actor User ID, Actor Username, Action, Target Type, Target ID, Reason, IP Address) et les bonnes lignes.
