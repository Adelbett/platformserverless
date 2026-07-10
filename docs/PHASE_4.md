# Phase 4 : Req/sec via Kourier/Prometheus

Phase 4 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : REPORTÉE (skip utilisateur, non explorée)

## Objectif initial

REQ/SEC est déjà corrigé en Phase 0 au niveau `revision` (métriques `revision_request_count` exposées par `queue-proxy`). La Phase 4 visait à ajouter une vue complémentaire au niveau **Kourier** (l'ingress gateway Knative, basé sur Envoy) — utile pour voir le débit agrégé au point d'entrée du cluster plutôt que par revision individuelle.

## État

Non investiguée — l'utilisateur a choisi de passer directement à la Phase 5 sans vérifier les métriques `envoy_*`/`kourier_*` dans Prometheus. À reprendre plus tard si besoin, en testant :
```
count by (__name__) ({__name__=~"envoy_.*|kourier_.*"})
```

## Décision utilisateur

Skip, passage à la Phase 5 (alertes Alertmanager actives).
