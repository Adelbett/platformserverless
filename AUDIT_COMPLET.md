# Audit Technique Complet — PlatformServerless

Document consolidant l'intégralité de l'audit : DevOps/CI-CD, Backend, Frontend, Kubernetes, Knative, Kafka, Sécurité, Infrastructure Cloud, Fonctionnalités Métier, Résilience, Bonnes Pratiques, et Rapport Final.

**Limite méthodologique** : cet audit est basé sur la lecture exhaustive du code source et des manifestes du dépôt. Aucune commande n'a été exécutée contre le cluster Kubernetes réel, Jenkins, ou tout autre système en production (conformément à la politique de l'utilisateur interdisant l'accès direct au cluster/VMs). Chaque section indique explicitement quand une vérification nécessite une commande à exécuter par l'utilisateur, avec la commande et la grille d'interprétation.

---

## Table des matières

1. [Analyse DevOps / CI-CD](#1-analyse-devops--ci-cd)
2. [Audit Backend, Frontend, Kubernetes/Knative/Kafka (analyse applicative)](#2-audit-backend-frontend-kubernetesknativekafka)
3. [Analyse de l'Infrastructure Cloud](#3-analyse-de-linfrastructure-cloud)
4. [Analyse des Fonctionnalités Métier](#4-analyse-des-fonctionnalités-métier)
5. [Tests de Résilience](#5-tests-de-résilience)
6. [Comparaison avec les Bonnes Pratiques](#6-comparaison-avec-les-bonnes-pratiques)
7. [Rapport Final](#7-rapport-final)

---

# 1. Analyse DevOps / CI-CD

## Vue d'ensemble de la chaîne

```
GitHub (main) → Jenkins (agent unique, plugin durability perf) → Maven/npm build
   → Kaniko (in-cluster, rootless) → Docker Hub (PAS Harbor) → kubectl set image → K8s namespace "platform"
```

4 pipelines indépendants (`Jenkinsfile.backend/.admin/.frontend/.microservices`), aucune lib partagée (`vars/`, `sharedLib`), aucun Helm, aucun Kustomize, **aucune trace de Harbor** — le registre est exclusivement Docker Hub (`adelbettaieb/...`, credential `dockerhub-credentials`).

### Audit Jenkins

- **Agent unique `agent any`** sur les 4 pipelines : pas de labels, pas de pool d'agents, pas d'isolation. Un seul exécuteur Jenkins fait tout (checkout, build Maven/npm, Kaniko, kubectl) → point de contention et de panne unique.
- Le `jenkins.Dockerfile` custom installe Java 21 par-dessus une image `jenkins/jenkins:lts-jdk17`, copie le binaire Kaniko `gcr.io/kaniko-project/executor:debug` directement dans l'image Jenkins, et augmente `nofile` à 65536 — révèle un historique de crashs `jspawnhelper`/fork() documenté dans les commits récents (`0e88d44`…`1b086bb`).
- Pas d'agent Kaniko dédié en pod éphémère (pattern classique K8s) — Kaniko tourne dans le même conteneur long-lived que le JVM Jenkins, d'où toute la série de correctifs `/tmp`, `TMPDIR`, `safeRestart`.
- Aucun paramètre de pipeline (`parameters {}`).
- Aucune notification (Slack/email/Teams) — seulement des `echo` dans `post{}`.
- CronJob `jenkins-workspace-cleanup` (K8s, tous les jours à 2h) fait doublon avec le stage `Cleanup` de chaque pipeline.

### Audit Jenkinsfile

**Jenkinsfile.backend** (le plus mature) :
- `retry(2)` au niveau pipeline entier — retry brutal (rebuild + repush + redeploy) plutôt que retry ciblé.
- `retry(3)` sur le `git checkout` seul — incohérent avec les 3 autres pipelines qui n'ont aucun retry sur le checkout.
- **Pas de `timeout()`** sur aucun stage, ni au niveau pipeline.
- Le `post { always { ... safeRestart ... } }` redémarre Jenkins **après chaque build backend**, y compris en cas d'échec précoce — un simple échec réseau redémarre le serveur CI entier, potentiellement interrompant d'autres builds concurrents.
- Mot de passe admin lu via `cat /var/jenkins_home/secrets/initialAdminPassword` avec fallback `admin`.
- Pas de `disableConcurrentBuilds()` — deux builds simultanés peuvent se marcher dessus sur `/var/jenkins_home/.jna-tmp`.

**Jenkinsfile.admin / .frontend** : quasi-identiques, sans `retry` ni `timeout` ni durcissement anti-Kaniko — donc probablement toujours exposés au bug fork() que backend a corrigé. Correctif appliqué à un seul pipeline sur quatre alors que les 4 utilisent Kaniko.

**Jenkinsfile.microservices** : le plus faible des 4 —
- `docker build`/`docker push` classiques, pas Kaniko — incohérence d'architecture (nécessite le socket Docker monté).
- `git checkout` sans `credentialsId`.
- Pas de déploiement K8s à la fin (pas de `kubectl set image`).

**Commun aux 4 pipelines :**
- Aucun stage de tests (`-DskipTests` explicite, aucun `npm test`/lint).
- Aucune analyse de qualité (SonarQube, ESLint, Trivy/Grype).
- Aucun rollback automatique si `kubectl rollout status` échoue.
- Tag `v${BUILD_NUMBER}` + push `:latest` simultané → `latest` mutable, non traçable vers un commit Git précis.

### Audit Docker

- **Deux Dockerfiles backend divergents** : `ci-cd/docker/backend.Dockerfile` (multi-stage, `maven:3.9-eclipse-temurin-21`) vs `ci-cd/docker/backend-kaniko.Dockerfile` (single-stage, `amazoncorretto:21-alpine3.19`, réellement utilisé par le pipeline). Le premier est du code mort/source de confusion.
- **Aucun `USER` non-root** dans aucun Dockerfile (backend, admin, frontend, order-service, notification-service).
- Aucun `HEALTHCHECK`, aucun `.dockerignore` trouvé.
- order-service/notification-service : `npm install` sans lockfile copié = build non-reproductible.

### Audit Kaniko

- Kaniko exécuté **in-process** dans le conteneur Jenkins (pas en pod agent K8s éphémère) — cause racine de la série de correctifs récents (fork() corrompu, `/tmp` wipé, JVM Jenkins crash). Un vrai correctif serait un pod Kaniko éphémère isolé du process Jenkins maître.
- Auth Docker Hub construite à la main (`printf | base64 -w0`) plutôt que via un plugin/secret monté.
- Pas de cache Kaniko activé.
- Seul le backend a `--use-new-run --snapshot-mode=redo` (patch anti-corruption) ; admin/frontend ne l'ont pas alors qu'ils utilisent aussi Kaniko dans le même Jenkins.

### Audit Harbor

**Aucune configuration Harbor n'existe dans ce dépôt.** Registre = Docker Hub public, sans scan de vulnérabilité intégré, sans politique de rétention des tags, sans signature/Notary.

### Audit Pipeline CI/CD

| Étape attendue | Présent ? | Commentaire |
|---|---|---|
| Compilation | ✅ | microservices : pas de build explicite hors Docker |
| Tests unitaires | ❌ | `-DskipTests` explicite |
| Analyse qualité | ❌ | absente partout |
| Scan sécurité images | ❌ | absent partout |
| Build Docker/Kaniko | ✅ | Kaniko sur 3/4, `docker build` classique sur microservices |
| Push registre | ✅ Docker Hub | pas de Harbor |
| Déploiement K8s | ✅ backend/admin/frontend | ❌ absent sur microservices |
| Déploiement Knative | ❌ dans le pipeline | géré hors CI apparemment |
| Vérification post-déploiement | Partiel | `kubectl rollout status` seulement |
| Rollback automatique | ❌ | absent partout |
| Nettoyage post-build | Partiel | pas de `cleanWs()` |
| Versioning image | Partiel | pas de lien avec le SHA Git |
| Notifications | ❌ | `echo` console uniquement |

### Problèmes DevOps détectés

1. Secrets applicatifs en clair dans `k8s/backend/deployment.yaml` (`SPRING_DATASOURCE_PASSWORD: "postgres"`).
2. `safeRestart` Jenkins déclenché à chaque build backend, même en cas d'échec précoce.
3. Incohérence architecturale majeure entre microservices (Docker daemon) et le reste (Kaniko).
4. Deux Dockerfiles backend divergents et non synchronisés.
5. Aucun timeout sur aucun stage.
6. `agent any` sans isolation.
7. Aucun test automatisé dans aucun pipeline.
8. `kubectl set image` sans digest pinning, combiné au tag mutable `:latest`.
9. Checkout Git sans `credentialsId` sur microservices.
10. CronJob de nettoyage Jenkins dupliqué avec la logique du stage `Cleanup`.
11. RBAC ClusterRole/Binding lié au ServiceAccount `default` du namespace `platform`.
12. Admin console exposée en NodePort fixe (30081) sans authentification réseau.

### Vulnérabilités DevOps

- Identifiants DB en clair (`postgres`/`postgres`) committés dans Git.
- Tous les conteneurs applicatifs tournent en root.
- Mot de passe Docker Hub transitant en base64 via un heredoc shell.
- Aucun scan de vulnérabilité d'image dans toute la chaîne.
- Pas de politique de moindre privilège Kaniko.
- `safeRestart` en HTTP local sans TLS, fallback silencieux vers mot de passe `"admin"`.

### Optimisations recommandées

- Migrer Kaniko vers un pod agent Kubernetes éphémère.
- Activer le cache Kaniko.
- Ajouter des agents Jenkins étiquetés pour paralléliser les 4 pipelines.
- Introduire un stage de tests obligatoire avant le build image.
- Ajouter un scan de vulnérabilités (Trivy) entre build et push.
- Taguer les images avec le SHA Git court en plus du `BUILD_NUMBER`.
- Ajouter `timeout()` par stage et `disableConcurrentBuilds()`.

### Bonnes pratiques manquantes

Pas de bibliothèque partagée Jenkins, pas de `.dockerignore`, pas de `USER` non-root, pas de `HEALTHCHECK`/probes, pas de Secret K8s pour les credentials, pas de `resources.requests/limits`, pas de rollback automatisé.

### Plan d'amélioration DevOps

1. **Urgent** : sortir `SPRING_DATASOURCE_PASSWORD` du YAML versionné vers un `Secret` K8s.
2. **Court terme** : harmoniser microservices sur Kaniko + ajouter le déploiement K8s manquant ; supprimer le Dockerfile backend mort.
3. **Court terme** : ajouter `timeout()`, retry ciblé, et un stage de tests sur les 4 pipelines.
4. **Moyen terme** : migrer Kaniko en pod agent K8s éphémère.
5. **Moyen terme** : ajouter scan de vulnérabilité image + notifications.
6. **Long terme** : évaluer un vrai registre privé (Harbor) avec politique de rétention.

### Scores DevOps / CI-CD

| Axe | /10 |
|---|---|
| Jenkins | 4 |
| Pipeline CI/CD | 3 |
| Docker | 5 |
| Sécurité DevOps | 2 |
| Automatisation | 5 |
| **DevOps Global** | **4** |

---

# 2. Audit Backend, Frontend, Kubernetes/Knative/Kafka

## 2.1 Analyse générale

**Correction factuelle importante** : le frontend n'est **pas** Next.js 14. Ce sont deux SPA **Vite + React 18.2 + React Router v6** avec MUI/Tailwind/Keycloak-js/Stripe/Recharts. Aucun SSR, aucun App/Pages Router, aucun `next/image`.

| Axe | Note /10 | Justification |
|---|---|---|
| Architecture | 6 | Séparation en couches correcte côté backend ; duplication intégrale entre les 2 frontends ; pas de monorepo partagé |
| Organisation du projet | 6 | Structure claire, mais CI/CD et manifests K8s incomplets vs. ce que le code fait réellement (RBAC) |
| Qualité du code | 5 | Backend soigné dans l'ensemble mais bugs fonctionnels critiques (SSE, @Async) |
| SOLID / Clean Architecture | 6 | Respecté globalement, mais `KnativeServiceHelper` mort, incohérences `UserContextService` |
| Maintenabilité | 5 | Duplication frontend x2, absence de tests sur le cœur métier |
| Évolutivité | 5 | Pas de bornes serveur sur les ressources tenants, pas de NetworkPolicy |
| Dette technique | 4 | Code mort identifié, config Keycloak avec typo silencieuse |

## 2.2 Backend Spring Boot

### Critiques

**C1 — IDOR sur les logs de déploiement (fuite cross-tenant)**
`LogController.java:28-40` — `getAppLogs`/`getUserLogs` ne sont protégés qu'au niveau classe par `@PreAuthorize("...VIEW_LOGS")`, sans vérification de propriété. `LogService.getLogsByApp/getLogsByUser` interrogent directement le repository par l'id fourni dans l'URL, sans filtrer par `effectiveUserId`. N'importe quel utilisateur avec `VIEW_LOGS` peut lire les logs de n'importe quel autre tenant.
Correction : router via `UserContextService` + `requireOwned`, comme `AppService.requireOwned`.

**C2 — IDOR sur la suppression de moyens de paiement Stripe**
`PaymentController.java:46-51` : `deleteMethod` appelle `detachPaymentMethod(paymentMethodId)` sans vérifier que ce `paymentMethodId` appartient au client Stripe de l'utilisateur authentifié.
Correction : vérifier `PaymentMethod.retrieve(id).getCustomer()` == customerId de l'appelant avant `detach()`.

**C3 — CORS trop permissif combiné à credentials**
`SecurityConfig.java:76-86` : `setAllowedOriginPatterns(List.of("*"))` + `setAllowCredentials(true)`. La propriété `allowedOrigins` injectée n'est même pas utilisée dans `corsConfigurationSource()` (code mort/incohérent). N'importe quel site tiers peut faire des requêtes credentialed contre l'API en prod.

**C4 — Secrets/mots de passe en dur en profil "production" (k8s)**
`application-k8s.yml:38-39` : `admin-username: admin`, `admin-password: admin` (compte admin Keycloak). Idem `postgres/postgres` dans tous les profils. Secret JWT (`application.yml:46`) en dur ET inutilisé dans le code (config morte dangereuse).

**C10 — `@Async` inopérant par auto-invocation**
`AppService.java:72` : `createApp()` appelle `triggerDeployAsync(app, req)` en self-invocation — `@Async` repose sur un proxy Spring AOP qu'un appel interne à `this` contourne totalement. `triggerDeployAsync` s'exécute donc **de façon synchrone**, dans le thread de la requête HTTP. `buildServiceUrl()` fait jusqu'à 20×3s de retry = jusqu'à 60s de blocage.
Correction : extraire dans un bean séparé injecté, ou `@Lazy AppService self`.

### Élevées

- **C6 — Élévation de rôle potentielle** : `UserSyncFilter.java:50-58` fait confiance à 100% aux rôles du JWT Keycloak — dépend de la config Keycloak (self-registration, default roles).
- **C11 — `Thread.sleep` bloquant en boucle** : `KnativeService.java:78,437-457`.
- **C18 — Rupture d'isolation tenant Kafka/Eventing** : `KafkaController`/`EventingController` utilisent `auth.getName()` (username brut) au lieu de `UserContextService.effectiveUserId()` — les topics créés par un MEMBER sont invisibles à son équipe/CLIENT_ADMIN.
- **C22 — SSE de logs cassé pour les MEMBER** : `LogController.streamLogs()` indexe l'émetteur par `auth.getName()` (username) alors que `AppService.addLog()` pousse par `effectiveUserId` (UUID) — ces deux clés ne matchent structurellement jamais pour un MEMBER.

### Moyennes / Faibles

- **C7** : pas de handler `AccessDeniedException` → 500 au lieu de 403.
- **C8** : `RestTemplate` sans timeout vers Keycloak, ré-authentification à chaque appel admin au lieu de cacher le token.
- **C12** : `substring` fragile dans `generateServiceName` (`AppService.java:303-312`) — risque de `StringIndexOutOfBoundsException`.
- **C13** : champs `envVars`/`args` de `AppRequest` totalement ignorés au déploiement — fonctionnalité fantôme.
- **C14** : connexion Kafka interne injectée inconditionnellement dans toutes les apps, même sans `kafkaEnabled`.
- **C15** : suppression Knative "delete-then-recreate" avec race condition (`Thread.sleep(2000)`).
- **C16/C17** : validation manquante (`cpuRequest`/`memoryRequest` sans `@Pattern`, `updateApp` sans `@Valid`).
- **C19** : pas de retry/DLQ Kafka, `fetchTopicMetrics` catch large silencieux.
- **C21** : `SseEmitter(0L)` = timeout infini, pas de heartbeat → fuite mémoire potentielle.
- **C25** : catchs larges dans `AdminController` (6 endpoints) retournant 200+liste vide au lieu de 502 explicite (pattern déjà correct pour `getNodes()` mais pas généralisé).
- **C26/C27** : `RuntimeException` brute au lieu de `NotFoundException`, suppression topic Kafka non transactionnellement sûre.

### Code mort

- `KnativeServiceHelper.java` : classe entière jamais utilisée.
- `app.jwt.secret`/`expiration-ms` : config morte (auth réelle via Keycloak OAuth2).
- `allowedOrigins` injecté mais jamais lu.
- `elaqsticsearch` (typo) dans `application.yml` — config Elasticsearch silencieusement ignorée.

### Tests

7 classes de test pour 122 classes de production (~6%). Zéro test sur `AppService`, `SecurityConfig`/filtres, `LogController`/`LogService` (IDOR C1), `PaymentController` (IDOR C2), `TeamService`, `KnativeService`. Aucun Testcontainers.

### Dépendances Maven

Spring Boot 3.2.3 et Fabric8 6.10.0 en retard de plusieurs patchs — vérifier CVE. `stripe-java`/`poi-ooxml` en versions fixées manuellement. Pas d'OWASP Dependency-Check configuré.

## 2.3 Frontend

### Critiques

- **JWT en query string sur tous les flux SSE** : `AppDetails.jsx:376,533`, `Monitoring.jsx:206,328`, `NotificationContext.jsx:67` — le token complet finit dans les logs nginx/proxy et l'historique navigateur.
- **Authentification ROPC** (`grant_type=password`) posté directement par le SPA (`AuthContext.jsx:68-103`, dupliqué x2) au lieu du flux Authorization Code + PKCE via `keycloak-js` — pourtant présent en dépendance mais inutilisé.

### Élevées

- Token + refreshToken stockés en `localStorage` (vulnérable à toute XSS).
- URL Keycloak de prod en **HTTP non chiffré** vers une IP privée (`web-portal/.env.production:1`).
- Aucun header de sécurité HTTP (CSP/HSTS/X-Frame-Options) dans les deux `nginx.conf`.
- Fallback silencieux vers données **mock** en cas d'échec API (`AppDetails.jsx:510,521-522`) sans bannière d'avertissement.
- Aucun Error Boundary React sur toute l'app.
- **Zéro test frontend** dans les deux apps.

### Moyennes / Faibles

Duplication intégrale de ~15 fichiers entre `web-portal` et `admin-console` ; pas de cache/retry réseau (React Query absent) ; recalculs non mémoïsés sur les flux SSE fréquents ; redirection brutale `window.location.href` sur 401 ; pas de page 404 dédiée ; styles inline massifs ; liens factices `href="#"`.

**Points positifs** : aucun `dangerouslySetInnerHTML`/`eval`, fallback SSE→polling bien géré, `aria-label` correct, nginx bien configuré pour le streaming SSE.

## 2.4 Kubernetes / Knative / Kafka

### Critiques

- **Aucun `resources.limits`** imposé aux Knative Services générés dynamiquement (`KnativeService.java:424-429`, seulement des `requests`) — combiné à `containerConcurrency: 0` (illimité) et à l'absence de plafond serveur sur `maxScale` : aucune borne n'empêche une app tenant d'épuiser les ressources d'un nœud partagé.
- **RBAC versionné très en-deçà des permissions réellement exercées** : `k8s/backend/rbac.yaml` ne déclare que `nodes`/`events` cluster-scope, alors que le code fait `namespaces:create`, `pods.inAnyNamespace().list/watch`, opérations Knative dans n'importe quel namespace.
- **Secrets en clair** : Postgres, Keycloak admin, secret JWT — dans les manifestes et tous les `application*.yml`. À traiter comme compromis et à faire tourner.
- **CORS `*` + credentials** (cause racine côté backend).
- **Aucune `NetworkPolicy` nulle part dans le repo** — aucune isolation réseau entre namespaces tenants, ni entre tenants et Postgres/Kafka/Keycloak partagés.

### Élevées

- Broker Kafka partagé injecté sans SASL/mTLS visible dans toutes les apps tenantes — aucun `KafkaUser`/ACL Strimzi versionné.
- Backend/frontend exposés en `LoadBalancer` direct sans Ingress ni TLS ; admin console en `NodePort` fixe sans authentification réseau.
- Aucune resource limit/request ni probe sur les 3 Deployments de la plateforme elle-même.
- **Labels Prometheus incohérents** : `alert-rules.yaml`/`service-monitor.yaml` portent `release: prometheus` alors que le sélecteur réel attend `release: monitoring-stack` → les alertes/métriques du backend ne sont probablement jamais scrapées, silencieusement.
- Réplication Kafka dégradée silencieusement si moins de brokers up que demandé.
- Pas de retry/DLQ visible pour la consommation Kafka applicative.
- Pas d'alerte sur échec des CronJobs de backup.

### Moyennes / Faibles

`imagePullPolicy` implicite sur `platform-api` ; pas de `securityContext` sur aucun Deployment/CronJob ; suppression Knative "delete-then-recreate" causant un downtime systématique à chaque mise à jour ; `timeoutSeconds` Knative non configuré ; couverture d'alertes minimale.

**Positifs** : client Fabric8 correctement géré en singleton, credentials S3 du backup via `secretKeyRef` correct, dashboard Grafana présent.

## 2.5 Sécurité (synthèse OWASP)

| Vulnérabilité | Sévérité | Référence |
|---|---|---|
| Broken Access Control (IDOR logs) | Critique | C1 |
| Broken Access Control (IDOR Stripe) | Critique | C2 |
| Secrets en clair (Git + K8s) | Critique | C4, `k8s/backend/deployment.yaml` |
| CORS mal configuré | Critique | `SecurityConfig.java:76-86` |
| Absence de NetworkPolicy | Critique | infra |
| RBAC sous-déclaré / sur-permissif réel | Critique | `rbac.yaml` |
| JWT en query string (fuite via logs) | Critique | frontend SSE |
| Auth ROPC au lieu d'Authorization Code+PKCE | Critique | `AuthContext.jsx` |
| Pas de limites ressources tenants (DoS interne) | Critique | `KnativeService.java:424-429` |
| Kafka partagé sans ACL par tenant | Élevée | C18, infra |
| Token en localStorage | Élevée | frontend |
| Console admin sans protection réseau | Élevée | `k8s/admin` |
| Élévation de rôle dépendante de Keycloak | Élevée | C6 |

## 2.6 Monitoring, Performance, Tests, Fonctionnel

**Monitoring** : Prometheus/Grafana en place mais probablement inactifs pour le backend (mismatch labels). Actuator exposé (`show-details: always` — à restreindre en prod).

**Performance** : blocage synchrone du endpoint de création d'app (jusqu'à 60s), `Thread.sleep` en boucle, RestTemplate sans timeout, pas de mémoïsation React sur SSE, pas de cache réseau frontend.

**Tests** : backend ~6% de couverture fichiers, rien sur le cœur métier ni la sécurité. Frontend : zéro test.

**Fonctionnalités cassées identifiées par preuve de code** : SSE logs temps réel pour les MEMBER, variables d'environnement/arguments custom (acceptées par l'API, ignorées au déploiement), déploiement d'app perçu comme asynchrone mais bloquant, isolation d'équipe Kafka/Eventing pour les MEMBER, mise à jour d'image Knative causant un downtime systématique.

---

# 3. Analyse de l'Infrastructure Cloud

## Ce qui est présent dans le dépôt

| Composant | Statut | Constat |
|---|---|---|
| Deployments (backend/admin/frontend) | ✅ présents | Aucun `resources.requests/limits`, aucune probe |
| RBAC | ✅ partiel | `platform-api-cluster-reader` seul — largement sous-déclaré |
| ResourceQuota | ✅ **appliqué dynamiquement par code** | `QuotaService.java:101-131` — crée un `ResourceQuota` par namespace tenant (`requests.cpu`, `requests.memory`, `count/services.serving.knative.dev`). **Aucun `limits.cpu`/`limits.memory`** dans le hard quota, cohérent avec l'absence de `limits` dans `KnativeService.java`. |
| LimitRange | ❌ absent | Aucun fichier, aucune création programmatique. Sans LimitRange, un conteneur sans `limits` explicite n'a aucun plafond par défaut imposé par le namespace. |
| NetworkPolicy | ❌ absent | Recherche exhaustive négative. |
| StorageClass / PV / PVC | ❌ absents du repo | Seule référence : `claimName: jenkins-pvc` dans `ci-cd/jenkins/jenkins-cleanup-cronjob.yaml`, non définie dans ce dépôt. Aucune StorageClass référencée pour Postgres/Elasticsearch. |
| Cilium (CNI) | ❌ aucune trace | Impossible de confirmer que Cilium est le CNI réel à partir du code seul. |
| CoreDNS / kube-proxy | ❌ aucune config custom | Normal, gérés au niveau cluster hors GitOps applicatif. |
| MetalLB | Mentionné en commentaire seulement | `README.md:15` et `k8s/admin/deployment.yaml` mentionnent l'IP publique MetalLB pour `platform-web`. Aucune `IPAddressPool`/`L2Advertisement` CRD versionnée. |
| Kourier | Mentionné en docs/UI seulement | Aucune configuration Kourier versionnée dans ce dépôt (normal, composant du contrôleur Knative Serving). |
| Architecture Master/Workers, HA | Aucune information | Aucun manifeste ou doc technique du repo ne décrit la topologie du cluster. **Information manquante.** |

## Risques identifiés

- **SPOF applicatif : Postgres et Keycloak en instance unique** — aucun StatefulSet/replica défini dans ce repo. Perte du pod Postgres = plateforme entière indisponible.
- **SPOF applicatif : `platform-api` en `replicas: 1`** — combiné à l'absence de probes, un pod gelé n'est ni redémarré ni retiré du Service.
- **Absence de LimitRange = quota de namespace inefficace en pratique** — même avec un `ResourceQuota` par tenant, un seul pod peut consommer toute la mémoire/CPU disponible sur son nœud, indépendamment du quota namespace.
- **Absence de NetworkPolicy** — point le plus structurant.
- **RBAC versionné incomplet** — risque de dérive de configuration cluster non documentée en IaC.
- **Pas de StorageClass/backup pour le stockage applicatif dans ce dépôt** — dépendance opérationnelle non versionnée.

## Corrections proposées

1. Ajouter un `LimitRange` par défaut à chaque namespace tenant (créé automatiquement en même temps que le namespace).
2. Étendre `QuotaService.syncToCluster()` pour inclure `limits.cpu`/`limits.memory`, et forcer `KnativeService.buildKnativeManifest()` à toujours poser des `limits`.
3. Documenter/versionner la topologie du cluster (control-planes, etcd, workers, zones).
4. Versionner ou documenter : StorageClass Postgres/Keycloak/ES, config MetalLB, config Kourier.
5. Passer `platform-api`/Postgres/Keycloak en `replicas ≥ 2` avec PodDisruptionBudget, ou documenter explicitement l'acceptation du risque SPOF pour cette phase (PFE).

## Commandes à exécuter vous-même

```bash
# Topologie du cluster
kubectl get nodes -o wide
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.metadata.labels.node-role\.kubernetes\.io/control-plane}{"\n"}{end}'

# CNI effectivement utilisé
kubectl get pods -n kube-system -o wide | grep -iE 'cilium|calico|flannel'
kubectl get ciliumnetworkpolicies -A 2>/dev/null

# CoreDNS / kube-proxy santé
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl get pods -n kube-system -l k8s-app=kube-proxy

# MetalLB
kubectl get ipaddresspool -n metallb-system
kubectl get l2advertisement -n metallb-system
kubectl get svc -A -o wide | grep LoadBalancer

# Kourier / Knative networking
kubectl get pods -n kourier-system
kubectl get ksvc -A -o wide

# Storage
kubectl get storageclass
kubectl get pv,pvc -A

# Résilience Postgres/Keycloak
kubectl get pods -n platform -l app=postgres -o wide
kubectl get statefulset -n platform

# ResourceQuota/LimitRange réellement en place
kubectl get resourcequota -A
kubectl get limitrange -A
```

---

# 4. Analyse des Fonctionnalités Métier

| Fonctionnalité | État | Preuve | Cas limites / Bugs |
|---|---|---|---|
| Authentification Keycloak | ✅ Fonctionne (probable) | `SecurityConfig.java`, `UserSyncFilter.java` | Flux ROPC côté frontend au lieu de PKCE ; élévation de rôle dépend de la config Keycloak (C6) |
| Gestion utilisateurs/rôles | ⚠️ Partiellement cassée pour MEMBER | `UserContextService` | Logs SSE cassés (C22), ressources Kafka/Eventing invisibles à l'équipe (C18) |
| Multi-tenancy (isolation) | ❌ Non fiable | `KnativeService.java`, absence NetworkPolicy | Isolation réseau/ressources absente ; IDOR logs/paiement (C1, C2) |
| Création d'application | ✅ Fonctionne mais bloquant | `AppService.createApp` | `@Async` inopérant (C10) |
| Déploiement image Docker | ✅ Fonctionne | `KnativeService.deploy()` | Pas de validation préalable de l'existence de l'image |
| Création automatique Knative Services | ✅ Fonctionne | `KnativeService.buildKnativeManifest()` | `envVars`/`args` ignorés (C13) ; pas de `limits` (Critique) |
| Attribution automatique des URLs | ✅ Fonctionne, avec attente active | `buildServiceUrl():437-457` | Polling bloquant jusqu'à 20×3s au lieu d'événementiel |
| Scale-to-zero | Probable, non vérifiable sans cluster | `minScale` par défaut 0 | Aucun test de validation trouvé |
| Autoscaling | Probable | `maxScale` piloté par le tenant | Pas de plafond serveur |
| Traffic Splitting | ⚠️ Non implémenté visiblement | Aucune classe trouvée | Fonctionnalité potentiellement manquante — à confirmer |
| Monitoring CPU/RAM | ⚠️ Probablement inactif pour le backend | Mismatch labels Prometheus | Métriques applicatives risquent de ne jamais remonter |
| Logs temps réel (SSE) | ⚠️ Cassé pour MEMBER | C22 | CLIENT_ADMIN/ADMIN : fonctionnel (sous réserve) |
| Kafka (topics) | ⚠️ Isolation rompue pour MEMBER | C18 | Réplication dégradée silencieusement si brokers insuffisants |
| Knative Eventing | ⚠️ Même défaut d'isolation que Kafka | `EventingController` | Non vérifiable en conditions réelles ici |
| Suppression d'application | ✅ Probable | `AppService`/`KnativeService.delete` | Pas de garde contre double-suppression concurrente |
| Mise à jour d'application | ⚠️ Fonctionne mais avec downtime | delete+recreate | Downtime systématique à chaque update |
| Rollback | ❌ Incertain | `rollbackToRevision` mentionné | Le pattern delete-then-recreate peut rompre l'historique de révisions exploitable |
| Gestion des erreurs (API) | ⚠️ Mitigée | `GlobalExceptionHandler` correct mais catchs larges (C25) | Masque des pannes RBAC/cluster réelles |

**À clarifier avec l'utilisateur** : le Traffic Splitting mentionné dans l'énoncé n'a pas de preuve de code trouvée dans le backend audité.

---

# 5. Tests de Résilience

| Scénario | Comportement attendu (déduit du code) | Robustesse |
|---|---|---|
| Pod applicatif tenant supprimé | Knative recrée le pod si `minScale ≥ 1` ; sinon scale-to-zero normal | ✅ Standard Knative |
| Worker indisponible | Aucune anti-affinité définie — rien n'empêche `platform-api`/Postgres/Keycloak de finir sur le même nœud | ❌ Non robuste |
| Master (control-plane) indisponible | Hors périmètre du dépôt, topologie non documentée | ⚠️ Inconnu — à documenter |
| Kafka indisponible | `fetchTopicMetrics` masque l'échec silencieusement ; create/delete échouent proprement (500 explicite) | ⚠️ Partiellement robuste |
| Prometheus indisponible | Pas de circuit-breaker/timeout trouvé pour les appels vers Prometheus | ⚠️ Risque de blocage synchrone (même défaut que C8) |
| Grafana indisponible | Pas de dépendance backend directe identifiée | ✅ Découplé |
| Registry (Docker Hub) indisponible | Kaniko échoue proprement au build ; pod déjà déployé continue de tourner | ✅ Acceptable |
| Jenkins indisponible | Aucun impact runtime, mais aucun déploiement possible tant que down | ✅ Découplage correct |
| Image Docker inexistante | Revision reste en `ImagePullBackOff`, `buildServiceUrl()` épuise 20 tentatives (60s) avant échec | ⚠️ Correct mais UX dégradée |
| Image Docker corrompue | `CrashLoopBackOff`, détection réactive seulement (admin doit consulter) | ⚠️ Pas de notification proactive au tenant |
| Mauvais token JWT | Rejeté par le filtre OAuth2 Resource Server standard → 401 | ✅ Robuste |
| Utilisateur non autorisé | `@PreAuthorize` bloque, sauf sur les IDOR identifiés (C1, C2) | ❌ Non robuste sur ces 2 points |
| Déploiements simultanés | Conflit 409 géré par delete+recreate + un seul retry — fragile sous forte contention | ⚠️ Fragile |
| Forte charge | `@Async` inopérant (C10) = chaque requête bloque un thread jusqu'à 60s | ❌ Non robuste — point de rupture le plus probable |
| Scale massif | Pas de plafond serveur sur ressources/maxScale | ❌ Non robuste |

**Verdict global** : le système repose correctement sur les primitives K8s/Knative standards pour les pannes basses (pod, image), mais reste fragile face à la charge et aux abus multi-tenant, avec des SPOF applicatifs non mitigés.

---

# 6. Comparaison avec les Bonnes Pratiques

## Twelve-Factor App

| Facteur | Respecté ? | Constat |
|---|---|---|
| Codebase | ✅ | Un repo, plusieurs déploiements |
| Dependencies | ✅ | Maven/npm explicites |
| Config | ❌ | Secrets/config en dur dans les YAML versionnés |
| Backing services | ✅ | Postgres/Kafka/Keycloak traités via URL |
| Build/release/run | ✅ | Séparation Kaniko build → K8s run correcte |
| Processes | ⚠️ | `@Async` cassé introduit un état caché dans le thread de requête |
| Port binding | ✅ | Standard Spring Boot |
| Concurrency | ❌ | `replicas:1`, endpoint bloquant |
| Disposability | ⚠️ | Pas de graceful shutdown documenté, pas de probes |
| Dev/prod parity | ⚠️ | Mêmes mots de passe par défaut partout |
| Logs | ✅ | Logs structurés SLF4J |
| Admin processes | ✅ | Endpoints admin dédiés |

## Kubernetes Best Practices
Écarts majeurs : pas de `resources.limits`/probes, RBAC non exhaustif, pas de NetworkPolicy, pas de `securityContext`, `replicas:1` sans PDB.

## Knative Best Practices
Écarts : `containerConcurrency:0` non borné, pas de `timeoutSeconds`, pattern delete-then-recreate, pas de plafond serveur sur `maxScale`.

## Spring Boot Best Practices
Écarts : `@Async` mal utilisé, secrets en dur, `RestTemplate` sans timeout, CORS mal configuré, catchs larges masquant des erreurs.

## DevOps / CI-CD Best Practices
Absence de tests dans les pipelines, `agent any` unique, pas de scan de vulnérabilité, Kaniko dans le process Jenkins maître, pas de Harbor.

## OWASP Top 10
A01 Broken Access Control (IDOR, RBAC), A02 Cryptographic Failures (Keycloak prod en HTTP), A05 Security Misconfiguration (CORS, secrets), A07 Identification and Authentication Failures (ROPC), A09 Security Logging Failures (catchs masquants).

## AWS Well-Architected Framework (transposé)
- **Reliability** : faible — SPOF multiples, pas de HA.
- **Security** : faible — secrets en clair, RBAC incomplet, CORS dangereux.
- **Performance Efficiency** : moyen — pas de cache, endpoint bloquant.
- **Cost Optimization** : non évaluable.
- **Operational Excellence** : moyen — monitoring présent mais probablement mal câblé.

---

# 7. Rapport Final

## Résumé exécutif
PlatformServerless est un projet PFE ambitieux et techniquement cohérent (Spring Boot + Fabric8 + Knative + Kafka + Keycloak), avec une architecture en couches lisible et de bons réflexes (gestion centralisée des exceptions, client K8s en singleton, backups programmés). L'audit croisé révèle un ensemble cohérent de failles concentrées sur trois axes : **isolation multi-tenant absente à tous les niveaux** (code, réseau, ressources), **secrets en clair versionnés et déployés**, et **un point de blocage de scalabilité critique** (`@Async` inopérant). Le projet démontre une maîtrise technique réelle mais n'est pas dans un état exploitable en production multi-tenant sans un cycle de durcissement dédié.

## Architecture globale
Monorepo : backend Spring Boot (Fabric8/Knative/Kafka), 2 SPA React/Vite, microservices Node.js annexes, CI/CD Jenkins+Kaniko vers Docker Hub, déploiement K8s namespace `platform` + namespaces tenants dynamiques. Pas de Harbor, pas de Helm/Kustomize, pas de NetworkPolicy, pas de LimitRange, HA non démontrée.

## Points forts
Séparation en couches backend cohérente ; `GlobalExceptionHandler` propre ; client Fabric8 bien géré ; bons patterns d'isolation tenant déjà présents mais pas généralisés (`AppService.requireOwned`, `PodLogStreamService`) ; backups programmés avec credentials S3 correctement gérés ; ResourceQuota par tenant déjà implémenté (bien que partiel) ; pipelines CI/CD fonctionnels bout-en-bout.

## Points faibles
Isolation multi-tenant incomplète (code + réseau + ressources) ; secrets en clair partout ; CORS dangereux ; duplication frontend x2 ; couverture de tests quasi nulle ; monitoring backend probablement inactif ; SPOF non mitigés.

## Bugs critiques
IDOR logs (C1), IDOR Stripe (C2), `@Async` inopérant (C10), CORS `*`+credentials, absence de `resources.limits` Knative + LimitRange absent, RBAC sous-déclaré, secrets en clair, JWT en query string SSE, auth ROPC frontend, absence de NetworkPolicy.

## Vulnérabilités
9 critiques + 4 élevées — RBAC, CORS, secrets, isolation réseau (cf. §2.5).

## Problèmes de sécurité
A01, A02, A05, A07, A09 OWASP tous concernés avec preuves de code (§6).

## Problèmes de performance
Endpoint de création d'app bloquant jusqu'à 60s, pas de HPA/replicas>1 sur le backend, RestTemplate sans timeout, pas de cache réseau frontend, pas de mémoïsation React sur flux SSE.

## Dette technique
`KnativeServiceHelper` mort, `app.jwt.secret` mort, `allowedOrigins` non lu, typo `elaqsticsearch`, duplication frontend intégrale, versions Spring Boot/Fabric8 en retard, pas d'OWASP Dependency-Check.

## Fonctionnalités manquantes
Traffic Splitting (non trouvé), NetworkPolicy/LimitRange par tenant, plafond serveur sur `maxScale`/concurrency, injection réelle des `envVars` custom, notification proactive en cas de CrashLoopBackOff, tests automatisés à tous les niveaux.

## Fonctionnalités défectueuses
SSE logs pour MEMBER (C22), isolation Kafka/Eventing par équipe (C18), mise à jour d'image avec downtime systématique, monitoring Prometheus du backend (mismatch labels), rollback à confirmer.

## Qualité par domaine
- **Backend** : structure solide, mais bugs fonctionnels critiques (async, SSE, isolation tenant) et sécurité insuffisante.
- **Frontend** : bonnes pratiques UI de base, mais dette de sécurité (ROPC, token localStorage, JWT en query string) et duplication majeure.
- **Kubernetes** : manifestes corrects pour une démo, insuffisants pour la prod.
- **Knative** : usage correct des primitives, mais paramètres tenants non bornés et mise à jour destructive.
- **Kafka** : administration fonctionnelle, isolation tenant rompue, pas d'ACL par tenant.
- **Jenkins** : fonctionnel mais fragile (agent unique, correctifs symptomatiques).
- **CI/CD** : automatisé bout-en-bout sur 3/4 pipelines, aucun test/scan de sécurité.
- **DevOps** : bonne intention d'automatisation, exécution à durcir.
- **Infrastructure** : StorageClass/PV/topologie/CNI non versionnés, SPOF applicatifs non mitigés.

## Recommandations classées par priorité

**Critique**
1. Corriger les 2 IDOR (C1, C2).
2. Sortir tous les secrets en `Secret` K8s et les faire tourner.
3. Corriger CORS.
4. Ajouter `resources.limits` + `LimitRange` par tenant.
5. Documenter/corriger le RBAC réel.

**Élevée**
6. Corriger `@Async` (C10) et SSE MEMBER (C22).
7. Réaligner les labels Prometheus.
8. Ajouter NetworkPolicy deny-all par défaut par namespace tenant.
9. Migrer l'auth frontend vers Authorization Code + PKCE.

**Moyenne**
10. Passer `platform-api`/Postgres/Keycloak en HA (replicas≥2 + PDB + anti-affinité).
11. Mutualiser le code frontend dupliqué.
12. Ajouter des tests sur le cœur métier et la sécurité.

**Faible**
13. Nettoyage code mort, corrections de typo, harmonisation des Dockerfiles.

## Plan d'amélioration

**30 jours** : corrections critiques de sécurité (IDOR, secrets, CORS, RBAC), fix `@Async` et SSE MEMBER, LimitRange + limits Knative.

**60 jours** : NetworkPolicy par tenant, ACL Kafka par tenant, migration auth PKCE frontend, réalignement monitoring, HA Postgres/Keycloak/backend, tests de sécurité automatisés.

**90 jours** : mutualisation frontend, couverture de tests étendue (intégration/charge/résilience), documentation infrastructure complète, durcissement CI/CD, migration éventuelle vers un registre privé avec politique de rétention.

## Scores finaux

| Axe | Note /10 |
|---|---|
| Architecture | 6 |
| Backend | 5 |
| Frontend | 4.5 |
| Kubernetes | 3.5 |
| Knative | 5 |
| Kafka | 5 |
| Jenkins | 4 |
| CI/CD | 3 |
| Docker | 5 |
| Sécurité | 2.5 |
| Performance | 5 |
| Observabilité | 3.5 |
| Qualité du code | 5 |
| Tests | 2 |
| DevOps | 4 |
| **Projet Global** | **4/10** |

**Verdict** : projet PFE de bon niveau technique dans sa conception, mais nécessitant un cycle de durcissement sécurité/isolation multi-tenant/résilience avant toute exposition à des utilisateurs réels externes.
