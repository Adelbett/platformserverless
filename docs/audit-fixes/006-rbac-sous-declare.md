# RBAC versionné très en-deçà des permissions réellement exercées

## Problème

`k8s/backend/rbac.yaml` ne déclarait qu'un `ClusterRole`/`ClusterRoleBinding` couvrant `nodes`/`events`. Le code du backend fait pourtant beaucoup plus : création de namespaces, gestion complète des Knative Services, listing de pods sur tout le cluster, gestion de topics Kafka, etc. Un audit du cluster réel a révélé qu'un second `ClusterRole`/`ClusterRoleBinding` (`platform-backend-role` / `platform-correct-binding`), non versionné dans ce dépôt, accordait ces permissions supplémentaires en direct sur le cluster.

## Gravité

Critique

## Pourquoi c'était un problème

- **Dérive IaC / cluster non documentée** : le fichier Git ne reflétait pas la réalité des permissions accordées. Reconstruire le cluster à partir de ce dépôt seul aurait recréé un backend avec des permissions bien plus restreintes que celles réellement utilisées, cassant silencieusement des fonctionnalités.
- **Deux bugs silencieux confirmés en conditions réelles** (vérifiés via `kubectl auth can-i` sur le cluster) :
  - `resourcequotas: create` manquant → `QuotaService.syncToCluster()` échoue à chaque appel (catché en `log.error`, jamais remonté à l'utilisateur) — les quotas par tenant n'étaient donc jamais réellement synchronisés sur le cluster.
  - `persistentvolumeclaims: list` manquant → `AdminController.getStorage()` renvoyait vraisemblablement une liste vide en silence (même pattern que le bug déjà documenté et corrigé pour `getNodes()`).
- **Portée excessive constatée** (identifiée, non corrigée dans ce ticket — voir "Alternatives") : le rôle caché accorde `delete`/`create`/`update` sur `pods`/`services`/`deployments`/`namespaces` au niveau **cluster entier**, pas seulement dans les namespaces des tenants. Le ServiceAccount qui fait tourner `platform-api` peut aujourd'hui, en théorie, supprimer des ressources dans n'importe quel namespace du cluster (`kube-system`, `monitoring`, `jenkins`, `kafka`...).

## Solution retenue

**Option A — documenter et compléter, sans réduire la portée actuelle** (choix explicite de l'utilisateur, pour ne rien casser sans revue de code plus poussée) :

1. Reconstruction fidèle dans `k8s/backend/rbac.yaml` du `ClusterRole` `platform-backend-role` et de son `ClusterRoleBinding` `platform-correct-binding`, à partir de leur contenu réel lu sur le cluster (`kubectl get clusterrole platform-backend-role -o yaml`) — mêmes noms d'objets, pour que `kubectl apply` converge sans suppression/recréation.
2. Ajout des deux permissions manquantes identifiées : `persistentvolumeclaims: get/list` et `resourcequotas: get/list/watch/create/update`.
3. Documentation en commentaire dans le fichier de la portée volontairement large restante (`pods`/`services`/`deployments`/`namespaces` en `delete` cluster-wide), avec un renvoi explicite vers un futur ticket de resserrement de portée (Option B, non traité ici).

## Alternatives étudiées

- **Option B — réduire réellement la portée** (retirer `delete`/`create`/`update` cluster-wide sur les ressources K8s brutes, ne garder que ce que Knative/le code utilisent vraiment) : identifiée comme la correction cible à terme, mais écartée pour ce ticket. Risque : je ne peux pas garantir par revue statique seule qu'aucun chemin de code n'utilise ces droits larges quelque part de façon non détectée ; les retirer sans revue exhaustive pourrait casser une fonctionnalité en production. À traiter comme ticket séparé après une revue dédiée de tous les appels `kubernetesClient.pods()/.services()/.deployments()/.namespaces()`.
- **Fusionner les deux `ClusterRole` en un seul** : écarté pour rester au plus près de l'état actuel du cluster (moins de changement = moins de risque), conformément au choix "Option A" de ne pas réorganiser au-delà de la documentation/complétion.

## Fichiers modifiés

- `k8s/backend/rbac.yaml`

## Changements réalisés

- Conservation intacte du `ClusterRole`/`ClusterRoleBinding` `platform-api-cluster-reader` (nodes/events) déjà présent.
- Ajout du `ClusterRole` `platform-backend-role` (reconstruit à l'identique du rôle caché trouvé sur le cluster) et de son `ClusterRoleBinding` `platform-correct-binding`.
- Ajout de deux règles supplémentaires à `platform-backend-role` : `persistentvolumeclaims: get/list` et `resourcequotas: get/list/watch/create/update`.
- Commentaires détaillés expliquant la provenance de chaque règle, l'origine de la découverte (audit cluster réel), et la portée volontairement non réduite pour ce ticket.

## Impact

- **Corrige deux bugs silencieux réels** : les quotas par tenant seront réellement appliqués côté cluster, et `AdminController.getStorage()` renverra les vraies données au lieu d'une liste vide.
- Aucune réduction de permission — le comportement actuel du backend (tout ce qui fonctionnait déjà) continue de fonctionner à l'identique.
- Le dépôt Git reflète désormais fidèlement les permissions réellement accordées sur le cluster.

## Risques

- **Aucun risque de régression fonctionnelle** attendu : ce ticket n'ajoute que des permissions manquantes et documente l'existant, sans rien retirer.
- **La portée excessive (delete cluster-wide) reste en place** — risque de sécurité résiduel volontairement non traité ici, à couvrir par un ticket dédié (resserrement RBAC) après revue de code plus poussée.
- Léger risque opérationnel au moment de l'`apply` : si le `ClusterRole`/`ClusterRoleBinding` existants sur le cluster n'ont pas été créés via `kubectl apply` (donc sans annotation `last-applied-configuration`), un `kubectl apply` pourrait ne fusionner que partiellement les changements. Le `platform-backend-role` actuel a été vérifié comme portant déjà cette annotation (créé via `kubectl apply` à l'origine) — la convergence devrait donc être propre.

## Tests à effectuer

- `kubectl apply -f k8s/backend/rbac.yaml` (voir commandes détaillées ci-dessous).
- `kubectl auth can-i create resourcequotas -n <namespace-tenant> --as=system:serviceaccount:platform:default` → doit passer de `no` à `yes`.
- `kubectl auth can-i list persistentvolumeclaims --all-namespaces --as=system:serviceaccount:platform:default` → doit passer de `no` à `yes`.
- Manuel : déclencher une mise à jour de quota pour un tenant via l'admin console, vérifier dans les logs du pod `platform-api` l'absence d'erreur `Failed to sync ResourceQuota`.
- Manuel : consulter la page de stockage/PVC dans l'admin console, vérifier qu'elle affiche désormais des données (si des PVC existent sur le cluster).

## Validation

1. `kubectl auth can-i create resourcequotas -n <namespace-tenant> --as=system:serviceaccount:platform:default` → `yes`.
2. `kubectl auth can-i list persistentvolumeclaims --all-namespaces --as=system:serviceaccount:platform:default` → `yes`.
3. `kubectl get clusterrole platform-backend-role -o yaml` correspond au contenu de `k8s/backend/rbac.yaml`.
4. Aucune régression sur les fonctionnalités déjà en place (déploiement d'app, admin console, monitoring).

## Commandes à exécuter toi-même sur le cluster

```bash
# Applique les permissions mises à jour (ajout des 2 règles manquantes,
# aucune suppression — converge avec l'état existant sans interruption)
kubectl apply -f k8s/backend/rbac.yaml

# Vérifier que les 2 permissions manquantes sont désormais accordées
kubectl auth can-i create resourcequotas -n user-exemple --as=system:serviceaccount:platform:default
kubectl auth can-i list persistentvolumeclaims --all-namespaces --as=system:serviceaccount:platform:default
# les deux doivent maintenant répondre "yes"

# Confirmer que rien d'autre n'a changé côté cluster
kubectl get clusterrole platform-backend-role -o yaml
kubectl get clusterrolebinding platform-correct-binding -o yaml
```

Aucun redémarrage du pod `platform-api` n'est nécessaire — les permissions RBAC sont vérifiées à chaque appel API, pas au démarrage.

## Commit Git conseillé

```
fix(security): version and complete RBAC (add missing resourcequotas/PVC permissions)
```
