# Phase 6 : Tendances historiques

Phase 6 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : REPORTÉE (skip utilisateur, non explorée)

## Objectif initial

Afficher des graphiques de tendance (CPU/RAM cluster, REQ/SEC, taux d'erreur) sur une fenêtre de temps, via l'API Prometheus `query_range` plutôt que des requêtes instantanées.

## État

Non investiguée — l'utilisateur a choisi de passer directement à la Phase 7 sans vérifier que `query_range` fonctionne comme attendu sur les métriques déjà utilisées. À reprendre plus tard si besoin, en testant dans l'UI Prometheus (onglet Graph) :
```
sum(rate(revision_request_count[5m]))
```
sur plusieurs heures.

## Décision utilisateur

Skip, passage à la Phase 7 (usage par tenant).
