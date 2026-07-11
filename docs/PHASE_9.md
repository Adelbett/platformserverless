# Phase 9 : Posture sécurité

Phase 9 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : REPORTÉE (skip utilisateur, non implémentée)

## Objectif initial (proposé, non validé)

Le brief ne précisait pas le périmètre exact. Proposition faite avant implémentation :
- Pods tournant en root (`runAsNonRoot` absent).
- Conteneurs privilégiés (`privileged: true`).
- RBAC trop permissif (ex: le type de bug corrigé en Phase 0 sur le ServiceAccount `default`).
- Secrets en variables d'environnement en clair.
- Images sans tag figé (`:latest`).

Limite explicite : pas de scan CVE réel (nécessiterait Trivy/Grype, non installé sur ce cluster) — seulement des vérifications de configuration K8s basiques.

## Décision utilisateur

Skip, passage à la Phase 10 (coût) sans implémentation.
