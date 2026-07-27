# SSE logs cassé (clé username vs. userId) — touchait tous les rôles, pas seulement les MEMBER

## Problème

`LogController.streamLogs()` abonnait le flux SSE de logs par `auth.getName()` — le **username** Keycloak (`preferred_username`) — alors que `LogSseService.push()` recherchait les émetteurs abonnés par `deploymentLog.getUserId()`, l'**id UUID interne** (`User.id`) posé par `AppService.addLog()`. Ces deux clés ne correspondaient jamais.

## Gravité

Élevée (révisé à la hausse en cours d'investigation — voir ci-dessous)

## Pourquoi c'était un problème

L'audit initial avait classé ce bug comme touchant spécifiquement les comptes MEMBER (la différence entre leur propre username et l'id de leur CLIENT_ADMIN est la plus visible). En creusant le code (`KeycloakJwtAuthConverter.java:35`, qui confirme que `Authentication#getName()` retourne toujours `preferred_username`, jamais l'id UUID), il s'avère que **le bug touchait en réalité tous les rôles, y compris un CLIENT_ADMIN consultant ses propres logs** : `auth.getName()` n'est jamais égal à `User.id`, quel que soit le rôle. Le flux `GET /api/logs/stream` ne délivrait donc probablement jamais aucun message en temps réel à personne.

Aggravant : `push()` échoue **silencieusement** en cas de clé non trouvée (`if (userEmitters == null || userEmitters.isEmpty()) return;`) — aucune erreur, aucun log d'avertissement, rien ne signalait le problème côté serveur.

## Solution retenue

Résolution de l'identité effective **dans la couche service** (`LogSseService`), cohérent avec le pattern déjà utilisé par `LogService.getMyLogs` :
- `LogSseService` reçoit désormais `UserContextService` en dépendance.
- `subscribe(String username)` résout `userContextService.resolve(username).effectiveUserId()` et enregistre l'émetteur sous cette clé — la même que celle utilisée par `push()`.
- Le contrôleur (`LogController.streamLogs`) reste inchangé : il continue de passer `auth.getName()`, la résolution se fait maintenant correctement à l'intérieur du service.

## Alternatives étudiées

- **Résoudre dans le contrôleur** (`LogController` injecte `UserContextService` directement) : écartée, choix explicite en faveur de garder la résolution d'identité dans la couche service, cohérent avec le reste du code (`LogService`), plutôt que de la disperser dans les contrôleurs.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/logs/LogSseService.java`
- `backend-api/src/test/java/com/platform/api/logs/LogSseServiceTest.java` (nouveau)

## Changements réalisés

- `LogSseService` : ajout du champ `UserContextService userContextService` (injecté par constructeur).
- `subscribe(String username)` résout désormais `effectiveUserId` avant d'enregistrer l'émetteur — la map interne `emitters` est indexée par cet id, cohérent avec ce que `push()` recherche déjà.
- Log d'info enrichi (`"SSE subscribed for user '{}' (effective id '{}')"`) pour faciliter le diagnostic futur.
- `LogSseServiceTest.java` (nouveau) : 3 tests, dont un point méthodologique important — un premier jet de test qui se contentait de vérifier "aucune exception" aurait **passé aussi bien avant qu'après le correctif** (`push()` échoue silencieusement dans les deux cas). Les tests finaux inspectent directement la clé d'enregistrement réelle (via réflexion sur le champ privé `emitters`, dans le même package — aucun code de production modifié pour la testabilité) pour garantir qu'ils détecteraient une régression future.

## Impact

- Le flux de logs en temps réel (`GET /api/logs/stream`) devrait désormais fonctionner pour tous les rôles (ADMIN, CLIENT_ADMIN, MEMBER) — c'est une fonctionnalité qui, selon toute vraisemblance, ne délivrait jamais rien à personne auparavant.
- Aucun changement d'API visible côté frontend (même endpoint, même contrat).
- `LogSseService` a maintenant une dépendance supplémentaire (`UserContextService`) — déjà un bean Spring existant, aucun nouveau composant à déployer.

## Risques

- Faible : le changement est localisé à une seule méthode (`subscribe`), et `push()` n'a pas été modifié (il cherchait déjà par la bonne clé).
- Si un utilisateur n'existe pas en base (cas anormal, un JWT valide sans `User` correspondant), `subscribe()` lève désormais `NotFoundException` au lieu de s'abonner silencieusement sous une mauvaise clé — comportement plus strict mais plus correct (déjà le comportement de `UserContextService.resolve()` utilisé ailleurs).

## Tests à effectuer

- ✅ `mvn -Dtest=LogSseServiceTest test` — 3/3 tests passent.
- ✅ `mvn test` (suite complète) — aucune régression.
- Manuel (recommandé après déploiement) : se connecter avec un compte CLIENT_ADMIN, ouvrir la page de logs en temps réel, déclencher un déploiement d'app, vérifier que le log apparaît bien en direct sans rechargement de page.
- Manuel : refaire le même test avec un compte MEMBER de la même équipe, vérifier qu'il reçoit aussi les logs de déploiement en temps réel.

## Validation

1. `mvn test` sans échec.
2. En conditions réelles, un log de déploiement apparaît en direct dans l'UI (sans rechargement) pour un CLIENT_ADMIN et pour un MEMBER de son équipe.
3. Les logs serveur affichent bien `SSE subscribed for user '...' (effective id '...')` avec un id cohérent avec celui utilisé par `AppService.addLog()`.

## Commit Git conseillé

```
fix(backend): key SSE log subscriptions by effectiveUserId instead of raw username
```
