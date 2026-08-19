# Facturation continue à tort après suppression d'une app

## Problème

`AppService.deleteApp()` marque correctement une app comme `DELETED` (suppression logique, pas physique) afin de préserver l'historique de facturation déjà généré — comportement voulu et documenté en commentaire dans le code. Mais en vérifiant le reste du système de facturation, `BillingService.takeSnapshot()` (la tâche planifiée qui génère un nouveau `BillingSnapshot` chaque heure) et trois autres calculs de "coût horaire actuel" continuaient d'inclure les apps `DELETED` dans leurs calculs.

## Gravité

Élevée (facturation continue à tort après suppression — impact financier direct sur le client)

## Pourquoi c'était un problème

`uptimeFactor(App app)` ne traite pas explicitement le statut `"DELETED"` :
```java
return switch (app.getStatus()) {
    case "RUNNING" -> 1.0;
    case "FAILED"  -> 0.0;
    default        -> 0.2;   // couvre SCALED_TO_ZERO... et DELETED, par accident
};
```
Une app supprimée tombe dans le `default` (`0.2`) au lieu d'être exclue — alors que ses ressources Knative ont déjà été détruites par `KnativeService.delete()` et qu'elle ne consomme plus rien sur le cluster. Conséquence : `takeSnapshot()` continuait de générer un nouveau `BillingSnapshot` **chaque heure, indéfiniment**, pour une app qui n'existe plus, facturant le client à 20% de son coût horaire configuré sans aucune limite dans le temps. Le même défaut affectait aussi l'affichage du "coût horaire actuel" (`hourlyNow`/`hourlyRate`) sur la page de facturation du client et sur la vue admin (globale et par client).

## Solution retenue

Exclure explicitement les apps au statut `DELETED` des 4 endroits qui calculent des coûts **à venir** :
1. `takeSnapshot()` — ne génère plus de nouveau `BillingSnapshot` pour une app supprimée.
2. `getMyBilling()` — le "coût horaire actuel" affiché au client n'inclut plus les apps supprimées.
3. `getPlatformBilling()` (vue admin globale) — idem au niveau plateforme.
4. `buildClientBilling()` (vue admin par client) — idem par client.

**L'historique de facturation déjà généré avant la suppression n'est jamais touché** — les `BillingSnapshot` existants restent en base et continuent d'apparaître dans `getMyBilling()`/`getPlatformBilling()` (avec le flag `deleted: true` déjà présent pour les distinguer visuellement). Seule la génération de **nouveaux** coûts est stoppée.

## Alternatives étudiées

- **Ajouter un cas explicite `"DELETED" -> 0.0` dans `uptimeFactor()`** plutôt que de filtrer en amont à chaque appel : écarté — `uptimeFactor()` est aussi utilisé pour calculer le coût d'un `BillingSnapshot` existant a posteriori (pas seulement pour décider si on doit en créer un nouveau) ; le filtrer en amont dans `takeSnapshot()` est plus explicite sur l'intention ("on ne facture plus du tout cette app"), plutôt que de dépendre d'un taux à zéro qui pourrait quand même déclencher la création d'une ligne `BillingSnapshot` à 0$ inutilement.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/billing/BillingService.java`

## Changements réalisés

- `takeSnapshot()` : filtre `appRepository.findAll()` pour exclure `status == "DELETED"` avant de générer les snapshots horaires.
- `getMyBilling()` : filtre appliqué au calcul de `hourlyNow`.
- `getPlatformBilling()` : filtre appliqué au calcul de `platformHourly`.
- `buildClientBilling()` : filtre appliqué au calcul de `hourlyNow` par client.
- Commentaire ajouté sur `takeSnapshot()` expliquant explicitement la distinction entre "arrêter les nouveaux frais" et "préserver l'historique déjà facturé".

## Impact

- Une app supprimée n'accumule plus aucun nouveau frais après sa suppression.
- L'historique de facturation antérieur à la suppression reste entièrement visible et inchangé (rien n'est perdu côté "montant déjà dû").
- Les affichages de "coût horaire actuel" (client et admin) reflètent désormais uniquement les apps réellement actives.

## Risques

- Faible : filtre additif qui exclut uniquement les apps déjà marquées `DELETED` — aucun changement pour les apps dans tout autre statut (`RUNNING`, `FAILED`, `SCALED_TO_ZERO`, `DEPLOYING`), et aucun changement sur les données déjà en base.

## Tests à effectuer

- ✅ `mvn test` — suite complète verte, aucune régression.
- Manuel (recommandé après déploiement) : supprimer une app de test, attendre le prochain cycle de `takeSnapshot()` (ou le déclencher manuellement si un endpoint admin existe), vérifier qu'aucun nouveau `BillingSnapshot` n'est créé pour cette app tout en confirmant que les anciens restent visibles dans l'historique de facturation.

## Validation

1. `mvn test` sans échec.
2. Après suppression d'une app et un cycle de facturation, `SELECT * FROM billing_snapshots WHERE app_id = '<id-app-supprimée>' ORDER BY snapshot_time DESC LIMIT 1;` ne montre aucune nouvelle ligne postérieure à la suppression.
3. L'historique de facturation du client affiche toujours les coûts générés avant la suppression.

## Commit Git conseillé

```
fix(billing): stop accruing new costs for deleted apps while preserving billing history
```
