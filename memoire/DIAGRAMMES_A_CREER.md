# Diagrammes et captures d'écran à créer pour le mémoire

Ce fichier liste **toutes** les images référencées dans les fichiers `.tex` du dossier `memoire/`, avec leur chemin exact, leur type, et une description de ce qu'elles doivent contenir. À produire avec Creately (ou tout autre outil UML) puis à exporter en `.png` aux chemins indiqués.

Deux dossiers à créer dans `memoire/` : `diagrammes/` et `captures/`.

---

## 1. Logo

| Fichier | Description |
|---|---|
| `memoire/logo.png` | Logo de NextStep IT (organisme d'accueil). Utilisé au Chapitre 1 et sur la page de garde (`garde_fin.tex`). |
| `diagrammes/organigramme.png` | Organigramme réel de NextStep IT (Chapitre 1, section 2.2) — actuellement en TODO/commenté dans le .tex. |
| `diagrammes/cycle_scrum.png` | Schéma classique du cycle Scrum (Chapitre 1, avant la section "Organisation de l'équipe Scrum") : Product Backlog → Sprint Planning → Sprint Backlog → Sprint (itération) → Incrément → Sprint Review → Sprint Retrospective → retour au Sprint suivant. |

---

## 2. Chapitre 2 — Analyse des besoins

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/uc_global.png` | Diagramme de cas d'utilisation (UML) | Vue globale : 3 acteurs (ADMIN, CLIENT_ADMIN, MEMBER) reliés aux grandes fonctionnalités : Se connecter, Gérer l'équipe, Déployer une application, Gérer Kafka, Configurer l'Eventing, Consulter logs/monitoring, Consulter facturation, Superviser le cluster, Gérer les comptes clients, Générer une clé d'API. Se baser sur le tableau 2.2 (`tab:uc-global`) du Chapitre 2 pour la liste exacte des cas d'utilisation et les acteurs associés. |

---

## 3. Chapitre 3 — Modélisation globale

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/architecture_logique.png` | Diagramme d'architecture (4 couches) | Couche présentation (Portail client React, Console admin React) → Couche service (API REST Spring Boot, modules par domaine : app, billing, user, security, apikey, kafka, eventing, admin, logs) → Couche orchestration (Fabric8 Kubernetes Client) → Couche infrastructure (Kubernetes, Knative Serving, Knative Eventing, Strimzi/Kafka, Keycloak, PostgreSQL, Prometheus/Grafana, Jenkins/Kaniko). Flèches descendantes montrant que seul le backend parle au cluster. |
| `diagrammes/architecture_physique.png` | Diagramme de déploiement (UML deployment diagram) | 3 nœuds K8s (1 control-plane + 2 workers), CNI Cilium, MetalLB, Kourier en entrée. Namespace `platform` (backend, 2 frontends, Keycloak, PostgreSQL) séparé des namespaces tenants (1 par client, avec NetworkPolicy). Cluster Kafka Strimzi représenté séparément, avec Knative Eventing (Broker/Trigger/KafkaSource) faisant le lien. |
| `diagrammes/diagramme_composants.png` | Diagramme de composants (UML) | Modules internes du backend Spring Boot : `app`, `billing`, `user`, `security`, `apikey`, `kafka`, `eventing`, `admin`, `logs`, chacun connecté à un client Fabric8 partagé et à PostgreSQL. |
| `diagrammes/diagramme_classes.png` | Diagramme de classes (UML) | Entités : `User` (+ `UserRole` enum, `Permission`), `App` (statut, image, port, minScale/maxScale), `DeploymentLog`, `BillingSnapshot`, `AppInvoice`, entité clé d'API. Relation `User` 1—* `App` résolue via `UserContextService` (délégation MEMBER → CLIENT_ADMIN). |
| `diagrammes/sequence_deploiement.png` | Diagramme de séquence (UML) | Processus complet de déploiement : Client → Portail → Backend (AppController/AppService) → DB (statut DEPLOYING) → réponse HTTP immédiate → AppDeploymentAsyncRunner → KnativeService → cluster K8s/Knative → KnativeWatcher met à jour le statut → SSE vers portail. Voir section 3.6.1 du Chapitre 3 pour les 8 étapes détaillées. |
| `diagrammes/sequence_eventing.png` | Diagramme de séquence (UML) | Flux événementiel : Producteur → topic Kafka (Strimzi) → KafkaSource (encapsule en CloudEvent) → Broker Knative Eventing → Trigger (filtre) → Activator (si app à 0 instance) → scale-up → App traite l'événement → réponse 200 → redescente à 0 après inactivité. Voir section 3.6.2 du Chapitre 3. |

---

## 4. Chapitre 5 — Release 1 (Sprints 3, 4, 5)

### Sprint 3 — Knative Eventing

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/sequence_configurer_trigger.png` | Diagramme de séquence | Cas d'utilisation « Configurer un déclencheur d'événement » : Utilisateur → Backend (vérif propriété app + topic via UserContextService) → création KafkaSource → création Trigger → persistance → réponse. Voir tableau 5.1 (description textuelle) pour le détail. |

### Sprint 4 — Authentification et sécurité

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/uc_securite.png` | Diagramme de cas d'utilisation | Acteurs CLIENT_ADMIN/MEMBER/ADMIN ; cas d'utilisation : Se connecter, Gérer les membres et permissions, Générer une clé d'API. |
| `diagrammes/sequence_login.png` | Diagramme de séquence | Authentification : Utilisateur → Portail → Keycloak (échange identifiants/JWT) → Portail joint le JWT à chaque requête → Backend (KeycloakJwtAuthConverter valide + extrait rôles, UserSyncFilter synchronise l'utilisateur local) → accès autorisé. Voir tableau 5.4 du Chapitre 5. |

### Sprint 5 — Gestion des applications + CI/CD Backend

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/uc_gestion_apps.png` | Diagramme de cas d'utilisation | Acteurs CLIENT_ADMIN/MEMBER ; cas d'utilisation : Déployer une application, Mettre à jour/Supprimer une application, Consulter l'historique de révisions, Effectuer un rollback. |
| `diagrammes/sequence_deploy_app_detail.png` | Diagramme de séquence (détaillé, niveau classes) | Version détaillée du déploiement au niveau des classes backend : AppController → AppService (vérif quota, génération nom DNS) → App (DB, statut DEPLOYING) → DeploymentLog + SSE → réponse HTTP → AppDeploymentAsyncRunner → KnativeService → cluster → KnativeWatcher → mise à jour statut. Reprend la figure `sequence_deploiement.png` du Chapitre 3 en l'enrichissant des noms de classes réels. |

---

## 5. Chapitre 6 — Release 2 (Sprints 6, 7)

### Sprint 6 — Kafka et Eventing côté Backend

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/uc_kafka_eventing.png` | Diagramme de cas d'utilisation | Acteurs CLIENT_ADMIN/MEMBER ; cas d'utilisation : Créer un sujet Kafka, Lister/Supprimer un sujet Kafka, Configurer un déclencheur. |
| `diagrammes/sequence_create_topic.png` | Diagramme de séquence | Création d'un sujet Kafka : Utilisateur → KafkaController → résolution identité effective (UserContextService) → KafkaService → création ressource KafkaTopic (Strimzi) → réponse. Voir tableau 6.2 du Chapitre 6. |

### Sprint 7 — Monitoring, métriques et logs

| Fichier | Type | Contenu attendu |
|---|---|---|
| `diagrammes/uc_monitoring.png` | Diagramme de cas d'utilisation | Acteurs CLIENT_ADMIN/MEMBER (consulter logs) + ADMIN (superviser cluster, consulter alertes). |
| `diagrammes/sequence_logs.png` | Diagramme de séquence | Consultation de logs en temps réel : Utilisateur → Portail (connexion SSE) → Backend (PodLogService/PodLogStreamService cible le conteneur `user-container`) → LogSseService diffuse en continu → Portail affiche. Voir tableau 6.4 du Chapitre 6. |

---

## 6. Chapitre 7 — Release 3 (captures d'écran d'interface, pas des diagrammes UML)

À réaliser une fois le portail/console déployés et fonctionnels (captures d'écran réelles de l'application, pas des schémas) :

| Fichier | Contenu attendu |
|---|---|
| `captures/deploy_app_form.png` | Formulaire de déploiement d'une application sur le portail client (page `DeployApp.jsx`) : champs nom, image Docker, tag, port, ressources CPU/RAM, min/max replicas. |
| `captures/cluster_management.png` | Vue de supervision du cluster sur la console d'administration (page `ClusterManagement.jsx`) : nœuds, alertes actives, namespaces tenants. |
| `captures/kafka_topics.png` | Page de gestion des sujets Kafka sur le portail client (page `KafkaTopics.jsx`). |
| `captures/billing_view.png` | Page de facturation du compte client (page `Billing.jsx`). |

---

## Récapitulatif — à faire dans l'ordre

1. Créer les dossiers `memoire/diagrammes/` et `memoire/captures/`.
2. Obtenir/créer `memoire/logo.png` (logo NextStep IT).
3. Produire les **13 diagrammes UML** dans Creately, dans l'ordre des chapitres (Ch.2 → Ch.3 → Ch.5 → Ch.6), en s'appuyant sur les tableaux de description textuelle et les listes d'étapes déjà rédigés dans chaque chapitre — ils servent de script direct pour chaque diagramme.
4. Prendre les **4 captures d'écran** une fois le portail/console accessibles.
5. Compiler `Main.tex` et vérifier qu'aucune image ne manque (`\includegraphics` échouera sinon à la compilation).
