# Architecture physique de la plateforme — descriptif détaillé pour la création du diagramme

Ce document sert de script détaillé pour produire le diagramme `diagrammes/architecture_physique.png` référencé dans le mémoire (`\includegraphics[width=13.5cm]{diagrammes/architecture_physique.png}`, label `fig:archi-physique`, Chapitre 2 — section "Architecture globale"). C'est un **diagramme de déploiement UML** : contrairement à l'architecture logique (qui montre des couches logicielles), celui-ci montre **où** chaque composant tourne physiquement — sur quel nœud, dans quel namespace Kubernetes, relié par quel réseau.

---

## 1. Objectif du diagramme

Montrer le déploiement réel de la plateforme sur le cluster Kubernetes de NextStep IT : 3 nœuds physiques, l'isolation par espace de noms (un namespace `platform` + un namespace par tenant), le cluster Kafka Strimzi séparé, et les points d'entrée réseau externes (MetalLB, Kourier).

## 2. Éléments à représenter (nœuds UML `<<device>>` / `<<node>>`)

### 2.1 Les 3 nœuds physiques du cluster

| Nœud | Rôle | Détail |
|---|---|---|
| **vm01** | Control-plane | Composants de contrôle Kubernetes (API server, etcd, scheduler, controller-manager) |
| **vm02** | Worker | Exécute les pods applicatifs (backend, frontends, apps clientes, Kafka) |
| **vm03** | Worker | Exécute les pods applicatifs (backend, frontends, apps clientes, Kafka) |

> Note de transparence à faire figurer en légende : cette topologie (3 nœuds, CNI, MetalLB, Kourier) a été confirmée par des commandes `kubectl` exécutées sur le cluster réel, mais **n'est pas formalisée en infrastructure-as-code versionnée** dans le dépôt du projet — c'est une limite déjà documentée au Chapitre 8 (Validation).

Dessiner les 3 nœuds comme 3 rectangles `<<device>>` côte à côte, avec une accolade ou un cadre englobant "Cluster Kubernetes".

### 2.2 Couche réseau (à représenter en incrustation ou en périphérie du cluster)

| Composant | Rôle |
|---|---|
| **Cilium** (CNI) | Interface réseau de conteneurs ; applique les ressources `NetworkPolicy` (isolation entre namespaces tenants) |
| **MetalLB** | Attribue des adresses IP externes de type `LoadBalancer` (environnement on-premise, sans load balancer cloud natif) |
| **Kourier** | Passerelle d'entrée (ingress gateway) pour tout le trafic HTTP à destination des services Knative |

Représenter ces 3 éléments comme une fine couche horizontale entre "Internet / utilisateurs externes" et l'intérieur du cluster.

### 2.3 Le namespace `platform` (composants de la plateforme elle-même)

À dessiner comme un rectangle en pointillés (`<<namespace>>`) réparti sur vm02/vm03, contenant :

- Pod **backend-api** (Spring Boot)
- Pod **web-portal** (Nginx + React)
- Pod **admin-console** (Nginx + React)
- Pod **Keycloak**
- Pod/service **PostgreSQL**
- (optionnel selon place disponible) Prometheus, Alertmanager, Grafana

### 2.4 Les namespaces tenants (un par client, créés dynamiquement)

Représenter **au moins 2 exemplaires** (ex: `user-clientA`, `user-clientB`) pour bien montrer la réplication du modèle multi-tenant, chacun en rectangle pointillé séparé, contenant :

- Une `NetworkPolicy` (icône ou étiquette) isolant ce namespace des autres tenants
- 1 à N **Services Knative** (représentant les applications déployées par ce client), chacun pouvant avoir 0 à N pods actifs (illustrer un exemple à 0 replica "scale-to-zero" et un exemple à 1+ replicas "actif")
- Optionnellement, une ressource `ResourceQuota` si ce tenant a un quota explicitement configuré par l'admin (cf. `QuotaService.syncToCluster`)

### 2.5 Le cluster Kafka (Strimzi) — bloc séparé

À représenter comme un bloc distinct (pas dans un namespace tenant ni dans `platform`, mais dans son propre espace, ex: namespace `kafka`) :

- Courtiers Kafka (brokers) opérés par l'opérateur **Strimzi**
- Sujets (`KafkaTopic`) créés par les clients via l'AdminClient Kafka (backend)
- Connexion représentée vers les namespaces tenants via les ressources **KafkaSource** / **Broker** / **Trigger** de Knative Eventing (ces ressources vivent dans le namespace du tenant mais se connectent au cluster Kafka)

### 2.6 Acteurs / systèmes externes en périphérie du diagramme

| Externe | Connexion |
|---|---|
| **Client (navigateur)** | → MetalLB/Kourier → web-portal ou admin-console |
| **Pipeline CI/CD (Jenkins)** | → backend-api (via clé d'API `X-Api-Key`) ; Jenkins lui-même n'est pas nécessairement hébergé sur ce même cluster — à noter comme externe si c'est le cas dans la réalité du projet |
| **Docker Hub** | Registre d'images, tiré par Kaniko lors des builds et par Kubernetes lors du déploiement des pods (`imagePullPolicy`) |
| **Stripe** | Service de paiement externe, appelé par le backend-api (sortant) et envoyant des webhooks (entrant) |

---

## 3. Flux réseau principaux à illustrer par des flèches

1. **Client → MetalLB/Kourier → web-portal / admin-console** (HTTPS)
2. **web-portal / admin-console → backend-api** (HTTPS, JWT Keycloak) — toujours à l'intérieur du namespace `platform` ou en traversant le réseau interne du cluster
3. **backend-api → Kubernetes API server** (via Fabric8, sur vm01) — pour créer/lire les ressources dans les namespaces tenants
4. **backend-api → PostgreSQL** (JDBC, namespace `platform`)
5. **backend-api → Keycloak** (validation JWT, namespace `platform`)
6. **backend-api → cluster Kafka** (AdminClient, création de topics)
7. **KafkaSource (namespace tenant) → cluster Kafka** (consommation de messages)
8. **KafkaSource → Broker → Trigger → Service Knative** (à l'intérieur du même namespace tenant, flux événementiel)
9. **Pipeline CI/CD → backend-api** (clé d'API, hors du flux utilisateur normal)

---

## 4. Recommandations de représentation visuelle

- Utiliser la notation UML de diagramme de déploiement : rectangles 3D (`<<device>>`) pour les nœuds physiques, rectangles pointillés pour les namespaces (artefacts logiques de regroupement), petits rectangles pleins pour les pods/services.
- Couleur distincte pour le namespace `platform` (ex: bleu) versus les namespaces tenants (ex: vert, dupliqué pour montrer la réplication du modèle) versus le cluster Kafka (ex: orange).
- Ne pas dessiner tous les pods d'un tenant en détail — un seul exemple de tenant représenté en détail suffit, avec une note "(répété pour chaque tenant)" à côté d'un second tenant simplifié (juste une boîte "Namespace tenant 2..N").
- Format paysage recommandé (le diagramme sera inséré à 13,5 cm de large dans le mémoire) : `\includegraphics[width=13.5cm]{diagrammes/architecture_physique.png}`.
- Rester cohérent avec le diagramme d'architecture logique (`ARCHITECTURE_LOGIQUE_DESCRIPTIF.md`) : les mêmes composants (backend, frontends, Keycloak, PostgreSQL, Kafka) doivent apparaître dans les deux diagrammes, mais celui-ci montre leur **emplacement physique** plutôt que leurs **responsabilités logicielles**.

---

## 5. Fichiers sources vérifiés (traçabilité)

- `PROJECT_DOCUMENTATION.md` §1.6 et §5 — topologie du cluster (3 nœuds, Cilium, MetalLB, Kourier) et convention de namespaces
- `AUDIT_PRODUCTION_READINESS.md` §2 — confirmation de la topologie 3 nœuds (vm01 control-plane, vm02/vm03 workers), CNI Cilium, MetalLB, Kourier
- `backend-api/src/main/java/com/platform/api/app/KnativeService.java` — `ensureNamespaceExists`, `ensureNetworkPolicyExists` (création dynamique du namespace tenant)
- `backend-api/src/main/java/com/platform/api/quota/QuotaService.java` — `syncToCluster` (création d'un `ResourceQuota` réel dans le namespace du tenant)
- `k8s/backend/rbac.yaml`, `k8s/backend/deployment.yaml`, `k8s/frontend/deployment.yaml`, `k8s/admin/deployment.yaml` — déploiement des composants de la plateforme dans le namespace `platform`
- `backend-api/src/main/java/com/platform/api/kafka/KafkaService.java` — connexion au cluster Kafka via AdminClient natif (pas de CRD `KafkaTopic` Strimzi — voir correction déjà appliquée au Chapitre 4 du mémoire)
- `memoire/Chapter2.tex` (section "Architecture physique de la plateforme") — texte du mémoire que ce diagramme doit illustrer, à ne pas contredire
