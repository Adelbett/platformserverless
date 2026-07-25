# IDOR sur les logs de déploiement (fuite cross-tenant)

## Problème

Les endpoints `GET /api/logs/apps/{id}` et `GET /api/logs/users/{id}` de `LogController` renvoyaient les logs de déploiement demandés sans jamais vérifier que la ressource (`appId` ou `userId`) appartenait à l'utilisateur authentifié. N'importe quel utilisateur disposant de la permission `VIEW_LOGS` pouvait donc lire les logs de déploiement de n'importe quel autre tenant en fournissant un id qui n'est pas le sien.

## Gravité

Critique

## Pourquoi c'était un problème

Le contrôle d'accès en place, `@PreAuthorize("@permissionService.has(authentication.name, 'VIEW_LOGS')")`, vérifie uniquement que l'appelant possède la permission de *catégorie* "voir des logs" — pas qu'il a le droit de voir *ces* logs précis. C'est une confusion classique entre autorisation par type d'action et autorisation par propriété de ressource (IDOR — Insecure Direct Object Reference, OWASP A01:2021 Broken Access Control).

Le reste du code contenait déjà le bon pattern ailleurs (`AppService.requireOwned()`, `PodLogStreamService.stream()`), ce qui confirme qu'il s'agissait d'un oubli sur `LogController`/`LogService` plutôt que d'un choix de conception.

Impact concret : un tenant pouvait lire les logs de build/déploiement d'un autre tenant (messages, noms d'image, erreurs internes) par simple énumération d'id, sans avoir besoin d'aucun autre accès.

## Solution retenue

Réplique du pattern déjà validé dans `AppService`/`PodLogStreamService` :

1. `LogService` résout désormais l'identité effective de l'appelant via `UserContextService.resolve(username)` (qui gère aussi le cas d'un membre d'équipe délégué à son CLIENT_ADMIN).
2. `getLogsByApp` charge l'`App` correspondant à l'id demandé et compare son `userId` à l'id effectif de l'appelant.
3. `getLogsByUser` compare directement l'id demandé à l'id effectif de l'appelant.
4. En cas de non-correspondance, `UnauthorizedException` est levée — déjà mappée par `GlobalExceptionHandler` vers une réponse **403 Forbidden**.
5. `LogController` transmet désormais l'`Authentication` de la requête à `LogService` pour permettre cette résolution.

Choix confirmés avec l'utilisateur :
- Correction minimale (pas d'aspect/annotation générique) — réutilisation stricte du pattern existant.
- Code de retour **403 Forbidden** en cas d'accès refusé.
- Ajout d'un test de non-régression dédié.

## Alternatives étudiées

- **Aspect/annotation générique `@RequireOwnership`** réutilisable sur tous les endpoints prenant un id de ressource en paramètre (couvrirait aussi Kafka/Eventing, cf. ticket 012). Écartée pour ce ticket : plus de surface de changement, sort du périmètre d'une correction unique, sera proposée séparément comme amélioration.
- **404 Not Found au lieu de 403** pour ne pas révéler l'existence de la ressource à un attaquant. Écartée sur décision explicite de l'utilisateur en faveur de 403, cohérent avec le comportement déjà en place pour `AppService`/`PodLogStreamService` (qui utilisent aussi `UnauthorizedException` → 403).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/logs/LogService.java`
- `backend-api/src/main/java/com/platform/api/logs/LogController.java`
- `backend-api/src/test/java/com/platform/api/logs/LogServiceTest.java` (nouveau)

## Changements réalisés

**`LogService.java`** :
- Ajout de la dépendance `AppRepository` (injection via le constructeur généré par `@RequiredArgsConstructor`).
- `getLogsByApp(String appId, String level)` devient `getLogsByApp(String appId, String level, String username)` : résout l'id effectif de l'appelant, charge l'app, vérifie la propriété avant de retourner les logs.
- `getLogsByUser(String userId, String level)` devient `getLogsByUser(String userId, String level, String username)` : résout l'id effectif de l'appelant et vérifie qu'il correspond au `userId` demandé avant de retourner les logs.

**`LogController.java`** :
- `getAppLogs` et `getUserLogs` reçoivent désormais un paramètre `Authentication auth` et transmettent `auth.getName()` au service.

**`LogServiceTest.java`** (nouveau) : 5 tests unitaires Mockito couvrant :
- refus (`UnauthorizedException`) quand l'app demandée appartient à un autre tenant,
- succès quand l'app appartient à l'appelant,
- refus quand le `userId` demandé n'est pas celui de l'appelant,
- succès quand le `userId` demandé est celui de l'appelant,
- succès pour un membre d'équipe qui demande les logs sous l'id effectif de son CLIENT_ADMIN (cas légitime, non régressé).

## Impact

- Comportement inchangé pour tout usage légitime (un tenant consultant ses propres logs, ou un membre consultant les logs de son équipe).
- Un accès à des logs n'appartenant pas à l'appelant retourne désormais **403 Forbidden** au lieu de 200 avec les données.
- Signature de deux méthodes publiques de `LogService` modifiée (ajout du paramètre `username`) — aucun autre appelant de ces méthodes n'existait dans le code (vérifié par compilation complète du module).

## Risques

- Faible : le changement est strictement additif en termes de contrôle (il restreint un accès qui n'aurait jamais dû être permis). Aucun changement de comportement pour les requêtes légitimes déjà utilisées par le frontend.
- Point de vigilance : si un futur appelant interne de `LogService.getLogsByApp/getLogsByUser` est ajouté sans connaître l'identité de l'appelant réel (ex. un job admin interne), il faudra prévoir un chemin dédié plutôt que de contourner cette vérification.

## Tests à effectuer

- ✅ `mvn -Dtest=LogServiceTest test` — 5/5 tests passent.
- ✅ `mvn compile test-compile` — compilation complète du module sans erreur (pas d'appelant cassé ailleurs).
- Manuel (recommandé avant déploiement) : se connecter avec deux comptes tenants différents (A et B), déployer une app avec chacun, puis vérifier depuis le compte A que `GET /api/logs/apps/{id-app-de-B}` retourne bien 403.
- Manuel : vérifier qu'un membre d'équipe (`MEMBER`) peut toujours consulter les logs de son équipe via `GET /api/logs/users/{id-de-son-CLIENT_ADMIN}`.

## Validation

1. Lancer `mvn -Dtest=LogServiceTest test` dans `backend-api/` → doit afficher 0 échec.
2. En environnement de test avec deux comptes tenants, confirmer que l'accès croisé aux logs (`/api/logs/apps/{id}` et `/api/logs/users/{id}`) retourne 403 quand l'id ne correspond pas au tenant appelant.
3. Confirmer que le tenant propriétaire continue d'accéder normalement à ses propres logs (200 + données).

## Commit Git conseillé

```
fix(security): fix IDOR on log endpoints (LogController/LogService)
```
