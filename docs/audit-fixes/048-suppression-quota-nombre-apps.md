# Suppression de la limite sur le nombre d'apps par tenant

## Problème / demande

`AppService.createApp()` refusait la création d'une nouvelle app dès qu'un tenant atteignait son quota (`maxApps`, 10 par défaut), avec l'erreur `409 Conflict — App quota reached`. Décision produit explicite de l'utilisateur : un client doit pouvoir créer autant d'apps qu'il le souhaite — cohérent avec le modèle "consommation libre, facturation à l'usage" déjà acté pour les ressources CPU/mémoire (ticket 005).

## Gravité

N/A — décision produit, pas une correction de bug.

## Pourquoi ce changement

Le mécanisme de quota (nombre d'apps, CPU, mémoire) reste disponible dans `QuotaService`/`QuotaController` — un administrateur peut toujours consulter et ajuster un quota par tenant s'il le souhaite un jour. Seule l'**application automatique** de la limite sur le nombre d'apps au moment de la création est retirée : elle bloquait un usage que l'utilisateur veut désormais autoriser sans restriction.

## Solution retenue

Retrait de l'appel `quotaService.assertCanCreateApp(effectiveUserId)` dans `AppService.createApp()`. Le champ `QuotaService` devenu inutilisé dans cette classe a été retiré proprement (import, injection, constructeur), avec mise à jour du test correspondant (`AppServiceTest`) pour refléter la nouvelle signature du constructeur.

## Alternatives étudiées

- **Garder le mécanisme mais fixer une valeur par défaut illimitée** (ex: `Integer.MAX_VALUE`) : écartée sur choix explicite de l'utilisateur, qui a demandé l'annulation directe de la règle plutôt qu'une valeur symboliquement très haute.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/app/AppService.java`
- `backend-api/src/test/java/com/platform/api/app/AppServiceTest.java`

## Changements réalisés

- Suppression de l'appel `quotaService.assertCanCreateApp(effectiveUserId)` dans `createApp()`, remplacé par un commentaire expliquant le choix (facturation à l'usage plutôt que quota bloquant).
- Suppression du champ `QuotaService quotaService`, de son import, et de son injection par constructeur (devenu inutilisé dans cette classe).
- `AppServiceTest.java` : constructeur `new AppService(...)` mis à jour (un paramètre en moins), mock `QuotaService` retiré.

## Impact

- Un tenant peut désormais créer un nombre illimité d'apps, sans blocage `409 Conflict`.
- `QuotaService.assertCanCreateApp()` (la méthode elle-même) reste dans le code, inutilisée pour l'instant — pas supprimée, au cas où elle serait réactivée pour un usage futur (ex: quota par abonnement payant).
- Le reste du système de quota (CPU/mémoire par `ResourceQuota` K8s, endpoints admin de consultation/modification) n'est pas affecté.

## Risques

- **Aucun plafond ne protège plus le cluster contre un tenant créant un très grand nombre d'apps** — cohérent avec la décision déjà actée sur les ressources (ticket 005), mais le cumul des deux (pas de limite d'apps + pas de limite CPU/mémoire par app) signifie qu'un tenant peut désormais consommer des ressources cluster de façon totalement non bornée. Risque déjà connu et accepté par l'utilisateur, mais qui s'aggrave avec ce changement — à garder en tête si des problèmes de charge cluster apparaissent.

## Tests à effectuer

- ✅ `mvn test` — suite complète verte, aucune régression.
- Manuel (déjà en cours de validation) : créer plus de 10 apps sur un même tenant, confirmer l'absence de blocage.

## Validation

1. `mvn test` sans échec.
2. Création d'une 11ᵉ, 12ᵉ, etc. app réussit sans erreur 409.

## Commit Git conseillé

```
feat(backend): remove app-count quota enforcement (usage-based billing, no cap)
```
