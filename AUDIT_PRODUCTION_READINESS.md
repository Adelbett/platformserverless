# Audit de Mise en Production — PlatformServerless

**Type d'audit** : Pré-production, niveau cabinet (architecture, sécurité, Kubernetes, Knative, Kafka, Jenkins, Docker, backend, frontend, monitoring, résilience, CI/CD).

**Méthodologie et limites déclarées** :
- Analyse basée sur la lecture exhaustive du code source, des manifestes Kubernetes, des Dockerfiles et des Jenkinsfiles du dépôt, complétée par des vérifications réelles sur le cluster de production (`kubectl auth can-i`, `kubectl get clusterrole/clusterrolebinding`, `kubectl get networkpolicy`, `kubectl get pods -n kube-system`, `kubectl get namespaces`) effectuées **par l'utilisateur** à ma demande — je n'ai pas d'accès direct au cluster/VMs (politique de l'utilisateur), donc toute vérification runtime est soit déjà confirmée via une commande exécutée par l'utilisateur pendant cet audit (citée explicitement), soit signalée comme "à vérifier" avec la commande exacte à lancer.
- **Ce rapport intègre l'état réel actuel du projet** : 12 corrections ont déjà été appliquées et vérifiées (compilation + tests + confirmation cluster) au cours de ce même audit, documentées dans `docs/audit-fixes/001-*.md` à `012-*.md`. Les sections ci-dessous distinguent explicitement "corrigé" de "encore ouvert".
- Aucun test de charge réel (100/500/1000/10000 utilisateurs) n'a été exécuté — section 18 fournit une analyse du comportement attendu par lecture de code, avec les commandes pour valider empiriquement.

---

## 1. Résumé exécutif

PlatformServerless est un projet techniquement solide dans sa conception (Spring Boot 3.2.3 + Fabric8 Kubernetes Client + Knative Serving/Eventing + Strimzi Kafka + Keycloak + Prometheus/Grafana), avec une architecture en couches lisible et des choix technologiques cohérents avec l'objectif ("l'utilisateur fournit une image Docker, la plateforme fait le reste"). Un audit approfondi mené en amont de cette session avait révélé neuf failles **critiques** concentrées sur trois axes : isolation multi-tenant absente (code, réseau, ressources), secrets en clair versionnés et déployés, et un point de blocage de scalabilité (`@Async` inopérant). **Sept de ces neuf failles critiques, plus trois failles élevées, ont depuis été corrigées et vérifiées** (IDOR logs, IDOR paiement Stripe, secrets Kubernetes, CORS wildcard, RBAC sous-déclaré, NetworkPolicy tenants, JWT en query string SSE, `@Async` cassé, SSE logs cassé pour tous les rôles, isolation Kafka/Eventing MEMBER). Deux failles ont été explicitement **acceptées comme risque produit** sur décision de l'utilisateur (absence de plafond de ressources — modèle "pay-as-you-go" — et authentification ROPC au lieu d'Authorization Code+PKCE). Il reste un socle de dette technique et de finitions opérationnelles (résilience/HA, observabilité Prometheus à réactiver, tests, CI/CD) avant une exposition pleinement mature à des utilisateurs externes non contrôlés.

## 2. Architecture globale

```
Utilisateur ──HTTPS──▶ web-portal (React/Vite) ──▶ backend-api (Spring Boot, Fabric8) ──▶ Kubernetes API
                                                         │                                    │
                                                    Keycloak (OIDC)                    Knative Serving
                                                         │                              (Service/Revision/Route)
                                                    PostgreSQL                                │
                                                         │                              Kourier (Ingress)
                                                    Strimzi Kafka ◀── KafkaSource/Trigger (Knative Eventing)
                                                         │
                                                  Prometheus/Grafana (monitoring)
```

- **Backend** : monolithe Spring Boot unique gérant auth, apps, Kafka, Eventing, paiement, admin, quotas.
- **Frontend** : deux SPA React/Vite indépendantes (`web-portal` pour les tenants, `admin-console` pour les opérateurs), **pas Next.js** malgré la mention initiale — correction factuelle actée dans l'audit précédent.
- **Infra** : cluster K8s 3 nœuds (`vm01` control-plane, `vm02`/`vm03` workers), CNI **Cilium**, MetalLB (LoadBalancer), Kourier (Ingress Knative), Strimzi (Kafka), namespace dédié par tenant (`user-*`).
- **CI/CD** : Jenkins + Kaniko (build in-cluster rootless) → Docker Hub (pas de registre privé de type Harbor) → `kubectl set image`.

## 3. Points forts

- Séparation en couches backend cohérente (Controller/Service/Repository/DTO), `GlobalExceptionHandler` centralisé et propre (`ProblemDetail`, pas de fuite de stacktrace).
- Client Fabric8 Kubernetes correctement géré en singleton (pas de fuite de connexion).
- Pattern d'isolation tenant correct déjà présent et généralisé au fil de cet audit (`AppService.requireOwned`, `PodLogStreamService`, et désormais `LogService`, `PaymentService`, `KafkaController`, `EventingController`, `LogSseService`).
- Backups Postgres/Elasticsearch programmés, credentials S3 gérés via `secretKeyRef` (bon exemple à suivre pour le reste).
- `ResourceQuota` par tenant déjà implémenté côté code (`QuotaService`), RBAC désormais versionné fidèlement et complété (`persistentvolumeclaims`, `resourcequotas`, `networkpolicies`).
- Isolation réseau par défaut désormais en place (NetworkPolicy générée automatiquement à la création de chaque namespace tenant).
- CNI Cilium — choix robuste, supporte pleinement `NetworkPolicy` et des politiques plus avancées si besoin futur.
- Pipeline CI/CD fonctionnel de bout en bout sur 3 des 4 composants (build → push → déploiement automatique).

## 4. Points faibles

- Absence de HA sur les composants d'état (Postgres, Keycloak, `platform-api` en `replicas: 1`) — SPOF non mitigés.
- Monitoring Prometheus du backend probablement inopérant (mismatch de labels du sélecteur, non encore corrigé — ticket 015 ouvert).
- Duplication intégrale de code entre `web-portal` et `admin-console` (~15 fichiers).
- Couverture de tests encore partielle (progrès réel apporté par cet audit sur les zones critiques touchées, mais le reste du cœur métier — `KnativeService`, `EventingService`, contrôleurs non modifiés — reste sous-testé).
- CI/CD sans stage de tests, sans scan de vulnérabilité, sans timeout, Kaniko in-process dans Jenkins (cause de correctifs symptomatiques passés).
- Deux décisions de risque acceptées explicitement (pas de plafond ressources tenants ; auth ROPC) — à surveiller en usage réel.

## 5. Tous les bugs détectés

*(état mis à jour — corrigé/ouvert)*

| Bug | Sévérité | État |
|---|---|---|
| IDOR logs de déploiement (`LogController`/`LogService`) | Critical | ✅ Corrigé (ticket 001) |
| IDOR suppression moyen de paiement Stripe | Critical | ✅ Corrigé (ticket 002) |
| `@Async` inopérant par auto-invocation (`AppService.triggerDeployAsync`) | Critical | ✅ Corrigé (ticket 010) |
| SSE logs cassé (clé username vs. userId) — touchait tous les rôles | High | ✅ Corrigé (ticket 011) |
| Isolation Kafka/Eventing rompue pour les MEMBER | High | ✅ Corrigé (ticket 012) |
| `generateServiceName()` : `StringIndexOutOfBoundsException` si `userId` contient un caractère non-alphanumérique et ≤6 caractères après nettoyage | Medium | ⚠️ Ouvert (ticket 045, découvert via test de régression du ticket 010) |
| `Thread.sleep` bloquant en boucle dans `KnativeService.buildServiceUrl()`/conflit 409 | High | ⚠️ Ouvert (ticket 013, expliqué mais non corrigé sur décision de report) |
| `envVars`/`args` de `AppRequest` acceptés par l'API mais ignorés au déploiement | Medium | ⚠️ Ouvert |
| Kafka injecté inconditionnellement dans chaque app même sans `kafkaEnabled` | Medium | ⚠️ Ouvert |
| Suppression Knative "delete-then-recreate" → downtime à chaque mise à jour d'image | Medium | ⚠️ Ouvert |
| Validation manquante (`cpuRequest`/`memoryRequest` sans `@Pattern`, `updateApp` sans `@Valid`) | Low | ⚠️ Ouvert |
| Catchs larges dans `AdminController` (6 endpoints) masquant des pannes en 200+liste vide | Medium | ⚠️ Ouvert |
| `SseEmitter(0L)` sans heartbeat — fuite mémoire potentielle sous forte volumétrie de connexions abandonnées | Medium | ⚠️ Ouvert |
| Pas de handler `AccessDeniedException` → 500 au lieu de 403 | Low | ⚠️ Ouvert |
| `RestTemplate` sans timeout + ré-authentification Keycloak à chaque appel admin | Medium | ⚠️ Ouvert |
| Code mort : `KnativeServiceHelper`, `app.jwt.secret` (désormais externalisé mais toujours non consommé), `allowedOrigins` — ce dernier **désormais utilisé** (corrigé au ticket 004) | Low | Partiellement corrigé |
| Typo `elaqsticsearch` dans `application.yml` (config Elasticsearch silencieusement ignorée) | Low | ⚠️ Ouvert |

## 6. Tous les problèmes de sécurité

| Problème | Sévérité | État |
|---|---|---|
| CORS `allowedOriginPatterns("*")` + `allowCredentials(true)` | Critical | ✅ Corrigé (ticket 004) — liste blanche réelle (IP LoadBalancer web-portal + 3 nœuds pour admin-console) |
| Secrets Postgres/Keycloak/JWT en clair dans le code et les manifestes versionnés | Critical | ✅ Corrigé côté code/manifeste (ticket 003) — `Secret` K8s créé par l'utilisateur ; **mots de passe non tournés** (décision explicite : mêmes valeurs `postgres`/`admin`, seulement déplacées vers un `Secret`) — risque résiduel si l'historique Git est un jour exposé |
| RBAC versionné très en-deçà des permissions réelles + `ClusterRole` caché non documenté | Critical | ✅ Corrigé (ticket 006) — reconstruit fidèlement, permissions manquantes (`persistentvolumeclaims`, `resourcequotas`) ajoutées et vérifiées sur le cluster réel |
| Absence totale de `NetworkPolicy` (isolation réseau tenants) | Critical | ✅ Corrigé côté code pour les futurs namespaces (ticket 009) ; **manifeste de rattrapage pour les 4 namespaces existants pas encore confirmé appliqué** par l'utilisateur (à vérifier) |
| JWT transmis en query string sur les flux SSE (fuite via logs nginx/proxy) | Critical | ✅ Corrigé (ticket 007) — migration vers `fetch` + en-tête `Authorization` |
| Absence de `resources.limits` sur les Knative Services tenants (DoS interne "noisy neighbour") | Critical | ⏭️ **Accepté comme risque produit** — décision explicite de l'utilisateur ("le client consomme et paie") ; risque résiduel signalé : ça n'affecte pas que la facturation du tenant fautif, mais aussi la performance des *autres* tenants co-localisés |
| Authentification ROPC (`grant_type=password`) au lieu d'Authorization Code + PKCE | Critical | ⏭️ **Accepté comme risque produit** — décision explicite de l'utilisateur |
| Broker Kafka partagé sans ACL/SASL par tenant (`KafkaUser` Strimzi) | High | ⚠️ Ouvert (ticket 018) |
| Token/refreshToken stockés en `localStorage` (vulnérable à toute XSS future) | High | ⚠️ Ouvert (ticket 016) |
| Élévation de rôle potentielle selon la config Keycloak réelle (self-registration, default roles) | High | ⚠️ En cours d'investigation (ticket 014) — nécessite vérification directe de la config Keycloak, pas uniquement du code |
| Admin console exposée en NodePort fixe sans protection réseau dédiée | High | ⚠️ Ouvert (ticket 017) |
| Actuator `show-details: always` exposé (fuite d'informations système) | Medium | ⚠️ Ouvert, non traité dans le plan actuel — à ajouter |
| Pas de scan de vulnérabilité (Trivy/OWASP Dependency-Check) dans le pipeline CI/CD | Medium | ⚠️ Ouvert (ticket 037) |
| Conteneurs applicatifs tournant en root (aucun `USER` dans les Dockerfiles) | Medium | ⚠️ Ouvert (ticket 042) |

## 7. Tous les problèmes DevOps

- Kaniko exécuté **in-process** dans le conteneur Jenkins (pas en pod agent K8s éphémère) — cause racine documentée d'une série de correctifs symptomatiques passés (`safeRestart`, gestion `/tmp`) plutôt qu'une correction structurelle (ticket 038, ouvert).
- Pipeline sans `timeout()`, sans `disableConcurrentBuilds()`, `agent any` unique pour les 4 Jenkinsfiles → point de contention/panne unique.
- Aucun stage de tests, d'analyse de qualité (SonarQube) ni de scan de sécurité d'image dans aucun des 4 pipelines (ticket 037, ouvert).
- Incohérence architecturale : `Jenkinsfile.microservices` utilise `docker build`/`docker push` classiques (nécessite le socket Docker), alors que les 3 autres utilisent Kaniko.
- Deux Dockerfiles backend divergents et non synchronisés (`backend.Dockerfile` mort, `backend-kaniko.Dockerfile` réellement utilisé) — ticket 041, ouvert.
- Registre Docker Hub public, pas de Harbor ni de politique de rétention des tags ; tag mutable `:latest` co-poussé à chaque build.

## 8. Tous les problèmes Kubernetes

| Problème | Sévérité | État |
|---|---|---|
| RBAC sous-déclaré/portée excessive (cluster-wide `delete` sur pods/services/deployments/namespaces) | Critical/High | Documentation corrigée (ticket 006) ; **portée non réduite** — décision explicite de ne traiter que la documentation/complétion pour l'instant, resserrement proposé comme ticket futur distinct |
| Absence de `NetworkPolicy` | Critical | ✅ Corrigé pour les futurs tenants (ticket 009) ; rattrapage des 4 namespaces existants à confirmer |
| Aucun `resources.requests/limits` sur les Deployments de la plateforme elle-même (`platform-api`, `platform-admin`, `platform-web`) | High | ⚠️ Ouvert |
| Aucune probe (`liveness`/`readiness`/`startup`) sur les Deployments de la plateforme | High | ⚠️ Ouvert |
| Aucun `LimitRange` par namespace tenant (le `ResourceQuota` existant ne borne que la somme des `requests`, pas les `limits` par pod) | High | ⚠️ Ouvert, lié à la décision produit du ticket 005 |
| `replicas: 1` sans `PodDisruptionBudget` ni anti-affinité sur `platform-api` | High | ⚠️ Ouvert (ticket 035) |
| Backend/frontend exposés en `LoadBalancer` direct sans Ingress ni TLS ; admin en `NodePort` fixe | High | ⚠️ Ouvert (ticket 017 partiellement) |
| Aucun `securityContext` (`runAsNonRoot`, `readOnlyRootFilesystem`) sur aucun Deployment/CronJob | Medium | ⚠️ Ouvert |
| Pas de `StorageClass`/PV/PVC versionnés dans ce dépôt pour Postgres/Keycloak/ES | Medium | Écart d'IaC — dépendance opérationnelle non versionnée, à documenter |
| Pas d'alerte sur échec des `CronJob` de backup | Medium | ⚠️ Ouvert (ticket 036) |
| Aucune `HorizontalPodAutoscaler` sur les Deployments de la plateforme (backend/frontend/admin) | Medium | Non traité — l'autoscaling actuel ne concerne que les Knative Services des tenants |
| Pas de `DaemonSet`/`StatefulSet` dans ce dépôt pour Postgres/Keycloak (déployés comme `Deployment` classiques a priori, à confirmer — pas de manifeste StatefulSet trouvé pour une base de données à état) | Medium | À documenter/vérifier |
| Aucun `ImagePullSecret` nécessaire actuellement (images publiques Docker Hub) mais absence de stratégie si le registre devient privé | Low | Point de vigilance futur |

## 9. Tous les problèmes Knative

| Problème | Sévérité | État |
|---|---|---|
| `containerConcurrency: 0` (illimité) par défaut pour toutes les apps tenants | High | ⏭️ Accepté comme risque produit (lié au ticket 005) |
| Pas de plafond serveur sur `maxScale`/`minScale` — entièrement pilotable par le tenant | High | ⏭️ Accepté comme risque produit |
| Suppression Knative "delete-then-recreate" en cas de conflit 409 → downtime systématique à chaque mise à jour d'image, au lieu d'un update in-place générant une nouvelle Revision proprement | Medium | ⚠️ Ouvert |
| `Thread.sleep` en boucle (jusqu'à 60s) pour obtenir l'URL du service au lieu d'exploiter le `KnativeWatcher` déjà présent dans le code | High | ⚠️ Ouvert (ticket 013, expliqué mais reporté) |
| Pas de `timeoutSeconds` explicite (valeur par défaut Knative 300s) | Low | Non traité, risque limité |
| Traffic Splitting (canary/blue-green) mentionné dans le contexte du projet mais **aucune preuve de code trouvée** dans le backend audité | Medium | Fonctionnalité potentiellement manquante — à confirmer avec le porteur du projet |
| Domain Mapping personnalisé : aucune trace de configuration `DomainMapping` Knative dans le dépôt | Low | Fonctionnalité non implémentée, à confirmer si prévue |
| Dead Letter Sink / Retry sur les Triggers Knative Eventing : aucune configuration de `delivery.deadLetterSink`/`retry` trouvée dans `EventingService` | Medium | Absence de gestion d'échec de livraison d'événements — un événement non traité par un Trigger est probablement perdu silencieusement |

## 10. Tous les problèmes Kafka

| Problème | Sévérité | État |
|---|---|---|
| Broker Kafka partagé injecté dans toutes les apps tenants sans SASL/mTLS, sans `KafkaUser`/ACL Strimzi par tenant | High | ⚠️ Ouvert (ticket 018) |
| Réplication dégradée silencieusement si moins de brokers disponibles que demandé (`KafkaService.java`) | Medium | ⚠️ Ouvert |
| Pas de retry/DLQ pour la consommation Kafka applicative | Medium | ⚠️ Ouvert |
| `fetchTopicMetrics` catch large silencieux (métriques disparaissent sans message d'erreur explicite en cas de panne Kafka prolongée) | Medium | ⚠️ Ouvert |
| Isolation tenant sur la création/liste des topics et sources Kafka (username brut vs. id effectif) | High | ✅ Corrigé (ticket 012) |
| Pas de manifeste Strimzi `KafkaTopic`/`KafkaUser` versionné dans ce dépôt — gestion entièrement via `AdminClient` Kafka applicatif, pas de GitOps sur les topics | Medium | Écart d'architecture à documenter, pas nécessairement un bug si le choix est assumé |

## 11. Tous les problèmes Jenkins

- Agent unique (`agent any`) sur les 4 pipelines, pas d'isolation, pas de parallélisation entre pipelines.
- `retry(2)` au niveau pipeline entier sur le backend (rebuild+repush+redeploy complet) plutôt qu'un retry ciblé.
- Aucun `timeout()` sur aucun stage ni au niveau pipeline — un build/déploiement bloqué gèle l'unique exécuteur.
- `post { always { safeRestart } }` sur le backend redémarre Jenkins après **chaque** build, y compris en cas d'échec précoce — correctif symptomatique du problème Kaniko in-process, pas une solution structurelle.
- Correctifs anti-Kaniko (`TMPDIR`, `--use-new-run --snapshot-mode=redo`) appliqués uniquement au pipeline backend, alors que 3 des 4 pipelines utilisent Kaniko — admin/frontend restent exposés au même bug fork().
- Aucune notification (Slack/email) — uniquement des `echo` console.
- Aucun stage de tests, aucune Quality Gate SonarQube, aucun scan Trivy/OWASP Dependency-Check.
- Versioning d'image : `v${BUILD_NUMBER}` + push simultané de `:latest` — pas de lien direct avec le SHA Git, `latest` mutable.
- Pas de cache de build Kaniko activé.

## 12. Tous les problèmes Docker

- Deux Dockerfiles backend divergents et non synchronisés (multi-stage `maven:3.9-eclipse-temurin-21` vs. single-stage `amazoncorretto:21-alpine3.19` réellement utilisé) — le premier est du code mort trompeur.
- Aucun `USER` non-root dans aucun des 5 Dockerfiles applicatifs (backend, admin, frontend, order-service, notification-service).
- Aucun `HEALTHCHECK` dans aucun Dockerfile.
- Aucun `.dockerignore` trouvé.
- `order-service`/`notification-service` : `npm install` sans lockfile copié — build non-reproductible.
- Pas de scan de CVE des images de base (Trivy/Grype) dans la chaîne CI/CD.

## 13. Tous les problèmes Backend

- `envVars`/`args` de `AppRequest` acceptés par l'API Swagger mais totalement ignorés au déploiement Knative — fonctionnalité fantôme, source de confusion côté utilisateur.
- Kafka injecté inconditionnellement dans chaque app déployée, même sans `kafkaEnabled` — expose l'adresse interne du broker à toute image utilisateur, y compris non fiable.
- Suppression Knative "delete-then-recreate" avec `Thread.sleep(2000)` — race condition possible si la suppression prend plus de 2s côté cluster.
- Catchs larges dans `AdminController` (6 endpoints hors `getNodes()` déjà corrigé historiquement) retournant 200+liste vide au lieu d'un code d'erreur explicite en cas de panne RBAC/cluster.
- `RestTemplate` sans timeout vers Keycloak, ré-authentification à chaque appel admin au lieu de mettre en cache le token.
- Pas de handler `AccessDeniedException` dédié → 500 générique au lieu de 403.
- `SseEmitter(0L)` (timeout infini) sans heartbeat périodique — fuite mémoire potentielle sous forte volumétrie de connexions abandonnées.
- Validation Bean Validation incomplète (`updateApp` sans `@Valid`, `cpuRequest`/`memoryRequest` sans `@Pattern`).
- Code mort : `KnativeServiceHelper` (classe entière jamais utilisée), typo `elaqsticsearch` dans `application.yml` (config Elasticsearch silencieusement ignorée).
- `generateServiceName()` fragile — `substring` peut lever `StringIndexOutOfBoundsException` selon le format du `userId` (reproduit en conditions réelles pendant cet audit).

## 14. Tous les problèmes Frontend

- Duplication intégrale de code entre `web-portal` et `admin-console` (~15 fichiers : `AuthContext`, `api/client`, `ThemeContext`, `Toast`, `Layout`/`Sidebar`, `nginx.conf`, `package.json`...).
- Authentification ROPC au lieu d'Authorization Code + PKCE (`keycloak-js` présent en dépendance mais inutilisé, `silent-check-sso.html` orphelin) — accepté comme risque produit.
- Token/refreshToken en `localStorage` (vulnérable à toute XSS future) — ticket 016 ouvert.
- Aucun Error Boundary React sur toute l'app — tout crash de rendu produit un écran blanc total.
- Fallback silencieux vers données mock en cas d'échec API (`AppDetails.jsx`) sans bannière d'avertissement — risque de confusion critique pour une plateforme de monitoring.
- Aucun header de sécurité HTTP (CSP/HSTS/X-Frame-Options) dans les `nginx.conf` des deux apps.
- Pas de cache/retry réseau structuré (React Query absent) — re-fetch redondant entre pages.
- Zéro test frontend (Vitest absent des `devDependencies`, `msw` présent mais inutilisé).
- Pas de code splitting/lazy loading identifié — bundle de production ~1MB minifié (avertissement Vite au build).
- Pas de page 404 dédiée, liens factices `href="#"` sur certains éléments (`Login.jsx`).

## 15. Tous les problèmes Monitoring

- **Mismatch de labels Prometheus** : `PrometheusRule` (`alert-rules.yaml`) et `ServiceMonitor` (`service-monitor.yaml`) portent `release: prometheus`, alors que le sélecteur réel du Prometheus Operator (documenté dans `queue-proxy-podmonitor.yaml`) attend `release: monitoring-stack` — **les métriques et alertes du backend ne sont probablement jamais scrapées/déclenchées**, silencieusement (ticket 015, ouvert). C'est le problème d'observabilité le plus structurant du projet : sans le corriger, aucune des autres garanties de monitoring listées ci-dessous n'est vérifiable.
- Couverture d'alertes minimale : seulement 2 règles définies (taux d'erreur 5xx backend, crash-loop pods `platform`) — rien sur la disponibilité Postgres/Keycloak/Kafka, les échecs de CronJob de backup, les échecs de déploiement Knative, ou la saturation ressources des namespaces tenants.
- `alertmanager-config.yaml` dépend d'une substitution manuelle (`envsubst`) non intégrée à un pipeline — risque d'oubli (déploiement avec un webhook littéral non substitué).
- Dashboard Grafana présent (`k8s/grafana/platform-tenant-dashboard.json`) mais dépend des métriques `queue-proxy` du `PodMonitor` — à revalider une fois le mismatch de labels corrigé.
- Actuator exposé avec `show-details: always` — fuite d'information système au-delà du nécessaire pour le monitoring.
- Aucune trace de Node Exporter, kube-state-metrics ou Metrics Server versionnés dans ce dépôt — probablement déployés hors du dépôt applicatif (stack `monitoring-stack-kube-prom-*` mentionnée dans les URLs de config), à vérifier que ces composants sont bien opérationnels sur le cluster (`kubectl get pods -n monitoring`).

## 16. Tous les problèmes Performance

- `Thread.sleep` bloquant en boucle (jusqu'à 60s) dans `KnativeService.buildServiceUrl()` — chaque déploiement d'app immobilise un thread du pool `@Async` sans rien faire d'utile pendant ce temps (ticket 013, ouvert).
- `RestTemplate` sans timeout vers Keycloak/Prometheus — risque de blocage synchrone prolongé en cas de lenteur de ces services.
- Pas de mémoïsation React sur les flux SSE fréquents (recalculs de graphiques à chaque message, potentiellement plusieurs fois par seconde).
- Pas de cache réseau frontend — re-fetch redondant des mêmes données entre pages (`Dashboard`, `AppsList`, `Monitoring` appellent chacun `appsApi.list()` indépendamment).
- Aucune `HorizontalPodAutoscaler` sur le backend lui-même — `platform-api` reste à `replicas: 1` quelle que soit la charge, un seul point de traitement pour toutes les requêtes API de tous les tenants.
- Pas de cache Kaniko activé en CI/CD — chaque build refait `mvn dependency:go-offline`/`npm install` intégralement.

## 17. Tous les problèmes Scalabilité

- `platform-api` en `replicas: 1`, sans HPA — la capacité de traitement de l'API ne peut pas s'adapter à une hausse du nombre de tenants ou de requêtes.
- Aucun plafond serveur sur les ressources/`maxScale`/`containerConcurrency` des apps tenants — un seul tenant peut, à lui seul, saturer un nœud avant même d'atteindre une charge multi-utilisateurs élevée (risque accepté explicitement par l'utilisateur, mais impacte directement la scalabilité globale du cluster partagé).
- Broker Kafka unique partagé par tous les tenants sans isolation de charge (pas de quotas Kafka par `KafkaUser`) — un tenant à fort volume peut dégrader la latence Kafka de tous les autres.
- Pas de `LimitRange` — la répartition effective des ressources entre pods d'un même namespace sous forte charge dépend uniquement du kube-scheduler et de l'absence de contention réseau/CPU non garantie par ailleurs.

## 18. Tous les problèmes Résilience

*(analyse par lecture de code — aucun test de charge réel exécuté ; commandes de validation fournies)*

| Scénario | Comportement attendu | Robustesse |
|---|---|---|
| Suppression d'un Pod tenant | Knative recrée si `minScale≥1` ; scale-to-zero normal sinon | ✅ Standard Knative |
| Suppression d'un Worker | Aucune anti-affinité définie — `platform-api` (replicas:1) et Postgres/Keycloak peuvent finir sur le même nœud | ❌ Non robuste (SPOF) |
| Crash Kafka | `fetchTopicMetrics` masque l'échec silencieusement ; create/delete topic échouent proprement (500 explicite) | ⚠️ Partiellement robuste |
| Crash Prometheus | Pas de circuit-breaker/timeout pour les appels vers Prometheus (`AdminController`) | ⚠️ Risque de blocage synchrone |
| Crash Grafana | Pas de dépendance backend directe | ✅ Découplé |
| Crash Keycloak | Toute authentification/rafraîchissement de token échoue — SPOF total sur l'auth, `replicas` de Keycloak non versionné dans ce dépôt (à vérifier : `kubectl get deploy keycloak -n platform -o jsonpath='{.spec.replicas}'`) | ❌ Probable SPOF |
| Crash PostgreSQL | Toute la plateforme devient indisponible (apps, logs, quotas, paiement) — `replicas` non versionné, à vérifier de la même façon | ❌ Probable SPOF |
| Crash Jenkins | Aucun impact runtime (CI/CD découplé de la prod), mais aucun déploiement/mise à jour possible tant que down | ✅ Découplage correct |
| Perte réseau (partition) | Comportement dépendant de Cilium/MetalLB — non testé, `kubectl get ciliumnetworkpolicies`/logs Cilium à consulter en cas d'incident réel | ⚠️ Non vérifié |
| 100 utilisateurs | Vraisemblablement stable (charge faible pour un seul backend `replicas:1`) | ✅ Probable |
| 500 utilisateurs | Risque de latence croissante — pas d'HPA, `Thread.sleep` bloquant en déploiement (moins impactant depuis le ticket 010, mais toujours présent au ticket 013) | ⚠️ À valider par test de charge réel |
| 1000 utilisateurs | Risque de saturation du pool de threads Tomcat/`@Async` sous forte fréquence de créations d'app, RestTemplate sans timeout amplifiant le risque | ⚠️ Non robuste sans correctifs 013/HPA |
| 10000 utilisateurs | Hors de portée de l'architecture actuelle sans HA backend, HPA, et resserrement des ressources tenants (`replicas:1`, pas de `LimitRange`, broker Kafka unique) | ❌ Non robuste |
| Déploiements simultanés (même app) | Conflit 409 géré par delete+recreate + un seul retry — fragile sous forte contention | ⚠️ Fragile |

**Commandes de validation à exécuter par l'utilisateur pour compléter cette section** :
```bash
kubectl get deploy postgres keycloak -n platform -o jsonpath='{.spec.replicas}{"\n"}'
kubectl get pdb -A
kubectl get pods -n platform -o wide   # vérifier la co-localisation sur les mêmes nœuds
```

## 19. Tous les problèmes CI/CD

Voir section 7/11 — synthèse : automatisation build→push→déploiement fonctionnelle sur 3/4 pipelines, mais totalement dépourvue de tests, de scan de sécurité, et de garde-fous d'exécution (timeout, concurrence). Aucun rollback automatique si `kubectl rollout status` échoue après un déploiement.

## 20. Fonctionnalités manquantes

- Traffic Splitting (canary/blue-been) — mentionné dans le contexte du projet, aucune preuve de code trouvée.
- Dead Letter Sink / retry sur les Triggers Knative Eventing.
- `LimitRange` par namespace tenant.
- ACL/authentification Kafka par tenant (`KafkaUser` Strimzi).
- HPA sur les composants de la plateforme elle-même (backend/frontend/admin).
- Ingress/TLS centralisé (actuellement LoadBalancer/NodePort directs).
- Tests automatisés (unitaires étendus, intégration, charge, résilience) sur l'essentiel du cœur métier restant.
- Domain Mapping personnalisé pour les apps tenants.

## 21. Fonctionnalités cassées

*(état mis à jour)*

- ~~SSE logs temps réel~~ → ✅ Corrigé (ticket 011).
- ~~Isolation Kafka/Eventing par équipe~~ → ✅ Corrigé (ticket 012).
- `envVars`/`args` custom acceptés par l'API mais ignorés au déploiement — toujours cassé.
- Mise à jour d'image Knative avec downtime systématique (delete-then-recreate) — toujours cassé.
- Monitoring Prometheus du backend — probablement toujours inactif (ticket 015 non traité).
- Rollback : la stratégie delete-then-recreate peut rompre l'historique de révisions Knative exploitable pour un vrai rollback — à confirmer.

## 22. Dette technique

- `KnativeServiceHelper` mort, typo `elaqsticsearch`, deux Dockerfiles backend divergents.
- Duplication frontend intégrale (~15 fichiers).
- Versions Spring Boot 3.2.3 et Fabric8 6.10.0 en retard de plusieurs patchs — vérifier CVE.
- Pas d'OWASP Dependency-Check/Trivy configuré.
- Portée RBAC volontairement non réduite (documentée mais pas resserrée) — dette de sécurité assumée à traiter dans un ticket futur dédié.

## 23. Bonnes pratiques absentes

- Twelve-Factor "Config" toujours partiellement violé (mots de passe non tournés, même externalisés).
- Pas de `securityContext`/`runAsNonRoot` sur les workloads.
- Pas de PodDisruptionBudget.
- Pas de bibliothèque Jenkins partagée (`vars/`) — logique Kaniko dupliquée dans les 4 pipelines.
- Pas de tests de charge/résilience formalisés dans le cycle de développement.

## 24. Scores par domaine /10

| Domaine | Score | Évolution vs. audit initial |
|---|---|---|
| Architecture | 6.5 | ↑ (isolation tenant généralisée) |
| Backend | 6 | ↑ (IDOR, @Async, SSE, Kafka/Eventing corrigés) |
| Frontend | 5 | ↑ léger (JWT SSE corrigé) |
| Kubernetes | 5 | ↑ (RBAC, NetworkPolicy corrigés ; HA/probes/LimitRange restent ouverts) |
| Knative | 5 | = (risques ressources acceptés comme décision produit) |
| Kafka | 5.5 | ↑ (isolation tenant corrigée ; ACL toujours absente) |
| Jenkins | 4 | = |
| CI/CD | 3 | = |
| Docker | 5 | = |
| Sécurité | 5 | ↑↑ (5 failles critiques corrigées sur 9 ; 2 acceptées comme risque produit) |
| Performance | 5.5 | ↑ (blocage `@Async` corrigé ; `Thread.sleep` Knative reste ouvert) |
| Observabilité | 3.5 | = (mismatch Prometheus non corrigé) |
| Résilience | 4 | = (SPOF non traités) |
| Qualité du code | 5.5 | ↑ (tests ajoutés sur les zones corrigées) |
| Tests | 3 | ↑ léger (couverture ciblée ajoutée sur logs/paiement/Kafka/async, reste partiel) |
| DevOps | 4 | = |

## 25. Score global

**5.2/10** — en nette progression par rapport à l'audit initial (4/10), grâce à la correction vérifiée de 7 failles critiques/élevées et à l'acceptation explicite et documentée de 2 risques produit assumés. Le projet n'est plus dans un état de faille béante multi-tenant, mais nécessite encore : la correction du monitoring Prometheus (aveugle aujourd'hui), la haute disponibilité des composants d'état, l'ACL Kafka par tenant, et un durcissement du pipeline CI/CD, avant une exposition pleinement mature à des utilisateurs externes non contrôlés à grande échelle.

---

*Rapport basé sur l'analyse exhaustive du dépôt et les vérifications cluster réelles effectuées au fil de cette session d'audit (voir `docs/audit-fixes/` pour le détail de chaque correction appliquée et vérifiée).*
