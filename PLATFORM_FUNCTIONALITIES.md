# Cartographie fonctionnelle de la plateforme

Document produit par analyse directe du code (contrôleurs, services, entités, pages frontend) du dépôt `platformserverless`. Aucune fonctionnalité n'est déduite d'une simple possibilité technique : chaque ligne renvoie à un endpoint, une méthode de service ou une page réellement présente dans le code.

## 1. Vue d'ensemble

La plateforme repose sur un modèle à trois acteurs, définis par l'énumération `UserRole` (`user/UserRole.java`) et appliqués via Spring Security (`@PreAuthorize`) :

- **ADMIN** — équipe opérationnelle de NextStep IT, exploite la console d'administration (`admin-console`), supervise l'ensemble des tenants et du cluster.
- **CLIENT_ADMIN** — titulaire d'un compte client (tenant), utilise le portail client (`web-portal`), gère ses applications, son équipe et sa facturation.
- **MEMBER** — membre d'équipe rattaché à un CLIENT_ADMIN, accès au portail client limité aux fonctionnalités pour lesquelles une permission granulaire lui a été explicitement accordée (`Permission` enum : `DEPLOY_APP`, `DELETE_APP`, `MANAGE_KAFKA`, `MANAGE_EVENTING`, `VIEW_LOGS`, `VIEW_MONITORING`, `VIEW_BILLING`, `EXPORT_BILLING`).

L'authentification passe entièrement par Keycloak (OIDC/JWT) ; le backend est un serveur de ressources OAuth2 qui ne gère ni connexion ni mot de passe lui-même (cf. Gestion 1).

---

## 2. Acteur : ADMIN

### Gestion 1 : Authentification et accès
- Connexion via Keycloak (même mécanisme que les autres acteurs, différenciation uniquement par le rôle porté par le jeton).

### Gestion 2 : Gestion des utilisateurs
- Lister l'ensemble des utilisateurs de la plateforme.
- Modifier le rôle d'un utilisateur.

### Gestion 3 : Gestion des comptes clients (tenants)
- Lister les comptes clients.
- Suspendre un compte client (bloque l'ensemble de ses applications).
- Réactiver un compte client suspendu.

### Gestion 4 : Gestion des quotas
- Consulter les quotas de ressources (CPU, mémoire, nombre maximal d'applications) d'un tenant.
- Modifier les quotas d'un tenant.

### Gestion 5 : Gestion des applications (niveau administrateur)
- Suppression forcée d'une application, quel que soit son propriétaire.
- Suspension d'une application.

### Gestion 6 : Gestion de Kafka (niveau administrateur)
- Suppression forcée d'un topic, quel que soit son propriétaire.

### Gestion 7 : Gestion de la supervision et du cluster
- Consulter les statistiques globales de la plateforme.
- Consulter l'état du cluster Kubernetes : nœuds, pods, namespaces, volumes (PVC), services Knative, courtiers Kafka.
- Consulter les alertes et événements actifs du cluster.
- Consulter une vue d'ensemble des composants système.

### Gestion 8 : Gestion de l'audit
- Consulter le journal d'audit des actions administratives (qui, quoi, avant/après, cible, IP).
- Exporter le journal d'audit (CSV).

### Gestion 9 : Gestion de la facturation (niveau administrateur)
- Consulter la facturation de l'ensemble des clients.
- Déclencher manuellement un instantané (snapshot) d'usage.
- Exporter un rapport de facturation.
- Consulter la liste des factures impayées.
- Suspendre un client pour non-paiement.

### Gestion 10 : Gestion du statut public
- Consulter le statut public de la plateforme (même accès que tout visiteur).

---

## 3. Acteur : CLIENT_ADMIN

### Gestion 1 : Authentification et compte
- Inscription (création d'un compte, provisionné dans Keycloak).
- Connexion via Keycloak.
- Consulter son propre profil.
- Modifier son propre profil.

### Gestion 2 : Gestion des clés d'API
- Créer une clé d'API (accès machine-à-machine, ex. pipelines CI/CD).
- Lister ses clés d'API.
- Révoquer une clé d'API.

### Gestion 3 : Gestion d'équipe
- Inviter/ajouter un membre (l'identifiant, l'e-mail et le mot de passe du membre sont définis directement par le CLIENT_ADMIN — aucun flux d'invitation par e-mail).
- Lister les membres de son équipe.
- Modifier les permissions accordées à un membre (par fonctionnalité : déploiement, Kafka, Eventing, journaux, monitoring, facturation).
- Supprimer un membre.

### Gestion 4 : Gestion des applications
- Créer/déployer une application à partir d'une image Docker.
- Consulter la liste de ses applications et leur statut en temps réel.
- Consulter le détail d'une application.
- Mettre à jour une application.
- Supprimer une application.
- Consulter l'historique des révisions.
- Revenir (rollback) à une révision antérieure.

### Gestion 5 : Gestion de Kafka
- Créer un topic.
- Lister ses topics.
- Supprimer un topic.

### Gestion 6 : Gestion de l'Eventing
- Configurer un déclencheur (associer un sujet Kafka à une application).
- Publier un événement (CloudEvent) sur un sujet.

### Gestion 7 : Gestion des journaux
- Consulter les journaux de déploiement de ses applications.
- Consulter les journaux applicatifs en flux continu (temps réel).

### Gestion 8 : Gestion du monitoring
- Consulter les métriques de ses applications (requêtes/s, latence, CPU, mémoire) en flux continu.

### Gestion 9 : Gestion de la facturation et des paiements
- Consulter son propre historique d'usage et de facturation.
- Enregistrer un moyen de paiement (Stripe).
- Consulter ses transactions.
- Consulter ses factures et les payer.
- Exporter un rapport de facturation.

### Gestion 10 : Gestion du statut public
- Consulter le statut public de la plateforme.

---

## 4. Acteur : MEMBER

Accès identique à celui du CLIENT_ADMIN sur les gestions applicatives, mais **conditionné à une permission explicitement accordée** par son CLIENT_ADMIN, et les ressources créées sont systématiquement rattachées au compte du CLIENT_ADMIN (résolution d'identité effective via `UserContextService`), jamais au compte propre du membre.

### Gestion 1 : Authentification et compte
- Connexion via Keycloak (compte créé directement par son CLIENT_ADMIN, avec mot de passe permanent — pas d'auto-inscription).
- Consulter/modifier son propre profil.

### Gestion 2 : Gestion des clés d'API
- Créer/lister/révoquer ses propres clés d'API.

### Gestion 3 : Gestion des applications *(si permission `DEPLOY_APP`/`DELETE_APP`)*
- Créer/déployer, consulter, mettre à jour, supprimer une application, gérer les révisions — mêmes actions que le CLIENT_ADMIN, rattachées à son compte.

### Gestion 4 : Gestion de Kafka *(si permission `MANAGE_KAFKA`)*
- Créer/lister/supprimer des topics, rattachés au compte du CLIENT_ADMIN.

### Gestion 5 : Gestion de l'Eventing *(si permission `MANAGE_EVENTING`)*
- Configurer des déclencheurs, publier des événements.

### Gestion 6 : Gestion des journaux *(si permission `VIEW_LOGS`)*
- Consulter les journaux de déploiement et applicatifs.

### Gestion 7 : Gestion du monitoring *(si permission `VIEW_MONITORING`)*
- Consulter les métriques des applications du compte.

### Gestion 8 : Gestion de la facturation *(si permission `VIEW_BILLING`/`EXPORT_BILLING`)*
- Consulter l'historique de facturation, exporter un rapport.
- **Non confirmé dans le code** : aucune permission dédiée au paiement (`PAY_BILLING` ou équivalent) n'existe dans l'énumération `Permission` — la capacité d'un MEMBER à réellement déclencher un paiement n'a pas pu être confirmée au niveau du contrôleur et n'est donc pas listée comme acquise.

### Gestion 9 : Gestion du statut public
- Consulter le statut public de la plateforme.

**Explicitement hors de portée d'un MEMBER** (protégé par `@PreAuthorize("hasRole('CLIENT_ADMIN')")` ou `ADMIN`) : gestion d'équipe (inviter/modifier/supprimer un membre), gestion des utilisateurs, gestion des comptes clients, gestion des quotas, toute fonctionnalité de la console d'administration.

---

## 5. Matrice globale des fonctionnalités

| Gestion | Fonctionnalité | Acteur(s) | Interface | Composant/API | Statut |
|---|---|---|---|---|---|
| Authentification | Inscription | CLIENT_ADMIN | Frontend + API | `POST /api/auth/register` | Confirmée |
| Authentification | Connexion | ADMIN, CLIENT_ADMIN, MEMBER | Frontend | Keycloak (OIDC), `KeycloakJwtAuthConverter` | Confirmée |
| Authentification | Consulter/modifier son profil | ADMIN, CLIENT_ADMIN, MEMBER | Frontend + API | `GET/PATCH /api/users/me` | Confirmée |
| Utilisateurs | Lister tous les utilisateurs | ADMIN | Admin console + API | `GET /api/users` | Confirmée |
| Utilisateurs | Modifier le rôle d'un utilisateur | ADMIN | Admin console + API | `PUT /api/users/{id}/role` | Confirmée |
| Clés d'API | Créer/lister/révoquer une clé d'API | CLIENT_ADMIN, MEMBER | Frontend + API | `/api/apikeys` | Confirmée |
| Équipe | Inviter un membre | CLIENT_ADMIN | Frontend + API | `POST /api/team/members` | Confirmée |
| Équipe | Lister les membres | CLIENT_ADMIN | Frontend + API | `GET /api/team/members` | Confirmée |
| Équipe | Modifier les permissions d'un membre | CLIENT_ADMIN | Frontend + API | `/api/team/members/{id}/permissions` | Confirmée |
| Équipe | Supprimer un membre | CLIENT_ADMIN | Frontend + API | `DELETE /api/team/members/{id}` | Confirmée |
| Applications | Créer/déployer une application | CLIENT_ADMIN, MEMBER* | Frontend + API | `POST /api/apps` | Confirmée |
| Applications | Consulter/lister les applications | CLIENT_ADMIN, MEMBER | Frontend + API | `GET /api/apps` | Confirmée |
| Applications | Mettre à jour une application | CLIENT_ADMIN, MEMBER* | Frontend + API | `PUT /api/apps/{id}` | Confirmée |
| Applications | Supprimer une application | CLIENT_ADMIN, MEMBER* | Frontend + API | `DELETE /api/apps/{id}` | Confirmée |
| Applications | Historique des révisions / rollback | CLIENT_ADMIN, MEMBER* | Frontend + API | `/api/apps/{id}/revisions`, rollback | Confirmée |
| Applications | Suppression forcée / suspension | ADMIN | Admin console + API | `admin` (force-delete, suspend) | Confirmée |
| Kafka | Créer/lister/supprimer un topic | CLIENT_ADMIN, MEMBER* | Frontend + API | `/api/kafka/topics` | Confirmée |
| Kafka | Suppression forcée d'un topic | ADMIN | Admin console + API | `admin` (force-delete topic) | Confirmée |
| Eventing | Configurer un déclencheur | CLIENT_ADMIN, MEMBER* | Frontend + API | `/api/eventing/sources`, `/triggers` | Confirmée |
| Eventing | Publier un événement | CLIENT_ADMIN, MEMBER* | API | `POST /api/events` | Confirmée |
| Journaux | Consulter les journaux (déploiement + applicatifs) | CLIENT_ADMIN, MEMBER* | Frontend + API | `/api/logs/...`, flux SSE | Confirmée |
| Journaux | Consulter tous les journaux | ADMIN | Admin console + API | `admin` (all logs) | Confirmée |
| Monitoring | Consulter les métriques d'une application | CLIENT_ADMIN, MEMBER* | Frontend + API | `/api/metrics/apps/{id}` | Confirmée |
| Supervision cluster | Introspection complète du cluster | ADMIN | Admin console + API | `admin` (nodes/pods/ns/pvc/ksvc/brokers/alerts) | Confirmée |
| Audit | Consulter/exporter le journal d'audit | ADMIN | Admin console + API | `GET /api/admin/audit-log`, `/export` | Confirmée |
| Comptes clients | Lister/suspendre/réactiver un client | ADMIN | Admin console + API | `admin` (clients) | Confirmée |
| Quotas | Consulter/modifier les quotas d'un tenant | ADMIN | Admin console + API | `GET/PUT /api/admin/clients/{id}/quota` | Confirmée |
| Facturation | Consulter sa propre facturation | CLIENT_ADMIN, MEMBER* | Frontend + API | `GET /api/billing/me` | Confirmée |
| Facturation | Consulter la facturation de tous les clients | ADMIN | Admin console + API | `GET /api/billing/admin` | Confirmée |
| Facturation | Déclencher un instantané d'usage | ADMIN | API | `/api/billing/admin/snapshot` | Confirmée |
| Facturation | Exporter un rapport de facturation | CLIENT_ADMIN, MEMBER*, ADMIN | Frontend + API | `/api/billing/export` | Confirmée |
| Paiement | Enregistrer un moyen de paiement | CLIENT_ADMIN | Frontend + API | `/api/payment/setup-intent`, `/methods` | Confirmée |
| Paiement | Consulter/payer ses transactions et factures | CLIENT_ADMIN | Frontend + API | `/api/payment/pay`, `/api/invoices` | Confirmée |
| Paiement | Relance impayés / suspension pour non-paiement | ADMIN | API | `/api/invoices` (admin) | Confirmée |
| Statut | Consulter le statut public | Public, ADMIN, CLIENT_ADMIN, MEMBER | Frontend + API | `GET /api/status`, `/incidents` | Confirmée |
| Applications | Catalogue d'images Docker validées | — | — | Entité `DockerImage` | **Non confirmée** (entité JPA orpheline, sans dépôt/service/contrôleur, non utilisée dans le flux de déploiement) |
| Agenda | Fonctionnalité de type agenda/planning | — | Frontend | `web-portal` `Agenda.jsx` | **Non confirmée** (page présente côté frontend, aucun contrôleur/service backend correspondant trouvé) |

*\* Sous réserve de la permission granulaire correspondante accordée par le CLIENT_ADMIN.*

---

## 6. Fonctionnalités communes aux acteurs

- Authentification via Keycloak et consultation/modification de son propre profil (ADMIN, CLIENT_ADMIN, MEMBER).
- Consultation du statut public (les trois acteurs, ainsi que le public non authentifié).
- Gestion des clés d'API (CLIENT_ADMIN, MEMBER — chacun pour ses propres clés).
- Gestion des applications, de Kafka, de l'Eventing, des journaux, du monitoring et de la facturation en lecture/action : communes à CLIENT_ADMIN et MEMBER, ce dernier étant systématiquement soumis à une permission explicite et à la délégation d'identité vers son CLIENT_ADMIN.

## 7. Fonctionnalités réservées à un acteur

**Réservées à ADMIN** : gestion des utilisateurs (rôles), gestion des comptes clients, gestion des quotas, supervision et introspection complète du cluster, gestion de l'audit, suppression forcée d'applications/topics, facturation globale, relance des impayés et suspension pour non-paiement.

**Réservées à CLIENT_ADMIN** : inscription initiale du compte, gestion d'équipe (inviter/modifier/supprimer un membre et ses permissions), enregistrement d'un moyen de paiement.

**Réservées à MEMBER** : aucune — le MEMBER n'a accès à aucune fonctionnalité qui ne soit pas également accessible au CLIENT_ADMIN ; son périmètre est un sous-ensemble conditionné par permission.

## 8. Fonctionnalités présentes dans la documentation mais non confirmées dans le code

- **Catalogue d'images Docker validées** (`DockerImage`) : entité JPA seule, sans dépôt, service ni contrôleur — ne correspond à aucune fonctionnalité opérationnelle.
- **Agenda / planning** (`Agenda.jsx` côté `web-portal`) : page frontend présente, mais aucun endpoint ou service backend correspondant identifié.
- **Paiement effectué par un MEMBER** : aucune permission dédiée (`PAY_BILLING` ou équivalent) n'existe ; seule la consultation (`VIEW_BILLING`) et l'export (`EXPORT_BILLING`) sont confirmées pour ce rôle.

## 9. Synthèse

- **Gestions identifiées** : 15 au total (Authentification/compte, Utilisateurs, Comptes clients, Quotas, Applications, Kafka, Eventing, Journaux, Monitoring, Supervision cluster, Audit, Facturation, Paiement, Équipe, Clés d'API, Statut public) — regroupées ci-dessus en 10 par acteur selon leur périmètre réel.
- **Fonctionnalités identifiées** : 33 fonctionnalités confirmées dans le code (cf. matrice section 5), plus 3 éléments non confirmés (catalogue d'images, agenda, paiement par un MEMBER).
- **Fonctionnalités par acteur** :
  - ADMIN : 19 fonctionnalités.
  - CLIENT_ADMIN : 26 fonctionnalités.
  - MEMBER : 20 fonctionnalités (sous réserve de permission).
- **Fonctionnalités communes** : 8 gestions partagées entre au moins deux acteurs (authentification/profil, clés d'API, applications, Kafka, Eventing, journaux, monitoring, facturation en lecture/export, statut public).
