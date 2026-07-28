# Liste blanche CORS incomplète — NodePort auto-attribué de `platform-web` manquant

## Problème

Après qu'une nouvelle image backend intégrant le correctif CORS du ticket 004 ait été déployée automatiquement (via le webhook Jenkins nouvellement configuré), toute création d'app depuis le frontend a commencé à échouer en **403 Forbidden**, avec le corps de réponse `"Invalid CORS request"`.

## Gravité

Élevée (fonctionnalité de déploiement d'app cassée pour l'origine réellement utilisée)

## Pourquoi c'était un problème

`CORS_ALLOWED_ORIGINS` (posé au ticket 004) listait :
- `http://10.9.21.238` (IP externe du `LoadBalancer` `platform-web`)
- `http://10.9.21.223:30081`, `:224:30081`, `:225:30081` (NodePort de `platform-admin`)

Mais l'utilisateur accédait en réalité à l'application via `http://10.9.21.224:31088` — une adresse absente de cette liste. Investigation (`kubectl get svc platform-web -n platform -o wide`) : `platform-web` est un service `LoadBalancer`, qui reçoit par défaut **aussi** un `NodePort` auto-attribué par Kubernetes en plus de son IP externe — en l'occurrence `31088`, joignable sur n'importe lequel des 3 nœuds. Cette voie d'accès n'avait pas été anticipée lors de la configuration initiale de la liste blanche (ticket 004), qui ne couvrait que l'IP `LoadBalancer` et le `NodePort` de `platform-admin`.

Le message `"Invalid CORS request"` est le texte exact renvoyé par le `CorsFilter` de Spring lorsqu'une origine ne correspond à aucune entrée de la liste blanche — rejeté avant même d'atteindre le contrôleur, donc invisible dans les logs applicatifs (`kubectl logs`).

## Solution retenue

Compléter `CORS_ALLOWED_ORIGINS` avec les 3 combinaisons nœud + NodePort de `platform-web` (`31088`), en plus de ce qui existait déjà pour `platform-admin` (`30081`) et l'IP `LoadBalancer`.

## Alternatives étudiées

- **Restreindre l'accès à la seule IP `LoadBalancer`** (interdire l'accès via NodePort) : écarté — nécessiterait de bloquer ce chemin d'accès au niveau réseau/pare-feu, un changement plus large hors du périmètre d'un correctif CORS, et l'utilisateur utilise activement cette voie d'accès.

## Fichiers modifiés

- `backend-api/src/main/resources/application-k8s.yml`
- `k8s/backend/deployment.yaml`

## Changements réalisés

- `application-k8s.yml` : valeur par défaut de `app.cors.allowed-origins` complétée avec `http://10.9.21.223:31088`, `http://10.9.21.224:31088`, `http://10.9.21.225:31088`.
- `k8s/backend/deployment.yaml` : `CORS_ALLOWED_ORIGINS` ajoutée **explicitement** comme variable d'environnement (elle ne l'était pas avant — seule une valeur par défaut existait dans le JAR), pour que ce correctif prenne effet immédiatement via `kubectl set env`/`kubectl apply`, sans dépendre d'un nouveau build d'image.
- Correctif appliqué en urgence sur le cluster via `kubectl set env deployment/platform-api -n platform CORS_ALLOWED_ORIGINS="..."` avant que le code ne soit redéployé.

## Impact

- Le déploiement d'apps (et tout autre appel API) fonctionne à nouveau depuis `http://10.9.21.224:31088` (et les deux autres nœuds).
- CORS reste strict (liste blanche, pas de wildcard) — seule la liste des origines couvertes a été complétée.

## Risques

- **Dépendance à des IP statiques** : si les IP des nœuds ou l'IP `LoadBalancer` changent (reconfiguration MetalLB, remplacement de nœud), cette liste devra être mise à jour à nouveau — même fragilité déjà documentée pour `KEYCLOAK_ISSUER_URI` (ticket 047). Un nom de domaine stable ou un Ingress centralisé réglerait ce problème de fond (déjà noté comme écart d'infrastructure dans l'audit initial).
- Aucun risque de régression : ajout d'entrées à une liste blanche existante, ne retire rien.

## Tests à effectuer

- ✅ Vérifié en production par l'utilisateur : la création d'app depuis `http://10.9.21.224:31088` ne retourne plus `403 Invalid CORS request` (la requête aboutit désormais à une réponse applicative normale).

## Validation

1. `kubectl get deployment platform-api -n platform -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name=="CORS_ALLOWED_ORIGINS")'` affiche la liste complète.
2. Appel API depuis chacune des origines listées ne déclenche plus de rejet CORS.

## Commit Git conseillé

```
fix(backend): add platform-web's auto-assigned NodePort to the CORS allowlist
```
