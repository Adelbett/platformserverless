# Chapitre III (Release 0) — Description détaillée des 9 figures à créer

Pour chaque figure : objectif, éléments exacts à dessiner (boîtes, texte, flèches avec leurs libellés), style recommandé, et le fichier exact où la déposer. Tout est tiré du texte déjà rédigé dans `chapitre1.tex` et du code vérifié — rien n'est à inventer, il suffit de le mettre en forme visuelle.

---

## 1. `image/cluster_topology.png` — Architecture du cluster Kubernetes

**Où elle apparaît** : Sprint 0, section "Architecture du cluster de la plateforme", figure~\ref{fig:cluster-topology}.

**Objectif** : montrer la topologie physique à 3 nœuds et la séparation logique platform/tenants.

**Éléments à dessiner** :
- Un grand rectangle englobant intitulé **"Cluster Kubernetes"**.
- À l'intérieur, 3 rectangles côte à côte représentant les nœuds (notation UML `<<device>>`, coin supérieur légèrement replié pour évoquer une machine physique/VM) :
  - **vm01** — étiquette sous le nom : *"control-plane"*
  - **vm02** — étiquette : *"worker"*
  - **vm03** — étiquette : *"worker"*
- Sous/à travers vm02 et vm03 (les workers hébergent les charges applicatives, pas vm01), deux zones en pointillés :
  - Zone **"Namespace : platform"** contenant 4 petites boîtes : `backend-api`, `web-portal`, `admin-console`, `PostgreSQL` + `Keycloak` (peuvent être groupés en une 5e boîte "Keycloak").
  - Zone **"Namespace : user-\<tenant\>"** (dessiner 2 exemplaires côte à côte pour montrer la réplication, avec le 2e étiqueté juste "..." ou "Namespace tenant 2") contenant une boîte "Application(s) du client".
- Une flèche bidirectionnelle simple entre vm01 et chacun des workers, étiquetée **"API Kubernetes"**.

**Style** : couleur bleue pour la zone `platform`, verte pour les zones tenants (cohérent avec les diagrammes déjà faits au Chapitre II). Format paysage, largeur cible 13 cm dans le document.

---

## 2. `image/cilium_isolation.png` — Isolation réseau Cilium / NetworkPolicy

**Où elle apparaît** : Sprint 0, section CNI/Cilium, figure~\ref{fig:cilium-isolation}.

**Objectif** : montrer concrètement quels flux sont autorisés et lesquels sont bloqués entre tenants — avec les vrais noms de namespaces tirés du code.

**Éléments à dessiner** :
- Deux rectangles côte à côte : **"Tenant A"** et **"Tenant B"**, chacun avec une icône Pod à l'intérieur.
- Une flèche entre les deux, barrée d'un **X rouge**, étiquetée **"trafic interdit (default-deny)"**.
- Sur le côté (par exemple au-dessus de "Tenant A"), dessiner 3 flèches **entrantes** avec leur origine, étiquetées :
  - depuis **`kourier-system`** → "ingress : routage public"
  - depuis **`knative-serving`** → "ingress : sondes/contrôle Knative"
  - depuis **`monitoring`** → "ingress : scraping Prometheus"
- En dessous, dessiner 4 flèches **sortantes** avec leur destination :
  - vers **`kube-system`** (port 53 UDP/TCP) → "egress : DNS"
  - vers **`kafka`** → "egress : bus d'événements"
  - vers **`knative-serving`** → "egress"
  - vers **`kourier-system`** → "egress"
- Légende en bas : *"NetworkPolicy default-deny + règles explicites (Cilium)"*.

**Style** : rouge/orange pour le X interdit, vert pour les flèches autorisées. C'est le diagramme le plus riche en information textuelle des 9 — privilégier la lisibilité à l'esthétique.

---

## 3. `image/metallb_flux.png` — Flux d'attribution d'IP externe via MetalLB

**Où elle apparaît** : Sprint 0, section MetalLB, figure~\ref{fig:metallb-flux}.

**Objectif** : schéma simple et linéaire.

**Éléments à dessiner** (de haut en bas ou de gauche à droite, 5 boîtes reliées par des flèches) :
1. **"Client externe"** (icône navigateur/utilisateur)
2. flèche vers → **"Internet"**
3. flèche vers → **"IP externe"** (attribuée par MetalLB — écrire "attribuée par MetalLB" en légende sur la flèche précédente)
4. flèche vers → **"Service Kubernetes (LoadBalancer)"**
5. flèche vers → **"Pods (Kourier)"**

**Style** : schéma minimaliste, une seule ligne de boîtes, pas de couleur complexe nécessaire.

---

## 4. `image/knative_architecture.png` — Cycle de vie d'un service Knative

**Où elle apparaît** : Sprint 1, figure~\ref{fig:knative-architecture}.

**Objectif** : expliquer visuellement image → service → autoscaling → scale-to-zero.

**Éléments à dessiner** (flux vertical) :
1. **"Image Docker"** (icône conteneur)
2. flèche vers → **"Knative Service"**
3. flèche vers → **"Revision"**
4. flèche vers → **"Autoscaler"**
5. À partir de "Autoscaler", **deux flèches qui se séparent** :
   - une vers **"Instance(s) actives"** (dessiner 1 à 3 petites icônes Pod), étiquetée *"si trafic"*
   - une vers **"0 instance"**, étiquetée *"si inactivité"*, avec un pictogramme "scale-to-zero"
6. Une flèche de **retour** de "0 instance" vers "Autoscaler", étiquetée **"nouvelle requête → réveil"**, formant une boucle visuelle.

**Style** : c'est le diagramme le plus important pédagogiquement — privilégier des couleurs contrastées entre l'état "actif" (vert) et l'état "zéro" (gris), avec la flèche de boucle bien visible pour montrer le caractère dynamique.

---

## 5. `image/backend_knative_integration.png` — Chaîne Backend → Fabric8 → Knative

**Où elle apparaît** : Sprint 1, section Fabric8, figure~\ref{fig:backend-knative-integration}.

**Objectif** : chaîne d'appel technique, linéaire.

**Éléments à dessiner** (6 boîtes en chaîne horizontale ou verticale) :
1. **"Backend Spring Boot"**
2. flèche vers → **"KnativeService"**
3. flèche vers → **"Fabric8 (genericKubernetesResources)"**
4. flèche vers → **"API Kubernetes"**
5. flèche vers → **"Ressource Knative Service"**
6. flèche vers → **"Revision / Pod"**

**Style** : simple chaîne, une couleur uniforme, éventuellement une petite icône Java/Spring sur la première boîte et une icône Kubernetes sur la 4e/5e.

---

## 6. `image/tenant_workflow.png` — Du premier déploiement à l'application disponible

**Où elle apparaît** : Sprint 1, figure~\ref{fig:tenant-workflow}.

**Objectif** : séquence d'étapes verticale, avec le nom de la méthode Java responsable de chaque étape.

**Éléments à dessiner** (6 étapes verticales reliées par des flèches descendantes) :
1. **"Premier déploiement"**
2. → **"Création namespace tenant"** *(méthode : `ensureNamespaceExists`)*
3. → **"Création NetworkPolicy"** *(méthode : `ensureNetworkPolicyExists`)*
4. → **"Création Knative Service"** *(méthode : `deploy(...)`)*
5. → **"Création Revision"**
6. → **"Application disponible"**

**Style** : diagramme d'activité simple, une flèche = un enchaînement séquentiel, annoter chaque boîte avec le nom de méthode entre parenthèses en petit texte italique.

---

## 7. `image/kafka_strimzi_architecture.png` — Kubernetes / Strimzi / Kafka

**Où elle apparaît** : Sprint 2, figure~\ref{fig:kafka-strimzi}.

**Objectif** : clarifier visuellement que Strimzi ≠ Kafka.

**Éléments à dessiner** (chaîne verticale) :
1. **"Kubernetes"**
2. flèche vers → **"Strimzi (opérateur)"** — ajouter une note à côté : *"gère/administre"*
3. flèche vers → **"Kafka Cluster : my-cluster"** (namespace **`kafka`**, à indiquer explicitement dans la boîte ou en légende)
4. flèche vers → **"Topics"** (dessiner 2 petites boîtes "Topic A" / "Topic B" à titre illustratif, sans donner de nombre réel de brokers)

**Style** : mettre "Strimzi" visuellement "au milieu/en dessous" de Kubernetes pour bien montrer qu'il est un intermédiaire logiciel, pas Kafka lui-même. Ne pas fusionner "Strimzi" et "Kafka Cluster" dans la même boîte — c'est précisément la distinction pédagogique à faire ressortir.

---

## 8. `image/backend_kafka_adminclient.png` — Chaîne Backend → AdminClient → Kafka

**Où elle apparaît** : Sprint 2, section AdminClient, figure~\ref{fig:backend-kafka-adminclient}.

**Objectif** : chaîne d'appel technique **différente** de la figure 5 (Knative) — bien montrer qu'il n'y a **pas** de passage par l'API Kubernetes ici.

**Éléments à dessiner** (chaîne horizontale ou verticale) :
1. **"Backend Spring Boot"**
2. flèche vers → **"KafkaService"**
3. flèche vers → **"AdminClient (Kafka natif)"**
4. flèche vers → **"Kafka API"** *(pas "API Kubernetes" — c'est le point important à ne pas confondre avec la figure 5)*
5. flèche vers → **"Cluster Kafka (my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092)"**
6. À côté de la boîte finale, lister les 3 opérations possibles : **"create topic"**, **"list topics"**, **"delete topic"**.

**Style** : utiliser une couleur différente de la figure 5 (par exemple orange au lieu de bleu) pour signaler visuellement, même sans lire le texte, qu'il s'agit d'un mécanisme différent.

---

## 9. `image/release0_synthese.png` — Synthèse visuelle de la Release 0

**Où elle apparaît** : fin du chapitre, section "Synthèse de la Release 0", figure~\ref{fig:release0-synthese}. C'est la conclusion graphique du chapitre.

**Objectif** : vue d'ensemble en un coup d'œil des 3 sprints et de ce que chacun a livré.

**Éléments à dessiner** :
1. Titre en haut : **"RELEASE 0"**
2. 3 branches descendantes vers 3 colonnes :
   - **Sprint 0** : Kubernetes, Cilium, MetalLB, Kourier
   - **Sprint 1** : Knative Serving, Serverless, Scale-to-zero
   - **Sprint 2** : Kafka, Strimzi, Topics, AdminClient
3. Les 3 colonnes convergent vers une boîte unique en bas : **"SOCLE CLOUD NATIVE"**
4. Une dernière flèche vers : **"Release 1"**

**Style** : c'est un diagramme de synthèse, pas un diagramme technique — privilégier un rendu propre et équilibré (3 colonnes de même largeur), avec une couleur par sprint (reprendre les mêmes couleurs que les figures 1-3 pour Sprint 0, 4-6 pour Sprint 1, 7-8 pour Sprint 2, si tu veux une cohérence visuelle sur tout le chapitre).

---

## Rappel pratique
- Toutes ces figures sont des **diagrammes conceptuels**, pas des captures d'écran (voir message précédent).
- Format recommandé : paysage, exporté en `.png`, largeur suffisante pour rester lisible une fois réduit à ~12-13 cm dans le document.
- Une fois produites, il suffit de remplacer les fichiers placeholder existants **au même chemin exact** (`image/cluster_topology.png`, etc.) — aucune modification du `.tex` n'est nécessaire.
