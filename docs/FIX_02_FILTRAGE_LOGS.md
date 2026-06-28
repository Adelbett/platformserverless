# Point #2 — Filtrage des logs par niveau (`?level=`)

> Explication ligne par ligne du problème identifié et de la correction appliquée.

---

## 1. Le problème

### 1.1 Constat

L'endpoint `GET /api/logs/apps/{id}` acceptait déjà un usage avec `?level=ERROR` côté frontend, mais **le backend ignorait totalement ce paramètre**. Résultat : peu importe ce que l'utilisateur demandait, l'API renvoyait toujours la liste complète des logs.

### 1.2 Pourquoi ça arrivait — l'entité `DeploymentLog`

```java
// DeploymentLog.java
@Column(nullable = false)
@Builder.Default
private String type = "INFO";   // ex: DEPLOYMENT_START, DEPLOYMENT_FAIL, DELETE...
```

Il n'existe **aucune colonne `level`** dans la base de données. Le "niveau" (`INFO`/`WARN`/`ERROR`) n'est pas stocké — c'est une notion purement visuelle que le frontend **calculait lui-même**, à partir du champ `type` :

```javascript
// LogsView.jsx (déjà existant avant la correction)
const typeToLevel = (type) => {
    if (!type) return 'INFO';
    if (type.includes('FAIL') || type.includes('ERROR')) return 'ERROR';
    if (type.includes('WARN')) return 'WARN';
    return 'INFO';
};
```

Donc le frontend savait calculer le niveau, mais ne pouvait pas demander au backend de **filtrer** selon ce niveau — il devait toujours télécharger tous les logs puis filtrer côté navigateur.

### 1.3 Le code initial de `LogService.java` (avant correction)

```java
public List<DeploymentLog> getLogsByApp(String appId) {
    return logRepository.findByAppIdOrderByCreatedAtDesc(appId);
}

public List<DeploymentLog> getLogsByUser(String userId) {
    return logRepository.findByUserIdOrderByCreatedAtDesc(userId);
}
```

Aucun paramètre `level` n'existait dans la signature de ces méthodes — impossible de filtrer même si on avait voulu, le paramètre n'était jamais reçu jusqu'ici.

---

## 2. La solution appliquée

### 2.1 Stratégie choisie

Plutôt que d'ajouter une vraie colonne `level` en base (ce qui aurait demandé une migration de données), on **reproduit côté backend exactement la même logique de calcul** que le frontend utilisait déjà (`type → level`), puis on filtre la liste en mémoire avant de la renvoyer.

### 2.2 `LogService.java` — code ajouté, ligne par ligne

```java
public List<DeploymentLog> getLogsByApp(String appId, String level) {
    return filterByLevel(logRepository.findByAppIdOrderByCreatedAtDesc(appId), level);
}
```
- **Avant** : la méthode prenait `(String appId)` seulement.
- **Après** : elle prend en plus `String level` — la valeur du paramètre de requête `?level=`.
- `logRepository.findByAppIdOrderByCreatedAtDesc(appId)` → récupère TOUS les logs de cette app (comme avant, aucun changement côté requête SQL).
- `filterByLevel(...)` → nouvelle méthode qui applique le filtre **après** avoir récupéré les données.

```java
public List<DeploymentLog> getLogsByUser(String userId, String level) {
    return filterByLevel(logRepository.findByUserIdOrderByCreatedAtDesc(userId), level);
}
```
- Exactement le même principe, mais pour la liste des logs d'un utilisateur entier (pas une app précise).

```java
private List<DeploymentLog> filterByLevel(List<DeploymentLog> logs, String level) {
    if (level == null || level.isBlank()) return logs;
    return logs.stream()
            .filter(log -> levelOf(log.getType()).equalsIgnoreCase(level))
            .toList();
}
```
- `if (level == null || level.isBlank()) return logs;` → **sécurité de compatibilité** : si personne n'envoie `?level=`, on renvoie la liste complète, exactement comme avant. Ça garantit qu'aucun appel existant ne casse.
- `logs.stream()` → transforme la liste en flux pour pouvoir la filtrer fonctionnellement.
- `.filter(log -> levelOf(log.getType()).equalsIgnoreCase(level))` → pour chaque log, on calcule son niveau réel via `levelOf()`, puis on compare (insensible à la casse) avec ce que l'utilisateur a demandé.
- `.toList()` → reconstruit une liste Java normale à partir du flux filtré.

```java
private String levelOf(String type) {
    if (type == null) return "INFO";
    String upper = type.toUpperCase();
    if (upper.contains("FAIL") || upper.contains("ERROR")) return "ERROR";
    if (upper.contains("WARN")) return "WARN";
    return "INFO";
}
```
- `if (type == null) return "INFO";` → cas défensif si jamais le champ `type` est vide en base (ne devrait jamais arriver car `@Column(nullable = false)`, mais on protège quand même).
- `type.toUpperCase()` → normalise la casse avant de comparer (au cas où "fail" serait écrit en minuscule).
- `if (upper.contains("FAIL") || upper.contains("ERROR")) return "ERROR";` → reproduit **exactement** la règle du frontend : `DEPLOYMENT_FAIL` contient "FAIL" → niveau ERROR.
- `if (upper.contains("WARN")) return "WARN";` → même logique pour WARN (même si aucun `type` actuel n'en contient, le code reste prêt si un jour un type `WARN_*` est ajouté).
- `return "INFO";` → tout le reste (`DEPLOYMENT_SUCCESS`, `DELETE`, `KAFKA_WIRED`, `UPDATE`...) est classé en `INFO` par défaut.

### 2.3 `LogController.java` — code modifié, ligne par ligne

```java
@GetMapping("/apps/{id}")
@Operation(summary = "Get deployment logs for a specific app, optionally filtered by level (INFO/WARN/ERROR)")
public ResponseEntity<List<DeploymentLog>> getAppLogs(@PathVariable String id,
                                                       @RequestParam(required = false) String level) {
    return ResponseEntity.ok(logService.getLogsByApp(id, level));
}
```
- `@PathVariable String id` → inchangé, c'est l'id de l'app dans l'URL (`/apps/123`).
- `@RequestParam(required = false) String level` → **nouveau**. Capture le paramètre de requête `?level=ERROR` dans l'URL. `required = false` signifie que si le paramètre est absent, `level` vaudra simplement `null` (au lieu de provoquer une erreur 400 Bad Request).
- `logService.getLogsByApp(id, level)` → transmet ce paramètre tel quel au service — le controller ne fait aucune logique de filtrage lui-même, il délègue tout à `LogService`.

```java
@GetMapping("/users/{id}")
@Operation(summary = "Get all deployment logs for a user, optionally filtered by level (INFO/WARN/ERROR)")
public ResponseEntity<List<DeploymentLog>> getUserLogs(@PathVariable String id,
                                                        @RequestParam(required = false) String level) {
    return ResponseEntity.ok(logService.getLogsByUser(id, level));
}
```
- Même modification, appliquée à l'endpoint qui liste les logs par utilisateur plutôt que par app.

---

## 3. Vérification de non-régression

Avant de modifier les signatures de `getLogsByApp()` et `getLogsByUser()`, une recherche dans tout le code (`grep`) a confirmé qu'**aucun autre fichier** n'appelait ces 2 méthodes avec l'ancienne signature à 1 seul argument — donc le changement de signature ne casse rien ailleurs dans le projet.

```bash
grep -r "getLogsByApp|getLogsByUser" backend-api/src/main/java
# → seuls LogService.java et LogController.java les utilisent
```

---

## 4. Résultat final — comportement de l'API

| Requête | Comportement |
|---|---|
| `GET /api/logs/apps/123` | Renvoie tous les logs (comportement identique à avant la correction) |
| `GET /api/logs/apps/123?level=ERROR` | Renvoie uniquement les logs dont le `type` contient `FAIL` ou `ERROR` |
| `GET /api/logs/apps/123?level=INFO` | Renvoie les logs `DEPLOYMENT_SUCCESS`, `DELETE`, `KAFKA_WIRED`, `UPDATE`... |
| `GET /api/logs/users/abc?level=warn` | Fonctionne aussi (comparaison insensible à la casse) |

---

## 5. Fichiers modifiés

| Fichier | Nature du changement |
|---|---|
| `backend-api/src/main/java/com/platform/api/logs/LogService.java` | Ajout du paramètre `level` + méthodes `filterByLevel()` et `levelOf()` |
| `backend-api/src/main/java/com/platform/api/logs/LogController.java` | Ajout de `@RequestParam(required = false) String level` sur 2 endpoints |

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — voir `AUDIT_CONCURRENCE_ET_MONITORING.md` section 5.2.*
