# Phase 8 : Stockage / PVC

Phase 8 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : IMPLÉMENTÉE (niveau 1) — en attente de déploiement/vérification en prod

## Objectif

Lister les volumes de stockage persistants (PersistentVolumeClaim) utilisés par les apps du cluster.

## Deux niveaux possibles

1. **Infos K8s de base** (implémenté ici) : nom, namespace, capacité, statut (Bound/Pending), classe de stockage, modes d'accès — via l'API Kubernetes, pas besoin de Prometheus.
2. **Usage réel du volume** (non implémenté) : combien d'espace est réellement rempli sur le volume (vs juste demandé) — nécessiterait la métrique `kubelet_volume_stats_used_bytes`, à vérifier dans Prometheus avant d'ajouter.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — nouvel endpoint `GET /admin/cluster/storage`, méthode `pvcInfo()` (nom, namespace, statut, storageClass, accessModes, volumeName, requestedCapacity, actualCapacity) via `kubernetesClient.persistentVolumeClaims().inAnyNamespace()`.
- `admin-console/src/api/index.js` — `adminApi.getStorage()`.
- `admin-console/src/pages/admin/ClusterManagement.jsx` — nouvelle section "Storage — Persistent Volumes" sur l'Overview, juste après "Tenant Namespaces".

## Prochaine étape

Push + déploiement, vérifier que la section liste bien les PVC existants (ou "No persistent volume claims found" si aucun n'est utilisé sur ce cluster — possible si les apps sont stateless). Si des PVC existent et qu'on veut l'usage réel (niveau 2), tester dans Prometheus :
```
kubelet_volume_stats_used_bytes
```
