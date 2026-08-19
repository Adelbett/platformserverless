# Architecture logique de la plateforme — descriptif détaillé pour la création du diagramme

Ce document sert de script détaillé pour produire le diagramme `diagrammes/architecture_logique.png` référencé dans le mémoire (Chapitre 2, section "Architecture globale" ; anciennement Chapitre 3). Il décrit précisément quoi dessiner, avec quels éléments, dans quel sens, et sur quelles preuves de code chaque élément s'appuie — afin que le diagramme produit dans Creately (ou tout autre outil) soit fidèle au projet réel et pas une supposition générique.

---

## 1. Objectif du diagramme

Montrer que la plateforme est structurée en **4 couches empilées verticalement**, avec un principe de conception central : **le backend Spring Boot est l'unique point d'entrée vers le cluster Kubernetes**. Aucune flèche ne doit relier directement la couche présentation (frontends) ou un acteur externe (pipeline CI/CD) à la couche infrastructure — tout passe par la couche service.

## 2. Vue d'ensemble — les 4 couches (de haut en bas)

```
┌─────────────────────────────────────────────────────────────┐
│  COUCHE PRÉSENTATION                                         │
│  Portail client (React)     Console d'administration (React) │
└───────────────────────────┬───────────────────────────────────┘
                             │ HTTPS / REST / SSE / JWT
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  COUCHE SERVICE                                               │
│  API REST Spring Boot (backend-api) — 21 packages métier      │
└───────────────────────────┬───────────────────────────────────┘
                             │ appels Java
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  COUCHE ORCHESTRATION                                          │
│  Client Kubernetes Java Fabric8                                │
└───────────────────────────┬───────────────────────────────────┘
                             │ API Kubernetes (HTTPS)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  COUCHE INFRASTRUCTURE                                         │
│  Cluster Kubernetes + opérateurs + briques transverses         │
└─────────────────────────────────────────────────────────────┘
```

Une flèche latérale doit aussi indiquer que le **Pipeline CI/CD externe** (via clé d'API) et le **cluster Kafka** entrent en jeu, mais toujours en passant par la couche service (jamais directement sur l'infrastructure).

---

## 3. Détail couche par couche

### 3.1 Couche présentation

Deux boîtes séparées, côte à côte :

| Élément | Détail | Preuve code |
|---|---|---|
| **Portail client** | Application React 18 + Vite, servie statiquement par Nginx. Pages : Dashboard, AppsList, DeployApp, AppDetails, KafkaTopics, Eventing, LogsView, Monitoring, Billing, Team, Settings, StatusPage, Login, Register | `web-portal/src/App.jsx`, `web-portal/src/pages/*` |
| **Console d'administration** | Application React 18 + Vite séparée, servie par Nginx. Pages : AdminDashboard, AdminClients, AdminUsers, AdminBilling, AdminAuditLog, ClusterManagement | `admin-console/src/App.jsx`, `admin-console/src/pages/admin/*` |

Les deux boîtes doivent être dessinées **séparément** (pas fusionnées) pour bien montrer qu'il s'agit de deux applications indépendantes, sans code partagé packagé (chacune a sa propre copie de `AuthContext`, `api/client.js`, etc. — dette technique déjà documentée).

Flèche descendante unique depuis chaque boîte vers la couche service, étiquetée `HTTPS / API REST / SSE (JWT Keycloak)`.

### 3.2 Couche service

Une seule grande boîte **"API REST Spring Boot (backend-api)"**, avec à l'intérieur les 21 packages métier réels, à représenter comme des sous-modules (pas besoin de tous les détailler visuellement si ça surcharge — grouper visuellement par bloc fonctionnel) :

| Bloc fonctionnel | Packages Java réels |
|---|---|
| Applications & déploiement | `app` (App, AppController, AppService, AppDeploymentAsyncRunner, KnativeService, KnativeWatcher, CrashLoopScheduler) |
| Sécurité & identité | `security` (KeycloakJwtAuthConverter, UserSyncFilter, ApiKeyFilter, SseTokenFilter), `user` (User, UserRole, Permission, PermissionService, UserContextService), `apikey` (ApiKeyService) |
| Messagerie | `kafka` (KafkaTopic, KafkaService), `eventing` (KafkaSource, Trigger, EventingService) |
| Facturation & paiement | `billing` (BillingSnapshot, AppInvoice, BillingService, BillingScheduler, InvoiceService), `payment` (PaymentTransaction, PaymentService) |
| Gouvernance | `quota` (TenantQuota, QuotaService), `admin` (AdminController), `audit` (AdminAuditLog) |
| Observabilité | `logs` (DeploymentLog, LogSseService, PodLogService), `metrics` (MetricsService), `status` (Incident, StatusController) |
| Support | `team`, `config`, `exception`, `repository`, `DockerImage` |

Flèche descendante unique vers la couche orchestration, étiquetée `appels Java (Fabric8 KubernetesClient)`.
Flèche entrante depuis un acteur externe **"Pipeline CI/CD (clé d'API)"** directement sur cette couche (pas sur la présentation), étiquetée `X-Api-Key`.
Flèche entrante/sortante avec **Keycloak** (validation JWT) et **PostgreSQL** (persistance JPA) et **Stripe** (paiement) — à représenter comme 3 petites boîtes externes connectées uniquement à cette couche, jamais aux couches du dessus ou du dessous.

### 3.3 Couche orchestration

Une seule boîte **"Fabric8 KubernetesClient"**. C'est la couche la plus fine (pas de sous-composants internes à détailler) : son rôle est uniquement de traduire les appels Java de la couche service en requêtes HTTP vers l'API Kubernetes, pour :
- les ressources natives Kubernetes (Namespace, NetworkPolicy, ResourceQuota, Pod, Deployment) ;
- les ressources personnalisées (CRD) génériques via `genericKubernetesResources(...)` : `Service`/`Revision` de Knative Serving, `Broker`/`Trigger`/`KafkaSource` de Knative Eventing, `KafkaTopic` de Strimzi.

Préciser dans une note à côté de cette boîte : *"Aucun client Java officiel n'existe pour Knative Serving/Eventing au moment du projet — utilisation systématique de l'API générique de ressources personnalisées de Fabric8."*

Flèche descendante vers la couche infrastructure, étiquetée `API Kubernetes (HTTPS, ServiceAccount RBAC)`.

### 3.4 Couche infrastructure

La boîte la plus large, contenant :

| Sous-bloc | Composants |
|---|---|
| **Orchestration** | Cluster Kubernetes (3 nœuds), CNI Cilium, MetalLB, passerelle Kourier |
| **Exécution serverless** | Knative Serving (Service, Revision, Route, Activator, Autoscaler) |
| **Événementiel** | Knative Eventing (Broker, Trigger) + Kafka opéré par Strimzi (KafkaTopic, courtiers) |
| **Briques transverses** | Keycloak (identité), PostgreSQL (persistance), Prometheus + Alertmanager + Grafana (supervision), Jenkins + Kaniko (CI/CD des composants de la plateforme elle-même) |

Représenter les espaces de noms comme un sous-découpage horizontal à l'intérieur de cette boîte : un namespace `platform` (backend, 2 frontends, Keycloak, PostgreSQL) et N namespaces tenants (un par client, isolés par `NetworkPolicy`), chacun hébergeant les `Service` Knative des applications de ce client.

---

## 4. Règle de conception à faire ressortir visuellement

Encadrer ou surligner cette phrase à côté du diagramme (ou en légende) :

> **Le backend Spring Boot est l'unique point d'entrée autorisé vers le cluster.** Ni les portails React, ni les clients externes (pipelines CI/CD) n'interagissent directement avec l'API Kubernetes — toute action passe par la couche service, qui applique les contrôles d'authentification, d'autorisation et d'isolation multi-tenant avant toute opération sur le cluster.

Concrètement dans le diagramme : il ne doit exister **aucune flèche** qui saute une couche (ex: pas de flèche directe Portail → Kubernetes, pas de flèche directe Pipeline CI/CD → Fabric8/Kubernetes sans passer par la couche service).

---

## 5. Recommandations de représentation visuelle

- 4 rectangles empilés verticalement, un par couche, avec un intitulé clair en haut de chaque rectangle.
- Couleur différente par couche (ex: bleu clair pour présentation, vert pour service, orange pour orchestration, gris pour infrastructure) pour une lecture immédiate.
- Flèches verticales épaisses entre les couches (flux principal), flèches plus fines et latérales pour les acteurs externes (Keycloak, Stripe, PostgreSQL, Pipeline CI/CD).
- Ne pas surcharger la couche service avec les 21 packages en détail si ça nuit à la lisibilité : les regrouper visuellement par les 7 blocs fonctionnels du tableau de la section 3.2, avec une liste de packages en petit texte à l'intérieur de chaque bloc.
- Largeur cible pour insertion dans le mémoire : la figure sera redimensionnée à 13,5 cm de large (voir `\includegraphics[width=13.5cm]{diagrammes/architecture_logique.png}` dans `Chapter2.tex`) — privilégier donc un format plutôt large que haut (paysage) pour rester lisible à cette taille.

---

## 6. Fichiers sources vérifiés (traçabilité)

- `web-portal/src/App.jsx`, `web-portal/src/pages/*` — pages du portail client
- `admin-console/src/App.jsx`, `admin-console/src/pages/admin/*` — pages de la console d'administration
- `backend-api/src/main/java/com/platform/api/` — 21 packages listés ci-dessus (structure vérifiée par exploration directe du dépôt)
- `backend-api/src/main/java/com/platform/api/app/KnativeService.java`, `eventing/EventingService.java`, `kafka/KafkaService.java` — usage de l'API générique Fabric8 (`genericKubernetesResources`)
- `k8s/backend/rbac.yaml` — ServiceAccount et permissions du backend sur le cluster
- `docs/GUIDE_TECHNIQUE_COMPLET.md`, `PROJECT_DOCUMENTATION.md` — architecture générale déjà documentée, recoupée avec le code
- `memoire/Chapter2.tex` (section "Architecture logique de la plateforme") — texte du mémoire que ce diagramme doit illustrer, à ne pas contredire
