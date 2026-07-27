# CORS `allowedOriginPatterns("*")` + `allowCredentials(true)`

## Problème

`SecurityConfig.corsConfigurationSource()` acceptait n'importe quelle origine (`setAllowedOriginPatterns(List.of("*"))`) tout en autorisant les requêtes avec cookies/`Authorization` (`setAllowCredentials(true)`). La propriété `allowedOrigins`, injectée via `@Value("${app.cors.allowed-origins}")` et déjà correctement définie par profil (`application.yml`, `application-k8s.yml`, etc.), n'était jamais utilisée dans la configuration CORS réellement appliquée.

## Gravité

Critique

## Pourquoi c'était un problème

`allowedOriginPatterns("*")` combiné à `allowCredentials(true)` est la configuration CORS la plus dangereuse possible : Spring reflète dynamiquement l'`Origin` de toute requête entrante dans `Access-Control-Allow-Origin`, tout en indiquant au navigateur d'envoyer les cookies/`Authorization`. Résultat : n'importe quel site web tiers peut faire exécuter par le navigateur d'un utilisateur déjà connecté à la plateforme des requêtes authentifiées vers l'API, et lire la réponse — vol de session / actions faites au nom de la victime, sans qu'elle ait besoin d'interagir autrement qu'en visitant une page piégée.

La propriété `allowedOrigins` était bien injectée dans la classe et correctement renseignée par profil dans les fichiers YAML — la protection avait donc été prévue à l'origine, mais jamais réellement branchée dans le code.

## Solution retenue

1. `SecurityConfig.corsConfigurationSource()` utilise désormais `config.setAllowedOrigins(allowedOrigins)` — la vraie liste blanche par profil, au lieu du wildcard codé en dur.
2. `application-k8s.yml` : `app.cors.allowed-origins` passe de `"*"` à la liste réelle des origines légitimes en cluster, obtenue via `kubectl get svc`/`kubectl get nodes` (fournies par l'utilisateur) :
   - `http://10.9.21.238` — `platform-web` (Service `LoadBalancer`, IP MetalLB)
   - `http://10.9.21.223:30081`, `http://10.9.21.224:30081`, `http://10.9.21.225:30081` — `platform-admin` (Service `NodePort` 30081, accessible depuis n'importe quel nœud du cluster : vm01/vm02/vm03)
3. La valeur reste surchargeable via la variable d'environnement `CORS_ALLOWED_ORIGINS` (`${CORS_ALLOWED_ORIGINS:<liste par défaut>}`), pour permettre de l'ajuster sans modifier le code si ces IP changent (passage à un nom de domaine/Ingress plus tard, par exemple).

## Alternatives étudiées

- **Laisser un wildcard restreint sans credentials** (`allowedOrigins("*")` + `allowCredentials(false)`) : écartée — l'authentification de la plateforme repose sur un Bearer token envoyé par le frontend avec credentials CORS activés (cookies éventuels côté SSE/refresh) ; désactiver `allowCredentials` casserait potentiellement des flux existants sans bénéfice supplémentaire par rapport à une liste blanche explicite.
- **Ingress + nom de domaine unique avec CORS restreint à ce domaine** : solution cible à terme (déjà notée comme écart d'infrastructure dans l'audit — absence d'Ingress/TLS), mais hors périmètre de cette correction ponctuelle ; les IP actuelles restent la seule information disponible tant qu'aucun Ingress n'existe.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/security/SecurityConfig.java`
- `backend-api/src/main/resources/application-k8s.yml`

## Changements réalisés

- `SecurityConfig.java:78` : `setAllowedOriginPatterns(List.of("*"))` → `setAllowedOrigins(allowedOrigins)`.
- `application-k8s.yml` : `allowed-origins: "*"` → `${CORS_ALLOWED_ORIGINS:http://10.9.21.238,http://10.9.21.223:30081,http://10.9.21.224:30081,http://10.9.21.225:30081}`.

## Impact

- Les appels API depuis `platform-web` (`http://10.9.21.238`) et `platform-admin` (`http://<n'importe-quel-noeud>:30081`) continuent de fonctionner normalement.
- Toute requête credentialed provenant d'une origine hors de cette liste est désormais rejetée par le navigateur (erreur CORS), y compris depuis un site tiers malveillant.
- Si l'IP de `platform-web` (LoadBalancer MetalLB) ou l'un des nœuds change un jour, il faudra soit redéployer avec `CORS_ALLOWED_ORIGINS` mis à jour, soit modifier la valeur par défaut dans `application-k8s.yml`.

## Risques

- **Si l'IP du LoadBalancer ou des nœuds change** (ex. reconfiguration MetalLB, ajout/suppression de nœuds), les appels depuis le frontend concerné échoueront en CORS jusqu'à mise à jour de la config — point de vigilance opérationnel, pas un risque de sécurité.
- Aucune régression attendue sur les profils de développement (`application.yml`, `application-dev.yml`, `application-local.yml`), qui définissaient déjà des listes d'origines `localhost` correctes et n'étaient pas concernés par ce bug (le hardcoded `"*"` s'appliquait à tous les profils confondus, donc ce fix corrige aussi silencieusement le comportement en dev — sans changement perceptible puisque les origines `localhost` étaient déjà dans leurs listes respectives).

## Tests à effectuer

- ✅ `mvn compile test-compile` — compilation complète sans erreur.
- Manuel (recommandé après déploiement) : depuis `platform-web`/`platform-admin`, confirmer que les appels API fonctionnent toujours normalement (login, listing des apps, etc.).
- Manuel : depuis une page HTML hébergée sur une origine hors liste (ex. ouvrir un fichier local ou un autre serveur), tenter un `fetch(<url-api>, {credentials: 'include'})` et confirmer que la requête est bloquée par le navigateur (erreur CORS visible dans la console).

## Validation

1. Après déploiement, vérifier dans les DevTools du navigateur que l'en-tête `Access-Control-Allow-Origin` de la réponse correspond exactement à l'origine appelante (et non `*`).
2. Confirmer qu'un appel cross-origin depuis une origine non listée échoue côté navigateur.
3. Confirmer que le web-portal et l'admin-console fonctionnent normalement en usage réel.

## Commit Git conseillé

```
fix(security): replace CORS wildcard origin with explicit allowlist
```
