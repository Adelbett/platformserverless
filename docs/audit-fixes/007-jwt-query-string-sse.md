# JWT transmis en query string sur les flux SSE

## Problème

6 endroits du frontend (`web-portal`) ouvraient une connexion SSE (Server-Sent Events, pour les logs et métriques en temps réel) via l'API navigateur `EventSource`, en passant le JWT complet de l'utilisateur comme paramètre `?token=` dans l'URL, faute d'alternative — `EventSource` ne permet pas d'envoyer d'en-têtes HTTP personnalisés.

## Gravité

Critique

## Pourquoi c'était un problème

Une URL, contrairement à un en-tête HTTP, se retrouve enregistrée à plusieurs endroits hors du contrôle de l'application : logs d'accès du serveur/proxy nginx (`web-portal/nginx.conf` fait du reverse-proxy vers `/api/`), historique de navigation du navigateur, et tout intermédiaire réseau (proxy d'entreprise, CDN) qui loggerait les URL complètes. Un JWT volé de cette façon donne un accès complet à l'API au nom de la victime, jusqu'à expiration du token — équivalent à un vol de session.

## Solution retenue

**Option A — remplacer `EventSource` par `fetch` + flux streamé**, en utilisant la bibliothèque `@microsoft/fetch-event-source` (gère nativement le parsing SSE, la reconnexion, les événements nommés — comportement le plus proche d'`EventSource` natif). Le token est désormais envoyé en en-tête `Authorization: Bearer`, comme tous les autres appels API du frontend, et ne transite plus jamais par une URL.

Un helper unique et réutilisable (`web-portal/src/api/sse.js`, fonction `openSseStream`) centralise cette logique pour les 6 sites d'appel, au lieu de dupliquer le code de connexion/authentification 6 fois.

Côté backend : aucun changement nécessaire. `SseTokenFilter` (qui promouvait `?token=` en en-tête `Authorization`) reste en place mais n'est plus le chemin emprunté par le frontend — Spring Security OAuth2 Resource Server traite l'en-tête `Authorization: Bearer` envoyé directement par `fetch`, exactement comme pour tous les autres appels API existants.

## Alternatives étudiées

- **Option B — token SSE dédié à courte durée de vie** : écartée. Aurait nécessité du nouveau code backend (génération/validation/expiration d'un second type de token), transformant un ticket frontend en ticket multi-composants pour un gain de sécurité inférieur à l'Option A (qui élimine le problème plutôt que de réduire sa fenêtre d'exposition).
- **Option C — masquer la query string dans les logs nginx uniquement** : écartée comme solution unique — ne corrige pas le problème de fond (le token reste exposé dans l'historique navigateur et tout intermédiaire réseau non contrôlé). Reste une amélioration de défense en profondeur possible en complément, non appliquée ici (hors périmètre, proposée séparément si souhaitée).
- **Parsing SSE écrit à la main (sans nouvelle dépendance)** : écarté au profit de `@microsoft/fetch-event-source`, choix explicite de l'utilisateur pour bénéficier d'une gestion de reconnexion et de parsing éprouvée plutôt que de réimplémenter et re-tester cette logique.

## Fichiers modifiés

- `web-portal/package.json` / `package-lock.json` (nouvelle dépendance `@microsoft/fetch-event-source`)
- `web-portal/src/api/sse.js` (nouveau — helper partagé)
- `web-portal/src/pages/AppDetails.jsx` (2 sites : logs de pod, métriques d'app)
- `web-portal/src/pages/Monitoring.jsx` (2 sites : métriques d'app, métriques cluster)
- `web-portal/src/context/NotificationContext.jsx` (1 site : notifications temps réel)
- `web-portal/src/pages/LogsView.jsx` (1 site : flux de logs)

## Changements réalisés

- `sse.js` : `openSseStream(path, { onMessage, onEvent, onOpen, onError })` — ouvre un flux `fetchEventSource` avec `Authorization: Bearer <token>` en en-tête, distingue les événements nommés (`onEvent`) des messages par défaut (`onMessage`), et **stoppe la reconnexion automatique dès la première erreur** (comportement volontairement aligné sur l'ancien code, qui appelait `es.close()` dans `onerror` — pas de retry infini avec backoff par défaut de la librairie).
- Chaque site d'appel remplace `new EventSource(...\`?token=...\`)` + gestionnaires manuels par un appel à `openSseStream(path, { ... })`, avec le même comportement fonctionnel qu'avant (mêmes fallbacks, mêmes états React mis à jour).
- Suppression au passage d'une variable morte déjà repérée dans l'audit initial (`const t = new Date()...` non utilisée dans `AppDetails.jsx`, dans le bloc directement réécrit par cette correction).
- `Monitoring.jsx` : suppression du `esRef` devenu inutile (la fermeture de la connexion précédente est déjà gérée par le cleanup de l'effet React, `esRef.current.close()` était redondant).

## Impact

- Comportement fonctionnel inchangé pour l'utilisateur : logs de pods, métriques temps réel, notifications, flux de logs continuent de fonctionner à l'identique.
- Le JWT ne transite plus jamais dans une URL — il reste exclusivement dans l'en-tête `Authorization`, cohérent avec le reste des appels API du frontend.
- Nouvelle dépendance frontend : `@microsoft/fetch-event-source` (~5 Ko).
- Comportement de reconnexion sur erreur reproduit à l'identique (arrêt après la première erreur, pas de retry automatique) — pas de régression, mais pas d'amélioration côté résilience ici : c'est le comportement qui existait déjà.

## Risques

- Faible : le comportement observable côté utilisateur est préservé (mêmes callbacks, mêmes conditions de fermeture). Le principal changement est invisible pour l'utilisateur (transport du token).
- Point de vigilance : `fetchEventSource` utilise `fetch` sous le capot — si un futur proxy/CDN devant l'application bufferise les réponses `fetch` différemment d'`EventSource` (peu probable avec la config nginx actuelle, qui a déjà `proxy_buffering off` pour le streaming), il faudrait revérifier le streaming en conditions réelles après déploiement.
- Le filtre backend `SseTokenFilter` (promotion de `?token=` en header) reste actif mais orphelin pour ces 6 endpoints désormais appelés en `Authorization` natif — il n'est pas supprimé (pourrait encore servir à d'autres cas d'usage ou clients externes) ; à réévaluer séparément si on veut le retirer complètement.

## Tests à effectuer

- ✅ `npm run build` (web-portal) — build de production réussi, aucune erreur.
- Manuel (recommandé) : ouvrir la page de détail d'une app avec un pod actif, vérifier que les logs de conteneur s'affichent bien en direct.
- Manuel : ouvrir la page Monitoring (métriques d'une app + métriques cluster), vérifier l'affichage temps réel des graphiques.
- Manuel : vérifier la réception de notifications temps réel après un déploiement/suppression d'app.
- Manuel : ouvrir les DevTools réseau du navigateur pendant l'utilisation de ces fonctionnalités, confirmer qu'aucune requête vers `/api/logs/*` ou `/api/metrics/*` ne contient `?token=` dans son URL.
- Manuel : confirmer dans les logs d'accès nginx (`web-portal/nginx.conf`) qu'aucune URL avec `token=` n'apparaît plus après ce changement.

## Validation

1. `npm run build` réussit sans erreur.
2. Inspection réseau (DevTools) : toutes les requêtes SSE portent un en-tête `Authorization: Bearer ...`, aucune URL ne contient `?token=`.
3. Fonctionnalités temps réel (logs de pod, métriques, notifications) toujours opérationnelles en usage réel.

## Commit Git conseillé

```
fix(security): send SSE auth via Authorization header instead of URL query param
```
