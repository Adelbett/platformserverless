# Préparation Soutenance PFE — PlatformServerless
### Banque de questions/réponses — Adel Bettaieb, NextStep IT, 2025-2026

---

## Table des matières

1. [Questions faciles (Niveau 1)](#1-questions-faciles-niveau-1)
2. [Questions intermédiaires (Niveau 2)](#2-questions-intermédiaires-niveau-2)
3. [Questions techniques difficiles (Niveau 3)](#3-questions-techniques-difficiles-niveau-3)
4. [Questions pièges / déstabilisation](#4-questions-pièges--déstabilisation)
5. [Questions commerciales / business](#5-questions-commerciales--business)
6. [Questions sur l'entreprise et le contexte du PFE](#6-questions-sur-lentreprise-et-le-contexte-du-pfe)
7. [Questions par section de la soutenance](#7-questions-par-section-de-la-soutenance)
8. [Préparation slide par slide](#8-préparation-slide-par-slide)
9. [Fiche de révision avant soutenance](#9-fiche-de-révision-avant-soutenance)
10. [Les 20 questions "Pourquoi ?"](#10-les-20-questions-pourquoi)
11. [Tableaux de comparaison](#11-tableaux-de-comparaison)
12. [Scénarios techniques](#12-scénarios-techniques)
13. [Questions très difficiles (raisonnement)](#13-questions-très-difficiles-raisonnement)
14. [Statistiques finales](#14-statistiques-finales)

**Légende** : 🟢 facile · 🟡 intermédiaire · 🟠 avancé · 🔴 difficile · 🔥 piège · ⭐ à connaître absolument

**Note méthodologique** : chaque réponse technique de ce document a été vérifiée contre le code source réel du dépôt (`backend-api/`, `web-portal/`, `admin-console/`, `k8s/`, `ci-cd/`, `microservices/`) et contre le mémoire final compilé. Quand une divergence entre le mémoire et le code a été trouvée, elle est signalée explicitement (voir notamment les sections Sécurité, RBAC et CI/CD). Aucune fonctionnalité, métrique ou résultat non présent dans le projet n'a été inventé.

---

## 1. QUESTIONS FACILES (Niveau 1)

### ⭐ Q1.1 🟢 Quel est l'objectif de votre projet ?
**Réponse** : Développer une plateforme Cloud Native serverless multi-tenant pour NextStep IT, qui permet à plusieurs clients de déployer leurs applications conteneurisées sur un cluster Kubernetes partagé, sans avoir à gérer eux-mêmes la complexité de l'orchestration — avec mise à l'échelle automatique jusqu'à zéro, messagerie événementielle intégrée, et facturation à l'usage.

### Q1.2 🟢 Quel problème avez-vous voulu résoudre ?
**Réponse** : Cinq problèmes concrets chez NextStep IT : la configuration de déploiement trop complexe (plusieurs fichiers YAML à écrire à la main), la mise en place event-driven difficile (KafkaSource/Broker/Trigger à créer manuellement), l'absence de multi-tenancy, le gaspillage de ressources (apps qui tournent en permanence même sans trafic), et le manque de visibilité centralisée (logs et métriques dispersés).

### Q1.3 🟢 Pourquoi avez-vous choisi Kubernetes ?
**Réponse** : Parce qu'il automatise l'orchestration de conteneurs — placement, redémarrage, mise à l'échelle — et fournit nativement les briques dont j'avais besoin pour le multi-tenant : namespaces pour isoler les ressources, RBAC pour les droits d'accès, NetworkPolicy pour l'isolation réseau.

### Q1.4 🟢 C'est quoi Kubernetes ?
**Réponse** : Un orchestrateur de conteneurs open source qui automatise leur déploiement, leur mise à l'échelle et leur gestion sur un ensemble de machines (le cluster), en garantissant que l'état réel correspond à l'état désiré qu'on lui décrit.

### Q1.5 🟢 C'est quoi une architecture serverless ?
**Réponse** : Une architecture où l'infrastructure sous-jacente est masquée au développeur, et où l'application ne consomme des ressources que lorsqu'elle traite réellement une requête — elle peut descendre à zéro instance quand elle est inactive. Dans notre cas, c'est Knative Serving qui apporte ça au-dessus de Kubernetes.

### Q1.6 🟢 C'est quoi un conteneur ?
**Réponse** : Une unité d'exécution qui embarque une application et toutes ses dépendances, isolée du système hôte mais partageant son noyau — plus léger qu'une machine virtuelle, portable d'un environnement à l'autre.

### Q1.7 🟢 Pourquoi Docker ?
**Réponse** : Docker est le standard de facto pour construire et empaqueter les images de conteneurs. Toutes les applications de la plateforme — le backend, les deux portails, les applications des clients — sont packagées en images Docker, ce qui est directement compatible avec Knative Serving, qui déploie des images de conteneurs.

### Q1.8 🟢 Pourquoi Kafka ?
**Réponse** : Pour permettre aux applications des clients de communiquer de manière asynchrone, sans dépendance directe entre elles, avec des messages persistés et rejouables — utile notamment pour réveiller automatiquement une application mise à zéro instance à la réception d'un événement.

### Q1.9 🟢 Pourquoi Keycloak ?
**Réponse** : Pour centraliser l'authentification sans avoir à réimplémenter moi-même la gestion des mots de passe, des jetons et des rôles — un sujet trop sensible pour être fait maison. Keycloak fournit l'authentification OIDC/OAuth2 standard.

### Q1.10 🟢 Quel est le rôle de PostgreSQL ?
**Réponse** : C'est la base de données relationnelle qui stocke toutes les entités métier de la plateforme : utilisateurs, applications, sujets Kafka, factures, journaux de déploiement. Toutes ces données sont fortement liées entre elles, un modèle relationnel classique convient bien.

### Q1.11 🟢 Quel est le rôle de Prometheus ?
**Réponse** : Il scrute (scrape) en continu les métriques exposées par les applications — CPU, RAM, requêtes par seconde — et les stocke dans une base de séries temporelles, sur laquelle le backend interroge ensuite des requêtes ponctuelles pour afficher les valeurs dans le portail.

### Q1.12 🟢 Qu'est-ce que Knative ?
**Réponse** : Une extension de Kubernetes qui ajoute deux capacités : Knative Serving, pour exécuter des applications en mode serverless avec scale-to-zero, et Knative Eventing, pour router des événements entre des sources et des applications de façon découplée.

### Q1.13 🟢 Quelle est la différence entre frontend et backend ?
**Réponse** : Le frontend, ce sont les deux interfaces React (portail client et console d'administration) que l'utilisateur voit et manipule dans son navigateur. Le backend, c'est l'API Spring Boot qui centralise toute la logique métier et qui est le seul composant autorisé à parler à l'API Kubernetes.

### Q1.14 🟢 Quelle est la différence entre authentification et autorisation ?
**Réponse** : L'authentification répond à "qui es-tu ?" — c'est Keycloak qui vérifie l'identité et émet un jeton JWT. L'autorisation répond à "as-tu le droit de faire ça ?" — c'est le backend qui vérifie, à chaque requête, le rôle et les permissions de l'utilisateur avant d'exécuter l'action.

---

## 2. QUESTIONS INTERMÉDIAIRES (Niveau 2)

### ⭐ Q2.1 🟡 Pourquoi Kubernetes et pas Docker seul ?
**Réponse** : Docker seul sait construire et exécuter un conteneur, mais ne sait ni le redémarrer automatiquement s'il plante, ni le répliquer selon la charge, ni isoler plusieurs clients entre eux sur la même infrastructure. Kubernetes ajoute exactement ces trois capacités, indispensables pour une plateforme multi-tenant.

### Q2.2 🟡 Pourquoi Knative au-dessus de Kubernetes ?
**Réponse** : Un `Deployment` Kubernetes classique fait tourner ses pods en permanence, même sans trafic — c'est un gaspillage de ressources et un coût pour le client. Knative Serving ajoute l'autoscaling avec scale-to-zero natif : sans lui, il aurait fallu écrire et maintenir un autoscaler personnalisé.

### Q2.3 🟡 Pourquoi Knative Serving ?
**Réponse** : C'est le composant qui permet à une application cliente de tourner uniquement quand elle reçoit du trafic, avec des révisions immuables et un routage par nom d'hôte — c'est le cœur de la promesse "serverless" de la plateforme.

### Q2.4 🟡 Pourquoi Knative Eventing ?
**Réponse** : Pour relier les messages Kafka aux applications Knative sans coupler les deux : le producteur ne connaît jamais le consommateur, et une application scale-to-zero peut être réveillée automatiquement par un événement, pas seulement par une requête HTTP.

### Q2.5 🟡 Pourquoi Kafka avec Knative plutôt que du REST direct entre applications ?
**Réponse** : Parce qu'avec du REST direct, une application appelante devrait connaître l'URL de l'application appelée et attendre qu'elle réponde — impossible si l'application cible est à zéro instance. Avec Kafka + Knative Eventing, le producteur écrit sur un topic sans savoir qui consomme, et le Broker/Trigger se charge de router et réveiller la bonne application.

### Q2.6 🟡 Quel est le rôle de Strimzi ?
**Réponse** : Strimzi est l'opérateur Kubernetes qui déploie et administre le cluster Kafka de façon déclarative — il gère le cycle de vie du broker. Strimzi n'est pas le broker lui-même, c'est ce qui l'exploite.

### Q2.7 🟡 Pourquoi utiliser Fabric8 ?
**Réponse** : C'est le client Java qui permet au backend Spring Boot de parler à l'API Kubernetes — créer des ressources, lire leur statut, ouvrir des connexions `watch`. Sans lui, il faudrait implémenter soi-même les appels HTTP bruts vers `kube-apiserver` et gérer l'authentification manuellement.

### Q2.8 🟡 Pourquoi utiliser Kafka AdminClient en plus de Fabric8 ?
**Réponse** : Parce que Fabric8 parle à l'API Kubernetes, pas au protocole Kafka natif. La gestion des topics (création, suppression, métriques de lag) passe par le Kafka AdminClient officiel, qui communique directement avec le broker via son propre protocole — deux bibliothèques, deux responsabilités bien séparées, dans le même processus backend.

### ⭐ Q2.9 🟡 Quelle est la différence entre Fabric8 et Kafka AdminClient ?
**Réponse** : Fabric8 crée/lit des ressources Kubernetes et Knative (Service, Broker, Trigger, KafkaSource — ce sont des objets Kubernetes). Le Kafka AdminClient crée/supprime des topics Kafka eux-mêmes, en parlant directement au broker, sans jamais passer par Kubernetes. Ce sont deux clients distincts, aucun des deux n'est un service à part — les deux tournent dans le processus du backend.

### Q2.10 🟡 Comment une application est-elle déployée ?
**Réponse** : L'utilisateur remplit un formulaire (nom, image Docker, port, ressources). Le backend enregistre l'app en base avec le statut DEPLOYING et répond immédiatement — sans attendre Kubernetes. En tâche de fond, il construit un manifeste Knative Service via Fabric8, l'envoie à l'API Kubernetes, puis interroge le statut jusqu'à obtenir l'URL publique.

### Q2.11 🟡 Comment fonctionne le workflow de déploiement dans le détail ?
**Réponse** : `AppController.createApp()` vérifie la permission, `AppService.createApp()` résout le tenant et persiste l'app, puis délègue à `AppDeploymentAsyncRunner.triggerDeploy()` (asynchrone) qui appelle `KnativeService.deploy()` : création du namespace si besoin, construction du manifeste Knative Service, envoi à l'API Kubernetes, puis attente active (polling, 20 tentatives de 3 secondes) de l'URL publique.

### Q2.12 🟡 Comment une image Docker arrive-t-elle dans Kubernetes ?
**Réponse** : Pour les apps clientes, l'utilisateur fournit directement une référence d'image (Docker Hub ou registre privé) dans le formulaire de déploiement — le backend ne construit pas l'image, il la référence dans le manifeste Knative Service, et c'est Kubernetes qui va la tirer (pull) depuis le registre au démarrage du pod.

### Q2.13 🟡 Comment fonctionne Jenkins dans votre projet ?
**Réponse** : Jenkins orchestre 4 pipelines déclaratifs (backend, portail client, console admin, microservices de démo), déclenchés manuellement ou sur push. Chaque pipeline clone le dépôt, construit l'application (Maven ou npm), construit une image Docker, la pousse sur Docker Hub, puis déploie sur Kubernetes via `kubectl set image` et vérifie le rollout.

### ⭐ Q2.14 🟡 Pourquoi Kaniko ?
**Réponse** : Parce que Kaniko construit une image de conteneur depuis l'intérieur d'un pod, sans avoir besoin d'un démon Docker ni de privilèges root — c'est indispensable puisque Jenkins lui-même tourne dans un pod Kubernetes. Un `docker build` classique exigerait un accès privilégié au socket Docker de l'hôte, une faille de sécurité dans ce contexte.

### Q2.15 🟡 Pourquoi ne pas utiliser Docker-in-Docker ?
**Réponse** : Docker-in-Docker exige de donner au conteneur Jenkins un accès privilégié (`--privileged`) pour lancer un démon Docker à l'intérieur — c'est une surface d'attaque connue et déconseillée dans un cluster Kubernetes partagé. Kaniko élimine ce besoin en construisant l'image sans démon du tout.

### ⭐ Q2.16 🟡 Comment fonctionne le scale-to-zero ?
**Réponse** : Chaque Knative Service porte des annotations `autoscaling.knative.dev/minScale` et `maxScale`. Si `minScale=0`, l'Autoscaler (KPA) coupe le dernier pod après une période sans trafic. Le composant Activator reste alors en écoute : à la requête suivante, il l'intercepte, déclenche la création d'un nouveau pod, et la transmet dès qu'il est prêt.

### Q2.17 🟡 Comment une requête arrive-t-elle jusqu'à l'application ?
**Réponse** : Client → MetalLB attribue l'IP externe au Service Kourier → Kourier route selon le nom d'hôte vers le bon Knative Service → l'Activator réveille un pod si nécessaire → la requête est traitée.

### Q2.18 🟡 Quel est le rôle de MetalLB ?
**Réponse** : Sur un cluster on-premise, il n'y a pas de LoadBalancer fourni par un cloud public. MetalLB comble ce manque en attribuant, depuis l'intérieur du cluster, une adresse IP externe à un Service Kubernetes de type LoadBalancer, prise dans une plage réservée du réseau local.

### ⭐ Q2.19 🟡 Quel est le rôle de Kourier ?
**Réponse** : C'est la passerelle d'entrée (ingress gateway) de Knative Serving. Il reçoit le trafic HTTP entrant sur l'IP attribuée par MetalLB, et le route vers le bon Knative Service selon le nom d'hôte de la requête. **Point important : Kourier ne route que le trafic Knative Serving — pas le backend ni les portails, qui sont exposés directement en LoadBalancer.**

### Q2.20 🟡 Quel est le rôle de Cilium ?
**Réponse** : C'est le CNI (Container Network Interface) du cluster — il gère la connectivité réseau entre les pods et applique concrètement les NetworkPolicy, notamment celle qui isole chaque namespace tenant des autres.

### Q2.21 🟡 Comment les tenants sont-ils isolés ?
**Réponse** : Trois mécanismes complémentaires, pas un seul : un namespace Kubernetes dédié par client, une NetworkPolicy "default-deny" générée automatiquement à la création du namespace et appliquée par Cilium, et une isolation applicative — chaque requête est scopée par l'`effectiveUserId` réel de l'utilisateur via `UserContextService`.

### ⭐ Q2.22 🟡 Comment fonctionne le JWT dans votre projet ?
**Réponse** : Le frontend obtient le jeton directement de Keycloak au login (pas via le backend). Chaque requête l'envoie en en-tête `Authorization: Bearer`. Côté backend, Spring Security valide la signature/expiration via `NimbusJwtDecoder` (JWKS de Keycloak, auto-configuré), puis `KeycloakJwtAuthConverter` extrait `realm_access.roles` du jeton pour construire les autorités Spring Security.

### Q2.23 🟡 Comment Keycloak intervient-il concrètement ?
**Réponse** : Il authentifie l'utilisateur (login/mot de passe), émet le jeton JWT signé avec les rôles dans `realm_access.roles`, et gère le rafraîchissement de session. Le backend ne stocke ni ne vérifie jamais de mot de passe — il valide uniquement des jetons déjà émis par Keycloak.

### Q2.24 🟡 Comment les rôles sont-ils vérifiés ?
**Réponse** : Via `@PreAuthorize("hasRole('ADMIN')")` — Spring lit directement les autorités déjà extraites du JWT par le converter, sans requête base de données.

### Q2.25 🟡 Comment les permissions sont-elles vérifiées ?
**Réponse** : Via `@PreAuthorize("@permissionService.has(authentication.name, 'PERM')")` — ici, `PermissionService` va chercher l'utilisateur en base PostgreSQL : un ADMIN ou CLIENT_ADMIN est toujours autorisé, un MEMBER doit avoir la permission explicitement accordée dans son `Set<String> permissions`.

### Q2.26 🟡 Comment fonctionne le monitoring ?
**Réponse** : Les applications exposent leurs métriques sur `/actuator/prometheus`. Prometheus les scrute toutes les 15 secondes. Le portail interroge le backend toutes les 30 secondes, qui interroge Prometheus via PromQL à cet instant précis — une requête ponctuelle, pas un flux continu.

### Q2.27 🟡 Comment fonctionnent les logs en temps réel ?
**Réponse** : Via Server-Sent Events (SSE), pas de polling. Chaque événement de déploiement est sauvegardé en base et immédiatement poussé sur un flux SSE (`/api/logs/stream`) que le portail écoute en continu.

### ⭐ Q2.28 🟡 Comment fonctionne le SSE dans votre projet ?
**Réponse** : Le backend utilise `LogSseService`/`SseEmitter` de Spring pour maintenir une connexion HTTP ouverte de type `text/event-stream`. Dès qu'un log est créé, il est poussé sur cette connexion. Côté frontend, la bibliothèque `fetch-event-source` est utilisée plutôt que l'API native `EventSource`, pour pouvoir envoyer le jeton JWT en en-tête `Authorization` plutôt qu'en paramètre d'URL — évite qu'il fuite dans les logs d'accès.

### Q2.29 🟡 Comment fonctionne le billing ?
**Réponse** : Un scheduler (`BillingScheduler`) prend un instantané horaire de chaque app (CPU, RAM, statut, nombre de réplicas), calcule un coût selon un tarif au CPU-heure et au Go-heure, avec un facteur d'usage selon le statut (100% si RUNNING, 20% si scale-to-zero, 0% si FAILED). Une facture est générée automatiquement le 1er de chaque mois.

### Q2.30 🟡 Comment fonctionne le webhook Stripe ?
**Réponse** : C'est un endpoint public (`POST /api/payment/webhook`), volontairement exclu de l'authentification JWT puisqu'il est appelé par Stripe et non par un utilisateur. Sa sécurité repose sur la vérification de la signature cryptographique de la requête (`Webhook.constructEvent(payload, sigHeader, webhookSecret)`) — si la signature ne correspond pas, la requête est rejetée.

---

## 3. QUESTIONS TECHNIQUES DIFFICILES (Niveau 3)

### Kubernetes

**Q3.1** 🔴 Que se passe-t-il exactement lorsqu'un Deployment Kubernetes classique est créé ? *(pour situer pourquoi le backend, lui, est justement un Deployment et pas un Knative Service)*
**Réponse** : Le controller-manager voit la nouvelle ressource, crée un ReplicaSet, qui à son tour crée les Pods demandés. Le scheduler assigne chaque pod à un nœud selon les ressources disponibles. C'est un mécanisme purement déclaratif et permanent — contrairement à Knative, il n'y a pas de mise à l'échelle automatique basée sur le trafic, seulement sur le nombre de réplicas fixé.

**Q3.2** 🟠 Quelle est la différence entre Pod, Deployment et Service ?
**Réponse** : Le Pod est l'unité d'exécution (un ou plusieurs conteneurs). Le Deployment gère le cycle de vie d'un ensemble de pods identiques (redémarrage, mise à l'échelle, mise à jour). Le Service est une abstraction réseau stable qui route le trafic vers les pods correspondants, même quand ils changent d'IP.

**Q3.3** ⭐ 🟠 Pourquoi un Namespace par tenant ?
**Réponse** : Le namespace est la frontière naturelle de Kubernetes pour regrouper et isoler des ressources : c'est le périmètre sur lequel s'appliquent les NetworkPolicy, les ResourceQuota, et sur lequel le nom des ressources peut se répéter sans collision entre deux clients (chaque tenant peut avoir une app "api", par exemple).

**Q3.4** 🔴 Que se passe-t-il lorsqu'un Pod tombe ?
**Réponse** : Le kubelet détecte l'échec, le ReplicaSet (ou le contrôleur Knative Revision) constate que le nombre de pods réels est inférieur au nombre désiré, et en recrée un nouveau. Dans notre cas, `KnativeWatcher` détecte aussi le changement via son `watch()` et met à jour le statut en base — potentiellement `FAILED` si la condition `Ready` passe à `False` sans motif de scale-to-zero.

**Q3.5** 🟠 Quelle est la différence entre ClusterIP, NodePort et LoadBalancer ?
**Réponse** : ClusterIP n'est joignable qu'à l'intérieur du cluster. NodePort ouvre un port fixe sur chaque nœud (utilisé par la console admin, port 30081, volontairement pas exposée en LoadBalancer). LoadBalancer demande une IP externe dédiée — c'est ce que MetalLB fournit ici, utilisé par le backend et le portail client.

**Q3.6** ⭐ 🔴 Pourquoi MetalLB est-il nécessaire dans votre environnement précisément ?
**Réponse** : Parce que le cluster tourne sur des VM bare-metal (Ubuntu), pas chez un cloud provider. Sans MetalLB, un Service de type LoadBalancer resterait indéfiniment à l'état `pending` — aucune IP externe ne serait jamais attribuée.

**Q3.7** 🔴 Où intervient le DNS dans votre architecture ?
**Réponse** : Les URLs des applications tenants utilisent `sslip.io`, un service qui résout n'importe quel sous-domaine contenant une IP vers cette IP littérale — pas de configuration DNS à gérer manuellement pour chaque nouvelle app. L'IP encodée est celle de Kourier (partagée par toutes les apps), et c'est le nom d'hôte complet qui permet à Kourier de router vers la bonne Revision.

### Cilium / réseau

**Q3.8** ⭐ 🔴 Pourquoi Cilium plutôt que Flannel ou Calico ?
**Réponse** : Flannel ne supporte pas nativement les NetworkPolicy. Calico les supporte de façon comparable à Cilium, mais Cilium a été retenu pour son architecture eBPF, plus performante que les règles iptables traditionnelles, et pour son potentiel d'observabilité réseau avancée à terme.

**Q3.9** 🔴 Qu'est-ce qu'eBPF ?
**Réponse** : Une technologie qui permet d'exécuter du code directement dans le noyau Linux, de façon sécurisée et sans modifier le noyau lui-même. Cilium l'utilise pour appliquer les règles réseau au plus près du paquet, plus vite que les longues chaînes de règles iptables traditionnelles.

**Q3.10** 🔴 Que se passe-t-il si une application d'un tenant essaie d'accéder à un autre namespace ?
**Réponse** : La NetworkPolicy "default-deny", générée automatiquement pour chaque namespace tenant et appliquée par Cilium, bloque le trafic au niveau réseau avant même qu'il n'atteigne l'autre namespace — la connexion échoue silencieusement, comme si la cible n'existait pas.

### Knative

**Q3.11** ⭐ 🔴 Quel est le rôle exact de l'Activator ?
**Réponse** : C'est le composant qui s'intercale devant un Knative Service quand il est à zéro pod. Il intercepte la requête entrante, met en attente la connexion, déclenche la création d'un pod via l'Autoscaler, et transmet la requête dès que le pod est prêt — c'est ce qui rend le cold start transparent pour le client.

**Q3.12** 🔴 Quelle différence entre un Service Knative et un Service Kubernetes ?
**Réponse** : Un Service Kubernetes est une simple abstraction réseau (une IP stable + du load balancing entre pods). Un Knative Service est une ressource de plus haut niveau qui orchestre Configuration → Revision → Route, avec autoscaling et scale-to-zero intégrés — un Service Kubernetes seul n'a aucune de ces capacités.

**Q3.13** 🔴 Que se passe-t-il lors d'une montée en charge sur une app tenant ?
**Réponse** : L'Autoscaler (KPA) observe la charge (concurrence par pod, configurée via `containerConcurrency`), et crée de nouveaux pods jusqu'à `maxScale`, dans les bornes définies par le client au déploiement.

### Kafka / Strimzi

**Q3.14** 🟠 Qu'est-ce qu'un topic, une partition, un consumer group ?
**Réponse** : Un topic est un flux nommé de messages. Il est divisé en partitions pour permettre le parallélisme et la scalabilité — chaque topic créé dans le projet a par défaut 3 partitions (configurable). Un consumer group est un ensemble de consommateurs qui se partagent la lecture des partitions d'un topic, chacun ne voyant chaque message qu'une fois par groupe.

**Q3.15** ⭐ 🔴 Pourquoi ne pas créer les topics uniquement avec les CRD Strimzi (`KafkaTopic`) plutôt que le Kafka AdminClient ?
**Réponse** : Les deux sont possibles en théorie. Le projet utilise directement l'AdminClient Kafka pour créer/gérer les topics, parce que c'est une opération synchrone et immédiate côté API REST du backend (`POST /api/kafka/topics` retourne directement le résultat), alors que passer par une CRD Strimzi impliquerait d'attendre que l'opérateur la réconcilie de façon asynchrone — plus de latence pour une simple création de topic déclenchée depuis l'interface.

**Q3.16** ⭐ 🔴 Comment un événement Kafka arrive-t-il jusqu'au service Knative ?
**Réponse** : Une app productrice écrit sur le topic Kafka. Le `KafkaSource` (créé via Fabric8) consomme ce topic via son `consumerGroup`, convertit chaque message en CloudEvent, et l'envoie en HTTP POST au `Broker` du tenant. Le `Trigger` évalue son filtre optionnel sur le type d'événement ; si ça correspond (ou s'il n'y a pas de filtre), il transmet l'événement en HTTP POST à l'URL de l'application cible.

**Q3.17** 🔴 Pourquoi le Broker s'appelle-t-il toujours "default" ?
**Réponse** : C'est une convention : chaque tenant a son propre Broker nommé "default" mais **dans son propre namespace** — ce n'est donc pas un objet global partagé entre tous les clients, malgré le nom identique. Le nom "default" suit simplement la convention Knative pour le broker principal d'un namespace.

**Q3.18** 🔴 Que se passe-t-il si Kafka est indisponible ?
**Réponse** : Les producteurs (comme le microservice de démo `order-service`) échouent leur envoi et le signalent (503 dans le health check applicatif). Côté plateforme, le `KafkaSource` ne peut plus consommer le topic, donc plus aucun événement n'est transformé en CloudEvent tant que Kafka n'est pas rétabli — les messages déjà écrits restent cependant dans les partitions et seront consommés au retour du service (Kafka persiste les messages).

**Q3.19** 🔥 Que se passe-t-il si un événement Kafka ne correspond à aucun Trigger ?
**Réponse** : Le Broker le reçoit mais ne le transmet à personne — l'événement est simplement "perdu" du point de vue applicatif (aucune application ne le traite), sans erreur remontée au producteur, puisque le découplage total signifie que le producteur ignore de toute façon qui consomme.

### Sécurité

**Q3.20** ⭐ 🔴 Que contient exactement le JWT ?
**Réponse** : Un payload JSON encodé (pas chiffré) contenant notamment `preferred_username`, `realm_access.roles` (les rôles Keycloak), l'émetteur (`iss`), l'expiration (`exp`). Le tout est signé par la clé privée de Keycloak — n'importe qui peut le lire, mais personne ne peut le falsifier sans cette clé.

**Q3.21** ⭐ 🔴 Que se passe-t-il si un utilisateur modifie son rôle directement dans le payload du JWT ?
**Réponse** : Rien de valide ne se passe — la signature ne correspondrait plus à un contenu modifié. `NimbusJwtDecoder` vérifie la signature à chaque requête avec la clé publique de Keycloak ; un payload altéré est immédiatement rejeté avec un 401, avant même d'atteindre `KeycloakJwtAuthConverter`.

**Q3.22** 🔴 Comment un MEMBER est-il associé à son CLIENT_ADMIN ?
**Réponse** : Via le champ `ownerId` de l'entité `User` en base. `UserContextService.resolve(username)` vérifie si `ownerId` est renseigné : si oui, il retourne le contexte (id + namespace) du propriétaire, pas celui du MEMBER — c'est ce qui garantit qu'un MEMBER agit toujours sur les ressources de son équipe.

**Q3.23** 🔥 Comment empêcher un MEMBER d'accéder aux ressources d'un autre tenant, même en manipulant un ID dans l'URL ?
**Réponse** : Chaque requête aux ressources (apps, factures, topics) est filtrée par l'`effectiveUserId` résolu côté serveur via `UserContextService`, jamais par un ID envoyé par le client. Même si un MEMBER modifie l'ID dans l'URL d'une requête, la requête base de données reste scopée à son propre `effectiveUserId` — il ne peut objectivement pas récupérer une ligne appartenant à un autre tenant.

**Q3.24** ⭐🔥 Quels sont les risques de sécurité connus de votre solution ?
**Réponse honnête** : Le `ServiceAccount` utilisé par le backend est le `default` du namespace `platform` — aucun `ServiceAccount` dédié n'a été créé, ce qui est documenté comme une limite connue dans le fichier RBAC lui-même. De plus, les `ClusterRoleBinding` accordent des droits à l'échelle du cluster (pas seulement aux namespaces tenants) plus larges que ce que le code semble réellement utiliser — un point de durcissement identifié mais pas encore réduit.

**Q3.25** 🔴 Quelle amélioration de sécurité proposeriez-vous ?
**Réponse** : Créer un `ServiceAccount` dédié et nommé pour le backend (plutôt que le `default` du namespace), réduire le périmètre des `ClusterRoleBinding` à ce qui est strictement nécessaire (idéalement des `Role`/`RoleBinding` par namespace plutôt que cluster-wide quand c'est possible), et ajouter un scanner de vulnérabilités dans le pipeline CI/CD — actuellement non réalisé, identifié comme perspective au Sprint 11.

### CI/CD

**Q3.26** 🔴 Comment gérez-vous les secrets dans les pipelines ?
**Réponse** : Via le magasin de credentials Jenkins (`github-credentials`, `dockerhub-credentials`) — jamais en clair dans le Jenkinsfile. Ils sont injectés dynamiquement au moment de l'exécution via `withCredentials`.

**Q3.27** 🔥 Comment gérez-vous un rollback en cas de problème après déploiement ?
**Réponse honnête** : Pour les applications tenants (Knative), il existe un vrai mécanisme applicatif : l'historique des Revisions permet un rollback via `POST /api/apps/{id}/rollback/{revisionName}`. **Pour le pipeline CI/CD de la plateforme elle-même (backend, portails), il n'y a pas de mécanisme de rollback automatisé** — `kubectl rollout status` vérifie que le déploiement aboutit, et en cas d'échec on redéploierait manuellement une image taguée antérieure (les images sont bien versionnées avec `v${BUILD_NUMBER}`, ce qui rend un rollback manuel possible mais pas automatique).

**Q3.28** 🔥 Que se passe-t-il si le build Jenkins échoue ?
**Réponse** : Le pipeline s'arrête à l'étape en échec (`kubectl rollout status` échoue explicitement le build si le déploiement ne devient pas disponible), un message d'échec est affiché (`post { failure { echo "❌ Pipeline échoué" } }`). L'option `retry(2)` relance le pipeline entier une fois en cas d'échec transitoire (utile pour la corruption de `/tmp` par Kaniko identifiée lors du Sprint 4).

### Backend

**Q3.29** 🟠 Pourquoi séparer Entity, DTO, Service et Controller ?
**Réponse** : Séparation des responsabilités classique : l'Entity représente la structure en base (JPA), le DTO ce qui transite réellement sur l'API (évite d'exposer des champs internes ou de créer des boucles de sérialisation), le Service porte la logique métier, le Controller ne fait que router les requêtes HTTP et déléguer.

**Q3.30** ⭐ 🔴 Comment synchronisez-vous l'état Kubernetes avec la base de données ?
**Réponse** : Deux mécanismes complémentaires. D'abord un chemin synchrone : au déploiement, `KnativeService.deploy()` interroge (poll) le statut jusqu'à obtenir l'URL, et écrit directement le résultat en base à ce moment précis. Ensuite un chemin permanent et indépendant : `KnativeWatcher` maintient une connexion `watch()` ouverte en continu sur toutes les ressources Knative Service du cluster, et corrige le statut en base à chaque changement détecté — même longtemps après le déploiement initial (scale-to-zero, crash).

**Q3.31** 🔴 Quel est le rôle de `KnativeWatcher` précisément, et pourquoi une classe séparée de `AppDeploymentAsyncRunner` ?
**Réponse** : `AppDeploymentAsyncRunner` gère un déploiement ponctuel et s'arrête après 60 secondes maximum. `KnativeWatcher` tourne en permanence pour toutes les apps de tous les tenants, dès le démarrage du backend (`@PostConstruct`), avec reconnexion automatique en cas de coupure. Ce sont deux responsabilités temporelles différentes : l'une réagit à une action utilisateur précise, l'autre observe l'état réel du cluster indépendamment de toute action.

**Q3.32** 🔥 Pourquoi le backend est-il un Deployment Kubernetes classique et pas un Knative Service ?
**Réponse** : Parce qu'il doit rester disponible en permanence pour piloter le reste de la plateforme (recevoir les requêtes API, maintenir la connexion `watch` de `KnativeWatcher`) — il ne se prête pas à une mise à l'échelle à zéro, contrairement aux applications tenants qui sont, elles, volontairement intermittentes.

### Logs / monitoring

**Q3.33** ⭐ 🔴 Pourquoi SSE et pas du polling pour les logs ?
**Réponse** : Le polling obligerait le frontend à interroger le backend toutes les X secondes, avec une latence perceptible et une charge inutile si rien n'a changé. Le SSE permet au backend de pousser l'information dès qu'elle existe, sans attente — la latence de perception d'un nouveau log est quasi nulle.

**Q3.34** 🔴 Pourquoi ne pas avoir utilisé WebSocket plutôt que SSE ?
**Réponse honnête** : Le besoin est unidirectionnel (serveur → client uniquement, jamais l'inverse) pour tous les flux temps réel du projet — logs, métriques, notifications. SSE est plus simple à mettre en œuvre pour ce cas (HTTP standard, reconnexion automatique native du navigateur), sans le coût du handshake bidirectionnel de WebSocket. **Point à assumer si le jury pousse dessus** : il existe un `WebSocketConfig.java` dans le code, avec un handler `/ws/logs/*` — c'est un reste d'exploration technique jamais terminé (le handler est un placeholder vide, non câblé au frontend), pas une fonctionnalité livrée.

**Q3.35** 🔴 Pourquoi interroger Prometheus depuis le backend plutôt que directement depuis le frontend ?
**Réponse** : Pour ne jamais exposer Prometheus directement à Internet, et pour appliquer la même couche d'autorisation (rôle/permission/propriété) sur les métriques que sur le reste de l'API — cohérent avec le principe "seul le backend parle à l'infrastructure".

### Billing

**Q3.36** ⭐ 🔴 Comment calculez-vous le coût exact d'une application ?
**Réponse** : `hourlyRate = (vCPU × 0.048 $/vCPU-heure + Go RAM × 0.006 $/Go-heure) × nombre de réplicas (au moins 1) × facteur d'usage`. Le facteur d'usage vaut 1.0 si l'app est `RUNNING`, 0.0 si `FAILED`, et 0.2 pour les autres états (notamment scale-to-zero).

**Q3.37** ⭐🔥 Pourquoi facturer 20% même quand l'application est à zéro instance (scale-to-zero) ?
**Réponse honnête** : C'est un choix de modélisation économique délibéré dans le code (`uptimeFactor`, cas par défaut à 0.2) : même sans pod actif, l'application occupe une réservation logique sur la plateforme (namespace, configuration Knative, monitoring). C'est un tarif réduit de "veille", pas un tarif plein — mais ce n'est effectivement pas gratuit. **Si le jury demande "pourquoi pas 0% ?"** : la réponse honnête est que c'est un choix de modèle économique assumé plutôt qu'un résultat mesuré scientifiquement — un axe clairement discutable et améliorable.

**Q3.38** 🔴 Comment évitez-vous de facturer deux fois la même heure ?
**Réponse** : `takeSnapshot()` vérifie `existsByAppIdAndSnapshotTime(appId, hour)` avant d'insérer un nouveau snapshot — si un instantané existe déjà pour cette heure précise et cette app, il est ignoré.

**Q3.39** 🔴 Que se passe-t-il pour la facturation quand une application est supprimée ?
**Réponse** : `takeSnapshot()` exclut explicitement les apps au statut `DELETED` — puisque `KnativeService.delete()` a déjà détruit la ressource Knative, aucune nouvelle consommation n'est possible. Les snapshots déjà pris avant la suppression restent en base, donc l'historique de facturation antérieur est préservé.

**Q3.40** 🔥 Comment sécurisez-vous le webhook Stripe précisément ?
**Réponse** : `Webhook.constructEvent(payload, sigHeader, webhookSecret)` du SDK officiel Stripe recalcule une signature HMAC à partir du corps brut de la requête et du secret partagé, et la compare à l'en-tête `Stripe-Signature`. En cas de non-correspondance (`SignatureVerificationException`), la requête est rejetée avec une erreur — aucun traitement métier n'a lieu.

---

## 4. QUESTIONS PIÈGES / DÉSTABILISATION

### 🔥⭐ Q4.1 — Pourquoi avez-vous choisi cette architecture et pas une autre ?
**Réponse** : Elle répond directement à la problématique : héberger sur l'infrastructure propre de NextStep IT (pas de vendor lock-in comme Cloud Run), tout en offrant scale-to-zero, event-driven et facturation à l'usage — aucune des solutions étudiées (Heroku, Cloud Run, OpenShift) ne réunissait ces deux exigences (hébergement privé + facturation à l'usage intégrée) simultanément.
**Ce que le jury vérifie** : que le choix n'est pas arbitraire mais découle de l'étude de l'existant.
**Points à mentionner** : le tableau comparatif du mémoire, le "vide" identifié entre briques open source non finies (Knative/Strimzi seuls) et plateformes commerciales fermées.
**Erreur à éviter** : répondre "parce que c'est la technologie à la mode" — toujours relier au besoin métier concret.

### 🔥 Q4.2 — Pourquoi utiliser Kubernetes si vous n'avez que quelques applications de démo ?
**Réponse** : Le projet est une preuve de concept d'une plateforme destinée à héberger un nombre croissant de clients — la complexité de Kubernetes est justifiée par le besoin d'isolation multi-tenant et de scalabilité horizontale, pas par le volume actuel de démonstration. Le cluster (3 nœuds) reste volontairement modeste car c'est un environnement de PFE, pas une preuve de charge en production.
**Ce que le jury vérifie** : la capacité à distinguer "taille de la démo" et "taille cible de la solution".
**Erreur à éviter** : prétendre que le cluster actuel supporte déjà une charge de production réelle — ce n'est pas le cas et ce n'est pas ce qui est mesuré ici.

### 🔥⭐ Q4.3 — Votre plateforme est-elle réellement serverless ?
**Réponse honnête** : Partiellement, et c'est assumé. **Les applications des tenants** le sont réellement (Knative Serving, scale-to-zero effectif). **Le backend, lui, ne l'est pas** — il tourne en `Deployment` classique en permanence, précisément parce qu'il doit rester disponible pour piloter la plateforme. Ce n'est pas un aveu de faiblesse : c'est un choix architectural cohérent, documenté comme tel dans le mémoire.
**Ce que le jury vérifie** : si tu sais reconnaître les limites de ta propre terminologie marketing.
**Erreur à éviter** : affirmer que "tout" est serverless — c'est faux et facilement contredit en regardant l'architecture physique.

### 🔥 Q4.4 — Qu'est-ce qui est réellement serverless dans votre solution ?
**Réponse** : Le scale-to-zero effectif des applications tenants via Knative Serving, et le réveil automatique par événement Kafka via Knative Eventing. C'est la définition opérationnelle du serverless retenue dans ce projet : pas de gestion d'infrastructure par le client, et un coût proportionnel à l'usage réel.

### 🔥 Q4.5 — Pourquoi Kafka alors que vous pourriez utiliser du simple REST entre services ?
**Réponse** : Voir Q2.5 — le découplage total et la capacité à réveiller une app à zéro instance sont impossibles avec du REST synchrone direct, qui suppose que le service appelé soit déjà actif et joignable.

### 🔥 Q4.6 — Pourquoi ne pas utiliser RabbitMQ à la place de Kafka ?
**Réponse** : RabbitMQ est plus simple à opérer pour de la messagerie point-à-point classique, mais Kafka offre la persistance et le rejeu des messages, et une meilleure scalabilité horizontale par partitions — pertinent pour une plateforme visant plusieurs tenants avec des volumes d'événements potentiellement importants. Kafka est aussi l'écosystème nativement intégré à Knative Eventing via `KafkaSource`.

### 🔥⭐ Q4.7 — Quelle est la limite principale de votre solution ?
**Réponse honnête** (à choisir selon ce qui te met le plus à l'aise, toutes vérifiées dans le code) : Le backend tourne actuellement en un seul réplica (`replicas: 1`), sans haute disponibilité stricte — s'il plante, il y a une interruption le temps du redémarrage. Autre limite réelle : le `ServiceAccount` par défaut, non dédié, avec des droits plus larges que nécessaire. Autre limite : aucun test automatisé ni scanner de sécurité dans le pipeline CI/CD à ce jour.
**Ce que le jury vérifie** : l'honnêteté et la capacité d'auto-critique technique — c'est en général très bien perçu par un jury quand la réponse est précise et assumée plutôt qu'évasive.
**Erreur à éviter** : dire "je n'ai pas de limite" — ça sonne faux et invite le jury à creuser plus dur.

### 🔥 Q4.8 — Quel est votre principal problème technique rencontré ?
**Réponse** *(à adapter selon ton vécu réel du projet, exemple grounded dans le code)* : La fiabilisation du pipeline Kaniko — Kaniko vide le répertoire `/tmp` pendant la construction de l'image, ce qui corrompait l'agent JNA de Jenkins et faisait planter les builds suivants de façon intermittente. La correction a été de rediriger les répertoires temporaires vers `/var/jenkins_home` (visible dans le Jenkinsfile actuel : `JAVA_TOOL_OPTIONS`, `TMPDIR`).

### 🔥 Q4.9 — Que se passe-t-il si Kubernetes tombe ?
**Réponse** : Toute la plateforme s'arrête — le backend ne peut plus déployer, superviser ni router aucune application, puisque tout repose sur l'API Kubernetes. C'est un point de défaillance unique assumé dans le contexte d'un PFE sur un cluster à 3 nœuds ; en production, ça impliquerait une haute disponibilité du control-plane (plusieurs masters), non mise en œuvre ici.

### 🔥 Q4.10 — Que se passe-t-il si Kafka tombe ?
**Réponse** : Voir Q3.18 — plus aucun événement n'est transformé en CloudEvent tant que Kafka n'est pas rétabli, mais les messages produits restent persistés et seront traités au retour du service.

### 🔥 Q4.11 — Que se passe-t-il si Keycloak tombe ?
**Réponse** : Plus aucun nouvel utilisateur ne peut se connecter ni rafraîchir son jeton (le rafraîchissement automatique toutes les 55 secondes échouerait et déconnecterait l'utilisateur). Les jetons déjà émis et non expirés restent valides pour l'instant qu'il leur reste, puisque la validation du JWT ne nécessite pas de contact réseau direct avec Keycloak à chaque requête (juste la clé publique déjà en cache).

### 🔥 Q4.12 — Que se passe-t-il si PostgreSQL tombe ?
**Réponse** : Le backend ne peut plus lire ni écrire aucune donnée métier (utilisateurs, apps, factures) — c'est également un point de défaillance unique, un seul pod PostgreSQL sans réplication mise en œuvre dans ce projet.

### 🔥 Q4.13 — Votre solution est-elle réellement scalable ?
**Réponse honnête** : Les applications tenants le sont, via l'autoscaling Knative. **Le backend applicatif, lui, ne l'est pas horizontalement en l'état** : il tourne en un seul réplica, et le passer à plusieurs réplicas casserait les tâches planifiées (`@Scheduled` du billing s'exécuteraient en double sans mécanisme de verrou distribué — pas encore implémenté).

### 🔥 Q4.14 — Est-elle réellement multi-tenant ?
**Réponse** : Oui, avec 3 couches d'isolation vérifiées (namespace, NetworkPolicy réseau, isolation applicative par `effectiveUserId`) — voir Q2.21 et Q3.23.

### 🔥 Q4.15 — Quelle est votre plus grande faiblesse dans ce projet ?
**Réponse honnête, orientée process plutôt que technique pure** : Le projet a été mené en solo, ce qui a limité la revue de code par les pairs et le temps disponible pour les tests automatisés — assumé et documenté comme perspective non réalisée plutôt que caché.

### 🔥 Q4.16 — Quelle amélioration feriez-vous avec 6 mois de plus ?
**Réponse** : Ajouter une suite de tests automatisés dans le pipeline CI/CD (actuellement `mvn -DskipTests`), intégrer un scanner de vulnérabilités des images (Trivy par exemple), créer un `ServiceAccount` Kubernetes dédié avec des droits réduits au strict nécessaire, et ajouter un mécanisme de verrou distribué (type ShedLock) pour permettre de faire tourner le backend sur plusieurs réplicas sans dupliquer les tâches planifiées.

### 🔥 Q4.17 — Pourquoi votre solution serait-elle meilleure que les solutions existantes (Heroku, Cloud Run, OpenShift) ?
**Réponse honnête, mesurée** : Elle n'est pas "meilleure" dans l'absolu — Heroku et Cloud Run sont bien plus matures et robustes en production. Sa valeur est de répondre à un besoin précis que ces solutions ne couvrent pas ensemble : hébergement sur infrastructure privée (contrairement à Cloud Run) ET facturation à l'usage intégrée (contrairement à OpenShift), pour un intégrateur qui veut garder le contrôle de sa propre infrastructure.

---

## 5. QUESTIONS COMMERCIALES / BUSINESS

**Q5.1** 🟢 Quel est le problème business résolu ?
**Réponse** : NextStep IT, intégrateur IT proposant déjà de l'Infrastructure as a Service, voulait monter en gamme vers une offre Platform as a Service serverless — pour se différencier sur le marché du cloud privé/on-premise plutôt que de concurrencer directement les hyperscalers sur leur propre terrain.

**Q5.2** 🟡 Qui sont les utilisateurs de la plateforme ?
**Réponse** : Trois profils réels dans le système : l'ADMIN (équipe NextStep IT, supervision globale), le CLIENT_ADMIN (responsable du compte d'un client, déploie et gère ses applications), et le MEMBER (développeur ajouté à l'équipe d'un CLIENT_ADMIN, avec des permissions limitées).

**Q5.3** 🟡 Qui sont les clients cibles ?
**Réponse** : Des PME ou équipes de développement qui veulent déployer des applications conteneurisées sans recruter d'expertise Kubernetes en interne, et qui préfèrent héberger chez un intégrateur de confiance plutôt que chez un hyperscaler international.

**Q5.4** 🟡 Quelle est la valeur ajoutée par rapport à Kubernetes directement ?
**Réponse** : Le client n'a jamais besoin d'écrire de YAML Kubernetes, ni de comprendre les namespaces, RBAC, autoscaling ou NetworkPolicy — il remplit un formulaire, et toute cette complexité (documentée dans les problématiques du projet) est gérée par la plateforme.

**Q5.5** 🟡 Comment un client utilise-t-il la plateforme au quotidien ?
**Réponse** : Il se connecte au portail, déploie une application depuis une image Docker en remplissant un formulaire simple, suit son statut en temps réel, consulte ses logs et métriques, configure éventuellement de la messagerie Kafka, et reçoit une facture mensuelle basée sur sa consommation réelle.

**Q5.6** 🟡 Quel est le parcours d'un nouveau client ?
**Réponse** : Auto-inscription sur le portail (crée automatiquement un compte CLIENT_ADMIN, propriétaire d'un nouveau tenant), configuration de son équipe (ajout de MEMBER avec permissions ciblées), puis déploiement de ses premières applications.

**Q5.7** 🟡 Comment gérez-vous plusieurs clients sur la même infrastructure ?
**Réponse** : Voir Q2.21 — isolation par namespace, NetworkPolicy et scoping applicatif, plus des quotas configurables par tenant (CPU, RAM, nombre d'apps max) synchronisés avec un `ResourceQuota` Kubernetes réel.

**Q5.8** 🟡 Comment fonctionne la facturation côté business ?
**Réponse** : Facturation à l'usage réel (CPU-heure, RAM-heure), pas un forfait fixe — un modèle adapté aux charges intermittentes, cohérent avec l'argument scale-to-zero (pourquoi payer plein tarif une app qui ne tourne pas en continu).

**Q5.9** 🟠 Comment votre solution pourrait-elle être commercialisée ?
**Réponse réaliste** : En SaaS, avec une facturation à l'usage déjà techniquement implémentée (Stripe, snapshots horaires) — donc directement exploitable comme modèle économique, sans invention supplémentaire nécessaire par rapport à ce qui existe déjà dans le code.

**Q5.10** 🟠 Quels seraient les coûts principaux pour NextStep IT à opérer cette plateforme ?
**Réponse réaliste** : L'infrastructure physique (les nœuds du cluster), la bande passante, le temps d'exploitation/support, et éventuellement le coût des licences des composants commerciaux s'ils en ajoutaient (la stack actuelle est entièrement open source : Kubernetes, Knative, Kafka/Strimzi, Keycloak, PostgreSQL, Prometheus/Grafana).

**Q5.11** 🔥 Quels sont vos concurrents ?
**Réponse honnête** : Les mêmes solutions étudiées dans le mémoire — Heroku, Google Cloud Run, Red Hat OpenShift — ainsi que, plus largement, tout hyperscaler proposant du PaaS managé. La différenciation n'est pas technologique (ces plateformes sont plus matures) mais positionnelle : hébergement privé + facturation à l'usage pour un client qui refuse le vendor lock-in.

**Q5.12** 🟠 Quelles seraient les limites commerciales de cette solution ?
**Réponse honnête** : Le manque de haute disponibilité du backend actuel serait un point bloquant pour un SLA commercial sérieux ; l'absence de tests automatisés et de scan de sécurité dans le pipeline serait aussi un frein pour un audit de sécurité client avant contractualisation.

**Q5.13** 🔥 Comment assureriez-vous la haute disponibilité pour un vrai client commercial ?
**Réponse honnête** : Ce n'est pas mis en œuvre dans ce projet — ce serait une évolution nécessaire avant commercialisation réelle : multiplier les nœuds du control-plane, répliquer PostgreSQL, et faire évoluer le backend pour supporter plusieurs réplicas (ce qui demande d'abord de résoudre le problème des tâches planifiées dupliquées, voir Q4.13).

---

## 6. QUESTIONS SUR L'ENTREPRISE ET LE CONTEXTE DU PFE

**Q6.1** 🟢 Pourquoi ce projet, pourquoi ce sujet ?
**Réponse** : NextStep IT, intégrateur cloud tunisien, voulait renforcer son offre Infrastructure as a Service avec une couche PaaS serverless, pour ses propres clients — un sujet qui correspondait à mon intérêt pour le Cloud Native et l'architecture distribuée.

**Q6.2** 🟢 Quel était votre rôle dans l'équipe ?
**Réponse** : Développeur (Equipe de développement Scrum), seul sur l'ensemble du projet — infrastructure, backend, les deux frontends, CI/CD — avec l'encadrant professionnel en double rôle de Product Owner et Scrum Master.

**Q6.3** 🟡 Pourquoi Scrum plutôt qu'une autre méthodologie ?
**Réponse** : Le projet combine des technologies encore jeunes et en évolution rapide (Knative, Strimzi), avec des contraintes réelles du cluster difficiles à anticiper entièrement en amont — une approche agile permet d'ajuster le périmètre et les priorités sprint après sprint plutôt que de tout figer dans une planification initiale rigide.

**Q6.4** 🟡 Comment avez-vous organisé les sprints ?
**Réponse** : 4 releases, 14 sprints (Sprint 0 à 13 dans la planification, dont les 12 premiers documentés dans le mémoire soumis) : Release 0 pour le socle Cloud Native, Release 1 pour le cœur applicatif, Release 2 pour l'exploitation/facturation, Release 3 pour l'industrialisation (sécurité + CI/CD).

**Q6.5** 🟡 Quelle difficulté avez-vous rencontrée et comment l'avez-vous résolue ?
**Réponse** : Voir Q4.8 (Kaniko/tmp) comme exemple technique concret et vérifiable dans le code actuel.

**Q6.6** 🟢 Qu'avez-vous appris pendant ce PFE ?
**Réponse** *(à personnaliser, orientation suggérée par le projet réel)* : Une compréhension en profondeur de l'écosystème Cloud Native (Kubernetes, Knative, Kafka) au-delà de la théorie — notamment les pièges pratiques (corruption `/tmp` par Kaniko, comportement réel du `watch()` Kubernetes, la nuance entre `Ready=True` et "pod réellement actif" en Knative) qu'aucun cours ne couvre.

**Q6.7** 🟢 Quelles compétences professionnelles avez-vous développées ?
**Réponse** : Travailler en autonomie sur un projet de bout en bout (de l'infrastructure à la facturation), documenter honnêtement les limites plutôt que de les dissimuler, et prioriser un périmètre fonctionnel large avec des ressources limitées (un seul développeur).

---

## 7. QUESTIONS PAR SECTION DE LA SOUTENANCE

### Introduction
- 🟢 *Pouvez-vous résumer votre projet en une phrase ?* → Voir Q1.1.
- 🟡 *Quel est le fil conducteur de votre présentation ?* → Cadre général → besoins → conception (2 architectures) → réalisation par grande fonctionnalité (multi-tenant, déploiement, event-driven, sécurité, observabilité, CI/CD).

### Problématique
- 🟢 *Quelles sont les 5 problématiques identifiées ?* → Complexité de configuration YAML, difficulté de mise en place event-driven, absence de multi-tenancy, gaspillage de ressources, manque de visibilité centralisée.
- 🔴 *Ces problématiques sont-elles toutes résolues ?* → Réponse honnête : oui pour les 5, avec des limites assumées par ailleurs (voir section Pièges) plutôt qu'une résolution parfaite à 100%.

### Solution proposée
- 🟡 *Quels sont les 6 piliers de la solution ?* → Simplification du déploiement, scalabilité automatique, multi-tenancy, observabilité unifiée, event-driven intégré, pipeline DevOps Jenkins.

### Architecture
- ⭐🟠 *Pourquoi deux architectures (logique et physique) et pas une seule ?* → L'architecture logique répond à "quels composants et comment ils interagissent" (vue logicielle) ; l'architecture physique répond à "sur quelle infrastructure ça tourne réellement" (vue matérielle/réseau) — deux questions différentes, deux niveaux d'abstraction.
- 🔴 *Pourquoi Keycloak est-il séparé de Cilium/Kourier dans l'architecture logique ?* → Parce que ce sont des responsabilités différentes : Keycloak est un service d'identité, Cilium/Kourier sont des composants réseau — les confondre dans la même boîte laisserait croire qu'ils ont le même rôle.

### Workflow (déploiement / eventing / sécurité)
- Voir intégralement les sections 2 et 3 ci-dessus (Q2.10-Q2.30, Q3.14-Q3.24).

### Technologies
- 🟡 *Pour chaque techno du tableau "Outils & Technologies", pouvez-vous justifier le choix ?* → Voir section 10 (les 20 "Pourquoi ?").

### Démonstration
- 🟢 *Que va montrer la démo ?* → Le portail client (déploiement d'une app, suivi du statut, Kafka/Eventing, facturation) et la console admin (supervision, gestion des clients).
- 🔥 *Et si la démo plante en direct ?* → Rester calme, avoir des captures d'écran de secours (déjà présentes dans le mémoire), expliquer verbalement le flux attendu en s'appuyant sur les diagrammes de séquence déjà montrés.

### Sécurité
- Voir Q2.22-Q2.25, Q3.20-Q3.25.

### CI/CD
- Voir Q2.13-Q2.15, Q3.26-Q3.28.

### Conclusion
- 🟡 *Quelles sont vos perspectives d'évolution ?* → Tests automatisés, scan de sécurité CI/CD, ServiceAccount dédié, haute disponibilité du backend — reprises de la section Pièges, présentées comme perspectives assumées plutôt que comme échecs.

---

## 8. PRÉPARATION SLIDE PAR SLIDE

*(Basé sur les 21 slides réelles de la présentation technique)*

### Slide 1 — Page de garde
**Facile** : *Qui sont vos encadrants ?* → M. Arafet Ben Kilani (professionnel, NextStep IT), Mme Ines Chouchane (académique).
**Point à mentionner** : nom exact du projet, "PlatformServerless".

### Slide 3 — Organisme d'accueil
**Facile** : *Que fait NextStep IT ?* → Intégrateur IT tunisien (2012, La Charguia) : cloud, cybersécurité, réseau, téléphonie IP, services managés.
**Piège** 🔥 : *NextStep IT a-t-il déjà un produit PaaS avant votre projet ?* → Non, c'est justement l'absence de ce type d'offre qui motive le projet — à ne pas confondre avec leur offre IaaS existante.

### Slide 4 — Problématiques
**Intermédiaire** : *Laquelle des 5 problématiques était la plus critique selon vous ?* → Réponse personnelle défendable, ex. l'absence de multi-tenancy, car elle conditionne la viabilité commerciale même de l'offre.

### Slide 5 — Étude de l'existant
⭐ **Difficile** : *Pourquoi ne pas avoir choisi OpenShift, qui coche presque toutes les cases techniques ?* → Coût de licence commercial et lourdeur opérationnelle incompatibles avec une offre destinée à des PME — voir tableau comparatif du mémoire (`tab:comparaison_paas`).

### Slide 6 — Solution proposée
**Intermédiaire** : *Le pipeline DevOps Jenkins est-il un service vendu aux clients ?* → Non — c'est l'outillage interne de l'équipe de développement pour construire/publier/déployer la plateforme elle-même, pas une fonctionnalité exposée aux tenants.

### Slide 7 — Besoins fonctionnels
**Facile** : *Combien de grands blocs fonctionnels ?* → 6 : authentification/utilisateurs, déploiement, Kafka/Eventing, monitoring/journaux, facturation/paiement, administration.

### Slide 8 — Besoins non fonctionnels
⭐ **Difficile** : *Comment mesurez-vous concrètement la "disponibilité" annoncée ?* → Voir Q4.7 — réponse honnête : la disponibilité concerne la bascule sans coupure lors des redéploiements volontaires (RollingUpdate), pas une tolérance aux pannes en cas de crash du pod unique (`replicas: 1`).

### Slides 9-10 — Méthodologie
**Facile** : *Qui est Product Owner ?* → M. Arafet Ben Kilani (double rôle avec Scrum Master).
**Piège** 🔥 : *N'est-ce pas un conflit qu'une seule personne soit Product Owner ET Scrum Master ?* → C'est une adaptation pragmatique à une équipe mono-développeur, assumée comme telle — pas un Scrum "par le livre" mais un cadre allégé et cohérent avec les ressources disponibles.

### Slide 11 — Cas d'utilisation
**Intermédiaire** : *Pourquoi deux diagrammes séparés (MEMBER/CLIENT_ADMIN vs ADMIN) plutôt qu'un seul ?* → Pour la lisibilité — les deux rôles côté client partagent presque toutes les fonctionnalités (avec des permissions différentes), tandis que l'ADMIN a un périmètre entièrement différent (supervision globale).

### Slide 12 — Architecture logique
Voir section Architecture ci-dessus.

### Slide 13 — Architecture physique
⭐ **Difficile** : *Pourquoi MetalLB et Kourier sont-ils dans la même couche du schéma alors qu'ils ont des rôles différents ?* → Parce qu'ils appartiennent tous les deux à la couche "Réseau & Ingress" au sens fonctionnel (achemine le trafic externe vers le cluster), même si leurs rôles précis diffèrent — MetalLB attribue l'IP, Kourier route par nom d'hôte.

### Slide 15 — Infrastructure et isolation multi-tenant
Voir Q2.21, Q3.23.

### Slide 16 — Déploiement d'une application
Voir Q2.10-Q2.12, Q3.30.

### Slide 17 — Event-driven Kafka/Knative Eventing
Voir Q3.16-Q3.19.

### Slide 18 — Authentification/autorisation
Voir Q2.22-Q2.25, Q3.20-Q3.23.

### Slide 19 — Observabilité
Voir Q2.26-Q2.29, Q3.33-Q3.35.

### Slide 20 — CI/CD
⭐ **Difficile** : *Vos 4 pipelines sont-ils identiques ?* → Réponse honnête : backend/frontend/admin sont quasi-identiques (Cleanup, Checkout, Build, Docker Build & Push + Deploy via Kaniko). **Le pipeline microservices est différent** : il utilise un simple `docker build` classique, pas Kaniko — une incohérence réelle du projet, jamais harmonisée (le Sprint 11 backlog liste d'ailleurs "aligner les 4 pipelines sur le socle backend" comme tâche **non réalisée**).

---

## 9. FICHE DE RÉVISION AVANT SOUTENANCE

### Architecture en 30 secondes
```
Client → MetalLB (IP externe) → Kourier (ingress Knative) → Knative Service → Pod applicatif
```
Backend et portails, eux, sont exposés directement en LoadBalancer (pas via Kourier).

### Déploiement en 30 secondes
```
Formulaire → POST /api/apps → AppService (DEPLOYING, réponse immédiate)
→ AppDeploymentAsyncRunner (@Async) → KnativeService.deploy()
→ Fabric8 → kube-apiserver → Knative Service → Revision → Route → URL
```

### CI/CD en 30 secondes
```
git push → Jenkins → Checkout → Build (Maven/npm) → Kaniko (build image, sans démon Docker)
→ Docker Hub → kubectl set image + rollout status
```

### Eventing en 30 secondes
```
App productrice → Topic Kafka → KafkaSource (consomme, convertit en CloudEvent)
→ Broker (namespace tenant) → Trigger (filtre optionnel) → App consommatrice (HTTP POST)
```

### Sécurité en 30 secondes
```
Login → Keycloak (JWT signé) → chaque requête : Bearer token
→ NimbusJwtDecoder (signature/expiration) → KeycloakJwtAuthConverter (rôles)
→ @PreAuthorize (hasRole ou permissionService.has) → UserContextService (scope tenant) → Accès
```

### Monitoring en 30 secondes
```
App expose /actuator/prometheus → Prometheus scrape (15s) → backend interroge PromQL (à la demande)
→ portail affiche (poll 30s)
```
En parallèle : Alertmanager détecte un seuil → backend interroge son API REST → portail affiche l'alerte.

### Logs en 30 secondes
```
Événement de déploiement → DeploymentLog (DB) + LogSseService.push() → SSE → portail (temps réel)
```

### Billing en 30 secondes
```
BillingScheduler (toutes les heures) → snapshot par app (CPU/RAM/statut)
→ coût = (vCPU×0.048 + Go×0.006) × réplicas × facteur d'usage
→ facture générée le 1er du mois → paiement Stripe (SetupIntent/PaymentIntent) → webhook signé
```

### Les 3 couches d'isolation multi-tenant
1. Namespace Kubernetes dédié par tenant
2. NetworkPolicy default-deny (appliquée par Cilium)
3. Scoping applicatif par `effectiveUserId` (`UserContextService`)

### Les 3 nœuds du cluster
- `vm01` (10.9.21.223) — control-plane
- `vm02` / `vm03` — workers (tous les pods, plateforme et tenants)

### Les 3 rôles applicatifs
- **ADMIN** — équipe NextStep IT, supervision globale
- **CLIENT_ADMIN** — propriétaire d'un tenant, tous les droits sur ses ressources
- **MEMBER** — ajouté par un CLIENT_ADMIN, permissions accordées explicitement

---

## 10. LES 20 QUESTIONS "POURQUOI ?"

| # | Question | Réponse courte |
|---|---|---|
| 1 | Pourquoi Kubernetes ? | Orchestration automatique + primitives natives pour le multi-tenant (namespace, RBAC, NetworkPolicy). |
| 2 | Pourquoi Knative ? | Scale-to-zero natif, évite de coder un autoscaler maison. |
| 3 | Pourquoi Kafka ? | Découplage asynchrone, persistance et rejeu des messages. |
| 4 | Pourquoi Strimzi ? | Opérateur Kubernetes pour administrer Kafka de façon déclarative. |
| 5 | Pourquoi Cilium ? | CNI moderne eBPF, meilleur support NetworkPolicy que Flannel. |
| 6 | Pourquoi MetalLB ? | Cluster bare-metal, pas de LoadBalancer natif d'un cloud public. |
| 7 | Pourquoi Kourier ? | Passerelle d'entrée légère dédiée à Knative, plus simple qu'Istio. |
| 8 | Pourquoi Keycloak ? | Ne jamais réimplémenter soi-même l'authentification. |
| 9 | Pourquoi PostgreSQL ? | Données métier fortement relationnelles (users, apps, factures). |
| 10 | Pourquoi Prometheus ? | Standard de facto de la supervision Cloud Native, intégration Micrometer. |
| 11 | Pourquoi Grafana ? | Visualisation standard couplée à Prometheus. |
| 12 | Pourquoi Jenkins ? | CI/CD self-hosted, cohérent avec un cluster on-premise. |
| 13 | Pourquoi Kaniko ? | Build d'image sans démon Docker privilégié, sécurité dans un pod K8s. |
| 14 | Pourquoi Fabric8 ? | Client Java le plus complet pour piloter Kubernetes/Knative depuis Spring Boot. |
| 15 | Pourquoi SSE ? | Flux unidirectionnel serveur→client, plus simple que WebSocket pour ce besoin. |
| 16 | Pourquoi REST ? | Standard, stateless, cohérent avec l'authentification par jeton. |
| 17 | Pourquoi cette architecture logique/physique en 2 vues ? | Séparer "quels composants" de "sur quelle infra" — deux questions différentes. |
| 18 | Pourquoi séparer rôle et permission ? | Rôle = contrôle grossier (JWT), permission = contrôle fin par tenant (base de données). |
| 19 | Pourquoi cette sécurité (JWT + permission + propriété) ? | Trois niveaux de contrôle, chacun bloquant une classe différente d'abus. |
| 20 | Pourquoi cette méthode de facturation (usage réel) ? | Cohérente avec l'argument scale-to-zero — payer ce qu'on consomme réellement. |

---

## 11. TABLEAUX DE COMPARAISON

| Solution | Notre choix | Pourquoi |
|---|---|---|
| Docker seul vs Kubernetes | Kubernetes | Redémarrage automatique, scalabilité, isolation multi-tenant natifs — Docker seul n'a rien de tout ça. |
| Kubernetes seul vs Knative | Knative (au-dessus de K8s) | Scale-to-zero natif, pas besoin d'un autoscaler maison. |
| HPA vs Knative autoscaling | Knative (KPA) | HPA ne descend pas à zéro réplica ; Knative si, via l'Activator. |
| Kafka vs RabbitMQ | Kafka | Persistance/rejeu des messages, scalabilité par partitions, intégration native `KafkaSource`. |
| Fabric8 vs appels REST bruts vers l'API Kubernetes | Fabric8 | Évite de réimplémenter l'authentification et la sérialisation des ressources K8s à la main. |
| Kafka AdminClient vs CRD Strimzi pour les topics | AdminClient | Création synchrone et immédiate, retour direct à l'API REST, pas d'attente de réconciliation d'opérateur. |
| Cilium vs Flannel | Cilium | Flannel ne supporte pas nativement les NetworkPolicy, indispensables au multi-tenant. |
| Cilium vs Calico | Cilium | Support NetworkPolicy comparable, mais eBPF plus performant + potentiel d'observabilité réseau. |
| MetalLB vs LoadBalancer cloud | MetalLB | Cluster bare-metal, pas de LoadBalancer managé disponible. |
| Jenkins vs GitHub Actions | Jenkins | Self-hosted, cohérent avec une infrastructure on-premise, pas de dépendance à un SaaS externe. |
| Kaniko vs démon Docker | Kaniko | Pas de privilège root nécessaire dans un pod Kubernetes. |
| Keycloak vs authentification maison | Keycloak | Standard OIDC/OAuth2 éprouvé, jamais gérer soi-même mots de passe/jetons. |
| SSE vs WebSocket | SSE | Besoin strictement unidirectionnel (serveur→client) pour logs/métriques/notifications. |
| Prometheus vs Grafana | Les deux, rôles différents | Prometheus collecte/stocke les métriques ; Grafana les visualise — pas une alternative, un duo complémentaire. |

---

## 12. SCÉNARIOS TECHNIQUES

### Scénario 1 — "Un client déploie une nouvelle application. Expliquez ce qui se passe de la requête jusqu'à l'exécution du pod."
**Réponse détaillée** :
1. Le formulaire du portail envoie `POST /api/apps` avec le jeton JWT en en-tête.
2. `@PreAuthorize` vérifie la permission `DEPLOY_APP`.
3. `AppService.createApp()` résout le tenant réel via `UserContextService`, dérive le nom du service Knative du nom choisi par l'utilisateur, enregistre l'app en base (`DEPLOYING`), et retourne immédiatement une réponse HTTP au client.
4. En tâche de fond, `AppDeploymentAsyncRunner.triggerDeploy()` (`@Async`) appelle `KnativeService.deploy()`.
5. `ensureNamespaceExists()` crée le namespace tenant et sa NetworkPolicy si c'est le premier déploiement.
6. `buildKnativeManifest()` construit l'objet Knative Service avec image, port, ressources, annotations d'autoscaling.
7. Fabric8 envoie ce manifeste au `kube-apiserver`.
8. Le contrôleur Knative crée une Configuration puis une Revision immuable, et une Route qui génère l'URL publique.
9. `buildServiceUrl()` interroge (poll) le statut jusqu'à récupérer cette URL (60s max).
10. Le statut passe à `RUNNING`, l'URL est sauvegardée, un log SSE est poussé au portail.
11. Indépendamment, `KnativeWatcher` continue d'observer l'état réel du pod en continu (scale-to-zero, crash éventuel).

### Scénario 2 — "Que se passe-t-il si le Pod tombe ?"
→ Voir Q3.4.

### Scénario 3 — "Que se passe-t-il si Kafka tombe ?"
→ Voir Q3.18/Q4.10.

### Scénario 4 — "Que se passe-t-il si Keycloak tombe ?"
→ Voir Q4.11.

### Scénario 5 — "Que se passe-t-il si PostgreSQL tombe ?"
→ Voir Q4.12.

### Scénario 6 — "Que se passe-t-il si le build Jenkins échoue ?"
→ Voir Q3.28.

### Scénario 7 — "Que se passe-t-il si l'image Docker référencée n'existe pas sur le registre ?"
**Réponse** : Le manifeste Knative Service est bien créé côté Kubernetes, mais le pod ne peut jamais démarrer (`ImagePullBackOff`). La condition `Ready` reste `False` sans motif de scale-to-zero identifié par `readReadyCondition()`, donc le statut affiché passe à `FAILED` après le délai d'attente de `buildServiceUrl()`.

### Scénario 8 — "Que se passe-t-il si le client envoie un JWT invalide ou expiré ?"
**Réponse** : `NimbusJwtDecoder` rejette la requête avant même d'atteindre le contrôleur — réponse `401 Non authentifié`. Côté frontend, l'intercepteur Axios détecte ce 401, vide le `localStorage` et redirige vers `/login`.

### Scénario 9 — "Que se passe-t-il si un MEMBER essaie de supprimer l'application d'un autre tenant ?"
**Réponse** : Même en connaissant l'ID de l'application ciblée, la requête est scopée par son `effectiveUserId` réel (celui de son CLIENT_ADMIN) — la requête base de données ne retrouve simplement pas cette ligne, réponse 404 (ou 403 selon l'implémentation exacte du endpoint), jamais un accès effectif.

### Scénario 10 — "Que se passe-t-il lorsqu'une application passe à zéro réplica, puis qu'une requête arrive ?"
**Réponse** : L'Activator, qui écoute à la place du pod absent, intercepte la requête, déclenche l'Autoscaler pour créer un nouveau pod, met la requête en attente le temps du cold start, puis la transmet dès que le pod est prêt à répondre.

### Scénario 11 — "Que se passe-t-il lorsqu'un événement Kafka est produit mais qu'aucun Trigger ne le filtre ?"
→ Voir Q3.19.

---

## 13. QUESTIONS TRÈS DIFFICILES (RAISONNEMENT)

### Q13.1 🔥⭐
**Question** : Votre backend utilise `@Scheduled` pour la facturation. Si vous deviez le faire tourner sur plusieurs réplicas pour la haute disponibilité, que se passerait-il, et comment le corrigeriez-vous ?
**Réponse courte à dire devant le jury** : "Les tâches planifiées s'exécuteraient sur chaque instance en parallèle, générant des factures et des alertes en double — un vrai risque identifié dans ce projet."
**Explication technique** : Spring exécute `@Scheduled` indépendamment sur chaque JVM ; sans coordination entre instances, il n'y a pas de notion de "un seul exécutant" par défaut.
**Point clé à retenir** : c'est un problème de coordination distribuée, pas un bug du code lui-même — le code est correct pour un seul réplica, ce qui est l'état actuel du déploiement (`replicas: 1`).
**Piège à éviter** : prétendre que ce n'est "pas un problème" — le jury Cloud Native connaît ce piège classique et le testera si tu mentionnes vouloir scaler le backend.

### Q13.2 🔥⭐
**Question** : Vous facturez 20% du tarif plein pour une application scale-to-zero. Comment justifiez-vous ce chiffre spécifiquement, et n'est-ce pas contradictoire avec l'argument marketing "scale-to-zero = pas de coût" ?
**Réponse courte** : "Ce n'est pas contradictoire — l'argument est 'coût réduit', pas 'coût nul' ; le chiffre de 20% est un choix de modélisation économique du projet, pas une mesure physique de consommation réelle."
**Explication technique** : `uptimeFactor()` retourne 0.2 pour tout statut qui n'est ni `RUNNING` ni `FAILED` — un choix de code, assumable et modifiable.
**Point clé** : distinguer "consommation CPU/RAM réelle d'un pod à 0 instance" (qui est 0) de "coût de réservation logique sur la plateforme" (le namespace, la configuration, le monitoring continuent d'exister).
**Piège à éviter** : essayer de justifier le 20% par une contrainte technique réelle qui n'existe pas dans le code — c'est un choix économique, pas une nécessité technique.

### Q13.3 🔥
**Question** : Pourquoi le Broker Knative Eventing est-il "par tenant" alors que les contrôleurs qui le font fonctionner (Eventing Controller, dispatcher) sont mutualisés pour tout le cluster ? N'est-ce pas une contradiction avec votre argument d'isolation multi-tenant ?
**Réponse courte** : "Non — ce sont deux couches différentes : les ressources applicatives (Broker, Trigger) sont bien isolées par tenant, seul le plan de contrôle technique sous-jacent (les pods qui font tourner Knative Eventing lui-même) est partagé, comme c'est le cas pour Kubernetes lui-même (un seul control-plane pour tous les tenants)."
**Explication technique** : c'est le modèle standard de tout système multi-tenant sur Kubernetes — le control-plane est structurellement partagé, l'isolation se fait au niveau des ressources et du réseau, pas en dupliquant les opérateurs eux-mêmes.
**Point clé** : c'est cohérent, pas contradictoire — l'incident réel mentionné dans le mémoire (panne du dispatcher affectant tous les clients) est justement la preuve tangible de cette limite assumée du plan de contrôle mutualisé.
**Piège à éviter** : nier que cette mutualisation est un point de défaillance partagé entre tenants — elle l'est, et c'est un vrai compromis à assumer.

### Q13.4 🔥
**Question** : Votre pipeline microservices utilise `docker build` classique alors que les 3 autres utilisent Kaniko. N'est-ce pas une faille de sécurité que vous avez vous-même identifiée comme critique pour les autres pipelines ?
**Réponse courte, honnête** : "Oui, c'est une incohérence réelle du projet, jamais harmonisée — le backlog du Sprint 11 liste explicitement cette tâche d'alignement comme non réalisée."
**Explication technique** : le pipeline `Jenkinsfile.microservices` utilise `sh "docker build ..."` directement, ce qui suppose un accès au démon Docker de l'agent Jenkins — exactement le risque que Kaniko élimine pour les 3 autres pipelines.
**Point clé** : c'est une limite honnêtement documentée, pas dissimulée.
**Piège à éviter** : prétendre que les 4 pipelines sont uniformes — un jury qui lit le code source le verra immédiatement.

### Q13.5 🔥
**Question** : Votre `ClusterRoleBinding` donne au backend des droits de suppression sur `pods/services/deployments/namespaces` à l'échelle de tout le cluster, pas seulement les namespaces tenants. Concrètement, quel est le pire scénario possible si le backend était compromis ?
**Réponse courte, honnête** : "Un attaquant qui compromettrait le backend pourrait, en théorie, supprimer des ressources dans n'importe quel namespace du cluster, y compris `kube-system`, `monitoring` ou `jenkins` — pas seulement les namespaces tenants."
**Explication technique** : le `ClusterRoleBinding` est cluster-wide par choix de simplicité initial, documenté dans le fichier RBAC lui-même comme plus large que nécessaire.
**Point clé** : c'est un vrai risque assumé et documenté, pas découvert par le jury — la maturité consiste à le présenter soi-même avant qu'on te le demande.
**Piège à éviter** : minimiser la gravité — c'est un risque réel de sécurité, pas un détail cosmétique.

---

## 14. STATISTIQUES FINALES

| Catégorie | Nombre de questions |
|---|---|
| Niveau 1 — Faciles | 14 |
| Niveau 2 — Intermédiaires | 30 |
| Niveau 3 — Techniques difficiles | 40 |
| Questions pièges / déstabilisation | 17 |
| Questions commerciales / business | 13 |
| Questions entreprise / contexte PFE | 7 |
| Questions par section de soutenance | ~20 |
| Questions slide par slide | ~15 |
| Les 20 "Pourquoi ?" | 20 |
| Tableaux de comparaison | 14 lignes |
| Scénarios techniques | 11 |
| Questions très difficiles (raisonnement) | 5 |
| **TOTAL de questions distinctes traitées** | **≈ 195** |

---

## Sources utilisées pour ce document

**Mémoire** : `memoire_migre/cadre_general.tex`, `chapitre0.tex` à `chapitre4.tex` (chapitre5 exclu de la version finale, non utilisé comme source ici).

**Code backend vérifié** : `AppController`, `AppService`, `AppDeploymentAsyncRunner`, `KnativeService`, `KnativeWatcher`, `EventingService`, `KafkaService`, `SecurityConfig`, `KeycloakJwtAuthConverter`, `PermissionService`, `UserContextService`, `AuthService`, `BillingScheduler`, `BillingService`, `PaymentController`/`PaymentService`, `QuotaService`, `LogSseService`, `WebSocketConfig`, `KubernetesConfig`.

**Configuration** : `k8s/backend/deployment.yaml`, `k8s/backend/rbac.yaml`, `k8s/frontend/deployment.yaml`, `k8s/admin/deployment.yaml`, `backend-api/pom.xml`.

**CI/CD** : `ci-cd/jenkins/pipelines/Jenkinsfile.backend`, `.frontend`, `.admin`, `.microservices`.

**Microservices de démo** : `microservices/order-service/index.js`.

**Présentation** : les 21 slides de la présentation technique de soutenance (PDF fourni).

**Divergences signalées explicitement dans ce document** (mémoire/code vs réalité, ou incohérences internes réelles du projet) : facteur de facturation scale-to-zero (20%, choix économique non justifié scientifiquement), pipeline microservices non aligné sur Kaniko, `ServiceAccount` non dédié, `ClusterRoleBinding` cluster-wide plus large que nécessaire, backend non hautement disponible (`replicas: 1`), WebSocket présent en code mais non utilisé.
