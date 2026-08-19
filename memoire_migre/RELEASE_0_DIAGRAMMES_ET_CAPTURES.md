 # Chapitre III (Release 0) — Diagrammes à produire + commandes pour les captures réelles

Ce fichier regroupe les deux choses demandées : (1) le descriptif précis des 9 diagrammes déjà référencés en placeholder dans `chapitre1.tex`, et (2) les commandes `kubectl` exactes à exécuter **toi-même sur le cluster réel** (je n'ai pas accès direct à ton cluster) pour obtenir de vraies captures d'écran à intégrer ensuite.

---

## PARTIE 1 — Les 9 diagrammes à produire (dans `image/`)

### 1. `cluster_topology.png` — Architecture du cluster Kubernetes
**Contenu** : 3 rectangles `<<device>>` (vm01, vm02, vm03). vm01 étiqueté "control-plane", vm02/vm03 étiquetés "worker". Sous vm02/vm03, deux zones logiques : namespace `platform` (backend, 2 frontends, PostgreSQL, Keycloak) et un ou deux namespaces `user-<tenant>` (répétés en pointillé "2..N"). Format proche de `diagrammes/architecture_physique.png` déjà produit pour le Chapitre II, mais **plus simple** (pas besoin de refaire Kafka/Cilium/MetalLB en détail ici, juste la topologie nœuds + namespaces).

### 2. `cilium_isolation.png` — Isolation réseau Cilium/NetworkPolicy
**Contenu** : deux namespaces tenants côte à côte ("Tenant A", "Tenant B"), chacun avec ses Pods. Une flèche en X (trafic interdit) entre les deux. À côté, dessiner les flux **autorisés** réels (tirés du code, section III.2.5 du chapitre) : flèches entrantes depuis `kourier-system`, `knative-serving`, `monitoring` vers un tenant ; flèches sortantes vers `kube-system` (DNS), `kafka`, `knative-serving`, `kourier-system`. Légende : "NetworkPolicy default-deny + règles explicites".

### 3. `metallb_flux.png` — Flux MetalLB
**Contenu** : Client externe → Internet → IP externe (attribuée par MetalLB) → Service Kubernetes (type LoadBalancer, en pratique Kourier) → Pods. Schéma linéaire simple, 4-5 boîtes avec flèches.

### 4. `knative_architecture.png` — Cycle de vie Knative
**Contenu** : Image Docker → Knative Service → Revision → Autoscaler, qui se ramifie en deux chemins : "Instance(s) actives" (si trafic) et "0 instance / scale-to-zero" (si inactivité), avec une flèche de retour de "0 instance" vers "Autoscaler" pour montrer le réveil sur nouvelle requête.

### 5. `backend_knative_integration.png` — Chaîne Backend → Knative
**Contenu** : Backend Spring Boot → KnativeService → Fabric8 (`genericKubernetesResources`) → API Kubernetes → ressource Knative Service → Revision/Pod. Chaîne linéaire à 6 boîtes.

### 6. `tenant_workflow.png` — Du premier déploiement à l'application disponible
**Contenu** : séquence verticale : Premier déploiement → Création namespace tenant (`ensureNamespaceExists`) → Création NetworkPolicy (`ensureNetworkPolicyExists`) → Création Knative Service (`deploy`) → Création Revision → Application disponible.

### 7. `kafka_strimzi_architecture.png` — Kubernetes / Strimzi / Kafka
**Contenu** : Kubernetes → Strimzi (opérateur) → Kafka Cluster (`my-cluster`, namespace `kafka`) → Topics (2-3 boîtes "Topic A", "Topic B" à titre illustratif, sans préciser de nombre de brokers).

### 8. `backend_kafka_adminclient.png` — Chaîne Backend → Kafka
**Contenu** : Backend Spring Boot → KafkaService → AdminClient (Kafka natif) → Kafka API → cluster Kafka (`my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092`), avec 3 opérations listées à côté : create topic / list topics / delete topic.

### 9. `release0_synthese.png` — Synthèse visuelle de la Release 0
**Contenu** : "RELEASE 0" en haut, se ramifiant en 3 colonnes (Sprint 0 / Sprint 1 / Sprint 2), chacune listant ses briques (Sprint 0 : Kubernetes, Cilium, MetalLB, Kourier ; Sprint 1 : Knative Serving, Serverless, Scale-to-zero ; Sprint 2 : Kafka, Strimzi, Topics, AdminClient), qui convergent vers "SOCLE CLOUD NATIVE" puis vers "Release 1".

---

## PARTIE 2 — Commandes à exécuter toi-même sur le cluster pour les vraies captures

Je n'exécute jamais de commande directement sur ton cluster — voici les commandes exactes à lancer via `kubectl` (depuis `sysadmin@vm01` ou ton poste configuré avec le bon `kubeconfig`), avec ce qu'il faut vérifier dans le résultat avant de faire la capture d'écran.

### Sprint 0 — Infrastructure Kubernetes

```bash
# 1. Les 3 nœuds, tous à l'état Ready
kubectl get nodes -o wide
# Attendu : vm01 (control-plane), vm02, vm03, tous "Ready"

# 2. Les namespaces (platform + tenants créés dynamiquement)
kubectl get namespaces
# Attendu : platform, kafka, knative-serving, kourier-system, monitoring, + un namespace par tenant ayant déjà déployé une app

# 3. Les NetworkPolicy appliquées (une par namespace tenant)
kubectl get networkpolicy -A
# Attendu : une entrée par namespace "user-<tenant>"

# 4. Détail d'une NetworkPolicy précise (pour montrer les règles réelles décrites au Sprint 0)
kubectl describe networkpolicy -n <un-namespace-tenant>

# 5. Confirmation Cilium actif comme CNI
kubectl get pods -n kube-system -l k8s-app=cilium

# 6. Confirmation MetalLB actif
kubectl get pods -n metallb-system
kubectl get ipaddresspool -n metallb-system   # si CRD MetalLB installée en v0.13+
```
→ Suggestions de noms de fichiers si tu veux les ajouter au mémoire : `capture_kubectl_get_nodes.png`, `capture_kubectl_get_ns.png`, `capture_kubectl_networkpolicy.png`.

### Sprint 1 — Knative Serving

```bash
# 7. Tous les services Knative et leur état READY
kubectl get ksvc -A

# 8. Détail d'un service Knative précis (pour vérifier minScale/maxScale, image, etc.)
kubectl describe ksvc <nom-du-service> -n <namespace-tenant>

# 9. Les révisions d'un service (pour illustrer Service → Revision)
kubectl get revisions -n <namespace-tenant>

# 10. Les pods d'une application, pour observer le scale-to-zero en direct
#     (lance-la deux fois à quelques minutes d'intervalle sans trafic entre les deux)
kubectl get pods -n <namespace-tenant> -l serving.knative.dev/service=<nom-du-service>
# Attendu la 1ère fois : 0 ou 1 pod (selon trafic récent)
# Attendu après une période sans trafic : 0 pod (scale-to-zero)

# 11. Kourier actif comme passerelle
kubectl get pods -n kourier-system
kubectl get svc -n kourier-system
```
→ Suggestions de noms : `capture_kubectl_get_ksvc.png`, `capture_scale_to_zero_avant.png` / `capture_scale_to_zero_apres.png` (les deux captures espacées dans le temps prouvent le scale-to-zero, c'est la preuve la plus convaincante pour un jury).

### Sprint 2 — Kafka et Strimzi

```bash
# 12. Confirmation du cluster Kafka Strimzi et de son nom réel
kubectl get kafka -n kafka
# Attendu : une ressource nommée "my-cluster" (déjà déduit du code, à confirmer ici)

# 13. Les pods Kafka (courtiers, ZooKeeper ou KRaft selon la version de Strimzi)
kubectl get pods -n kafka

# 14. Les topics créés par les clients via l'AdminClient du backend
#     (si les topics sont aussi exposés comme CRD par Strimzi, sinon utiliser un client Kafka CLI)
kubectl get kafkatopic -n kafka 2>/dev/null || echo "Pas de CRD KafkaTopic exposée — topics gérés uniquement via AdminClient applicatif"

# 15. Lister les topics directement via le protocole Kafka (preuve la plus fidèle au code réel)
kubectl exec -it -n kafka my-cluster-kafka-0 -- bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```
→ Suggestions de noms : `capture_kubectl_get_kafka.png`, `capture_kafka_topics_list.png`.

### Bonus — preuve côté backend (au lieu du terminal, capture Postman ou logs applicatifs)

```bash
# Logs du backend au moment de la création d'un topic (montre l'appel AdminClient)
kubectl logs -n platform -l app=backend-api --tail=100 | grep -i kafka
```

---

## Ce que je te recommande de prioriser (si tu n'as pas le temps de tout capturer)

1. `kubectl get nodes` — rapide, prouve la topologie 3 nœuds.
2. Les deux captures **avant/après** du scale-to-zero — la preuve la plus parlante pour un jury, spécifique à Knative.
3. `kubectl get kafka -n kafka` + liste des topics — confirme Strimzi et corrige/valide définitivement la section III.4.

Une fois que tu as ces captures, dis-le-moi et je les intègre dans `chapitre1.tex` à la place des explications textuelles actuelles sur l'absence de capture.
