# RAPPORT D'ÉTAT DU PROJET — NEXTSTEP SERVERLESS PLATFORM
> Généré le : 2026-04-17

---

## 1. VUE D'ENSEMBLE DU PROJET

### Stack technique
| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + Axios + Keycloak-JS + MUI + Recharts |
| Backend | Spring Boot 3.2.3 / Java 21 |
| Base de données | PostgreSQL 16 (H2 en dev) |
| Auth | Keycloak 26.1 (OAuth2/OIDC + PKCE) |
| Orchestration | Knative Serving + Eventing |
| Messaging | Kafka (stub) |
| Métriques | Prometheus |
| Conteneurs | Docker + docker-compose |

---

## 2. OÙ ON EN EST — ÉTAT PAR MODULE

### 2.1 Backend (Spring Boot) — ~80% complet

| Endpoint | Statut |
|----------|--------|
| `POST /api/auth/register` | ✅ Fonctionnel |
| `POST /api/auth/login` | ✅ Fonctionnel |
| `GET/PATCH /api/users/me` | ✅ Fonctionnel |
| `POST /api/apps` | ⚠️ Mock K8s si `kubernetes.enabled=false` |
| `GET /api/apps` | ✅ Fonctionnel (DB) |
| `GET /api/apps/{id}` | ✅ Fonctionnel (DB) |
| `POST /api/apps/{id}/deploy` | ⚠️ Mock K8s |
| `DELETE /api/apps/{id}` | ⚠️ Mock K8s |
| `GET /api/metrics/apps/{id}` | ⚠️ Requiert Prometheus actif |
| `GET /api/metrics/cluster` | ⚠️ Requiert Prometheus actif |
| `GET /api/logs/apps/{id}` | ✅ Fonctionnel (DB) |
| `GET /api/logs/users/{id}` | ✅ Fonctionnel (DB) |
| `POST /api/kafka/topics` | ⚠️ DB uniquement, pas de vrai Kafka |
| `GET /api/kafka/topics` | ✅ Fonctionnel (DB) |
| `DELETE /api/kafka/topics/{id}` | ⚠️ DB uniquement |
| `POST /api/events` | ⚠️ CloudEvent stub |
| `/actuator/health` | ✅ Fonctionnel |
| `/swagger-ui.html` | ✅ Fonctionnel |

### 2.2 Frontend (React) — ~85% complet

| Page | Route | Statut |
|------|-------|--------|
| Login | `/login` | ✅ UI complète, Keycloak SSO |
| Register | `/register` | ✅ UI complète |
| Dashboard | `/dashboard` | ✅ Fonctionnel |
| Apps List | `/apps` | ✅ Design complet (inline styles) |
| Deploy App | `/apps/new` | ✅ Formulaire 4 onglets |
| App Details | `/apps/:id` | ✅ Métriques + logs |
| Kafka Topics | `/kafka` | ✅ Design complet (inline styles) |
| Eventing | `/eventing` | ✅ Formulaire CloudEvent |
| Logs View | `/logs` | ✅ Recherche + export |
| Monitoring | `/monitoring` | ⚠️ UI Tailwind incohérente (design à refaire) |
| Settings | `/settings` | ❌ Redirige vers dashboard |
| Users | `/users` | ❌ Redirige vers dashboard |
| Agenda | — | ❌ Page créée, non liée au routeur |

---

## 3. PROBLÈMES ACTUELS IDENTIFIÉS

### 🔴 BLOQUANTS (à régler avant toute connexion à Kubernetes)

#### P1 — Keycloak : Erreur d'authentification SSO
**Symptôme :**
```
Unsafe attempt to load URL http://localhost:8081/realms/platform/protocol/openid-connect/auth?
...response_mode=fragment... from frame with URL chrome-error://chromewebdata/
```
**Cause :** L'iframe silent SSO de Keycloak essaie de charger dans une page Chrome en erreur (réseau). Le navigateur bloque l'origine `chrome-error://` vers `localhost:8081`.

**Corrections appliquées dans le code :**
- ✅ `public/silent-check-sso.html` créé
- ✅ `AuthContext.jsx` : `onLoad: 'check-sso'`, `silentCheckSsoRedirectUri`, `checkLoginIframe: false`

**Configuration Keycloak admin MANQUANTE (à faire manuellement) :**
1. Ouvrir `http://localhost:8081` → Admin Console (admin/admin)
2. Sélectionner realm `platform`
3. Client `platform-web` → Settings :
   - **Valid Redirect URIs** : `http://localhost:5173/*`
   - **Web Origins** : `http://localhost:5173`
   - **Access Type** : `public`
4. Sauvegarder

#### P2 — Kafka : Pas d'intégration réelle
**Symptôme :** La création de topic via l'UI ne crée qu'un enregistrement en base. Aucun vrai topic Kafka n'est créé.
**Cause :** La dépendance `spring-kafka` n'est PAS dans `pom.xml`. L'intégration est un stub.
**Fix requis :** Ajouter la dépendance + implémenter `AdminClient.createTopics()`.

#### P3 — Kubernetes : Désactivé par défaut
**Symptôme :** `app.kubernetes.enabled=false` en dev. Les déploiements retournent des URLs mock.
**Cause :** Configuration intentionnelle pour le développement local.
**Fix requis :** Activer avec un vrai kubeconfig et les permissions RBAC.

#### P4 — Prometheus : Fichier de configuration absent
**Symptôme :** Le docker-compose démarre Prometheus mais sans `prometheus.yml` dans le repo.
**Fix requis :** Créer `prometheus.yml` avec les scrape configs pour le backend Spring Boot.

---

### 🟡 NON-BLOQUANTS (à traiter avant production)

#### P5 — URL d'API hardcodées (pas de variables d'environnement)
- `src/api/client.js` : `baseURL: '/api'` — fonctionne en dev via proxy Vite
- `src/auth/keycloak.js` : `http://localhost:8081` hardcodé
- **Fix :** Créer `.env.development` et `.env.production` avec `VITE_*` variables

#### P6 — Page Monitoring incohérente
- Utilise des classes Tailwind (`className="..."`) alors que toutes les autres pages utilisent `style={{ ... }}` inline
- Certains tokens de couleur Tailwind MD3 peuvent ne pas s'appliquer correctement
- **Fix :** Réécrire avec inline styles comme DeployApp/LogsView

#### P7 — Pages incomplètes
- `/settings` → redirect dashboard (non implémenté)
- `/users` → redirect dashboard (non implémenté)
- Agenda page créée mais non accessible via navigation

#### P8 — Pas de WebSocket temps réel
- `@EnableWebSocket` présent dans le backend mais aucun handler défini
- Le frontend n'a pas de client WebSocket
- Logs et métriques ne se rafraîchissent pas en temps réel (polling uniquement)

#### P9 — Absence de Error Boundaries React
- Pas de `<ErrorBoundary>` dans l'arbre de composants
- Une erreur dans un composant peut crasher toute l'application

#### P10 — Elasticsearch/Redis déclarés mais non utilisés
- Dépendances présentes dans `pom.xml`
- Aucune intégration dans le code

---

## 4. CHECKLIST POUR CONNECTER LE FRONTEND À KUBERNETES

### Phase 1 — Prérequis locaux (Kubernetes local)

```bash
# Option A : Minikube
minikube start --cpus=4 --memory=8192

# Option B : Kind
kind create cluster --name platform
```

- [ ] Installer Knative Serving
  ```bash
  kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-crds.yaml
  kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving-core.yaml
  ```
- [ ] Installer Knative Eventing
  ```bash
  kubectl apply -f https://github.com/knative/eventing/releases/latest/download/eventing-crds.yaml
  kubectl apply -f https://github.com/knative/eventing/releases/latest/download/eventing-core.yaml
  ```

### Phase 2 — Configuration Keycloak (BLOQUER P1)

- [ ] Lancer Keycloak via docker-compose
- [ ] Créer realm `platform` (ou importer un realm.json)
- [ ] Créer client `platform-web` (type: public)
- [ ] Ajouter Valid Redirect URIs : `http://localhost:5173/*`
- [ ] Ajouter Web Origins : `http://localhost:5173`
- [ ] Créer un utilisateur de test avec le role `admin` ou `user`

### Phase 3 — Activer Kubernetes dans le backend

- [ ] Copier le `kubeconfig` local dans `~/.kube/config`
- [ ] Modifier `backend-api/src/main/resources/application-dev.yml` :
  ```yaml
  app:
    kubernetes:
      enabled: true
      namespace: default
  ```
- [ ] Créer un Service Account avec les permissions RBAC :
  ```bash
  kubectl create serviceaccount platform-backend
  kubectl create clusterrolebinding platform-backend-binding \
    --clusterrole=cluster-admin \
    --serviceaccount=default:platform-backend
  ```

### Phase 4 — Variables d'environnement frontend

- [ ] Créer `web-portal/.env.development` :
  ```env
  VITE_API_BASE_URL=http://localhost:8080/api
  VITE_KEYCLOAK_URL=http://localhost:8081
  VITE_KEYCLOAK_REALM=platform
  VITE_KEYCLOAK_CLIENT_ID=platform-web
  ```
- [ ] Mettre à jour `src/api/client.js` pour utiliser `import.meta.env.VITE_API_BASE_URL`
- [ ] Vérifier que `src/auth/keycloak.js` utilise déjà les variables d'env (✅ oui)

### Phase 5 — Prometheus

- [ ] Créer `prometheus.yml` :
  ```yaml
  global:
    scrape_interval: 15s

  scrape_configs:
    - job_name: 'spring-boot'
      static_configs:
        - targets: ['host.docker.internal:8080']
      metrics_path: '/actuator/prometheus'
  ```
- [ ] Monter le fichier dans docker-compose.yml pour Prometheus

### Phase 6 — Kafka réel (optionnel en dev)

- [ ] Ajouter dans `pom.xml` :
  ```xml
  <dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
  </dependency>
  ```
- [ ] Implémenter `AdminClient.createTopics()` dans `KafkaService.java`
- [ ] Configurer `bootstrap-servers` dans `application.yml`

---

## 5. ESTIMATION DE COMPLÉTION

| Composant | Complétion |
|-----------|-----------|
| Backend API | 80% |
| Frontend UI | 85% |
| Infrastructure K8s | 30% |
| Kafka réel | 10% |
| Observabilité (Prometheus) | 40% |
| CI/CD | 0% |
| **Projet global** | **~60%** |

---

## 6. PROCHAINES ÉTAPES RECOMMANDÉES (ordre de priorité)

1. **[MAINTENANT]** Configurer Keycloak admin → résoudre P1 (bloquant login)
2. **[MAINTENANT]** Créer `prometheus.yml` → activer les métriques
3. **[COURT TERME]** Créer les fichiers `.env` frontend avec variables Vite
4. **[COURT TERME]** Activer `kubernetes.enabled=true` + configurer kubeconfig
5. **[MOYEN TERME]** Réécrire `Monitoring.jsx` avec inline styles (cohérence design)
6. **[MOYEN TERME]** Ajouter spring-kafka + implémenter vrai client Kafka Admin
7. **[LONG TERME]** Implémenter WebSocket pour logs/métriques temps réel
8. **[LONG TERME]** Écrire les manifests K8s (Deployment, Service, Ingress, ConfigMap, Secret)
9. **[LONG TERME]** Mettre en place CI/CD (GitHub Actions ou GitLab CI)

---

## 7. COMMANDES UTILES

```bash
# Démarrer le stack local complet
docker-compose up -d

# Lancer le backend en mode dev
cd backend-api && mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Lancer le frontend
cd web-portal && npm run dev

# Vérifier la santé du backend
curl http://localhost:8080/actuator/health

# Voir les logs Keycloak
docker-compose logs -f keycloak

# Vérifier les services Knative
kubectl get ksvc -A
```

---

*Rapport généré automatiquement à partir de l'analyse du code source du projet.*
