# Configuration Keycloak — NEXTSTEP Platform

---

## 1. Serveur Keycloak

| Paramètre | Valeur |
|-----------|--------|
| URL | http://localhost:8081 |
| Admin Console | http://localhost:8081/admin |
| Admin user | `admin` |
| Admin password | `admin` |
| Realm | `platform` |

---

## 2. Client Keycloak (pour React)

| Paramètre | Valeur |
|-----------|--------|
| Client ID | `platform-web` |
| Client type | Public (Client authentication = Off) |
| Valid Redirect URIs | `http://localhost:5173/*` |
| Valid Post Logout Redirect URIs | `http://localhost:5173/*` |
| Web Origins | `http://localhost:5173` |
| Standard flow | ✅ activé |
| Direct access grants | ✅ activé |

---

## 3. Realm Settings (Login tab)

| Paramètre | Valeur |
|-----------|--------|
| User registration | **On** (pour Register) |
| Email as username | Off |
| Forgot password | On (optionnel) |

---

## 4. Fichiers côté React

### `web-portal/src/auth/keycloak.js`
```js
const keycloak = new Keycloak({
    url:      import.meta.env.VITE_KEYCLOAK_URL       || 'http://localhost:8081',
    realm:    import.meta.env.VITE_KEYCLOAK_REALM     || 'platform',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'platform-web',
});
```

### `web-portal/.env`
```env
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KEYCLOAK_REALM=platform
VITE_KEYCLOAK_CLIENT_ID=platform-web
```

### `web-portal/src/context/AuthContext.jsx` — init Keycloak
```js
const authenticated = await keycloak.init({
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    checkLoginIframe: false,
    pkceMethod: 'S256',
});
```

### `web-portal/public/silent-check-sso.html`
```html
<!DOCTYPE html>
<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>
```

---

## 5. Fichiers côté Spring Boot

### `backend-api/src/main/resources/application.yml`
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${KEYCLOAK_ISSUER_URI:http://localhost:8081/realms/platform}

app:
  jwt:
    secret: c2VjcmV0S2V5...
    expiration-ms: 86400000
```

> Le backend **ne s'enregistre pas** dans Keycloak.
> Il télécharge la clé publique depuis `http://localhost:8081/realms/platform`
> et l'utilise pour valider les tokens JWT reçus.

---

## 6. Utilisateurs de test

| Username | Password | Rôle |
|----------|----------|------|
| `testuser` | `test123` | USER |
| `admin` | `admin123` | ADMIN |

> Créer dans : Keycloak → realm `platform` → **Users** → Add user
> Puis onglet **Credentials** → Set password → Temporary = **Off**

---

## 7. Flux d'authentification

```
1. React → keycloak.login()
2. Keycloak affiche la page de login
3. Utilisateur entre username/password
4. Keycloak retourne un token JWT
5. React stocke le token dans localStorage
6. React envoie le token dans chaque requête :
   Authorization: Bearer <token>
7. Spring Boot valide le token avec la clé publique Keycloak
8. Spring Boot autorise ou refuse la requête
```

---

## 8. Checklist démarrage

- [ ] Docker : `docker-compose up -d keycloak postgres`
- [ ] Keycloak accessible : http://localhost:8081
- [ ] Realm `platform` créé
- [ ] Client `platform-web` configuré (Redirect URIs + Web Origins)
- [ ] Realm settings → Login → User registration = On
- [ ] Utilisateur test créé avec mot de passe non-temporaire
- [ ] Frontend : `npm run dev` (port 5173)
- [ ] Backend : `mvn spring-boot:run "-Dspring-boot.run.profiles=dev"` (port 8080)
