# Isolation tenant rompue sur Kafka/Eventing

## Problème

`KafkaController` (4 endpoints) et `EventingController` (5 endpoints) passaient directement `auth.getName()` (le username Keycloak brut) à `KafkaService`/`EventingService` comme s'il s'agissait de l'id effectif du tenant, sans passer par `UserContextService.resolve(username).effectiveUserId()` — contrairement au reste du code (`AppService`, `LogService`, `LogSseService` déjà corrigé au ticket 011).

## Gravité

Élevée

## Pourquoi c'était un problème

Pour un membre d'équipe (MEMBER), `effectiveUserId` doit être l'id de son CLIENT_ADMIN (règle métier centrale du modèle multi-tenant : une équipe partage ses ressources). En utilisant le username brut à la place :
- Un topic Kafka ou une KafkaSource/Trigger créé par un MEMBER est enregistré sous son propre username, pas sous l'id de son équipe.
- Le CLIENT_ADMIN (et les autres membres de l'équipe) ne voit jamais ces ressources en listant les siennes, puisque `listTopics`/`listKafkaSources`/`listTriggersForUser` cherchent par l'id effectif de qui les appelle, qui diffère.
- Risque de rupture du rattachement automatique ailleurs dans le code : `AppService` résout les triggers Kafka d'une app via l'id effectif du propriétaire de l'app — un trigger créé sous un username brut ne serait jamais retrouvé par cette résolution.

## Solution retenue

Même correction, appliquée aux deux contrôleurs : injecter `UserContextService`, résoudre `effectiveUserId = userContextService.resolve(auth.getName()).effectiveUserId()` en début de chaque méthode, et transmettre cette valeur (au lieu de `auth.getName()`) aux services sous-jacents. Aucun changement côté `KafkaService`/`EventingService` — ils recevaient déjà un paramètre `userId` correctement utilisé, seul l'appelant leur passait la mauvaise valeur.

## Alternatives étudiées

Aucune alternative de fond envisagée — c'est la correction directe du même défaut déjà traité aux tickets 001 et 011 (résolution d'identité manquante), appliquée ici à deux contrôleurs supplémentaires qui présentaient le même oubli.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/kafka/KafkaController.java`
- `backend-api/src/main/java/com/platform/api/eventing/EventingController.java`
- `backend-api/src/test/java/com/platform/api/kafka/KafkaControllerTest.java` (nouveau)
- `backend-api/src/test/java/com/platform/api/eventing/EventingControllerTest.java` (nouveau)

## Changements réalisés

- `KafkaController` : `createTopic`, `listTopics`, `getTopic`, `deleteTopic` résolvent désormais `effectiveUserId` avant d'appeler `KafkaService`.
- `EventingController` : `createSource`, `listSources`, `createTrigger`, `deleteTrigger`, `listTriggers` résolvent désormais `effectiveUserId` avant d'appeler `EventingService`.
- Tests ajoutés pour les 9 endpoints au total, vérifiant que le service sous-jacent reçoit bien `effectiveUserId` (simulé via un `UserContextService` mocké renvoyant un id différent du username de l'appelant, pour détecter tout retour en arrière vers `auth.getName()` direct).

## Impact

- Les topics Kafka et ressources Eventing créés par un membre d'équipe seront désormais visibles par le reste de l'équipe (CLIENT_ADMIN et autres MEMBER), et correctement rattachés aux apps qui les référencent.
- Aucun changement d'API visible côté frontend — mêmes endpoints, même contrat de réponse.
- **Les ressources déjà créées avant ce correctif restent enregistrées sous l'ancien username brut** — elles ne deviendront pas automatiquement visibles rétroactivement (voir Risques).

## Risques

- **Ressources existantes non migrées** : tout topic Kafka/KafkaSource/Trigger créé par un MEMBER avant ce correctif reste orphelin sous son ancien `userId` (le username). Un script de migration ou une vérification manuelle en base (`SELECT * FROM kafka_topics WHERE user_id NOT IN (SELECT id FROM users)` ou équivalent) serait nécessaire pour identifier et corriger ces enregistrements — proposé séparément si tu veux qu'on le traite (nécessite d'abord de vérifier s'il existe des données réelles concernées sur ton cluster).
- Faible risque de régression fonctionnelle : le changement ajoute une résolution supplémentaire avant un appel déjà existant, sans changer la signature des services.

## Tests à effectuer

- ✅ `mvn -Dtest=KafkaControllerTest,EventingControllerTest test` — 9/9 tests passent.
- ✅ `mvn test` (suite complète) — aucune régression.
- Manuel (recommandé après déploiement) : avec un compte MEMBER, créer un topic Kafka ; se reconnecter avec le CLIENT_ADMIN de la même équipe et vérifier qu'il apparaît dans sa liste de topics.
- Manuel : même test avec une KafkaSource/Trigger créé par un MEMBER.

## Validation

1. `mvn test` sans échec.
2. Un topic/trigger créé par un MEMBER est visible par son CLIENT_ADMIN et les autres membres de l'équipe.
3. Le rattachement automatique app ↔ trigger Kafka (dans `AppService`) fonctionne pour les apps déployées par des MEMBER.

## Commit Git conseillé

```
fix(backend): resolve effectiveUserId in Kafka/Eventing controllers instead of raw username
```
