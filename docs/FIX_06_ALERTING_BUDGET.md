# Point #6 — Alerting sur seuil de consommation (budget)

> Explication complète : le concept, le problème, et chaque ligne de code ajoutée.

---

## 1. Le contexte métier — important à comprendre avant le code

Le client **ne paie pas en avance** — c'est un modèle de **post-paiement** : il consomme tout le mois (CPU/RAM de ses apps), et la facture finale est calculée à la fin du mois (exactement comme une facture électricité).

Donc cette fonctionnalité n'est **pas** un système qui bloque ou débite quoi que ce soit. C'est purement **préventif** : avertir le CLIENT_ADMIN **avant** la fin du mois que sa consommation actuelle dépasse un seuil, pour qu'il ne soit pas surpris par le montant de sa facture.

```
Sans alerte : le client découvre le montant SEULEMENT à la fin du mois
Avec alerte : le client est prévenu EN COURS DE MOIS, peut réagir (réduire ses apps, etc.)
```

---

## 2. Pourquoi c'était facile à ajouter dans ce projet précis

Le projet a déjà toute l'infrastructure de notification construite pour les événements de déploiement :

```
DeploymentLog (entité)
    ↓ sauvegardé en base
LogSseService.push(...)
    ↓ diffusé en temps réel via SSE
NotificationContext.jsx (frontend)
    ↓ écoute le flux SSE, affiche dans le bandeau cloche 🔔
```

Il suffisait de **réutiliser ce pipeline existant** avec un nouveau `type` de log (`"BUDGET_ALERT"`), au lieu de construire un système de notification séparé (pas de nouvelle table, pas de nouveau composant React lourd).

---

## 3. Le problème — qu'est-ce qui manquait

Un job planifié existait déjà (`BillingScheduler`, toutes les heures) qui calcule le coût de chaque app et l'enregistre (`takeSnapshot()`). Mais **rien ne comparait jamais ce coût cumulé à un seuil** — même si un client dépassait largement un montant "raisonnable", aucune notification n'était générée.

---

## 4. La solution — fichier par fichier, ligne par ligne

### 4.1 `application.yml` — seuil configurable

```yaml
# Billing alerts
billing:
  alert-threshold-usd: 50.0
```

- Placé sous la clé `app:` existante (comme `app.kubernetes`, `app.cors`...).
- **Pourquoi configurable et pas codé en dur** : chaque déploiement (dev/staging/prod) peut avoir un seuil différent sans recompiler le code — juste changer cette valeur ou la variable d'environnement correspondante.

### 4.2 `DeploymentLogRepository.java` — nouvelle méthode anti-spam

```java
boolean existsByUserIdAndTypeAndCreatedAtAfter(String userId, String type, LocalDateTime after);
```

- Spring Data JPA génère automatiquement la requête SQL à partir du nom de la méthode (convention de nommage) — aucune implémentation manuelle nécessaire.
- Se traduit en SQL équivalent à :
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM deployment_logs
    WHERE user_id = ? AND type = 'BUDGET_ALERT' AND created_at > ?
  )
  ```
- **Rôle** : avant de créer une nouvelle alerte, on vérifie qu'aucune alerte du même type n'a déjà été envoyée à cet utilisateur depuis le début du mois courant. Sans ça, le job tournant toutes les heures créerait une notification identique 24 fois par jour tant que le seuil reste dépassé.

### 4.3 `BillingService.java` — les nouveaux champs injectés

```java
private final DeploymentLogRepository logRepository;
private final LogSseService logSseService;

@Value("${app.billing.alert-threshold-usd:50.0}")
private double alertThresholdUsd;
```

- `logRepository` et `logSseService` → injectés par Spring (via `@RequiredArgsConstructor` de Lombok, qui génère automatiquement le constructeur avec tous les champs `final`) — exactement le même mécanisme d'injection que `snapshotRepo` et `appRepository` qui existaient déjà.
- `@Value("${app.billing.alert-threshold-usd:50.0}")` → lit la valeur définie dans `application.yml`. Le `:50.0` après les deux-points est une **valeur de secours** : si jamais la propriété n'existe pas dans la config (ex: profil de test), `50.0` est utilisé par défaut au lieu de planter au démarrage.

### 4.4 `BillingService.java` — la méthode `checkBudgetAlerts()`

```java
public void checkBudgetAlerts() {
    LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
    LocalDateTime now        = LocalDateTime.now();
```
- `monthStart` → calcule le 1er jour du mois en cours à minuit (ex: si on est le 22 juin, ça donne le 1er juin à 00:00:00). C'est la borne de début pour calculer "la consommation de CE mois".
- Exactement la même logique que `getMyBilling()` (déjà existante) utilise pour ses propres calculs — réutilisation d'un pattern déjà éprouvé dans le projet.

```java
    List<BillingSnapshot> snapshots = snapshotRepo
            .findBySnapshotTimeBetweenOrderBySnapshotTimeAsc(monthStart, now);
```
- Récupère **tous** les snapshots horaires (toutes apps, tous clients confondus) du mois en cours — méthode déjà existante dans `BillingSnapshotRepository`, juste réutilisée ici pour une nouvelle raison (calcul d'alerte plutôt qu'affichage de facture).

```java
    Map<String, Double> costByUser = new HashMap<>();
    for (BillingSnapshot s : snapshots) {
        costByUser.merge(s.getUserId(), s.getTotalCost(), Double::sum);
    }
```
- Construit une table `userId → coût total cumulé du mois`, en sommant le `totalCost` de chaque snapshot horaire pour ce même utilisateur.
- `costByUser.merge(key, value, Double::sum)` → syntaxe Java standard pour "ajouter `value` à l'entrée existante de `key`, ou créer l'entrée avec `value` si elle n'existe pas encore" — évite d'écrire une logique `if (map.containsKey(...)) {...} else {...}` manuelle.

```java
    for (var entry : costByUser.entrySet()) {
        String userId    = entry.getKey();
        double totalCost = entry.getValue();
        if (totalCost <= alertThresholdUsd) continue;
```
- Parcourt chaque client et son coût total. Si le coût est **sous** le seuil, `continue` passe directement au client suivant — pas d'action nécessaire.

```java
        boolean alreadyAlerted = logRepository
                .existsByUserIdAndTypeAndCreatedAtAfter(userId, "BUDGET_ALERT", monthStart);
        if (alreadyAlerted) continue;
```
- Utilise la méthode ajoutée en 4.2 : si une alerte `BUDGET_ALERT` existe déjà pour cet utilisateur **depuis le début du mois**, on ne recrée rien — évite le spam horaire.

```java
        DeploymentLog alert = logRepository.save(DeploymentLog.builder()
                .userId(userId)
                .message(String.format(
                        "Votre consommation a dépassé %.2f$ ce mois-ci (actuellement %.2f$). " +
                        "Cette estimation sera incluse dans votre facture de fin de mois.",
                        alertThresholdUsd, totalCost))
                .type("BUDGET_ALERT")
                .build());
```
- Crée une nouvelle entrée `DeploymentLog`, avec :
  - `userId` → le client concerné (chaque utilisateur ne voit que SES propres alertes via le mécanisme multi-tenant déjà en place — `LogSseService.push()` filtre par `userId`).
  - `message` → formulation **volontairement préventive**, pas alarmiste ni transactionnelle : explique que c'est une estimation qui apparaîtra sur la facture future, pas un débit immédiat.
  - `type("BUDGET_ALERT")` → le nouveau type qui sera reconnu par le frontend.
  - `appId` n'est pas renseigné (reste `null`) → cette alerte concerne **l'ensemble du compte client**, pas une app précise.

```java
        logSseService.push(alert);
        log.info("Budget alert sent to user {} — {}$ / {}$ threshold", userId, totalCost, alertThresholdUsd);
    }
}
```
- `logSseService.push(alert)` → **réutilise exactement** le mécanisme SSE déjà construit pour les notifications de déploiement (`LogSseService.push(DeploymentLog)` — déjà appelé ailleurs dans le projet, par exemple potentiellement dans `AppService` pour les logs de déploiement). Si le client a son navigateur ouvert au moment où l'alerte est créée, elle apparaît **instantanément** dans son bandeau cloche, sans recharger la page.
- `log.info(...)` → trace côté serveur (visible dans `kubectl logs`) pour audit/debug — pratique pour vérifier que le job a bien tourné sans avoir besoin d'attendre qu'un client se plaigne.

### 4.5 `BillingScheduler.java` — branchement au job existant

```java
@Scheduled(cron = "0 0 * * * *")
public void hourlySnapshot() {
    log.info("Running hourly billing snapshot...");
    billingService.takeSnapshot();
    billingService.checkBudgetAlerts();
}
```

- Une seule ligne ajoutée : `billingService.checkBudgetAlerts();`, exécutée **juste après** `takeSnapshot()`. Logique : il faut d'abord enregistrer le coût de l'heure qui vient de s'écouler avant de pouvoir vérifier si le total du mois dépasse le seuil — l'ordre des deux appels est important.
- Le `cron = "0 0 * * * *"` (toutes les heures à la minute 0) n'a pas changé — la vérification budget profite du même rythme que les snapshots, pas besoin d'un job séparé.

### 4.6 `NotificationContext.jsx` — reconnaissance du nouveau type côté frontend

```javascript
const NOTIF_META = {
    DEPLOYMENT_SUCCESS: { emoji: '🚀', color: '#10B981' },
    DEPLOYMENT_FAIL:    { emoji: '⚠️', color: '#EF4444' },
    KAFKA_WIRED:        { emoji: '⚡', color: '#F59E0B' },
    DELETE:             { emoji: '🗑️', color: '#6B7280' },
    UPDATE:             { emoji: '🔄', color: '#00D4FF' },
    ROLLBACK:           { emoji: '↩️', color: '#00D4FF' },
    BUDGET_ALERT:       { emoji: '💰', color: '#F59E0B' },
};
```

- `BUDGET_ALERT: { emoji: '💰', color: '#F59E0B' }` → ajoute le mapping type → icône/couleur. C'est la **seule** ligne nécessaire côté frontend, car `NotificationContext.jsx` lit déjà dynamiquement `Object.keys(NOTIF_META)` pour savoir quels types afficher (`SHOW_TYPES`) — pas besoin de toucher à la logique de polling SSE ni d'affichage, qui fonctionne déjà génériquement pour n'importe quel `type` présent dans cette table.
- `ROLLBACK: { emoji: '↩️', color: '#00D4FF' }` → ajout correctif au passage : ce type avait été créé au point #5 (rollback Knative) dans `AppService.addLog(...)`, mais jamais ajouté ici — sans cette ligne, les notifications de rollback étaient silencieusement ignorées par le bandeau (elles existaient en base mais `SHOW_TYPES.includes(log.type)` retournait `false`).

---

## 5. Vérification de non-régression

- Aucune méthode existante n'a été modifiée — seulement des champs et une méthode **ajoutés** dans `BillingService.java`, et une ligne **ajoutée** (pas remplacée) dans `BillingScheduler.java` et `DeploymentLogRepository.java`.
- Compilation Maven réussie après l'ajout complet (`mvn compile`).
- Le calcul de coût (`totalCost`) provient de `BillingSnapshot`, une entité déjà alimentée et testée par `takeSnapshot()` — aucun nouveau calcul de prix n'a été inventé, juste une agrégation (somme) de données déjà fiables.

---

## 6. Résultat final — scénario complet

```
Jour 1 du mois  : coût cumulé = 2$    → sous le seuil (50$), rien ne se passe
Jour 20 du mois : coût cumulé = 47$   → toujours sous le seuil
Jour 22 du mois, 14h00 : coût cumulé = 52$
    → checkBudgetAlerts() détecte le dépassement
    → aucune alerte BUDGET_ALERT trouvée depuis le 1er du mois
    → crée le DeploymentLog + push SSE
    → 🔔 le CLIENT_ADMIN voit immédiatement :
        "💰 Votre consommation a dépassé 50.00$ ce mois-ci (actuellement 52.34$).
         Cette estimation sera incluse dans votre facture de fin de mois."

Jour 22, 15h00 : coût cumulé = 53$
    → checkBudgetAlerts() s'exécute à nouveau (job horaire)
    → une alerte BUDGET_ALERT existe déjà depuis le 1er du mois → ignoré, pas de doublon

1er jour du mois suivant : le calcul recommence à 0$
    → si dépassement à nouveau, une NOUVELLE alerte (pour le nouveau mois) sera créée
```

---

## 7. Fichiers modifiés

| Fichier | Nature du changement |
|---|---|
| `backend-api/src/main/resources/application.yml` | Ajout de `app.billing.alert-threshold-usd` |
| `backend-api/src/main/java/com/platform/api/logs/DeploymentLogRepository.java` | Ajout de `existsByUserIdAndTypeAndCreatedAtAfter(...)` |
| `backend-api/src/main/java/com/platform/api/billing/BillingService.java` | Ajout des champs injectés + méthode `checkBudgetAlerts()` |
| `backend-api/src/main/java/com/platform/api/billing/BillingScheduler.java` | Ajout de l'appel à `checkBudgetAlerts()` après `takeSnapshot()` |
| `web-portal/src/context/NotificationContext.jsx` | Ajout de `BUDGET_ALERT` et `ROLLBACK` dans `NOTIF_META` |

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — voir `AUDIT_CONCURRENCE_ET_MONITORING.md` section 6.1.*
