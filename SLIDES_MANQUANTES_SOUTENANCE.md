# Slides techniques manquantes — extension de la présentation actuelle (17 slides)

Analyse basée sur : ta présentation actuelle (17 slides, "serverless platform", NextStep IT) + le code du repo vérifié tout au long de cette session + le mémoire.

⚠️ Deux points signalés par le prompt lui-même n'ont **pas pu être vérifiés dans le mémoire depuis cette session** (je n'ai pas relu le chapitre validation/sécurité complet) : le score d'audit sécurité "4/10 → 5.2/10" et le nombre exact de cas de test validés (84). **Vérifie ces deux chiffres dans ton mémoire avant de les utiliser** — je les ai marqués ⚠️ NON VÉRIFIÉ ci-dessous plutôt que de les affirmer.

---

## 1. Table des slides existantes

| N° | Titre | Sujet traité | Conserver ? | Compléter ? |
|---|---|---|---|---|
| 1 | Cover | Titre projet, encadrants, année | ✅ | Corriger éventuellement le nom affiché ("serverless platform" en minuscule — à harmoniser en "PlatformServerless" si c'est le vrai nom du projet) |
| 2 | Plan de travail | 4 sections | ✅ | Ajouter une 5e section "Réalisation avancée" ou intégrer les nouvelles slides dans la section 4 existante |
| 3 | Organisme d'accueil | NextStep IT | ✅ | Non |
| 4 | Problématiques | 5 problèmes | ✅ | Non |
| 5 | Étude de l'existant | Vercel/Heroku/EKS | ✅ | Non |
| 6 | Solution proposée | 6 piliers | ⚠️ | **Retirer "Borcelle Project"** (résidu de template, toujours présent) |
| 7 | Besoins fonctionnels | 6 modules | ✅ | Non |
| 8 | Besoins non fonctionnels | Scalabilité/Sécurité/Performance/Disponibilité | ⚠️ | Reformuler "cold start < 3s" (non mesuré) → "scale-to-zero et activation à la demande" |
| 9 | Méthodologie — rôles Scrum | Product Owner/Scrum Master/Developer | ✅ | Non |
| 10 | Méthodologie — 7 étapes | Analyse→Infra→Backend→Kafka→Frontend→CI/CD→Tests | ⚠️ | Corriger **"Frontend Next.js"** → React (confirmé dans le code : `.jsx`, Vite, pas de Next.js) |
| 11 | Diagramme de cas d'utilisation | UML | ✅ | Non |
| 12 | Diagramme de classes | UML | ✅ | Non (déjà dense, ne pas surcharger) |
| 13 | Architecture logique | Couches présentation/appli/données/infra | ⚠️ | Corriger **"Next.js 14 / TypeScript"** → React 18.2 + Vite + JavaScript (JSX). Corriger éventuellement "Kafka géré via KafkaService" pour préciser que **Kafka AdminClient** gère les topics, Fabric8 gère uniquement Kubernetes/Knative |
| 14 | Architecture physique | Cluster 3 nœuds, namespaces | ⚠️ | **Titre dupliqué "Architecture logique"** au lieu de "Architecture physique" (bug de copier-coller à corriger) |
| 15 | Architecture Kafka + Knative | Producer→Broker→KafkaSource→Trigger→Activator→Pod | 🟢 | Déjà excellente, garder telle quelle |
| 16 | Outils & Technologies | 4 catégories | ⚠️ | **Prometheus/Grafana/Alertmanager absents** alors qu'ils sont dans le mémoire — à ajouter dans la catégorie infra. Corriger "TypeScript" → JavaScript si confirmé |
| 17 | Merci | Clôture | ✅ | Non |

---

## 2. Table de couverture des sujets techniques du mémoire

| Sujet | Présent ? | Niveau | Ajouter une slide ? | Priorité |
|---|---|---|---|---|
| Infrastructure réseau (Cilium/MetalLB/Kourier) isolation multi-tenant | Mentionné en liste (slide 16) et namespaces (slide 14) | 🟡 | Oui — slide dédiée avec workflow d'isolation | HIGH |
| Serverless / Knative Serving en détail (scale-to-zero) | Intégré dans slide 15 (mêlé à Kafka) | 🟡 | Oui — slide standalone traffic-in/traffic-out | HIGH |
| Event-driven Kafka + Knative Eventing | Slide 15 complète | 🟢 | Non | — |
| Fabric8 vs Kafka AdminClient | Absent (juste des noms de service dans le diagramme) | ❌ | Oui | HIGH |
| Workflow déploiement complet + watcher | Absent en tant que workflow explicite | ❌ | Oui | HIGH |
| Sécurité applicative (Keycloak/JWT/rôles/@PreAuthorize) | Un mot dans besoins non-fonctionnels | ❌ | Oui | HIGH |
| Sécurité M2M / API Key CI-CD | Absent | ❌ | Oui (si confirmé dans le code — à vérifier : `ApiKeyFilter`) | MEDIUM |
| Observabilité (logs SSE, Prometheus, Grafana, Alertmanager) | Absent | ❌ | Oui | HIGH |
| Billing (BillingScheduler) | Absent | ❌ | Oui | HIGH |
| Paiement Stripe (webhook, signature) | Absent | ❌ | Oui | HIGH |
| Administration (comptes, quotas, audit) | Absent | ❌ | Oui | MEDIUM |
| CI/CD avec Kaniko | Tools listés (Jenkins/Docker/DockerHub/GitHub) sans workflow ni Kaniko | 🟡 | Oui | HIGH |
| Security hardening (score avant/après) | Absent | ❌ | Oui, **si confirmé dans le mémoire** ⚠️ NON VÉRIFIÉ | MEDIUM |
| Résultats / démonstration (captures) | Absent | ❌ | Oui | HIGH |
| Validation (cas de test) | Absent | ❌ | Oui, **nombre de cas à vérifier dans le mémoire** ⚠️ NON VÉRIFIÉ | HIGH |
| Limites et perspectives | Absent | ❌ | Oui — inclure la limite Postgres/Knative confirmée cette session | HIGH |

---

## 3. Ordre final (slides existantes + nouvelles insérées)

```
1–8   : existantes (corrections mineures notées ci-dessus)
9     : existante (rôles Scrum)
10    : existante (7 étapes, corriger "Next.js")
11    : existante (cas d'utilisation)
12    : existante (diagramme de classes)
13    : existante (architecture logique, corriger Next.js→React)
14    : existante (architecture physique, corriger le titre dupliqué)
15    : existante (Kafka + Knative, garder)
16    : existante (outils, ajouter Prometheus/Grafana/Alertmanager)

17 NOUVELLE : Infrastructure & isolation multi-tenant (Cilium/MetalLB/Kourier)
18 NOUVELLE : Serverless — Knative Serving en détail (scale-to-zero)
19 NOUVELLE : Fabric8 vs Kafka AdminClient — le backend comme cerveau
20 NOUVELLE : Déploiement d'une application — workflow complet + watcher
21 NOUVELLE : Sécurité applicative (Keycloak → JWT → rôles → @PreAuthorize)
22 NOUVELLE : Sécurité M2M / CI-CD (si confirmé)
23 NOUVELLE : Observabilité (logs SSE, Prometheus, Grafana, Alertmanager)
24 NOUVELLE : Billing (BillingScheduler)
25 NOUVELLE : Paiement Stripe (webhook + signature)
26 NOUVELLE : Administration (comptes, quotas, audit)
27 NOUVELLE : CI/CD (GitHub → Jenkins → Maven → Kaniko → Docker Hub → K8s)
28 NOUVELLE : Security hardening (⚠️ si confirmé)
29 NOUVELLE : Résultats / Démonstration (captures)
30 NOUVELLE : Validation (⚠️ nombre de cas à confirmer)
31 NOUVELLE : Limites et perspectives (inclure limite Postgres/Knative)

32    : existante (Merci)
```

---

## 4. Détail des nouvelles slides

### Slide 17 — Infrastructure & isolation multi-tenant
**Pourquoi nécessaire** : Cilium/MetalLB/Kourier sont cités comme mots-clés (slide 16) mais jamais expliqués — un jury technique posera forcément la question "quel est le rôle exact de chacun".
**Objectif** : le jury comprend comment le trafic entre de l'extérieur jusqu'à une app, et comment un tenant est isolé d'un autre.
**Contenu** :
- MetalLB → attribue une IP externe de type LoadBalancer au cluster (bare-metal, pas de cloud provider).
- Kourier → passerelle HTTP/HTTPS d'entrée pour les Knative Services.
- Cilium → CNI (réseau des pods) + application des `NetworkPolicy`.
- Chaque tenant = 1 namespace `user-<client>`, créé dynamiquement, isolé par NetworkPolicy automatique.
**Design** : 3 cartes horizontales (MetalLB/Kourier/Cilium) avec icône + rôle en une ligne, puis en dessous un schéma "Tenant A [namespace] ──✕── Tenant B [namespace]" avec Cilium au milieu.
**Schéma** :
```
Internet
   ↓
MetalLB (IP externe)
   ↓
Kourier (Ingress HTTP/HTTPS)
   ↓
Cilium (NetworkPolicy) ─── namespace user-clientA ✕ namespace user-clientB
```
**📸 Capture de code : NON** (architecture réseau, pas de code applicatif pertinent — CNI/LoadBalancer sont des composants infra, pas du code du projet)
**🗣️ Speech** : « Le trafic externe entre par MetalLB, qui lui attribue une IP, puis Kourier route la requête HTTP vers le bon Knative Service. Cilium, lui, applique les règles réseau qui isolent chaque client dans son propre namespace — c'est ce qui garantit qu'un tenant ne peut jamais atteindre les ressources d'un autre, sans dupliquer l'infrastructure. »

---

### Slide 18 — Serverless : Knative Serving en détail
**Pourquoi nécessaire** : le scale-to-zero est mentionné (slide 8, avec le chiffre "<3s" à corriger) mais jamais montré comme mécanisme.
**Objectif** : le jury comprend concrètement comment un pod apparaît/disparaît selon le trafic.
**Contenu** :
- Trafic entrant → Activator intercepte si 0 pod actif → Autoscaler (KPA) décide du nombre de pods → pod créé.
- 60 secondes sans trafic → scale-to-zero automatique.
- Chaque déploiement = `Revision` immuable, `Route` gère le trafic entre révisions.
**Design** : courbe simple montrant trafic (axe X = temps) vs nombre de pods (axe Y), avec annotations "1er trafic → cold start" et "60s idle → 0 pod".
**Schéma** :
```
Trafic → Kourier → Activator (si 0 pod) → Autoscaler (KPA) → crée pod
Pas de trafic pendant 60s → Autoscaler → scale to 0
```
**📸 Capture de code : NON** (comportement Knative natif, pas de code applicatif à montrer — sauf si tu veux montrer la génération du YAML Knative Service côté backend, auquel cas voir slide 20)
**🗣️ Speech** : « Contrairement à un déploiement Kubernetes classique où les pods tournent en permanence, Knative peut descendre à zéro pod quand personne n'utilise l'app, et en recréer un dès la première requête — c'est l'Activator qui intercepte cette requête pendant que l'Autoscaler décide de la remontée en charge. »

---

### Slide 19 — Fabric8 vs Kafka AdminClient : le backend comme cerveau
**Pourquoi nécessaire** : distinction technique que le jury va probablement questionner — éviter de laisser penser que Fabric8 gère aussi Kafka.
**Objectif** : clarifier que deux bibliothèques différentes gèrent deux couches différentes.
**Contenu** :
- **Fabric8 Kubernetes Client** → bibliothèque Java in-process → crée/lit/modifie les ressources Kubernetes et les CRD Knative (Service, Revision, KafkaSource, Trigger).
- **Kafka AdminClient** → bibliothèque Java dédiée → crée/supprime les topics Kafka eux-mêmes (opérations d'administration Kafka, pas Kubernetes).
- Aucun des deux n'est un service séparé — les deux tournent dans le process du backend Spring Boot.
**Design** : deux colonnes côte à côte (Fabric8 | Kafka AdminClient), même structure : logo/icône, "quoi", "exemple d'action".
**📸 Capture de code : OUI**
Fichier : `EventingService.java`
Bloc à montrer : la méthode `createKnativeKafkaSource(...)` (construction d'une ressource `GenericKubernetesResource` via Fabric8) à côté d'un extrait équivalent utilisant `KafkaAdminClient` pour la création de topic (si présent dans `KafkaService.java`/`createTopicInKafka`).
Pourquoi : preuve concrète que ce sont deux clients distincts dans le même backend.
**🗣️ Speech** : « Le backend utilise deux bibliothèques Java différentes selon ce qu'il pilote : Fabric8 pour tout ce qui est ressource Kubernetes ou Knative, et le Kafka AdminClient officiel pour la gestion des topics Kafka eux-mêmes — les deux s'exécutent dans le même process, ce ne sont pas des services séparés. »

---

### Slide 20 — Déploiement d'une application : workflow complet
**Pourquoi nécessaire** : c'est le workflow le plus important de toute la soutenance et il n'existe encore nulle part comme slide autonome.
**Objectif** : le jury suit, étape par étape, ce qui se passe entre le clic "Déployer" et l'app accessible.
**Contenu / Schéma** :
```
👤 Utilisateur
   ↓
🖥️ Portail React (formulaire Deploy)
   ↓
⚙️ Backend Spring Boot — POST /api/apps
   ↓
🔐 Keycloak / JWT — vérification identité + permission DEPLOY_APP
   ↓
🗄️ Enregistrement App en base (statut DEPLOYING)
   ↓
⚡ Traitement asynchrone (AppDeploymentAsyncRunner, @Async)
   ↓
🔧 Fabric8 → création du Knative Service
   ↓
☁️ Knative → Revision → Pod
   ↓
🌐 Application accessible (URL générée)
```
Puis le retour :
```
Knative Service status → backend (polling/watch) → mise à jour statut en DB → SSE → Portail (badge RUNNING)
```
**Design** : diagramme vertical en 2 colonnes — aller (gauche, flèches descendantes) / retour (droite, flèches montantes), avec une ligne pointillée reliant les deux au niveau de Knative.
**📸 Capture de code : OUI**
Fichier : `AppDeploymentAsyncRunner.java`
Bloc : la méthode `triggerDeploy(App app, AppRequest req)` avec l'annotation `@Async`.
Pourquoi : montre concrètement que le déploiement est traité en tâche de fond, pas de façon bloquante pour l'utilisateur.
**🗣️ Speech** : « Quand un client clique sur Déployer, le backend ne bloque pas la réponse HTTP en attendant que Kubernetes crée le pod — il enregistre l'app en statut DEPLOYING et lance le déploiement réel en tâche asynchrone. C'est cette méthode ici, annotée `@Async`, qui appelle Fabric8 pour créer la ressource Knative Service. »

---

### Slide 21 — Sécurité applicative
**Pourquoi nécessaire** : "Sécurité" n'est qu'un mot dans les besoins non-fonctionnels (slide 8) — jamais expliqué comme mécanisme.
**Objectif** : le jury comprend la chaîne complète JWT → rôle → permission → endpoint.
**Contenu / Schéma** :
```
Utilisateur → Keycloak (authentification, émission JWT)
   ↓
Requête API + JWT (Authorization: Bearer ...)
   ↓
Spring Security (oauth2-resource-server) — validation du JWT (issuer-uri Keycloak)
   ↓
Rôle (ADMIN / CLIENT_ADMIN / DEVELOPER)
   ↓
Permission (ex. DEPLOY_APP, MANAGE_EVENTING)
   ↓
@PreAuthorize sur l'endpoint
```
**Design** : chaîne verticale d'étapes avec icônes, rôles affichés en 3 badges colorés (ADMIN rouge, CLIENT_ADMIN bleu, DEVELOPER vert).
**📸 Capture de code : OUI**
Fichier : n'importe quel contrôleur avec `@PreAuthorize("@permissionService.has(authentication.name, 'MANAGE_EVENTING')")` (ex. `EventingController.java`, déjà vu dans le code cette session).
Pourquoi : preuve que chaque endpoint sensible vérifie explicitement une permission, pas juste "être connecté".
**🗣️ Speech** : « Keycloak authentifie l'utilisateur et émet un JWT. Spring Security valide ce token à chaque requête grâce à l'issuer configuré, puis un service de permissions vérifie, avant même d'entrer dans le contrôleur, que le rôle de l'utilisateur autorise bien l'action demandée — ici par exemple, `MANAGE_EVENTING` pour créer un Trigger Kafka. »

---

### Slide 22 — Sécurité machine-à-machine (CI/CD)
**Pourquoi nécessaire** : distinct du JWT utilisateur — Jenkins ne se connecte pas comme un humain.
**Objectif** : montrer que l'authentification humaine (JWT) et machine (clé API) sont deux mécanismes séparés.
**Contenu** : à confirmer dans le code (chercher `ApiKeyFilter` ou équivalent) avant de construire cette slide — si le mécanisme existe réellement, le workflow est `Jenkins → header X-Api-Key → Filter dédié → Endpoint autorisé (hors chaîne JWT)`.
**⚠️ Vérifier d'abord** : cherche `ApiKeyFilter`, `X-Api-Key` dans `backend-api/src/main/java` avant de construire cette slide — si absent, ne pas l'inclure ou reformuler en perspective plutôt qu'en fonctionnalité livrée.

---

### Slide 23 — Observabilité
**Pourquoi nécessaire** : Prometheus/Grafana/Alertmanager sont dans le mémoire mais absents à 100% des 17 slides actuelles, y compris la slide "Outils".
**Objectif** : montrer les 3 flux d'information (logs, métriques, alertes) et comment l'utilisateur les consulte.
**Contenu / Schéma** :
```
Application (pod)
   ├── Logs ──────→ SSE (LogSseService) ──→ Portail (flux temps réel)
   ├── Metrics ───→ Micrometer/Actuator ──→ Prometheus ──→ Grafana
   └── Seuils ────→ Alertmanager
```
**Design** : 3 branches horizontales partant d'un bloc "Application" central, chacune avec son icône et sa destination finale.
**📸 Capture de code : OUI**
Fichier : `LogSseService.java`
Bloc : la méthode utilisant `SseEmitter`.
Pourquoi : preuve que les logs sont vraiment poussés en temps réel (pas de polling côté frontend), différenciant technique par rapport à une simple liste rafraîchie.
**🗣️ Speech** : « Les logs de déploiement sont poussés en direct au frontend via Server-Sent Events, pas par polling — dès qu'un événement se produit côté backend, il est streamé immédiatement au portail. Les métriques applicatives, elles, sont exposées via Micrometer/Actuator et scrapées par Prometheus, visualisées dans Grafana. »

---

### Slide 24 — Billing
**Pourquoi nécessaire** : module complet du mémoire, absent des 17 slides.
**Objectif** : le jury comprend le principe de facturation à l'usage, sans formule inventée.
**Contenu / Schéma** :
```
BillingScheduler (@Scheduled — toutes les heures)
   ↓
Snapshot horaire : CPU + RAM + replicas + statut de chaque app
   ↓
Calcul du coût
   ↓
Facture mensuelle (AppInvoice, échéance = fin de période + 5 jours)
```
Mentionner l'alerte J-3 (confirmée dans le code cette session : `sendDueSoonAlerts()`, alerte exactement 3 jours avant échéance).
**📸 Capture de code : OUI**
Fichier : `BillingScheduler.java`
Bloc : `@Scheduled(cron = "0 0 * * * *")` (snapshot horaire) et `@Scheduled(cron = "0 0 8 * * *")` (alertes J-3 quotidiennes).
Pourquoi : preuve d'automatisation réelle, pas manuelle.
**🗣️ Speech** : « Chaque heure, un scheduler prend un instantané de la consommation réelle de chaque application — CPU, RAM, nombre de réplicas actifs — et l'utilise pour calculer le coût. Une facture est générée mensuellement, avec une alerte automatique envoyée 3 jours avant l'échéance. »

---

### Slide 25 — Paiement Stripe
**Pourquoi nécessaire** : absent des 17 slides, alors que c'est un point technique intéressant (sécurité par signature, pas JWT).
**Objectif** : le jury comprend que le webhook Stripe n'est PAS sécurisé comme les autres endpoints.
**Contenu / Schéma** :
```
Stripe (paiement effectué)
   ↓
Webhook HTTP POST
   ↓
Vérification de la signature Stripe (webhook secret) — PAS de JWT ici
   ↓
PaymentController → PaymentService
   ↓
Mise à jour du statut de la facture
```
**Design** : encadré rouge/orange autour de "Vérification de la signature Stripe" pour insister visuellement sur la différence avec le flux JWT classique.
**📸 Capture de code : OUI**
Fichier : `PaymentController.java` / `PaymentService.java`
Bloc : la vérification de signature Stripe (`Webhook.constructEvent(...)` ou équivalent SDK Stripe).
Pourquoi : preuve que la sécurité de cet endpoint public repose sur un mécanisme différent, volontairement.
**🗣️ Speech** : « Ce endpoint est volontairement accessible sans JWT, puisque c'est Stripe qui l'appelle, pas un utilisateur connecté. Sa sécurité repose sur la vérification de la signature cryptographique du payload avec le secret webhook — si la signature ne correspond pas, la requête est rejetée immédiatement. »

---

### Slide 26 — Administration
**Pourquoi nécessaire** : la console admin existe dans le code (`admin-console/`) mais n'apparaît nulle part dans les 17 slides.
**Objectif** : montrer que la plateforme a deux niveaux d'usage (client / admin plateforme).
**Contenu** : gestion des comptes clients, supervision globale des applications de tous les tenants, facturation globale, audit, gestion Kafka globale.
**📸 Capture de code : NON** (mieux vaut une capture UI ici — voir tableau captures)
**🗣️ Speech** : « À côté du portail client, une console d'administration séparée permet à l'équipe NextStep IT de superviser l'ensemble des tenants — comptes, facturation globale, audit — sans jamais donner à un client de visibilité sur les autres. »

---

### Slide 27 — CI/CD complet
**Pourquoi nécessaire** : les outils sont listés (slide 16) mais sans workflow ni mention de Kaniko, alors que 4 vrais Jenkinsfiles existent dans le repo (`ci-cd/jenkins/pipelines/Jenkinsfile.{admin,backend,frontend,microservices}`).
**Objectif** : montrer un vrai pipeline fonctionnel, pas juste des logos.
**Contenu / Schéma** :
```
GitHub (push)
   ↓
Jenkins (déclenchement pipeline)
   ↓
Build Maven / npm
   ↓
Tests
   ↓
Kaniko (build d'image sans daemon Docker — compatible cluster K8s)
   ↓
Docker Hub (push image)
   ↓
kubectl set image / rollout (déploiement K8s)
```
**Design** : ligne horizontale d'icônes technologiques reliées par des flèches, chronomètre ou badge "4 pipelines Jenkins réels" en évidence.
**📸 Capture de code : OUI**
Fichier : `Jenkinsfile.backend` (ou `.frontend`)
Bloc : l'étape utilisant Kaniko pour le build d'image.
Pourquoi : Kaniko est un choix technique précis (build d'image sans accès au daemon Docker, sécurisé pour tourner dans un pod Kubernetes) — bon point à expliquer si le jury demande "pourquoi pas juste `docker build` ?".
**🗣️ Speech** : « On utilise Kaniko plutôt que le démon Docker classique parce que le build d'image tourne lui-même dans un pod Kubernetes — Kaniko permet de construire une image sans avoir besoin d'un accès privilégié au socket Docker, ce qui est plus sûr dans ce contexte. »

---

### Slide 28 — Security hardening ⚠️ À VÉRIFIER AVANT UTILISATION
**Ne pas construire cette slide avant d'avoir confirmé dans le mémoire** que le score "4/10 → 5.2/10" (ou tout autre chiffre) y est réellement documenté avec sa méthodologie de calcul. Si confirmé, structure suggérée :
```
Audit initial : X/10
   ↓
Corrections appliquées (lister 2-3 corrections réelles, ex. celles trouvées cette session : userId JWT vs local, endpoint /api/metrics/cluster non restreint à ADMIN)
   ↓
Audit après corrections : Y/10
```
Message honnête : amélioration mesurée, pas "plateforme sécurisée à 100%".

---

### Slide 29 — Résultats / Démonstration
**Pourquoi nécessaire** : aucune capture d'écran dans les 17 slides actuelles.
**Contenu** : voir tableau captures UI ci-dessous — sélectionner 4 à 6 captures fortes, une par écran, pas de mosaïque.
**🗣️ Speech type** : « Voici le portail client en action : ici le formulaire de déploiement, où l'utilisateur renseigne juste le nom de l'app et l'image Docker — tout le reste (Fabric8, Knative, sécurité) est géré automatiquement derrière. »

---

### Slide 30 — Validation ⚠️ À VÉRIFIER AVANT UTILISATION
**Ne pas écrire "84/84 tests réussis"** sans confirmation exacte dans le mémoire du nombre réel de cas et de leur taux de réussite. Structure sûre en attendant vérification :
```
Plan de validation : X cas de test (REST/Postman)
Couverture : [modules testés — à lister depuis le mémoire]
```
Si le mémoire donne un taux de réussite précis, l'utiliser tel quel ; sinon reformuler en "cas de test définis et exécutés" sans chiffre de réussite inventé.

---

### Slide 31 — Limites et perspectives
**Contenu confirmé (cette session)** :
- **Limite réelle et testée** : Knative Serving est HTTP-only — une base de données déployée comme Knative Service est injoignable en TCP brut (confirmé avec `order-service` → `PSQLException: Connection refused`).
- Perspective : distinguer ressources "stateless" (déployables via Knative) et "stateful" (nécessitant un StatefulSet K8s classique hors serverless).
- Ajouter toute autre limite réellement documentée dans le mémoire (ne pas inventer).

---

## 5. Captures de code prioritaires

| Priorité | Fichier | Élément à capturer | Slide | Pourquoi |
|---|---|---|---|---|
| 1 | `AppDeploymentAsyncRunner.java` | méthode `triggerDeploy` + `@Async` | 20 | Preuve du déploiement asynchrone |
| 2 | `EventingController.java` (ou équivalent) | `@PreAuthorize("@permissionService.has(...)")` | 21 | Preuve du contrôle de permission par endpoint |
| 3 | `BillingScheduler.java` | les 2 `@Scheduled` (snapshot horaire + alertes J-3) | 24 | Preuve d'automatisation billing |
| 4 | `PaymentController.java`/`PaymentService.java` | vérification signature Stripe | 25 | Preuve sécurité webhook différente du JWT |
| 5 | `Jenkinsfile.backend` | étape Kaniko | 27 | Choix technique CI/CD à justifier |
| 6 | `EventingService.java` | `createKnativeKafkaSource` (Fabric8) vs création topic (AdminClient) | 19 | Distinction Fabric8/AdminClient |
| 7 | `LogSseService.java` | usage `SseEmitter` | 23 | Preuve logs temps réel (pas polling) |

## 6. Captures UI recommandées

| Capture | Slide | Ce qu'elle démontre |
|---|---|---|
| Dashboard portail client | 29 | Vue globale |
| Formulaire de déploiement | 29 | Simplicité du déploiement |
| Liste des apps + statut | 29 | Suivi en temps réel |
| Kafka Topics / Triggers | 29 | Event-driven en action |
| Monitoring (CPU/RAM par app) | 29 | Observabilité |
| Console admin (comptes clients) | 26 ou 29 | Administration multi-tenant |
| Page Billing | 24 ou 29 | Facturation |

---

## 7. Tableau final des slides à ajouter

| N° | Titre | Type | Code ? | Capture UI ? | Schéma ? | Importance |
|---|---|---|---|---|---|---|
| 17 | Infrastructure & isolation multi-tenant | Architecture | Non | Non | Oui | HIGH |
| 18 | Serverless — Knative Serving | Workflow | Non | Non | Oui | HIGH |
| 19 | Fabric8 vs Kafka AdminClient | Code | Oui | Non | Non | HIGH |
| 20 | Déploiement d'une app | Workflow | Oui | Non | Oui | HIGH |
| 21 | Sécurité applicative | Workflow | Oui | Non | Oui | HIGH |
| 22 | Sécurité M2M | Workflow | À vérifier | Non | Oui | MEDIUM |
| 23 | Observabilité | Workflow | Oui | Non | Oui | HIGH |
| 24 | Billing | Workflow | Oui | Oui | Oui | HIGH |
| 25 | Paiement Stripe | Workflow | Oui | Non | Oui | HIGH |
| 26 | Administration | Démonstration | Non | Oui | Non | MEDIUM |
| 27 | CI/CD complet | Workflow | Oui | Non | Oui | HIGH |
| 28 | Security hardening | Résultat | Non | Non | Non | MEDIUM ⚠️ vérifier |
| 29 | Résultats / Démonstration | Démonstration | Non | Oui | Non | HIGH |
| 30 | Validation | Validation | Non | Non | Non | HIGH ⚠️ vérifier |
| 31 | Limites et perspectives | Résultat | Non | Non | Non | HIGH |
