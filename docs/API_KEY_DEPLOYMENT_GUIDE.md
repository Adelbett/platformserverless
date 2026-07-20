 # API Key — Guide Complet Déploiement & Utilisation

## 1. Problème résolu

### Avant (sans API Key)

Un service déployé sur la plateforme qui voulait publier un event devait :
- Connaître l'adresse interne du broker Kafka (`kafka-broker.kafka.svc.cluster.local:9092`)
- Gérer un token JWT qui expire toutes les 24h
- Implémenter le renouvellement de token dans le code du service

```
Service A  →  JWT (expire dans 24h)  →  Backend API  →  Kafka
               ❌ expire
               ❌ client connaît le broker
               ❌ dépendance infrastructure
```

### Après (avec API Key)

```
Service A  →  X-Api-Key: plat_xxxx  →  Backend API  →  Kafka
               ✅ jamais expire
               ✅ client ne connaît pas le broker
               ✅ révocable instantanément
               ✅ une seule variable d'environnement
```

---

## 2. Architecture sécurité

```
Génération :
  User clique "Generate" dans Settings
      ↓
  Backend génère : plat_ + 40 chars base64url aléatoires
      ↓
  Stocke en BDD : SHA-256(clé) uniquement  ← jamais la clé brute
      ↓
  Retourne la clé brute UNE SEULE FOIS → user la copie

Validation (à chaque requête) :
  Service A  →  POST /api/events  →  Header: X-Api-Key: plat_xxxx
                                          ↓
                                    ApiKeyFilter
                                    SHA-256(plat_xxxx)
                                          ↓
                                    SELECT * FROM api_keys
                                    WHERE key_hash = ?
                                    AND active = true
                                          ↓
                                    Authentifié → SecurityContext
```

### Ce qui est stocké en BDD

| Colonne | Valeur exemple | Description |
|---|---|---|
| `id` | `uuid` | Identifiant |
| `user_id` | `abc-123` | Propriétaire |
| `name` | `demo-producer` | Label affiché |
| `key_prefix` | `plat_AbCdEf` | 12 premiers chars (affichage) |
| `key_hash` | `sha256(...)` | Hash SHA-256 — jamais la clé brute |
| `active` | `true/false` | Révocation instantanée |
| `last_used_at` | `2026-07-06T14:30:00` | Auditabilité |

---

## 3. Code Backend

### Entité `ApiKey.java`

```java
@Entity @Table(name = "api_keys")
public class ApiKey {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;           // label affiché dans Settings

    @Column(name = "key_hash", nullable = false, unique = true)
    private String keyHash;        // SHA-256 — jamais la clé brute

    @Column(name = "key_prefix", nullable = false)
    private String keyPrefix;      // 12 premiers chars pour l'affichage

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
```

### `ApiKeyService.java` — génération

```java
public Map<String, String> generate(String userId, String name) {
    // 1. Générer 40 bytes aléatoires → base64url
    byte[] bytes = new byte[30];
    new SecureRandom().nextBytes(bytes);
    String rawKey = "plat_" + Base64.getUrlEncoder()
                                    .withoutPadding()
                                    .encodeToString(bytes);

    // 2. Hasher avec SHA-256
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    String hash = HexFormat.of().formatHex(digest.digest(rawKey.getBytes()));

    // 3. Sauvegarder le hash, jamais la clé brute
    apiKeyRepo.save(ApiKey.builder()
        .userId(userId)
        .name(name)
        .keyHash(hash)
        .keyPrefix(rawKey.substring(0, 12))
        .build());

    // 4. Retourner la clé brute UNE SEULE FOIS
    return Map.of("key", rawKey, "prefix", rawKey.substring(0, 12));
}
```

### `ApiKeyService.java` — validation

```java
public Optional<String> validate(String rawKey) {
    if (rawKey == null || !rawKey.startsWith("plat_")) return Optional.empty();

    String hash = sha256(rawKey);
    return apiKeyRepo.findByKeyHashAndActiveTrue(hash)
        .map(key -> {
            key.setLastUsedAt(LocalDateTime.now());
            apiKeyRepo.save(key);
            return key.getUserId();
        });
}
```

### `ApiKeyFilter.java` — Spring Security filter

```java
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String rawKey = request.getHeader("X-Api-Key");

        if (rawKey != null && SecurityContextHolder.getContext()
                                                   .getAuthentication() == null) {
            apiKeyService.validate(rawKey).ifPresent(userId -> {
                var auth = new UsernamePasswordAuthenticationToken(
                    userId, null,
                    List.of(new SimpleGrantedAuthority("ROLE_CLIENT_ADMIN"))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }

        chain.doFilter(request, response);
    }
}
```

### `ApiKeyController.java` — endpoints

```
GET    /api/apikeys          → liste les clés de l'user (sans les hash)
POST   /api/apikeys          → body: { "name": "demo-producer" }
DELETE /api/apikeys/{id}     → révoque la clé (active = false)
```

---

## 4. Code Service A (Producer) — Node.js

### `demo/producer/index.js`

```javascript
const http  = require('http');
const https = require('https');

// Variables d'environnement — configurées au déploiement
const PLATFORM_URL = process.env.PLATFORM_API_URL
                   || 'http://platform-api.platform.svc.cluster.local:8082';
const API_KEY      = process.env.PLATFORM_API_KEY || '';
const TOPIC        = process.env.KAFKA_TOPIC      || 'demo-events';
const EVENT_TYPE   = process.env.EVENT_TYPE       || 'com.platform.demo';
const INTERVAL_MS  = parseInt(process.env.SEND_INTERVAL_MS || '30000');

function sendEvent(trigger = 'auto') {
    const body = JSON.stringify({
        type:  EVENT_TYPE,
        topic: TOPIC,
        data: {
            message:   `Scale from zero demo!`,
            trigger,
            sentAt:    new Date().toISOString(),
            producer:  'demo-producer-service',
        },
    });

    const url  = new URL(`${PLATFORM_URL}/api/events`);
    const opts = {
        hostname: url.hostname,
        port:     url.port,
        path:     url.pathname,
        method:   'POST',
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-Api-Key':      API_KEY,          // ← authentification
        },
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(opts, res => {
        console.log(`[Producer] Event sent → ${res.statusCode}`);
    });
    req.write(body);
    req.end();
}

// Auto-send toutes les INTERVAL_MS secondes
setTimeout(() => sendEvent('startup'), 2000);
setInterval(() => sendEvent('auto'), INTERVAL_MS);

// Endpoint HTTP pour trigger manuel
http.createServer((req, res) => {
    if (req.url === '/send') {
        sendEvent('manual');
        res.end(JSON.stringify({ status: 'sent' }));
    } else {
        res.end(JSON.stringify({ status: 'ok', topic: TOPIC }));
    }
}).listen(8080);
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
COPY index.js .
EXPOSE 8080
CMD ["node", "index.js"]
```

### Build & Push

```bash
cd demo/producer
docker build -t adelbettaieb/demo-producer:latest .
docker push adelbettaieb/demo-producer:latest
```

---

## 5. Déploiement Service A sur la plateforme

### Variables d'environnement à configurer

| Variable | Valeur | Description |
|---|---|---|
| `PLATFORM_API_URL` | `http://platform-api.platform.svc.cluster.local:8082` | URL interne backend |
| `PLATFORM_API_KEY` | `plat_xxxx` (généré dans Settings) | Clé API |
| `KAFKA_TOPIC` | `demo-events` | Topic cible |
| `SEND_INTERVAL_MS` | `15000` | Intervalle envoi (ms) |
| `EVENT_TYPE` | `com.platform.demo` | Type CloudEvent |

### Pourquoi `platform-api.platform.svc.cluster.local` ?

C'est l'adresse DNS interne Kubernetes du backend.
Le Service A tourne dans le même cluster → communication directe sans passer par Internet.

```
Service A (Pod)  →  platform-api.platform.svc.cluster.local:8082
                     = Service K8s "platform-api" dans namespace "platform"
```

---

## 6. Démo Scale-from-Zero

### Architecture complète

```
Service A (Producer)                      Service B (Consumer)
  min_replicas = 0                          min_replicas = 0
  SEND_INTERVAL = 15s                       image: event_display

       │                                          │
       │  POST /api/events                        │
       │  X-Api-Key: plat_xxxx                    │
       ▼                                          │
  Platform API                                    │
       │                                          │
       │  publish()                               │
       ▼                                          │
    Kafka                                         │
  topic: demo-events                              │
       │                                          │
       ▼                                          │
  KafkaSource ──────────────────────────────────► │
  (Eventing)          CloudEvent                  │
                                                  ▼
                                           Knative scales
                                           0 → 1 replica
                                                  │
                                            logs l'event
                                                  │
                                         après 90s sans trafic
                                           1 → 0 replica
```

### Commandes de vérification

```bash
# Voir Service B scaler de 0 à 1
kubectl get pods -n <namespace> -w | grep service-b

# Logs de Service B (events reçus)
kubectl logs -n <namespace> \
  -l serving.knative.dev/service=service-b-consumer -f

# Trigger manuel Service A
curl http://<service-a-url>/send
```

---

## 7. Gestion des clés dans Settings

### Créer une clé
1. Settings → API Keys → **+ Generate Key**
2. Saisir un nom (ex: `demo-producer`)
3. Copier la clé affichée — **montrée une seule fois**
4. La coller comme variable d'environnement `PLATFORM_API_KEY` lors du déploiement

### Révoquer une clé
1. Settings → API Keys → **Revoke** (icône corbeille)
2. Le service utilisant cette clé reçoit `401 Unauthorized` immédiatement
3. Générer une nouvelle clé et redéployer avec la nouvelle valeur

### Ce que l'utilisateur voit dans Settings

```
API Keys
┌──────────────────┬────────────────┬─────────────────────┬──────────┐
│ Name             │ Prefix         │ Last Used           │ Action   │
├──────────────────┼────────────────┼─────────────────────┼──────────┤
│ demo-producer    │ plat_AbCdEf... │ 2026-07-06 14:30    │ [Revoke] │
│ ci-pipeline      │ plat_XyZwVu... │ 2026-07-05 09:15    │ [Revoke] │
└──────────────────┴────────────────┴─────────────────────┴──────────┘
```

---

## 8. Résumé des endpoints API

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/apikeys` | JWT | Liste mes clés |
| `POST` | `/api/apikeys` | JWT | Générer une clé |
| `DELETE` | `/api/apikeys/{id}` | JWT | Révoquer une clé |
| `POST` | `/api/events` | JWT **ou** X-Api-Key | Publier un event |
