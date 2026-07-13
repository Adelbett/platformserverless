# Fonctionnalité "Generate Token" (API Key)

## Où se trouve cette fonctionnalité

- **Côté client (`web-portal`)** : page **Settings** → section **API Keys** (`web-portal/src/pages/Settings.jsx`, composant `ApiKeysSection`). C'est la **seule** interface qui l'expose — bouton **"+ Generate New Token"**, liste des clés existantes (nom, préfixe, dernière utilisation), bouton de révocation.
- **Côté admin (`admin-console`)** : **n'existe pas**. L'admin console ne gère ni ne voit les clés API des clients — ce n'est pas une fonctionnalité admin, uniquement client.

## Pourquoi cette fonctionnalité existe

### Le problème qu'elle résout

Un service déployé sur la plateforme (une app du client, tournant sur Knative) a parfois besoin d'appeler l'API de la plateforme elle-même — typiquement pour **publier un événement** (`POST /api/events`) qui va déclencher une chaîne Kafka → Knative (réveiller une autre app en scale-from-zero, par exemple).

Deux façons d'authentifier cet appel étaient possibles, toutes les deux mauvaises pour ce cas d'usage :
1. **Donner au service le mot de passe/JWT de l'utilisateur** — mauvais : le JWT expire au bout de 24h, donc un service qui tourne en continu (ou qui se réveille après plusieurs jours d'inactivité en scale-to-zero) se retrouverait bloqué avec un token périmé.
2. **Donner au service un accès direct à Kafka** (adresse du broker, credentials) — mauvais : ça expose les détails d'infrastructure interne du cluster à du code applicatif du client, et complique la portabilité de l'app.

### La solution : un token applicatif qui n'expire pas

Un **API Key** (aussi appelée "Personal Access Token") est une clé longue durée, générée une fois par le client, que son service peut utiliser indéfiniment (jusqu'à révocation manuelle) pour s'authentifier auprès de l'API de la plateforme — sans jamais connaître l'infrastructure Kafka/Kubernetes sous-jacente.

## Où on en a besoin concrètement

Cas d'usage principal (démontré par le service de démo `demo/producer/`) :

```
Service A (Producer, déployé par le client)
  env: PLATFORM_API_KEY=plat_xxxx
      ↓
  POST /api/events
  Header: X-Api-Key: plat_xxxx
      ↓
  ApiKeyFilter (backend) → valide le hash → authentifie l'utilisateur propriétaire de la clé
      ↓
  EventService → publie le message sur Kafka
      ↓
  KafkaSource (déjà configurée) → transmet l'événement à Service B
      ↓
  Service B (Consumer) se réveille (scale-from-zero) pour traiter l'événement
```

Sans cette clé, Service A n'aurait aucun moyen simple et durable de déclencher ce flux depuis son propre code applicatif.

## Comment ça marche, étape par étape

### 1. Génération
- Le client va dans **Settings → API Keys**, clique **"+ Generate New Token"**, donne un nom (ex: "CI/CD pipeline", "Producer service").
- Appel `POST /api/apikeys` côté backend.
- Le backend génère une clé aléatoire préfixée `plat_` (ex: `plat_aZ8kP...`), calcule son hash **SHA-256**, et stocke **uniquement le hash** en base — jamais la clé en clair.
- La clé en clair est renvoyée **une seule fois** dans la réponse de l'API. L'interface l'affiche avec un badge **"À copier maintenant — ne sera plus jamais affichée"**. Si le client la perd, il doit en générer une nouvelle (il n'y a aucun moyen de la récupérer après coup).

### 2. Utilisation
- Le client configure cette clé comme variable d'environnement sur son app déployée (ex: `PLATFORM_API_KEY=plat_xxxx`).
- Le code de l'app envoie cette valeur dans l'en-tête HTTP `X-Api-Key` sur ses appels à l'API de la plateforme.

### 3. Validation (côté backend)
- `ApiKeyFilter` (un filtre Spring Security) intercepte chaque requête entrante contenant un header `X-Api-Key` (et seulement si aucune authentification JWT n'est déjà présente).
- Il recalcule le hash SHA-256 de la clé reçue et cherche une correspondance en base (`findByKeyHashAndActiveTrue`).
- Si trouvée : la requête est authentifiée comme appartenant à l'utilisateur propriétaire de la clé (rôle `CLIENT_ADMIN`), et `lastUsedAt` est mis à jour (traçabilité — le client peut voir quand sa clé a servi pour la dernière fois).
- Si non trouvée ou révoquée : la requête est rejetée (`401 Unauthorized`).

### 4. Révocation
- Le client clique sur "Revoke" à côté d'une clé dans Settings → `DELETE /api/apikeys/{id}`.
- La clé est marquée `active=false` en base (suppression logique, pas physique — garde une trace).
- **Effet immédiat** : toute requête utilisant cette clé échoue désormais avec `401`.

## Garanties de sécurité

- La clé brute n'est **jamais stockée** — seul son hash SHA-256 l'est. Même en cas de fuite de la base de données, les clés elles-mêmes ne sont pas récupérables.
- Le préfixe `plat_` permet d'identifier visuellement ce type de clé (ex: dans des logs, des scanners de secrets).
- Chaque clé est liée à **un seul utilisateur** — impossible d'en emprunter une autre.
- Révocation instantanée, sans redéploiement nécessaire côté service consommateur (le prochain appel échouera simplement).

## Fichiers concernés (backend)

| Fichier | Rôle |
|---|---|
| `backend-api/src/main/java/com/platform/api/apikey/ApiKey.java` | Entité JPA (id, userId, name, keyHash, keyPrefix, active, lastUsedAt) |
| `backend-api/src/main/java/com/platform/api/apikey/ApiKeyRepository.java` | Accès DB |
| `backend-api/src/main/java/com/platform/api/apikey/ApiKeyService.java` | Génération, validation, révocation |
| `backend-api/src/main/java/com/platform/api/apikey/ApiKeyController.java` | `GET/POST /api/apikeys`, `DELETE /api/apikeys/{id}` |
| `backend-api/src/main/java/com/platform/api/security/ApiKeyFilter.java` | Filtre Spring Security qui valide le header `X-Api-Key` |
| `backend-api/src/main/java/com/platform/api/eventing/EventController.java` | Endpoint `/api/events` — accepte JWT **ou** API Key |
| `web-portal/src/pages/Settings.jsx` | Interface client (génération/liste/révocation) |

Pour le détail du flux de démo complet (Service A → Kafka → Service B) et les instructions de déploiement, voir `docs/FIX_11_API_KEY_AUTH.md` et `docs/API_KEY_DEPLOYMENT_GUIDE.md`.
