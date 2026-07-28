# Audit Progress

Suivi des corrections issues de `AUDIT_COMPLET.md`. Une correction = une discussion = un fichier Markdown = une validation avant de passer à la suivante. Rien n'est modifié sans accord explicite.

## Plan global priorisé

### Critique

| ID | Sujet | Composant(s) | État |
|----|---|---|---|
| 001 | [IDOR sur les logs de déploiement (C1)](001-idor-logs-deploiement.md) | Backend | ✅ Fait |
| 002 | [IDOR sur suppression de moyen de paiement Stripe (C2)](002-idor-stripe-payment-method.md) | Backend | ✅ Fait |
| 003 | [Secrets en clair (Postgres/Keycloak/JWT mort)](003-secrets-en-clair.md) | Backend + Kubernetes | ✅ Fait — déployé et vérifié sur le cluster (pod `platform-api` Running, logs propres) |
| 004 | [CORS `allowedOriginPatterns("*")` + `allowCredentials(true)`](004-cors-wildcard-credentials.md) | Backend | ✅ Fait |
| 005 | Absence de `resources.limits` + `LimitRange` sur les Knative Services tenants | Backend + Kubernetes | ⏭️ Ignoré — décision produit : consommation libre, facturation à l'usage |
| 006 | [RBAC sous-déclaré vs. permissions réellement exercées](006-rbac-sous-declare.md) | Kubernetes | ✅ Fait — vérifié sur le cluster (`can-i` → yes/yes) |
| 007 | [JWT transmis en query string sur les flux SSE](007-jwt-query-string-sse.md) | Frontend | ✅ Fait |
| 008 | Authentification ROPC au lieu d'Authorization Code + PKCE | Frontend | ⏭️ Ignoré — décision utilisateur |
| 009 | [Absence totale de NetworkPolicy (isolation réseau tenants)](009-network-policy-tenants.md) | Kubernetes + Backend | ✅ Fait (code) — commandes cluster à appliquer |

### Haute

| ID | Sujet | Composant(s) | État |
|----|---|---|---|
| 010 | [`@Async` inopérant par auto-invocation (déploiement bloquant)](010-async-self-invocation.md) | Backend | ✅ Fait |
| 011 | [SSE logs cassé (clé username vs userId — touchait en réalité tous les rôles)](011-sse-logs-cle-incoherente.md) | Backend | ✅ Fait |
| 012 | [Isolation tenant rompue sur Kafka/Eventing pour les MEMBER (C18)](012-isolation-kafka-eventing.md) | Backend | ✅ Fait |
| 013 | `Thread.sleep` bloquant en boucle dans le déploiement Knative | Backend | À faire |
| 014 | Élévation de rôle potentielle dépendante de la config Keycloak (C6) | Backend + Keycloak (config) | À faire |
| 015 | Mismatch labels Prometheus (monitoring backend probablement inactif) | Kubernetes | À faire |
| 016 | Token/refreshToken stockés en `localStorage` | Frontend | À faire |
| 017 | Console admin exposée en NodePort sans protection réseau | Kubernetes | À faire |
| 018 | Broker Kafka partagé sans ACL/authentification par tenant | Kubernetes + Kafka | À faire |
| 019 | Zéro test frontend | Frontend | À faire |
| 020 | Couverture de tests backend quasi nulle sur le cœur métier/sécurité | Backend | À faire |

### Moyenne

| ID | Sujet | Composant(s) | État |
|----|---|---|---|
| 021 | Pas de handler `AccessDeniedException` (500 au lieu de 403) | Backend | À faire |
| 022 | `RestTemplate` sans timeout + ré-authentification Keycloak à chaque appel | Backend | À faire |
| 023 | `envVars`/`args` de `AppRequest` ignorés au déploiement | Backend | À faire |
| 024 | Kafka injecté inconditionnellement même sans `kafkaEnabled` | Backend | À faire |
| 025 | Suppression Knative "delete-then-recreate" (downtime à chaque update) | Backend | À faire |
| 026 | Validation manquante (`cpuRequest`/`memoryRequest`, `updateApp` sans `@Valid`) | Backend | À faire |
| 027 | Pas de retry/DLQ Kafka, catch large silencieux sur métriques | Backend | À faire |
| 028 | `SseEmitter(0L)` sans heartbeat (fuite mémoire potentielle) | Backend | À faire |
| 029 | Catchs larges dans `AdminController` masquant des pannes (200 + liste vide) | Backend | À faire |
| 030 | Fallback silencieux vers données mock en cas d'échec API | Frontend | À faire |
| 031 | Aucun Error Boundary React | Frontend | À faire |
| 032 | Aucun header de sécurité HTTP (CSP/HSTS/X-Frame-Options) | Frontend (nginx) | À faire |
| 033 | Pas de cache/retry réseau frontend (React Query absent) | Frontend | À faire |
| 034 | Duplication intégrale web-portal / admin-console | Frontend | À faire |
| 035 | HA Postgres/Keycloak/platform-api (SPOF, `replicas:1`) | Kubernetes | À faire |
| 036 | Pas d'alerte sur échec des CronJobs de backup | Kubernetes | À faire |
| 037 | Pipeline Jenkins sans timeout/tests/scan sécurité | DevOps/CI-CD | À faire |
| 038 | Kaniko in-process dans Jenkins (cause racine des correctifs fork()) | DevOps/CI-CD | À faire |

### Faible

| ID | Sujet | Composant(s) | État |
|----|---|---|---|
| 039 | Code mort backend (`KnativeServiceHelper`, `app.jwt.secret`, `allowedOrigins`, typo `elaqsticsearch`) | Backend | À faire |
| 040 | `RuntimeException` brute au lieu de `NotFoundException` | Backend | À faire |
| 041 | Deux Dockerfiles backend divergents (un mort) | DevOps | À faire |
| 042 | Conteneurs applicatifs tournant en root (pas de `USER`) | Docker | À faire |
| 043 | Pas de page 404 dédiée / liens factices `href="#"` | Frontend | À faire |
| 044 | Code mort frontend (`auth/keycloak.js` orphelin, `msw` inutilisé) | Frontend | À faire |
| 045 | `generateServiceName()` : `substring` fragile (C12) — `StringIndexOutOfBoundsException` si `userId` a un caractère non-alphanumérique et ≤6 caractères après nettoyage (reproduit en conditions réelles via `AppServiceTest`, ticket 010) | Backend | À faire |

---

## Notes de méthode

- Une seule correction traitée à la fois, dans l'ordre de priorité ci-dessus (sauf si tu préfères réordonner).
- Chaque correction fait l'objet d'un fichier `docs/audit-fixes/0XX-nom-du-probleme.md` créé **après** ta validation et l'application du correctif.
- Aucune modification de code n'est faite sans ton accord explicite.
- Ce tableau sera mis à jour au fur et à mesure (État : À faire / En cours / ✅ Fait).

## Incidents de production découverts hors plan initial

| ID | Sujet | Composant(s) | État |
|----|---|---|---|
| 046 | [Logs invisibles — frontend envoie le username au lieu de l'id effectif](046-frontend-logs-username-vs-userid.md) (régression révélée par le ticket 001) | Frontend | ✅ Fait |
| 047 | [Panne d'authentification totale — `KEYCLOAK_ISSUER_URI` incohérent avec l'URL réelle de Keycloak](047-keycloak-issuer-uri-mismatch.md) | Backend + Kubernetes | ✅ Fait — vérifié en production |
| 049 | [Liste blanche CORS incomplète — NodePort de `platform-web` (31088) manquant](049-cors-nodeport-manquant.md) | Backend + Kubernetes | ✅ Fait |
| 048 | [Suppression de la limite sur le nombre d'apps par tenant](048-suppression-quota-nombre-apps.md) (décision produit) | Backend | ✅ Fait |
