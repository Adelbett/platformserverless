# `@Async` inopérant par auto-invocation (déploiement bloquant)

## Problème

`AppService.createApp()` (et aussi `updateApp()`/`redeploy()`) appelait `triggerDeployAsync(app, req)` — une méthode annotée `@Async` mais définie dans la **même classe**. Cet appel implicite à `this.triggerDeployAsync(...)` contourne le proxy Spring AOP dont `@Async` dépend entièrement pour fonctionner : la méthode s'exécutait donc en réalité de façon **synchrone**, dans le thread de la requête HTTP.

## Gravité

Critique

## Pourquoi c'était un problème

`triggerDeployAsync` appelle `KnativeService.deploy(...)`, dont `buildServiceUrl()` fait jusqu'à 20 tentatives de 3 secondes en attendant l'attribution d'une URL Knative — jusqu'à 60 secondes dans le pire cas. Puisque `@Async` n'avait aucun effet, `POST /api/apps` (et les endpoints d'update/redeploy) pouvaient rester bloqués jusqu'à une minute, immobilisant un thread Tomcat pendant tout ce temps. Sous plusieurs créations d'app simultanées, c'était le point de rupture le plus probable de la plateforme en charge (épuisement du pool de threads).

C'est un piège classique et documenté de Spring : le framework ne peut techniquement pas détecter ni empêcher ce genre d'auto-invocation.

## Solution retenue

**Option A — extraire la méthode asynchrone dans un bean séparé**, `AppDeploymentAsyncRunner` (nouvelle classe, `@Service`), injecté dans `AppService`. Les 3 sites d'appel (`createApp`, `updateApp`, `redeploy`) appellent désormais `deploymentAsyncRunner.triggerDeploy(app, req)` — un appel à un **autre bean**, qui passe donc réellement par le proxy Spring, rendant `@Async` effectif.

## Alternatives étudiées

- **Option B — auto-injection (`@Lazy AppService self`)** : écartée, choix explicite de l'utilisateur en faveur de l'option A — pattern moins lisible et plus fragile dans la durée (facile de recommencer un appel direct par erreur lors d'une future refacto).
- **Option C — `ApplicationEventPublisher` + `@Async @EventListener`** : écartée, disproportionnée par rapport au besoin (pas de justification pour un système d'événements ici).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/app/AppDeploymentAsyncRunner.java` (nouveau)
- `backend-api/src/main/java/com/platform/api/app/AppService.java`
- `backend-api/src/test/java/com/platform/api/app/AppServiceTest.java` (nouveau)

## Changements réalisés

- `AppDeploymentAsyncRunner` : nouvelle classe portant la méthode `@Async public void triggerDeploy(App app, AppRequest req)`, avec le corps exact de l'ancienne `triggerDeployAsync` (déploiement Knative, mise à jour du statut, wiring Kafka optionnel, gestion d'erreur → statut `FAILED`), plus une copie de l'utilitaire `addLog` (dépendances : `AppRepository`, `DeploymentLogRepository`, `LogSseService` — les mêmes que celles déjà utilisées par ce code).
- `AppService.java` : suppression de l'import `@Async` et de l'ancienne méthode `triggerDeployAsync` ; ajout du champ `AppDeploymentAsyncRunner deploymentAsyncRunner` (injecté par constructeur, comme les autres dépendances) ; les 3 sites d'appel (`createApp:72`, `updateApp:153`, `redeploy:168`) appellent désormais `deploymentAsyncRunner.triggerDeploy(...)`.
- `AppServiceTest.java` (nouveau) : 2 tests de non-régression vérifiant que `createApp`/`redeploy` délèguent bien le déploiement à `AppDeploymentAsyncRunner` (bean mocké) et que `KnativeService.deploy(...)` n'est jamais appelé directement par `AppService` — la garantie structurelle que le bug ne peut pas revenir silencieusement.

## Découverte annexe (hors périmètre de ce ticket)

En écrivant le test, un jeu de données (`userId = "user-1"`) a fait planter `AppService.generateServiceName()` avec un `StringIndexOutOfBoundsException` — confirmation en conditions réelles du bug déjà noté dans l'audit initial (C12) : `Math.min(6, userId.length())` mesure la longueur de `userId` **avant** nettoyage des caractères non alphanumériques, donc si le nettoyage réduit la chaîne en dessous de 6 caractères, `substring()` déborde. Le test a été ajusté pour utiliser un `userId` sans caractère spécial (`"u1"`) afin de ne pas dépendre de la correction de ce bug distinct. **Ce bug n'a pas de ticket numéroté dans le plan actuel — à ajouter si tu veux qu'on le traite séparément.**

## Impact

- Comportement fonctionnel inchangé pour l'utilisateur final : la création/mise à jour/redéploiement d'une app continue de fonctionner à l'identique.
- `POST /api/apps` (et les endpoints d'update/redeploy) retournent désormais réellement sans attendre la fin du déploiement Knative — le thread de la requête HTTP n'est plus bloqué jusqu'à 60 secondes.
- Le thread qui exécute réellement `triggerDeploy` change (thread du pool `@Async` de Spring au lieu du thread de la requête HTTP) — sans impact observable, `@EnableAsync` était déjà configuré sur l'application (`BackendApiApplication.java`), donc l'infrastructure d'exécution asynchrone existait déjà, seul le bug d'auto-invocation empêchait de l'utiliser.

## Risques

- Faible : la logique métier interne de `triggerDeploy` n'a pas changé, seul son emplacement (nouvelle classe) et son mode d'invocation ont changé.
- Point de vigilance : `AppDeploymentAsyncRunner` duplique une petite méthode `addLog` (~14 lignes) déjà présente dans `AppService` — accepté comme compromis raisonnable plutôt que de complexifier le partage entre les deux beans pour un si petit bloc de code.
- Le pool de threads par défaut de Spring `@Async` (`SimpleAsyncTaskExecutor`, non borné) n'a pas été revu dans ce ticket — un pic de créations d'apps simultanées pourrait toujours créer un grand nombre de threads. Amélioration possible à proposer séparément (configurer un `ThreadPoolTaskExecutor` borné dédié).

## Tests à effectuer

- ✅ `mvn -Dtest=AppServiceTest test` — 2/2 tests passent.
- ✅ `mvn test` (suite complète) — aucune régression.
- Manuel (recommandé après déploiement) : créer une app et mesurer le temps de réponse de `POST /api/apps` — doit répondre quasi immédiatement (quelques dizaines de ms), indépendamment du temps que prend le déploiement Knative réel en arrière-plan (visible ensuite via le passage du statut `DEPLOYING` → `RUNNING`/`FAILED`).
- Manuel : vérifier que les logs de déploiement (`DEPLOYMENT_START` → `DEPLOYMENT_SUCCESS`/`DEPLOYMENT_FAIL`) apparaissent toujours normalement dans l'UI, dans le bon ordre.

## Validation

1. `mvn test` sans échec.
2. En usage réel, `POST /api/apps` répond en quelques dizaines de millisecondes (pas jusqu'à 60 secondes), avec l'app visible immédiatement en statut `DEPLOYING`, puis mise à jour asynchrone vers `RUNNING`/`FAILED`.
3. Sous plusieurs créations d'app simultanées, le serveur reste réactif sur d'autres requêtes pendant que les déploiements se terminent en arrière-plan.

## Commit Git conseillé

```
fix(backend): move async app deployment to a separate bean so @Async actually applies
```
