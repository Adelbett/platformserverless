# Refonte présentation soutenance PFE — Analyse & données de référence

Ce fichier centralise tout ce qui a été vérifié (code, mémoire, deux PDF analysés) pour reconstruire la présentation PowerPoint. Il sert de source de vérité avant de toucher au .pptx.

Sources analysées :
- Présentation actuelle : `Downloads/Green and Black Modern Thesis Defense Presentation (5).pdf` (17 slides)
- Présentation inspiration (mise en page uniquement) : `Downloads/Copie de SIKIBI Adoulaa 3.pdf` (projet TSS/Tunisys, sans rapport avec PlatformServerless)
- Code : `backend-api/pom.xml`, `web-portal/`, `admin-console/`, `ci-cd/jenkins/pipelines/`
- Mémoire : `memoire_migre/chapitre0..5.tex` + diagrammes dans `memoire_migre/image/`

---

## A. Palette graphique actuelle à CONSERVER

Extraite visuellement du PDF (5), ignorer le nom de fichier "Green and Black" :

| Rôle | Couleur observée |
|---|---|
| Fond slide de titre / remerciements | Bleu moyen (~#4A7BA6 à ~#5B8FB0, dégradé de cercles bleu clair) |
| Fond slides de contenu | Blanc |
| Titres de section (gros titres noirs) | Noir / gris très foncé, bold, sans-serif condensé |
| Sous-titres / labels ("Cadre général du projet") | Bleu foncé (~#1F4E79 / #2C5F8A) |
| Accent violet/indigo (cartes "Problématiques") | Violet clair (~#8E8CD8) |
| Accent orange (mise en avant) | Orange (~#E8944A) |
| Cartes bleu clair (besoins fonctionnels) | Bleu ciel (~#AEDFF7 bordure, fond gris clair) |
| Formes déco (coin haut/bas gauche) | Bleu marine (#1B3A5C environ) |
| Diagrammes d'architecture (déjà dans le mémoire) | Palette propre : bleu (présentation), violet (application), vert (données/infra), orange/beige (Knative/Kafka) — à réutiliser telle quelle |

Aucune couleur rouge/violet façon Tunisys ne doit être introduite — c'était la palette de l'autre présentation (inspiration de mise en page seulement).

---

## B. Ce qui est déjà bon dans la présentation actuelle

- Structure globale cohérente (Cadre général → Besoins → Conception → Réalisation).
- Diagramme de cas d'utilisation et diagramme de classes déjà présents et détaillés.
- Architecture logique, physique et Kafka/Knative déjà dessinées et globalement correctes (voir corrections en D).
- Slide "Outils & Technologies" bien organisée par catégorie.
- Ton sobre, peu d'emojis, déjà proche d'un registre soutenance (contrairement à l'inspiration, plus "storytelling").

## C. Ce qui doit être supprimé / reformulé

- Le mot **"Next.js"** (slide Architecture logique + slide Outils & Technologies "Frontend Next.js") — **FAUX**, voir section F.
- **"cold start … inférieur à 3 secondes"** (slide Besoins non fonctionnels) — **non mesuré**, à supprimer ou reformuler.
- **"disponibilité : deux pods via Jenkins, si un tombe l'autre prend le relais"** — à vérifier avant de garder (voir F) ; formulation actuelle laisse penser à une HA mesurée alors que c'est un mécanisme de réplication basique, pas un test de bascule réel.
- Slide "Outils & Technologies" mentionne TypeScript pour le frontend — **à vérifier, probablement faux** (voir F).
- Aucune distinction claire IMPLÉMENTÉ / VALIDÉ / MESURÉ / LIMITE / PERSPECTIVE dans la version actuelle — à introduire.

## D. Ce qui doit être corrigé (détail technique)

| Point à vérifier | Dans la présentation actuelle | Réalité vérifiée dans le code | Action |
|---|---|---|---|
| Framework frontend | "Next.js 14 / TypeScript" | **React 18.2 + Vite 5.4**, fichiers en **`.jsx` (JavaScript, pas TypeScript)** | Corriger partout : "React 18.2 · Vite 5.4 · JavaScript (JSX) · Tailwind CSS 3.4" |
| Spring Boot | "Spring Boot 3.2" | **3.2.3** exact (pom.xml `spring-boot-starter-parent` v3.2.3) | Préciser 3.2.3 si besoin de précision, sinon "3.2.x" reste correct |
| Java | "Java 21" | Confirmé (`<java.version>21</java.version>`) | OK, garder tel quel |
| Fabric8 Kubernetes Client | mentionné sans version | **io.fabric8:kubernetes-client 6.10.0** | Ajouter la version si le jury est technique |
| Sécurité JWT | "Keycloak" | Confirmé : `spring-boot-starter-oauth2-resource-server` + JJWT 0.12.5, `issuer-uri` pointant vers un realm Keycloak (`realms/platform`) | OK, garder |
| PostgreSQL | mentionné | Driver `org.postgresql:postgresql` présent dans le pom | OK, garder |
| Stripe | pas mentionné dans la présentation actuelle mais présent dans la logique métier (billing/paiement) | `com.stripe:stripe-java` confirmé dans le pom | À ajouter dans la présentation (slide 20 "Paiement et Stripe" du plan de refonte) |
| Monitoring | mentionné (Prometheus/Grafana pas dans la présentation actuelle mais dans le mémoire) | `spring-boot-starter-actuator` + `micrometer-registry-prometheus` confirmés | OK à ajouter, cohérent avec le mémoire |
| CI/CD Jenkins | "Pipeline DevOps Jenkins" | 4 Jenkinsfiles réels trouvés : `ci-cd/jenkins/pipelines/Jenkinsfile.{admin,backend,frontend,microservices}` | OK, existant et vérifiable — bon point à montrer (preuve concrète, contrairement à Tunisys qui n'a qu'un POC local) |
| Cold start < 3s | affirmé comme non-fonctionnel | Aucune mesure trouvée dans le mémoire/code à ce stade | Reformuler en "scale-to-zero et activation à la demande via Knative Serving (Activator + Autoscaler)" sans chiffre, sauf si une mesure existe réellement dans chapitre5.tex — à vérifier avant l'écriture finale des slides |
| Disponibilité "2 pods, bascule auto" | affirmé comme SLA | Vraisemblablement vrai pour le déploiement du backend lui-même (replicas Kubernetes), mais ce n'est pas une "haute disponibilité" testée avec un scénario de panne documenté | Reformuler : "Backend déployé en 2 réplicas Kubernetes — bascule automatique en cas de défaillance d'un pod" (retirer toute connotation de test de charge/panne réel non effectué) |

**Limite structurelle majeure à documenter (déjà confirmée cette session, voir mémoire projet)** :
Knative Serving ne route que du HTTP/HTTP2/gRPC (le sidecar `queue-proxy` parse le trafic comme du HTTP pour l'autoscaling et le routing). Une base de données comme PostgreSQL déployée comme Knative Service est donc injoignable en TCP brut — testé et confirmé avec un vrai microservice Spring Boot (order-service) : `org.postgresql.util.PSQLException: Connection to order-db-6b312a:5432 refused`. **C'est un résultat de test réel, à valoriser en slide "Limites" (section Validation) plutôt qu'à cacher.**

## E. Ce qui manque et doit être ajouté

- Slide dédiée au **workflow de déploiement** (Client → Frontend → REST API → AppService → Fabric8 → Knative Service → Revision → Pod) — actuellement absent en tant que workflow explicite, seulement présent dans l'architecture logique statique.
- Slide **"Pourquoi Fabric8 ?"** — le rôle exact du client Kubernetes programmatique n'est jamais expliqué à l'oral actuellement.
- Slide **sécurité applicative** détaillée (rôles ADMIN/CLIENT_ADMIN/MEMBER — confirmer les noms exacts dans le code avant la slide finale, `UserRole` enum vu dans le diagramme de classes montre `ADMIN, CLIENT_ADMIN, DEVELOPER`, pas "MEMBER" — **à corriger dans le plan proposé par l'utilisateur**, qui mentionnait MEMBER par erreur).
- Slide **sécurité machine-à-machine (API Key pour Jenkins/CI)** — à vérifier dans le code (`ApiKeyFilter` ou équivalent) avant de l'affirmer.
- Slide **facturation/Stripe séparée de l'authentification** (webhook signature vs JWT) — absente actuellement.
- Slide **limite Postgres/Knative** — résultat de test réel de cette session, absent de la présentation actuelle, doit apparaître en section Validation/Limites.
- Captures d'écran réelles de l'application — la présentation actuelle n'en contient aucune (contrairement à l'inspiration, très riche en captures).

## F. Corrections supplémentaires trouvées pendant la vérification code

- **UserRole réel** (voir diagramme de classes existant, slide 12 du PDF actuel) : `ADMIN`, `CLIENT_ADMIN`, `DEVELOPER` — pas de rôle "MEMBER". Le plan fourni par l'utilisateur en section 16 du brief mentionnait `ADMIN / CLIENT_ADMIN / MEMBER` : à corriger en `ADMIN / CLIENT_ADMIN / DEVELOPER`.
- Le frontend n'utilise **pas TypeScript** (fichiers `.jsx`), contrairement à ce que la présentation actuelle affirme et à ce que le brief de refonte supposait par défaut ("React/Vite pour les portails" — vrai — mais sans TypeScript, à ne pas afficher "TypeScript" sur les slides finales sauf vérification ultérieure d'un autre sous-projet).

## G. Workflows prioritaires (fidèles au code, réutilisables tels quels pour les slides)

1. **Déploiement d'une app** : Client → Frontend (React/Vite) → `POST /api/apps` → Spring Boot (Auth JWT) → `AppService` → Fabric8 `KubernetesClient` → API Kubernetes → Knative `Service` → `Revision` → Pod.
2. **Serverless (Knative Serving)** : Requête HTTP → Kourier (Ingress) → Knative Service → Activator (si 0 pod) → Autoscaler (KPA) → Pod créé (~3s selon le diagramme du mémoire, à ne citer QUE si mesuré) → trafic → 60s sans trafic → scale-to-zero.
3. **Event-driven (Kafka + Knative Eventing)** : Producer → Kafka Topic (Strimzi, `my-cluster`, port 9092) → KafkaSource (lit le topic → CloudEvent) → Broker (InMemoryChannel) → Trigger (filtre) → HTTP POST → Knative Service cible.
4. **Sécurité utilisateur** : User → Keycloak → JWT → Spring Security (`oauth2-resource-server`, `issuer-uri`) → rôle (`ADMIN`/`CLIENT_ADMIN`/`DEVELOPER`) → endpoint.
5. **Multi-tenancy** : Namespace dédié par tenant (`user-<tenant>` observé en usage réel, ex. `user-user`) + Cilium (CNI + NetworkPolicy) pour l'isolation réseau.
6. **CI/CD** : GitHub → Jenkins (4 pipelines distincts : admin, backend, frontend, microservices) → Build/Test → Docker build → Docker Hub → déploiement Kubernetes.
7. **Paiement** : Stripe → Webhook HTTP → contrôleur paiement → vérification signature webhook Stripe (pas de JWT sur ce endpoint) → traitement.
8. **Monitoring** : Backend expose des métriques via Actuator/Micrometer → Prometheus scrape → Grafana (visualisation) — confirmer présence de Grafana/Alertmanager dans le repo avant de l'affirmer en slide.

## H. Diagrammes déjà réalisés dans le mémoire — à RÉUTILISER (ne pas redessiner)

Trouvés dans `memoire_migre/image/` et `memoire_migre/Images/` :
- `physiquearchitecture.png`, `Images/architecturePhy.PNG` — architecture physique cluster
- `logique.png`, `Images/archictureLogique.PNG` — architecture logique
- `kafka_strimzi_architecture.png` — architecture Kafka/Strimzi
- `knative_architecture.png` — architecture Knative
- `seq-eventing-trigger.png`, `sequence_eventing.png`, `uc_kafka_eventing.png` — séquence/flux eventing
- `cilium_isolation.png`, `cilium_isolation1.png`, `isolation_reseau.png` — isolation réseau multi-tenant
- `capture_eventing_broker.png`, `capture_eventing_kafkasource.png`, `capture_eventing_trigger.png` — captures réelles CRDs Knative Eventing
- `capture_kafka_cluster.png`, `capture_kafka_pods.png`, `capture_kafka_svc.png`, `kafka_topics.png` — captures réelles Kafka
- `backend_kafka_adminclient.png` — rôle du Kafka AdminClient côté backend
- `arch_logique_chatBot.png` — à ignorer (semble être un résidu d'un autre projet/template, à vérifier avant usage — NE PAS l'utiliser sans confirmation, le nom suggère un chatbot qui n'a pas de lien évident avec PlatformServerless)

**Règle : pour toute slide d'architecture dans le pptx, réutiliser une capture/version simplifiée fidèle de ces fichiers plutôt que d'en inventer une nouvelle.**

## I. Captures d'application à intégrer (Réalisation/Démonstration) — à sélectionner par l'utilisateur

La présentation actuelle n'a AUCUNE capture d'écran de l'application. Écrans à demander/capturer (priorité haute) :
1. Login / authentification Keycloak
2. Dashboard vue globale (client)
3. Formulaire de déploiement d'app (le fameux "App Name" + "Docker Image")
4. Liste des applications déployées
5. Détail d'une application (logs, métriques, statut)
6. Gestion des topics Kafka
7. Eventing (KafkaSource/Broker/Trigger dans l'UI si exposé)
8. Monitoring (CPU/RAM par app)
9. Admin console — gestion utilisateurs/équipe
10. Billing/facturation

## J. Structure de slides proposée (26 slides, priorités indiquées)

Reprend le plan détaillé fourni par l'utilisateur (section 7 de son brief), validé et corrigé point par point :

1. **Cover** — HIGH — "PlatformServerless", logos ESPRIT + Next Step, encadrants (Arafet Ben Kilani / Ines Chouchane), Adel Bettaieb, 2025-2026.
2. **Phrase forte** — HIGH — "Déployer une application conteneurisée sans gérer directement Kubernetes."
3. **Le problème** — HIGH — reprendre les 5 problématiques déjà écrites (slide 4 actuelle), déjà bonnes, juste redesign visuel.
4. **Solutions existantes (Vercel/Heroku/EKS)** — MEDIUM — contenu déjà bon (slide 5 actuelle), reformater en comparaison visuelle.
5. **Notre réponse** — HIGH — solution proposée (slide 6 actuelle), redesign.
6. **Timeline Releases/Sprints** — MEDIUM — à construire à partir de chapitre1-4.tex (Infrastructure → Serverless → Event-driven → Sécurité → Billing → Admin → CI/CD → Validation).
7. **Architecture globale (logique)** — HIGH — réutiliser `logique.png`/`archictureLogique.PNG`, simplifié.
8. **Architecture physique** — HIGH — réutiliser `physiquearchitecture.png`.
9. **Workflow déploiement d'une app** — HIGH (priorité 1 du brief) — utiliser workflow G.1.
10. **Rôle de Fabric8** — HIGH — nouveau, absent actuellement.
11. **Serverless / Knative Serving** — HIGH (priorité 2) — workflow G.2, scale-to-zero SANS chiffre de cold start non mesuré.
12. **Isolation multi-tenant** — HIGH (priorité 5) — namespace par tenant + Cilium, sans survendre Cilium comme "proxy HTTP".
13. **Event-driven Kafka + Knative Eventing** — HIGH (priorité 3) — réutiliser `kafka_strimzi_architecture.png`/`knative_architecture.png`.
14. **Exemple concret d'événement** — MEDIUM — à construire avec un vrai topic du projet (ex. les topics testés cette session : `order-created-topic`, `payment-result-topic`, etc. si utilisés comme exemple pédagogique — préciser qu'il s'agit d'un scénario de test, pas d'une fonctionnalité livrée en production).
15. **CloudEvents** — MEDIUM — contrat HTTP entre Kafka et l'app cible, exemple JSON court UNIQUEMENT si trouvé réellement dans les logs/code.
16. **Sécurité (JWT/Keycloak/rôles)** — HIGH (priorité 4) — rôles corrigés : ADMIN / CLIENT_ADMIN / DEVELOPER (pas MEMBER).
17. **Sécurité M2M (CI/CD)** — MEDIUM — à vérifier dans le code avant affirmation (chercher `ApiKeyFilter` ou équivalent).
18. **Observabilité** — MEDIUM — Actuator/Micrometer/Prometheus confirmés ; Grafana/Alertmanager à confirmer avant de les afficher.
19. **Facturation à l'usage** — MEDIUM (priorité 7) — BillingScheduler/snapshot, déjà dans le diagramme de classes actuel (`BillingSnapshot`).
20. **Paiement Stripe** — MEDIUM — nouveau, webhook + signature, absent actuellement mais confirmé dans le code.
21. **CI/CD** — HIGH (priorité 8) — 4 pipelines Jenkins réels, bon point différenciant (contrairement à l'inspiration où c'est un simple POC local).
22. **Ce qui se passe après un push** — LOW — optionnel, peut fusionner avec 21 si le temps de soutenance est limité.
23. **Architecture backend (organisation du code)** — MEDIUM — services vus dans le diagramme de classes (AppService, KafkaService, EventingService, MetricsService, UserService...).
24. **Démonstration — portail client** — HIGH — captures réelles (voir I).
25. **Démonstration — eventing/monitoring/admin** — HIGH — captures réelles.
26. **Validation, limites, perspectives + conclusion** — HIGH — inclure explicitement la limite Postgres/Knative confirmée cette session, distinguer IMPLÉMENTÉ/VALIDÉ/LIMITE/PERSPECTIVE, puis "Merci pour votre attention".

---

## Prochaine étape

Cette analyse est prête à servir de base pour reconstruire le .pptx (ou un jeu de slides HTML/Markdown intermédiaire). Reste à trancher avant la génération finale :
1. Confirmer/écarter les points "à vérifier" ci-dessus (Grafana/Alertmanager réels, ApiKeyFilter, MetalLB/Kourier rôle exact) par une recherche rapide dans le code si besoin.
2. Fournir les captures d'écran listées en I.
3. Décider du format de sortie (.pptx direct vs. slides HTML à exporter).
