# Phase 2 : Cold-start Knative

Phase 2 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : NON RÉALISABLE telle que décrite dans le brief — reportée

## Objectif initial

Afficher un temps de cold-start (latence de démarrage à froid) pour les apps Knative scale-to-zero.

## Ce qui a été vérifié

Requête `{__name__=~"autoscaler_.*", namespace_name!=""}` dans Prometheus : aucune métrique `*cold_start*` n'existe. L'autoscaler Knative expose des métriques d'état de scaling (`autoscaler_actual_pods`, `desired_pods`, `pending_pods`, `not_ready_pods`, `terminating_pods`, `panic_mode`, `stable_request_concurrency`), mais **aucune métrique de latence de cold-start en millisecondes**.

## Conclusion

Sans instrumentation applicative supplémentaire (mesurer côté client le délai entre l'envoi d'une requête et la première réponse après un scale-from-zero), il n'est pas possible d'afficher un vrai "temps de cold-start" avec les métriques actuellement exposées par le cluster.

## Alternative possible (non implémentée, en attente de décision)

Afficher un **indicateur d'état de scaling en temps réel** par app plutôt qu'une latence :
- `pending_pods > 0` → badge "Scaling up..."
- `actual_pods == 0` → badge "Scaled to zero"
- `actual_pods == desired_pods` → badge "Stable"

Décision utilisateur : reportée, on passe à la Phase 3 (lag Kafka historique).
