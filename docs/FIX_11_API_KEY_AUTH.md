# FIX 11 — API Key Authentication + Demo Producer Service

## Problème

Les services déployés sur la plateforme (Service A Producer) ne peuvent pas
publier des events sans connaître le broker Kafka interne ni gérer les tokens
JWT qui expirent toutes les 24h.

## Solution — API Key (X-Api-Key)

Le client génère une clé depuis Settings → API Keys.
Il la passe comme variable d'environnement dans son service.
Le service l'envoie dans le header `X-Api-Key`.

```
Service A (Producer)
  PLATFORM_API_KEY=plat_xxxx
      ↓
  POST /api/events
  X-Api-Key: plat_xxxx
      ↓
  ApiKeyFilter → valide le hash → authentifie l'user
      ↓
  EventService → publie sur Kafka
      ↓
  KafkaSource → Service B (Consumer) scale from ZERO ↑
```

---

## Fichiers créés / modifiés

| Fichier | Description |
|---|---|
| `backend-api/.../apikey/ApiKey.java` | Entité BDD (hash SHA-256, jamais la clé brute) |
| `backend-api/.../apikey/ApiKeyRepository.java` | JPA repository |
| `backend-api/.../apikey/ApiKeyService.java` | Génération, validation, révocation |
| `backend-api/.../apikey/ApiKeyController.java` | GET/POST/DELETE `/api/apikeys` |
| `backend-api/.../security/ApiKeyFilter.java` | Spring filter — lit X-Api-Key header |
| `backend-api/.../security/SecurityConfig.java` | Branche ApiKeyFilter |
| `backend-api/.../eventing/EventController.java` | Accepte JWT + API Key |
| `web-portal/src/pages/Settings.jsx` | Section API Keys connectée au backend réel |
| `demo/producer/index.js` | Service A — Node.js, envoie events via API |
| `demo/producer/Dockerfile` | Image Docker du producer |

---

## Sécurité

- La clé brute est montrée **une seule fois** à la création (jamais en BDD)
- En BDD : hash SHA-256 uniquement
- La clé commence par `plat_` pour identification rapide
- `lastUsedAt` mis à jour à chaque validation (auditabilité)
- Révocation instantanée depuis Settings

---

## Service A — Build & Deploy

```bash
# Sur ta machine ou CI
cd demo/producer
docker build -t adelbettaieb/demo-producer:latest .
docker push adelbettaieb/demo-producer:latest
```

Déployer sur la plateforme web :
| Champ | Valeur |
|---|---|
| Image | `adelbettaieb/demo-producer:latest` |
| Port | `8080` |
| Min replicas | `0` |
| Env: PLATFORM_API_URL | `http://platform-api.platform.svc.cluster.local:8082` |
| Env: PLATFORM_API_KEY | `plat_xxxx` (généré dans Settings) |
| Env: KAFKA_TOPIC | `demo-events` |
| Env: SEND_INTERVAL_MS | `30000` (30 secondes) |

## Service B — image publique

```
gcr.io/knative-releases/knative.dev/eventing/cmd/event_display
Port: 8080, Min replicas: 0
```

## Flux démo complet

1. Service A scale from zero → envoie event → re-scale to zero
2. Kafka topic `demo-events` reçoit le message
3. KafkaSource forward vers Service B
4. Service B scale from ZERO → traite l'event → logs
5. Après 90s sans trafic → Service B rescale to zero
