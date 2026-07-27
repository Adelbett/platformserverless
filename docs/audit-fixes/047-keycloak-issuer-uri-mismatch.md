# Panne de production : `KEYCLOAK_ISSUER_URI` incohérent avec l'URL réelle de Keycloak (401 généralisé)

## Problème

Après le déploiement du correctif du ticket 003 (secrets externalisés, `kubectl apply -f k8s/backend/deployment.yaml`), toute authentification a cessé de fonctionner : chaque appel API authentifié échouait en `401 Unauthorized`, avec l'utilisateur systématiquement renvoyé à `/login` juste après une connexion pourtant réussie.

## Gravité

Critique (panne totale d'authentification en production)

## Pourquoi c'était un problème

Diagnostic conduit avec l'utilisateur, étape par étape (Network tab du navigateur → en-tête `WWW-Authenticate` de la réponse 401) :
```
www-authenticate: Bearer error="invalid_token",
  error_description="An error occurred while attempting to decode the Jwt: The iss claim is not valid"
```

Le token JWT émis par Keycloak contient `"iss":"http://10.9.21.236:8080/realms/platform"` — l'adresse **publique** par laquelle le frontend (`VITE_KEYCLOAK_URL`) atteint Keycloak. Mais `k8s/backend/deployment.yaml` configurait `KEYCLOAK_ISSUER_URI` sur l'adresse **interne du cluster** (`http://keycloak.platform.svc.cluster.local:8080/realms/platform`). Spring Security OAuth2 Resource Server compare le claim `iss` du token **littéralement, chaîne pour chaîne**, à cette valeur configurée — ça ne matchait jamais, donc chaque token, même parfaitement valide, était rejeté.

**Enquête sur la cause racine** (`git log -p` sur les fichiers concernés) : cette incohérence existe dans le dépôt Git **depuis la création même de `k8s/backend/deployment.yaml`** — elle n'a jamais été corrigée dans le code versionné. L'hypothèse la plus cohérente : quelqu'un avait corrigé cette valeur **directement sur le cluster** (`kubectl edit`/`kubectl set env`), sans jamais reporter cette correction dans Git. Le cluster tournait donc avec la bonne valeur en pratique depuis des mois, pendant que le fichier versionné contenait toujours la valeur fausse. Le `kubectl apply -f k8s/backend/deployment.yaml` du ticket 003 a **écrasé silencieusement** cette correction manuelle jamais sauvegardée, en réappliquant l'ancienne valeur incorrecte du fichier.

**Ce n'est donc pas une régression introduite par l'audit** — c'est un bug de configuration préexistant, invisible depuis des mois à cause d'un correctif manuel non versionné, et révélé par le premier `kubectl apply` complet du manifeste.

## Solution retenue

Aligner `KEYCLOAK_ISSUER_URI` sur l'adresse réellement utilisée par le frontend pour atteindre Keycloak (`http://10.9.21.236:8080/realms/platform`), **dans le fichier versionné** cette fois, pour que cette correction ne disparaisse plus jamais au prochain déploiement.

Vérifié avant application que le pod backend peut bien joindre cette adresse depuis l'intérieur du cluster :
```bash
kubectl exec -n platform deploy/platform-api -- wget -qO- --server-response \
  http://10.9.21.236:8080/realms/platform/.well-known/openid-configuration
# → 200 OK, confirmé
```

## Alternatives étudiées

- **Configurer un "Frontend URL" cohérent dans Keycloak** (réglage realm Keycloak forçant un `iss` unique quel que soit le chemin d'accès) : solution plus propre à terme (un seul `iss` valable pour le frontend ET le backend, indépendamment de l'adresse réseau utilisée), mais nécessite de toucher la configuration Keycloak elle-même — écarté pour un correctif d'urgence, à envisager séparément si on veut une solution plus robuste à long terme.

## Fichiers modifiés

- `k8s/backend/deployment.yaml`
- `backend-api/src/main/resources/application-k8s.yml`

## Changements réalisés

- `k8s/backend/deployment.yaml` : `KEYCLOAK_ISSUER_URI` passe de `http://keycloak.platform.svc.cluster.local:8080/realms/platform` à `http://10.9.21.236:8080/realms/platform`, avec un commentaire expliquant pourquoi (comparaison littérale de chaîne contre le claim `iss`, pas une question de joignabilité réseau).
- `application-k8s.yml` : valeur par défaut de `issuer-uri` alignée de la même façon.
- Correctif appliqué en urgence sur le cluster en direct via `kubectl set env deployment/platform-api -n platform KEYCLOAK_ISSUER_URI=...` avant que le code ne soit redéployé, pour rétablir l'authentification immédiatement.

## Impact

- L'authentification refonctionne pour tous les rôles.
- Si l'IP publique de Keycloak change un jour (ré-assignation MetalLB, nouvel environnement), il faudra mettre à jour cette valeur en conséquence — point de fragilité documenté, pas résolu structurellement (voir Alternatives).

## Risques

- **Ce correctif dépend d'une IP statique** (`10.9.21.236`) plutôt que d'un nom de domaine stable — si cette IP change, la panne reviendra à l'identique. Recommandation : envisager un nom de domaine ou l'approche "Frontend URL" Keycloak dès que possible.
- Aucun risque de régression fonctionnelle : le changement aligne juste une valeur de configuration sur la réalité déjà en usage côté frontend.

## Tests à effectuer

- ✅ Vérifié : le pod backend peut joindre `10.9.21.236:8080` (200 OK sur `.well-known/openid-configuration`).
- ✅ Vérifié en production par l'utilisateur : connexion réussie, plus de 401, plus de redirection automatique vers `/login`.

## Validation

1. `kubectl get deployment platform-api -n platform -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name=="KEYCLOAK_ISSUER_URI")'` affiche la nouvelle valeur.
2. Connexion en conditions réelles réussie, sans 401 sur les appels API suivants.

## Commit Git conseillé

```
fix(backend): align KEYCLOAK_ISSUER_URI with Keycloak's actual public URL (fixes total auth outage)
```
