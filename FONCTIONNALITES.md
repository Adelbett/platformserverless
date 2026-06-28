# NEXTSTEP Platform Serverless — Fonctionnalités implémentées

> Document de référence listant toutes les fonctionnalités réellement implémentées dans le projet, basé sur l'audit du code source.

---

## 1. Stack technique

| Couche | Technologie |
|---|---|
| Backend | Spring Boot 3.2.3 (Java 21) |
| Frontend | React 18.2 + Vite + React Router + MUI + Tailwind |
| Base de données | PostgreSQL |
| Authentification | Keycloak (OAuth2 / OIDC / JWT) |
| Orchestration | Kubernetes + Knative Serving/Eventing |
| Messaging | Kafka (Strimzi Operator) |
| Monitoring | Prometheus |
| CI/CD | Jenkins (pipelines déclaratifs) |
| Build images | Kaniko (sans Docker daemon) |

---

## 2. Authentification & Comptes

- Inscription (`POST /api/auth/register`) via Keycloak Admin API
- Connexion / déconnexion déléguées à Keycloak (OAuth2/OIDC)
- Synchronisation automatique Keycloak → PostgreSQL (`UserSyncFilter`)
- Consultation et modification du profil (`GET/PATCH /api/users/me`)
- JWT validé par Spring OAuth2 Resource Server (`KeycloakJwtAuthConverter`)
- Tokens promus automatiquement pour les flux SSE (`SseTokenFilter`)

---

## 3. Gestion des utilisateurs & Rôles (RBAC)

**Rôles** : `ADMIN`, `CLIENT_ADMIN`, `DEVELOPER`, `VIEWER`, `BILLING_MANAGER`

- Liste de tous les utilisateurs (ADMIN only)
- Changement de rôle d'un utilisateur (ADMIN only)
- Permissions granulaires par utilisateur (`Permission` enum : `DEPLOY_APP`, `DELETE_APP`, `MANAGE_KAFKA`, `MANAGE_EVENTING`, `VIEW_LOGS`, `VIEW_MONITORING`, `VIEW_BILLING`, `EXPORT_BILLING`)
- Contrôle d'accès via `@PreAuthorize(hasRole(...))` et `@permissionService.has(...)`

---

## 4. Gestion d'équipe (multi-tenant)

- CLIENT_ADMIN peut lister, ajouter, modifier le rôle et supprimer des membres de son équipe
- Les membres (`DEVELOPER`/`VIEWER`/`BILLING_MANAGER`) sont liés à leur CLIENT_ADMIN via `ownerId`
- `UserContextService` délègue automatiquement le `userId` effectif et le `namespace` du membre vers celui de son CLIENT_ADMIN

---

## 5. Multi-tenancy (isolation des données)

- Chaque entité (`App`, `KafkaTopic`, `KafkaSource`, `Trigger`, `BillingSnapshot`, `Metric`) porte un `userId`
- Isolation physique : chaque client a son propre namespace Kubernetes (`user-{username}`)
- Vérification d'ownership avant toute action sensible (`requireOwned()` dans `AppService`)
- Délégation transparente DEVELOPER → CLIENT_ADMIN via `UserContextService`

---

## 6. Déploiement d'Applications (Knative)

- Déploiement d'une app à partir d'une image Docker (`POST /api/apps`)
- Génération dynamique du manifeste Knative Service via Fabric8 (pas de fichier YAML statique)
- Création automatique du namespace cible si inexistant
- Liste, détails, mise à jour, redéploiement, suppression d'une app
- Détection automatique du statut réel depuis Kubernetes : `DEPLOYING`, `RUNNING`, `IDLE` (scale-to-zero), `FAILED`, `DELETED`
- Scaling configurable (`minReplicas`/`maxReplicas`) avec patch des annotations Knative autoscaling
- Construction automatique de l'URL publique de l'app
- Auto-wiring Kafka optionnel à la création d'une app (KafkaSource + Trigger générés automatiquement)

---

## 7. Kafka (Topics)

- Création de topics Kafka via Strimzi CRD (`KafkaTopic`)
- Liste, détails, suppression de topics
- Configuration : partitions, replicas, config

---

## 8. Eventing (Knative Eventing)

- Création de `KafkaSource` (connecteur topic Kafka → événements Knative)
- Liste des KafkaSources d'un utilisateur
- Création de `Trigger` (règle de filtrage + action déclenchée)
- Liste et suppression de Triggers
- Publication manuelle de CloudEvents vers le broker Knative

---

## 9. Logs

- Journal des événements de déploiement (`DeploymentLog`) : `DEPLOYMENT_START`, `DEPLOYMENT_SUCCESS`, `DEPLOYMENT_FAIL`, `UPDATE`, `DELETE`, `KAFKA_WIRED`
- Consultation des logs par app ou par utilisateur
- Stream temps réel des logs de déploiement (SSE, `LogSseService`)
- **Logs bruts du conteneur (stdout/stderr)** — `GET /api/logs/apps/{id}/pod-logs/stream` :
  - Localisation automatique du pod via le label Knative `serving.knative.dev/service`
  - Streaming temps réel via `watchLog()` (Fabric8)
  - Vérification ownership multi-tenant avant le stream
  - Affichage live côté frontend (`AppDetails.jsx` → composant `ContainerLogViewer`)

---

## 10. Monitoring & Métriques (Prometheus)

- Métriques par app : CPU, mémoire, requêtes/sec, latence P95, taux d'erreur
- Métriques agrégées du cluster
- Stream SSE temps réel (toutes les 10s) pour les métriques d'app et du cluster

---

## 11. Facturation (Billing)

- Snapshot horaire automatique de consommation (CPU/RAM/coût) par app
- Historique de facturation mensuel avec agrégation journalière (CLIENT_ADMIN)
- Vue facturation globale tous clients (ADMIN)
- Déclenchement manuel d'un snapshot (ADMIN)
- Export Excel (XLSX) du rapport de facturation (résumé, services, topics Kafka)
- Tarification : CPU 0.048$/vCPU-heure, RAM 0.006$/Go-heure, facteur d'usage selon statut (RUNNING=1.0, FAILED=0.0, autres=0.2)

---

## 12. Administration Plateforme (ADMIN only)

- Statistiques globales de la plateforme
- Vue d'ensemble complète du cluster (nœuds, pods, namespaces, services Knative, brokers Kafka)
- Liste de toutes les apps / tous les topics / toutes les KafkaSources / tous les Triggers, tous clients confondus
- Suppression forcée d'une app ou d'un topic Kafka
- Suspension / restauration d'une app spécifique (scale-to-zero)
- Suspension / restauration de tous les services d'un client
- Liste de tous les clients (CLIENT_ADMIN) avec statut de suspension

---

## 13. Sécurité Kubernetes (RBAC cluster)

- `ServiceAccount` "default" du namespace `platform` lié à `ClusterRole` restrictif (`platform-backend-role`)
- Permissions limitées à : Knative Services/Revisions/Routes, Eventing Brokers/Triggers/KafkaSources, KafkaTopics (Strimzi), Pods + Pods/log, Namespaces, Deployments, Services
- Suppression de l'ancien binding `cluster-admin` (principe du moindre privilège appliqué)

---

## 14. CI/CD (Jenkins)

- Pipelines déclaratifs séparés : `Jenkinsfile.backend`, `Jenkinsfile.frontend`, `Jenkinsfile.microservices`
- Build Maven (`mvn clean package`)
- Build d'image Docker sans daemon via **Kaniko**
- Push vers Docker Hub
- Déploiement automatique (`kubectl set image` + `kubectl rollout status`)

---

## 15. Frontend (pages disponibles)

| Page | Fonction |
|---|---|
| `/login`, `/register` | Authentification |
| `/dashboard` | Vue d'ensemble |
| `/apps`, `/apps/new`, `/apps/:id` | Gestion des applications + logs live + métriques |
| `/kafka` | CRUD Topics Kafka |
| `/eventing` | KafkaSources + Triggers |
| `/logs` | Historique des logs de déploiement (filtrable) |
| `/monitoring` | Graphiques CPU/RAM/requêtes |
| `/billing` | Facturation client |
| `/team` | Gestion d'équipe (CLIENT_ADMIN) |
| `/users` | Gestion des utilisateurs (ADMIN) |
| `/settings` | Paramètres / secrets |
| admin/* | Pages d'administration plateforme |

---

## 16. Points connus comme incomplets (à date de cet audit)

- `DELETE /api/users/:id` non implémenté (seul le changement de rôle existe)
- Filtrage des logs par niveau (`?level=ERROR`) non implémenté
- `GET /api/kafka/topics/:name/lag` (consumer lag) non implémenté
- Endpoint `DELETE /api/eventing/sources/:name` non exposé directement
- VIEWER : restriction GET-only non appliquée explicitement par `@PreAuthorize`
- Nettoyage automatique JNA/tmp Jenkins non finalisé (cause du bug de checkout SCM identifié)

---

*Document généré à partir de l'audit du code source — à mettre à jour si de nouvelles fonctionnalités sont ajoutées.*
