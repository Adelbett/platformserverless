# Phase 10 : Coût

Phase 10 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : REPORTÉE (skip utilisateur) — déjà couverte ailleurs

## Constat fait avant implémentation

Cette fonctionnalité existe déjà entièrement dans le projet, en dehors de `/cluster` :
- Tarification réelle : `CPU_PER_VCPU_HOUR = 0.048`, `MEM_PER_GB_HOUR = 0.006` (`backend-api/src/main/java/com/platform/api/billing/BillingService.java`), snapshots horaires par app.
- Endpoint admin complet : `GET /billing/admin` (coût par client, projection mensuelle, historique quotidien, coût par app).
- Page frontend complète : `admin-console/src/pages/admin/AdminBilling.jsx` (menu "Revenue") — KPIs, tableau par client, graphiques, onglet Kafka.

## Option proposée (non implémentée)

Ajouter une carte KPI condensée sur `/cluster` (ex: "Coût MTD plateforme" + "Coût projeté") réutilisant `GET /billing/admin` déjà existant, sans nouveau calcul — juste un raccourci visuel.

## Décision utilisateur

Skip, passage à la Phase 11 sans implémentation. Le coût reste consultable via la page Revenue existante.
