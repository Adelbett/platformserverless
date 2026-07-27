# Frontend : logs invisibles après le correctif IDOR (username envoyé au lieu de l'id effectif)

## Problème

Après déploiement en production du correctif du ticket 001 (IDOR sur `LogController`/`LogService`), l'utilisateur a signalé : plus aucun log ne s'affiche sur `/logs`, ni sur le dashboard, ni dans les notifications temps réel — alors que la connexion elle-même fonctionnait.

## Gravité

Élevée (régression fonctionnelle en production, détectée en usage réel)

## Pourquoi c'était un problème

Trois endroits du frontend (`web-portal/src/pages/LogsView.jsx`, `web-portal/src/pages/Dashboard.jsx`, `web-portal/src/context/NotificationContext.jsx`, et `admin-console/src/context/NotificationContext.jsx`) appelaient :
```js
logsApi.getByUser(user.username)   // ou user?.username || user?.id || 'admin'
```
c'est-à-dire `GET /api/logs/users/{username}`, en passant le **username** Keycloak comme s'il s'agissait de l'identifiant interne de l'utilisateur.

**Avant le ticket 001**, `LogService.getLogsByUser` ne vérifiait aucune propriété — il interrogeait simplement `logRepository.findByUserIdOrderByCreatedAtDesc(userId)` avec cette valeur telle quelle. Comme `DeploymentLog.userId` est en réalité rempli avec l'id UUID interne (pas le username), cette requête ne trouvait déjà probablement jamais rien de correct — mais elle ne plantait pas, elle renvoyait juste une liste vide en silence.

**Après le ticket 001**, `getLogsByUser` compare désormais strictement `effectiveUserId` (résolu via `UserContextService`, un UUID) à l'`id` fourni dans l'URL (le username, une chaîne différente) — ces deux valeurs ne correspondent jamais, donc l'appel échoue maintenant en **403 Forbidden** au lieu de renvoyer silencieusement une liste vide.

Le correctif de sécurité est correct en soi (il referme une vraie faille IDOR) — c'est le frontend qui utilisait ce endpoint de façon incorrecte depuis le début, un problème resté invisible tant que la vérification de propriété n'existait pas.

## Solution retenue

Remplacer les 4 appels `logsApi.getByUser(username)` par `logsApi.getMine()` (`GET /api/logs/me`) — un endpoint déjà existant, qui résout correctement l'identité de l'appelant **côté serveur** (via `UserContextService`, gère aussi le cas d'un membre d'équipe rattaché à son CLIENT_ADMIN), sans que le frontend n'ait besoin de connaître ou de deviner un identifiant.

## Alternatives étudiées

- **Faire connaître au frontend son propre `effectiveUserId`** (l'exposer dans la réponse de login, puis l'utiliser dans l'URL) : écarté — plus de changement (backend + frontend), pour un résultat strictement équivalent à `getMine()` qui existe déjà et fait exactement ça côté serveur, sans exposer l'UUID interne au frontend inutilement.

## Fichiers modifiés

- `web-portal/src/pages/LogsView.jsx`
- `web-portal/src/pages/Dashboard.jsx`
- `web-portal/src/context/NotificationContext.jsx`
- `admin-console/src/context/NotificationContext.jsx`

## Changements réalisés

- `LogsView.jsx` : `logsApi.getByUser(userId)` (avec `userId = user?.username || user?.id || 'admin'`) → `logsApi.getMine()`.
- `Dashboard.jsx` : `logsApi.getByUser(user.username)` → `logsApi.getMine()`.
- `NotificationContext.jsx` (web-portal et admin-console) : `logsApi.getByUser(user.username)` → `logsApi.getMine()`.

## Impact

- Les logs de déploiement redeviennent visibles sur `/logs`, le dashboard, et les notifications temps réel, pour tous les rôles (ADMIN, CLIENT_ADMIN, MEMBER).
- Aucun changement d'API backend nécessaire — `GET /api/logs/me` existait déjà et n'a pas été modifié.
- Comportement plus correct qu'avant le ticket 001 : ces trois vues affichaient déjà, avant le correctif IDOR, probablement une liste vide silencieuse (même bug, juste sans erreur visible) — donc ce n'est pas une régression par rapport à un état qui fonctionnait vraiment, mais la correction d'un bug préexistant révélé par un correctif de sécurité plus strict.

## Risques

Faible — `getMine()` est un endpoint déjà utilisé ailleurs dans le code (probablement), simple substitution d'appel sans changement de structure de données retournée (même format `DeploymentLog[]`).

## Tests à effectuer

- ✅ `npm run build` (web-portal et admin-console) — les deux réussissent sans erreur.
- Manuel (déjà en cours de validation par l'utilisateur en production) : se connecter, déployer une app de test, vérifier que les logs apparaissent sur `/logs` (avec le filtre INFO coché), sur le dashboard, et dans les notifications.

## Validation

1. Build réussi des deux frontends.
2. En production, après reconnexion : les logs de déploiement s'affichent normalement sur `/logs`, `/dashboard`, et dans les notifications, pour un CLIENT_ADMIN et un MEMBER.

## Commit Git conseillé

```
fix(frontend): use /logs/me instead of sending username as a user id (fixes logs broken by ticket 001's IDOR fix)
```
