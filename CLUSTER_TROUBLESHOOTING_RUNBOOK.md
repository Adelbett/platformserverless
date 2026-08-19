# PlatformServerless — Cluster & Cloud Native Troubleshooting Runbook

> **Version :** 2026-07-25  
> **Projet :** PlatformServerless  
> **Cluster :** Kubernetes on-premise — vm01 (control-plane) / vm02 / vm03

---

## Table des matières

1. [Objectif du document](#1-objectif-du-document)
2. [Architecture de référence](#2-architecture-de-référence)
3. [Règles avant toute intervention](#3-règles-avant-toute-intervention)
4. [Préparation du diagnostic — Checklist initiale](#4-préparation-du-diagnostic--checklist-initiale)
5. [Kubernetes — Nœuds, Pods, Events](#5-kubernetes--nœuds-pods-events)
6. [Namespaces et RBAC](#6-namespaces-et-rbac)
7. [Cilium — Réseau et NetworkPolicy](#7-cilium--réseau-et-networkpolicy)
8. [MetalLB — Load Balancer on-premise](#8-metallb--load-balancer-on-premise)
9. [Kourier — Ingress Knative](#9-kourier--ingress-knative)
10. [Knative Serving — Services, Révisions, Autoscaling](#10-knative-serving--services-révisions-autoscaling)
11. [Knative Eventing — Broker, Trigger, KafkaSource](#11-knative-eventing--broker-trigger-kafkasource)
12. [Kafka et Strimzi](#12-kafka-et-strimzi)
13. [Applications déployées — Diagnostic](#13-applications-déployées--diagnostic)
14. [Logs des pods applicatifs](#14-logs-des-pods-applicatifs)
15. [Backend API — Diagnostic](#15-backend-api--diagnostic)
16. [Monitoring — Prometheus et Alertmanager](#16-monitoring--prometheus-et-alertmanager)
17. [CI/CD Jenkins — Diagnostic](#17-cicd-jenkins--diagnostic)
18. [PostgreSQL](#18-postgresql)
19. [Problèmes connus et solutions](#19-problèmes-connus-et-solutions)
20. [Référence rapide — Commandes essentielles](#20-référence-rapide--commandes-essentielles)

---

## 1. Objectif du document

Ce runbook est le guide opérationnel de référence pour diagnostiquer et résoudre les incidents sur l'infrastructure Cloud Native de **PlatformServerless**.

Il couvre l'intégralité de la stack :

- **Kubernetes** (orchestration)
- **Cilium** (CNI, isolation réseau)
- **MetalLB** (LoadBalancer bare-metal)
- **Kourier** (Ingress Knative)
- **Knative Serving** (déploiement serverless, autoscaling)
- **Knative Eventing** (Broker, Trigger, KafkaSource)
- **Apache Kafka / Strimzi** (messaging événementiel)
- **Backend Spring Boot** (plateforme API)
- **Jenkins / Kaniko** (CI/CD)
- **Prometheus / Alertmanager** (monitoring)
- **PostgreSQL** (base de données)

Ce document est basé sur les fichiers réels du projet : manifests YAML, code backend, documentation technique existante, et incidents rencontrés.

---

## 2. Architecture de référence

```
Utilisateur (navigateur / API Key)
        │
        ▼
   MetalLB (10.9.21.230–235)
        │
        ▼
   Kourier (Ingress Knative)
        │
        ▼
   Knative Serving (KService)
        │
        ▼
   Pod applicatif (user-container + queue-proxy)
        │
        ▼
   Namespace tenant (user-{userId})
        │
   NetworkPolicy Cilium (isolation inter-tenants)

Composants associés :
  ┌─────────────────────────────────┐
  │ Knative Eventing                │
  │   Broker → Trigger → Subscriber│
  │   KafkaSource → Broker          │
  ├─────────────────────────────────┤
  │ Kafka / Strimzi                 │
  │   my-cluster (namespace kafka)  │
  ├─────────────────────────────────┤
  │ Backend API (namespace platform)│
  │   Spring Boot + Fabric8         │
  ├─────────────────────────────────┤
  │ PostgreSQL (namespace platform) │
  ├─────────────────────────────────┤
  │ Prometheus + Alertmanager       │
  │   (namespace monitoring)        │
  └─────────────────────────────────┘
```

**Namespaces du cluster :**

| Namespace | Contenu |
|-----------|---------|
| `platform` | backend-api, postgres, keycloak, frontend, admin |
| `jenkins` | Jenkins CI/CD |
| `kafka` | Strimzi, brokers Kafka |
| `knative-serving` | Knative Serving (activator, controller, autoscaler) |
| `knative-eventing` | Knative Eventing (broker-ingress, broker-filter, imc-dispatcher) |
| `monitoring` | Prometheus, Alertmanager, Grafana |
| `metallb-system` | MetalLB |
| `kourier-system` | Kourier Ingress |
| `user-{userId}` | Namespaces tenants (un par utilisateur) |

---

## 3. Règles avant toute intervention

> **Lire cette section avant chaque intervention en production.**

### ✅ SAFE — Lecture seule (sans risque)

Ces commandes ne modifient rien. Toujours commencer par celles-ci.

```bash
kubectl get ...
kubectl describe ...
kubectl logs ...
kubectl get events ...
kubectl top pods/nodes
kubectl auth can-i ...
kubectl get -o yaml ...
kubectl get -o jsonpath ...
```

### ⚠️ MODIFICATION — Impact limité mais réversible

```bash
kubectl apply -f ...          # applique une config
kubectl patch ...             # modifie un champ
kubectl rollout restart ...   # rolling restart
kubectl set image ...         # nouvelle image
kubectl label ...             # ajout de label
```

> Toujours faire un `kubectl get -o yaml > backup.yaml` avant modification.

### 🔴 DESTRUCTIF — Irréversible ou à haut risque

```bash
kubectl delete pod/deployment/namespace ...
kubectl delete --all ...           # ⛔ INTERDIT sans confirmation
kubectl delete kafkatopic ...      # ⛔ supprime les données du topic
kubectl delete namespace user-xxx  # ⛔ supprime tout le tenant
kubectl delete pvc ...             # ⛔ supprime les données persistantes
```

> **Règle absolue :** ne jamais exécuter une commande destructive sans :
> 1. avoir vérifié les logs
> 2. avoir vérifié les events Kubernetes
> 3. avoir sauvegardé la configuration concernée
> 4. avoir confirmé que la ressource n'est pas en cours d'utilisation

### Checklist de sécurité pré-intervention

```bash
# Vérifier dans quel contexte on est
kubectl config current-context

# Vérifier le namespace par défaut du contexte
kubectl config view --minify | grep namespace

# Ne jamais utiliser --all sans filtrer le namespace
kubectl get pods -n <namespace-exact>   # ✅
kubectl get pods --all-namespaces       # ✅ lecture seulement
kubectl delete pods --all               # ⛔
```

---

## 4. Préparation du diagnostic — Checklist initiale

Avant tout diagnostic approfondi, exécuter ces commandes en séquence :

```bash
# 1. Contexte
kubectl config current-context
kubectl cluster-info

# 2. État des nœuds
kubectl get nodes -o wide

# 3. Namespaces actifs
kubectl get namespaces

# 4. Pods en anomalie (tout ce qui n'est pas Running/Completed)
kubectl get pods -A | grep -v -E "Running|Completed"

# 5. Services Knative non prêts
kubectl get ksvc -A | grep -v "True"

# 6. Brokers non prêts
kubectl get broker -A

# 7. Triggers non prêts
kubectl get trigger -A | grep -v "True"

# 8. KafkaSources non prêtes
kubectl get kafkasource -A | grep -v "True"

# 9. Derniers événements d'erreur
kubectl get events -A --sort-by='.lastTimestamp' | tail -20

# 10. Ressources consommées
kubectl top nodes
kubectl top pods -A
```

---

## 5. Kubernetes — Nœuds, Pods, Events

### 5.1 Nœuds

```bash
# État général des nœuds
kubectl get nodes -o wide

# Ressources allouées sur un nœud
kubectl describe node vm02 | grep -A 10 "Allocated resources"

# Ressources disponibles sur chaque nœud
kubectl describe nodes | grep -E "Name:|cpu:|memory:|Allocated"
```

**Interpréter les statuts :**

| Statut | Signification | Action |
|--------|---------------|--------|
| `Ready` | Nœud opérationnel | Aucune |
| `NotReady` | Kubelet ne répond plus | `ssh sysadmin@vmXX "sudo systemctl restart kubelet"` |
| `SchedulingDisabled` | Nœud cordonné | `kubectl uncordon vmXX` |

### 5.2 Pods

```bash
# Tous les pods, tous namespaces
kubectl get pods -A

# Pods d'un namespace précis avec plus de détails
kubectl get pods -n platform -o wide

# Détail complet d'un pod (événements, état des containers)
kubectl describe pod <nom-pod> -n <namespace>

# Pods avec labels (utile pour les pods Knative)
kubectl get pods -n user-hassan --show-labels

# Pods Knative uniquement
kubectl get pods -A -l "serving.knative.dev/service"

# Pods en erreur avec leur raison
kubectl get pods -A -o jsonpath='{range .items[?(@.status.phase!="Running")]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{.status.conditions[0].message}{"\n"}{end}'
```

**États des pods :**

| État | Cause probable | Diagnostic |
|------|----------------|------------|
| `Pending` | Ressources insuffisantes, PVC manquant, nodeSelector | `kubectl describe pod` → Events |
| `CrashLoopBackOff` | App qui plante au démarrage | `kubectl logs --previous` |
| `ImagePullBackOff` | Image introuvable ou credentials manquants | `kubectl describe pod` → Events |
| `CreateContainerError` | Problème de montage, snapshotter containerd | `kubectl describe pod` → Events |
| `OOMKilled` | Mémoire insuffisante | Augmenter `limits.memory` |
| `Terminating` | Pod bloqué à la suppression | `kubectl delete pod --force --grace-period=0` |

### 5.3 Events Kubernetes

```bash
# Events d'un namespace, triés par date
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Events d'échec uniquement
kubectl get events -n <namespace> --field-selector reason=Failed

# Derniers events de tous les namespaces
kubectl get events -A --sort-by='.lastTimestamp' | tail -30

# Events liés à un pod précis
kubectl get events -n <namespace> --field-selector involvedObject.name=<nom-pod>
```

---

## 6. Namespaces et RBAC

### 6.1 Namespaces

```bash
# Lister tous les namespaces
kubectl get namespaces

# Namespaces tenants uniquement
kubectl get namespaces | grep "user-"

# Vérifier les quotas d'un namespace tenant
kubectl get resourcequota -n user-hassan
kubectl describe resourcequota -n user-hassan
```

### 6.2 RBAC — Vérification des permissions

Le backend utilise le `ServiceAccount default` du namespace `platform` avec deux ClusterRoles :
- `platform-api-cluster-reader` (nodes, events)
- `platform-backend-role` (pods, services, ksvc, kafkasources, triggers, networkpolicies...)

```bash
# Vérifier le ServiceAccount du backend
kubectl get serviceaccount default -n platform -o yaml

# Vérifier les ClusterRoles
kubectl get clusterrole platform-backend-role -o yaml
kubectl get clusterrole platform-api-cluster-reader -o yaml

# Vérifier les ClusterRoleBindings
kubectl get clusterrolebinding platform-correct-binding -o yaml
kubectl get clusterrolebinding platform-api-cluster-reader -o yaml

# Tester une permission précise
kubectl auth can-i list pods \
  --as=system:serviceaccount:platform:default -n user-hassan

kubectl auth can-i create networkpolicies \
  --as=system:serviceaccount:platform:default -n user-hassan

kubectl auth can-i create kafkasources \
  --as=system:serviceaccount:platform:default \
  --subresource="" -n user-hassan

# Tester toutes les permissions d'un ServiceAccount
kubectl auth can-i --list \
  --as=system:serviceaccount:platform:default
```

> **Note projet :** Le RBAC a été audité (ticket 006). Deux permissions manquaient et ont été ajoutées : `persistentvolumeclaims` et `resourcequotas`. Si une fonctionnalité admin retourne silencieusement une liste vide, vérifier les permissions RBAC en premier.

---

## 7. Cilium — Réseau et NetworkPolicy

### 7.1 Diagnostic Cilium

> **Commande de diagnostic recommandée.**

```bash
# État général de Cilium
kubectl exec -n kube-system -l k8s-app=cilium -- cilium status

# Lister les endpoints Cilium
kubectl exec -n kube-system -l k8s-app=cilium -- cilium endpoint list

# Vérifier la connectivité entre deux pods
kubectl exec -n kube-system -l k8s-app=cilium -- \
  cilium connectivity test
```

### 7.2 NetworkPolicy

Le projet applique une NetworkPolicy sur chaque namespace tenant via `k8s/tenant/network-policy.yaml`. Cette policy est appliquée par le backend (`KnativeService.ensureNetworkPolicyExists()`).

**Règles appliquées par namespace tenant :**

| Trafic | Autorisé depuis/vers |
|--------|----------------------|
| Ingress | Pods du même namespace (intra-tenant) |
| Ingress | `kourier-system` (trafic HTTP entrant) |
| Ingress | `knative-serving` (health checks activator) |
| Ingress | `monitoring` (scraping Prometheus) |
| Egress | Pods du même namespace |
| Egress | `kube-system` port 53 (DNS) |
| Egress | Namespace `kafka` |
| Egress | `knative-serving` |
| Egress | `kourier-system` |

```bash
# Lister les NetworkPolicies de tous les namespaces
kubectl get networkpolicy -A

# Voir la NetworkPolicy d'un namespace tenant
kubectl get networkpolicy -n user-hassan -o yaml

# Voir le détail
kubectl describe networkpolicy tenant-default-isolation -n user-hassan
```

**Problème : pod ne peut pas communiquer avec Kafka**

```bash
# Vérifier que la NetworkPolicy autorise l'egress vers kafka
kubectl get networkpolicy -n user-hassan -o jsonpath='{.items[0].spec.egress}' | python3 -m json.tool

# Vérifier que le namespace kafka a bien le label attendu
kubectl get namespace kafka --show-labels
```

---

## 8. MetalLB — Load Balancer on-premise

MetalLB assigne des IPs externes aux Services de type `LoadBalancer` dans un cluster bare-metal.

**Plage d'IPs configurée dans le projet :** `10.9.21.230–235`

```bash
# Vérifier l'état de MetalLB
kubectl get pods -n metallb-system

# Vérifier les IPAddressPools
kubectl get ipaddresspool -n metallb-system
kubectl get ipaddresspool -n metallb-system -o yaml

# Vérifier les L2Advertisements
kubectl get l2advertisement -n metallb-system

# Voir les services avec leur IP externe assignée
kubectl get svc -A | grep LoadBalancer

# Vérifier l'IP de Kourier
kubectl get svc -n kourier-system
```

**Problème : service LoadBalancer reste en `<pending>`**

```bash
# Diagnostiquer pourquoi MetalLB n'assigne pas d'IP
kubectl describe svc <nom-service> -n <namespace>
kubectl get events -n metallb-system --sort-by='.lastTimestamp'
kubectl logs -n metallb-system -l component=controller --tail=30
```

Causes fréquentes :
- Toutes les IPs de la plage sont épuisées
- L2Advertisement manquante ou mal configurée
- Interface réseau non trouvée sur les nœuds

---

## 9. Kourier — Ingress Knative

Kourier est le composant réseau qui reçoit le trafic HTTP externe et le route vers les pods Knative.

```bash
# État des pods Kourier
kubectl get pods -n kourier-system

# Service Kourier (IP externe assignée par MetalLB)
kubectl get svc -n kourier-system

# Logs Kourier
kubectl logs -n kourier-system -l app=3scale-kourier-gateway --tail=30

# ConfigMap Kourier
kubectl get configmap -n knative-serving config-kourier -o yaml
```

**Problème : erreur 404 sur une URL d'application**

```bash
# Vérifier que le service Knative est Ready
kubectl get ksvc -A

# Vérifier que l'URL générée correspond à la requête
kubectl get ksvc <nom-service> -n <namespace> -o jsonpath='{.status.url}'

# Vérifier les règles de routage
kubectl get route -n <namespace>
```

---

## 10. Knative Serving — Services, Révisions, Autoscaling

### 10.1 Services Knative (KService)

```bash
# Lister tous les services Knative
kubectl get ksvc -A

# Détail d'un service Knative
kubectl describe ksvc <nom-service> -n <namespace>

# URL d'un service
kubectl get ksvc <nom-service> -n <namespace> -o jsonpath='{.status.url}'

# Statut détaillé (conditions Ready/ConfigurationsReady/RoutesReady)
kubectl get ksvc <nom-service> -n <namespace> -o yaml | grep -A 20 "conditions:"
```

**Interpréter les conditions :**

| Condition | Type | Signification |
|-----------|------|---------------|
| `Ready: True` | OK | Service opérationnel |
| `Ready: False` | Problème | Voir `message` dans le YAML |
| `ConfigurationsReady: False` | Problème de config | Mauvaise image ou port |
| `RoutesReady: False` | Problème de routage | Problème Kourier |

```bash
# Récupérer le message d'erreur exact (utilisé par le backend)
kubectl get ksvc <nom-service> -n <namespace> \
  -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'
```

> **Note projet :** Le backend expose ce message d'erreur via le champ `failureMessage` dans `AppResponse`. Il est récupéré par `KnativeService.getFailureMessage()` et affiché dans l'interface sous le badge `FAILED`.

### 10.2 Révisions

```bash
# Lister les révisions d'un service
kubectl get revisions -n <namespace>

# Révisions d'un service spécifique
kubectl get revisions -n <namespace> \
  -l "serving.knative.dev/service=<nom-service>"

# Détail d'une révision (raison d'échec, image, port)
kubectl describe revision <nom-revision> -n <namespace>

# Filtrer les informations importantes
kubectl describe revision <nom-revision> -n <namespace> \
  | grep -E "Message|Reason|Image|Port|Exit Code|State"
```

**Causes fréquentes d'échec d'une révision :**

| Erreur | Cause | Solution |
|--------|-------|----------|
| `ImagePullBackOff` | Image introuvable sur Docker Hub | Vérifier le tag de l'image |
| `CrashLoopBackOff` | App plante au démarrage | `kubectl logs --previous` |
| `ProgressDeadlineExceeded` | Pod ne démarre pas en temps imparti | `kubectl describe pod` |
| `port X is not listening` | App n'écoute pas sur le port déclaré | Vérifier le port dans le Dockerfile |

### 10.3 Scale-to-zero et Autoscaling

```bash
# Voir le nombre de pods actifs pour un service
kubectl get pods -n <namespace> -l "serving.knative.dev/service=<nom-service>"

# Voir la configuration d'autoscaling
kubectl get ksvc <nom-service> -n <namespace> \
  -o jsonpath='{.spec.template.metadata.annotations}'

# Voir l'état de l'autoscaler
kubectl get podautoscaler -n <namespace>

# Logs de l'autoscaler Knative
kubectl logs -n knative-serving -l app=autoscaler --tail=30

# Logs de l'activator (gère les requêtes pendant scale-to-zero)
kubectl logs -n knative-serving -l app=activator --tail=30
```

**Valeurs d'autoscaling dans le projet :**
- `minScale` : 0 (scale-to-zero activé)
- `maxScale` : 10 (configurable par déploiement)
- Annotation : `autoscaling.knative.dev/minScale` / `autoscaling.knative.dev/maxScale`

**Problème : app ne se réveille pas après scale-to-zero**

```bash
# Vérifier que l'activator est Running
kubectl get pods -n knative-serving -l app=activator

# Vérifier les logs de l'activator au moment de la requête
kubectl logs -n knative-serving -l app=activator -f

# Vérifier que le Broker peut contacter le pod (Knative Eventing)
kubectl logs -n knative-eventing -l app=mt-broker-ingress --tail=20
```

### 10.4 Logs des composants Knative Serving

```bash
# Activator (point d'entrée des requêtes en scale-to-zero)
kubectl logs -n knative-serving -l app=activator --tail=30

# Autoscaler
kubectl logs -n knative-serving -l app=autoscaler --tail=30

# Controller (gère la création/suppression des KServices)
kubectl logs -n knative-serving -l app=controller --tail=30

# Webhook (validation des ressources Knative)
kubectl logs -n knative-serving -l app=webhook --tail=30
```

---

## 11. Knative Eventing — Broker, Trigger, KafkaSource

### 11.1 Vue d'ensemble

```bash
# État complet de l'eventing
kubectl get broker -A
kubectl get trigger -A
kubectl get kafkasource -A
```

### 11.2 Broker

> **Architecture du projet :** chaque namespace tenant (`user-{userId}`) possède son propre Broker nommé `default`. Le Broker est créé automatiquement par `EventingService.ensureBrokerExists()` lors de la création d'une KafkaSource.

```bash
# Lister les Brokers (doit en avoir un par namespace tenant actif)
kubectl get broker -A

# Statut d'un Broker
kubectl get broker default -n user-hassan -o yaml \
  | grep -E "Ready|reason|message|channel|address"

# URL d'injection du Broker
kubectl get broker default -n user-hassan \
  -o jsonpath='{.status.address.url}'

# Logs broker-ingress (reçoit les CloudEvents)
kubectl logs -n knative-eventing -l app=mt-broker-ingress --tail=20

# Logs broker-filter (route vers les Triggers)
kubectl logs -n knative-eventing -l app=mt-broker-filter --tail=20
```

**Problème : Broker non Ready**

```bash
kubectl describe broker default -n user-hassan
kubectl get events -n user-hassan --sort-by='.lastTimestamp' | grep -i broker
```

### 11.3 Trigger

```bash
# Lister tous les Triggers
kubectl get trigger -A

# Détail d'un Trigger
kubectl describe trigger <nom-trigger> -n <namespace>

# Voir le filtre et l'abonné (subscriber)
kubectl get trigger <nom-trigger> -n <namespace> \
  -o jsonpath='{.spec}'
```

**Problème : Trigger non Ready**

```bash
# Vérifier que le Broker référencé existe dans le même namespace
kubectl get broker -n <namespace>

# Vérifier que l'URL subscriber est joignable
kubectl get ksvc -n <namespace>
```

> **Note projet :** Le webhook Knative rejette les Triggers dont le Broker n'est pas dans le même namespace. Le Trigger ET le Broker doivent être dans `user-{userId}`.

### 11.4 KafkaSource

```bash
# Lister les KafkaSources
kubectl get kafkasource -A

# Voir la configuration complète (topics, sink, bootstrap)
kubectl get kafkasource <nom> -n <namespace> -o yaml

# Topics écoutés
kubectl get kafkasource -n <namespace> \
  -o jsonpath='{.items[*].spec.topics}'

# Sink (doit pointer vers le Broker du même namespace)
kubectl get kafkasource <nom> -n <namespace> \
  -o jsonpath='{.spec.sink}'

# Logs du dispatcher KafkaSource
kubectl logs -n knative-eventing -l app=kafka-source-dispatcher --tail=30
# ou selon la version :
kubectl get pods -n knative-eventing | grep kafka
kubectl logs -n knative-eventing kafka-source-dispatcher-0 --tail=30
```

**Problème fréquent : KafkaSource bloquée en PENDING**

```bash
kubectl describe kafkasource <nom> -n <namespace>
```

Causes connues dans ce projet :

| Erreur | Cause | Solution |
|--------|-------|----------|
| `mismatched namespaces` | KafkaSource et Broker dans des namespaces différents | Broker doit être dans le même namespace que la KafkaSource |
| `sink not found` | Le Broker `default` n'existe pas dans le namespace | `ensureBrokerExists()` doit s'exécuter avant la création |
| `bootstrap server unreachable` | Kafka inaccessible | Vérifier `kafka` namespace |

> **Fix appliqué dans le projet (commit récent) :** `EventingService.createKnativeKafkaSource()` appelle maintenant `ensureBrokerExists(appNamespace)` avant de créer la KafkaSource, et le sink pointe vers `appNamespace` (pas `default`).

### 11.5 Logs des composants Knative Eventing

```bash
# Trouver les noms exacts des pods
kubectl get pods -n knative-eventing

# broker-ingress (reçoit les CloudEvents publiés)
kubectl logs -n knative-eventing \
  $(kubectl get pod -n knative-eventing -l app=mt-broker-ingress -o name | head -1) \
  --tail=30

# broker-filter (route selon les filtres des Triggers)
kubectl logs -n knative-eventing \
  $(kubectl get pod -n knative-eventing -l app=mt-broker-filter -o name | head -1) \
  --tail=30

# imc-dispatcher (InMemoryChannel dispatcher)
kubectl logs -n knative-eventing \
  $(kubectl get pod -n knative-eventing -l app=imc-dispatcher -o name | head -1) \
  --tail=20
```

---

## 12. Kafka et Strimzi

### 12.1 État du cluster Kafka

```bash
# Pods Kafka (Strimzi)
kubectl get pods -n kafka

# Cluster Kafka Strimzi
kubectl get kafka -n kafka
kubectl describe kafka my-cluster -n kafka

# Topics Strimzi CRD
kubectl get kafkatopic -n kafka
```

### 12.2 Opérations sur les topics (via kubectl exec)

> Ces commandes sont extraites de `docs/COMMANDES_DIAGNOSTIC.md`.

```bash
# Lister les topics
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Décrire un topic (partitions, réplication, offsets)
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic <nom-topic>

# Voir les consumer groups
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

# Voir le lag d'un consumer group
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group <nom-group>

# Produire un message de test
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic <nom-topic>

# Consommer des messages (depuis le début)
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic <nom-topic> \
  --from-beginning \
  --max-messages 10
```

**Bootstrap server interne au cluster :**

```
my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092
```

### 12.3 Logs Kafka/Strimzi

```bash
# Logs d'un broker Kafka
kubectl logs -n kafka my-cluster-kafka-0 --tail=50

# Logs Strimzi operator
kubectl logs -n kafka \
  $(kubectl get pod -n kafka -l name=strimzi-cluster-operator -o name | head -1) \
  --tail=30
```

### 12.4 AdminClient — Backend

> **Note projet :** La gestion des topics dans le backend (`KafkaService.java`) utilise l'**AdminClient Kafka Java**, PAS les CRD Strimzi. `KafkaTopic` en base de données est une entité JPA (`@Entity`, table `kafka_topics`), distincte des CRD Strimzi.

Si le backend ne peut pas créer un topic :

```bash
# Vérifier que le backend peut atteindre Kafka
kubectl exec -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) \
  -- curl -s telnet://my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092 || echo "unreachable"

# Logs backend filtrés sur Kafka
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) \
  --tail=50 | grep -iE "kafka|topic|AdminClient|bootstrap"
```

---

## 13. Applications déployées — Diagnostic

### 13.1 Trouver les pods d'une application

```bash
# Par namespace tenant et label Knative
kubectl get pods -n user-hassan \
  -l "serving.knative.dev/service=<nom-service>"

# Tous les pods d'un namespace tenant
kubectl get pods -n user-hassan -o wide

# Statut du service Knative correspondant
kubectl get ksvc -n user-hassan
```

### 13.2 Application en statut FAILED

```bash
# 1. Récupérer le message d'erreur Knative
kubectl get ksvc <nom-service> -n <namespace> \
  -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'

# 2. Voir la dernière révision
kubectl get revisions -n <namespace> \
  -l "serving.knative.dev/service=<nom-service>"

# 3. Décrire la révision
kubectl describe revision <nom-revision> -n <namespace>

# 4. Logs du pod si existant
kubectl logs -n <namespace> \
  -l "serving.knative.dev/service=<nom-service>" \
  -c user-container --tail=50
```

### 13.3 Vérifier le port d'une application

> Problème fréquent : l'application n'écoute pas sur le port déclaré.

```bash
# Vérifier sur quel port écoute réellement le container
kubectl exec <nom-pod> -n <namespace> -- netstat -tlnp
# ou si netstat n'est pas disponible :
kubectl exec <nom-pod> -n <namespace> -- ss -tlnp
```

### 13.4 Container Logs — pods multi-container

> **Note projet :** Les pods Knative ont TOUJOURS 2 containers : `user-container` (l'app) et `queue-proxy` (sidecar Knative). Il faut spécifier le container.

```bash
# Logs de l'application (container applicatif)
kubectl logs <nom-pod> -n <namespace> -c user-container

# Logs du queue-proxy (sidecar Knative — métriques, santé)
kubectl logs <nom-pod> -n <namespace> -c queue-proxy

# 100 dernières lignes de l'app
kubectl logs <nom-pod> -n <namespace> -c user-container --tail=100

# Suivi en temps réel
kubectl logs <nom-pod> -n <namespace> -c user-container -f

# Logs par label (sans connaître le nom exact du pod)
kubectl logs -n user-hassan \
  -l "serving.knative.dev/service=<nom-service>" \
  -c user-container --tail=30
```

> **Fix appliqué dans le projet :** `PodLogService.java` utilise `.inContainer("user-container")` explicitement pour éviter l'erreur Kubernetes sur les pods multi-container.

---

## 14. Logs des pods applicatifs

```bash
# Logs en temps réel
kubectl logs <nom-pod> -n <namespace> -f

# Dernières N lignes
kubectl logs <nom-pod> -n <namespace> --tail=100

# Depuis les dernières X heures
kubectl logs <nom-pod> -n <namespace> --since=2h

# Logs du container précédent (après un crash)
kubectl logs <nom-pod> -n <namespace> --previous

# Logs filtrés
kubectl logs <nom-pod> -n <namespace> --tail=100 \
  | grep -iE "ERROR|WARN|FATAL|Exception"

# Port-forward pour accéder localement à un service
kubectl port-forward svc/<nom-service> 8080:80 -n <namespace>
```

---

## 15. Backend API — Diagnostic

### 15.1 Trouver et accéder au pod backend

```bash
# Trouver le pod
kubectl get pods -n platform | grep backend

# Logs backend (erreurs)
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) \
  --tail=50 | grep -iE "ERROR|WARN|Exception"

# Logs en temps réel
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) -f

# Logs depuis 1 heure
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) --since=1h

# Logs filtrés sur l'eventing
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) \
  --tail=100 | grep -iE "kafka|eventing|broker|trigger|knative"
```

### 15.2 Vérifier la connectivité depuis le backend

```bash
# Entrer dans le pod backend
kubectl exec -it \
  $(kubectl get pod -n platform -l app=backend-api -o name | head -1) \
  -n platform -- /bin/sh

# Depuis le shell du pod :
# Tester DNS
nslookup my-cluster-kafka-bootstrap.kafka.svc.cluster.local
# Tester Keycloak
curl -s http://keycloak.platform.svc.cluster.local:8080/health
# Tester Kubernetes API
curl -sk https://kubernetes.default.svc.cluster.local/healthz
```

### 15.3 Crash-loop detection

Le backend détecte automatiquement les crash-loops toutes les 5 minutes via `CrashLoopScheduler`. Les seuils :

- `CRASH_LOOP_RESTART_THRESHOLD = 5` (redémarrages avant alerte)
- `CRASH_LOOP_ALERT_COOLDOWN_HOURS = 1` (anti-spam)

```bash
# Vérifier les pods en crash-loop
kubectl get pods -A | grep CrashLoop

# Voir le restart count
kubectl get pods -A -o wide | grep -v "0/\|1/1\|2/2"

# Logs de l'app en crash
kubectl logs <nom-pod> -n <namespace> -c user-container --previous
```

---

## 16. Monitoring — Prometheus et Alertmanager

### 16.1 Alertes actives

```bash
# Pods Prometheus/Alertmanager
kubectl get pods -n monitoring

# Port-forward Prometheus
kubectl port-forward svc/prometheus -n monitoring 9090:9090

# Port-forward Alertmanager
kubectl port-forward svc/alertmanager -n monitoring 9093:9093
```

**Alertes définies dans le projet (`k8s/monitoring/alert-rules.yaml`) :**

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| `PlatformApiHighErrorRate` | > 5% de 5xx sur 5 min | critical |
| `PlatformApiPodCrashLooping` | > 3 restarts en 15 min | critical |

```bash
# Vérifier les PrometheusRules
kubectl get prometheusrule -n platform

# Voir les règles
kubectl describe prometheusrule platform-api-alerts -n platform
```

### 16.2 ServiceMonitor

```bash
# Vérifier que le ServiceMonitor du backend existe
kubectl get servicemonitor -n platform

# Voir la configuration de scraping
kubectl describe servicemonitor -n platform
```

---

## 17. CI/CD Jenkins — Diagnostic

### 17.1 État de Jenkins

```bash
# Pod Jenkins
kubectl get pods -n jenkins

# Logs Jenkins
kubectl logs -n jenkins \
  $(kubectl get pod -n jenkins -l app=jenkins -o name | head -1) \
  --tail=50

# Ressources Jenkins
kubectl get deployment jenkins -n jenkins \
  -o jsonpath='{.spec.template.spec.containers[0].resources}'
```

### 17.2 Problème spawn helper — `Failed to exec spawn helper: exit value: 1`

> **Problème documenté dans `docs/FIX_08_JENKINS_JNA_SPAWN_HELPER.md`.**

**Cause racine :** Kaniko (builder Docker) tourne dans le même container que Jenkins. L'image de base `eclipse-temurin:21-jre-alpine` met Java dans `/opt/java/openjdk/` — **le même chemin** que le JDK17 de Jenkins. Kaniko extrait l'image sur le filesystem réel du container pendant le build, écrasant le `jspawnhelper` de Jenkins.

**Diagnostic :**

```bash
# Vérifier les variables JVM Jenkins
kubectl exec -n jenkins deployment/jenkins -- env | grep -E "JAVA|TMPDIR"

# Vérifier les ressources CPU/mémoire
kubectl get deployment jenkins -n jenkins \
  -o jsonpath='{.spec.template.spec.containers[0].resources}'

# Vérifier les PIDs actifs
kubectl exec -n jenkins deployment/jenkins -- \
  cat /sys/fs/cgroup/pids.current

# Compter les FDs ouverts par la JVM Jenkins
kubectl exec -n jenkins deployment/jenkins -- \
  sh -c 'ls /proc/$(pgrep -f jenkins.war | head -1)/fd | wc -l'
```

**Fix appliqué :** Le `backend-kaniko.Dockerfile` utilise `amazoncorretto:21-alpine3.19` au lieu de `eclipse-temurin:21-jre-alpine`. Amazon Corretto met Java dans `/usr/lib/jvm/java-21-amazon-corretto/`, ne conflictant pas avec `/opt/java/openjdk/` de Jenkins.

**Solution immédiate si le problème réapparaît :**

```bash
# Redémarrer Jenkins proprement (attend la fin des builds en cours)
kubectl rollout restart deployment/jenkins -n jenkins
kubectl get pods -n jenkins -w
```

### 17.3 Ressources Jenkins — CPU throttling

```bash
# Vérifier les ressources actuelles
kubectl get deployment jenkins -n jenkins \
  -o jsonpath='{.spec.template.spec.containers[0].resources}'

# Ressources cibles (validées dans le projet)
# requests: cpu=100m, memory=256Mi
# limits:   cpu=2,    memory=3Gi

# Corriger si nécessaire
kubectl patch deployment jenkins -n jenkins --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources","value":{"requests":{"cpu":"100m","memory":"256Mi"},"limits":{"cpu":"2","memory":"3Gi"}}}]'
```

### 17.4 Variables d'environnement Jenkins

```bash
# Vérifier JAVA_OPTS (configuré par le projet)
kubectl exec -n jenkins deployment/jenkins -- env | grep JAVA
```

Variables attendues :
- `JAVA_OPTS=-Xmx1g -Xms512m -Djava.io.tmpdir=/var/jenkins_home/tmp -Djna.tmpdir=/var/jenkins_home/jna`
- `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=/var/jenkins_home/.java-tmp -Djna.tmpdir=/var/jenkins_home/.jna-tmp`

```bash
# Vérifier que les dossiers tmp persistent existent
kubectl exec -n jenkins deployment/jenkins -- \
  ls -la /var/jenkins_home/tmp /var/jenkins_home/jna

# Créer si manquants
kubectl exec -n jenkins deployment/jenkins -- \
  mkdir -p /var/jenkins_home/tmp /var/jenkins_home/jna \
           /var/jenkins_home/.java-tmp /var/jenkins_home/.jna-tmp
```

---

## 18. PostgreSQL

```bash
# Pod PostgreSQL
kubectl get pods -n platform | grep postgres

# Logs PostgreSQL
kubectl logs -n platform \
  $(kubectl get pod -n platform -l app=postgres -o name | head -1) \
  --tail=30

# Connexion directe à la base
kubectl exec -it \
  $(kubectl get pod -n platform -l app=postgres -o name | head -1) \
  -n platform -- psql -U platform -d platformdb

# Vérifier le PVC PostgreSQL
kubectl get pvc -n platform
```

---

## 19. Problèmes connus et solutions

### 19.1 Tableau récapitulatif

| Problème | Symptôme | Commande clé | Solution |
|----------|----------|--------------|----------|
| App FAILED — mauvais port | Pod Running mais erreur 503 | `kubectl exec <pod> -- netstat -tlnp` | Corriger le port dans le déploiement |
| KafkaSource PENDING | `mismatched namespaces` | `kubectl describe kafkasource <nom> -n <ns>` | Broker et KafkaSource dans le même namespace |
| Event 502 — app scaled to zero | Timeout sur CloudEvent | `kubectl logs -n knative-eventing -l app=imc-dispatcher` | Vérifier que l'activator répond |
| Broker 500 | CloudEvent rejeté | `kubectl logs -n knative-eventing -l app=mt-broker-ingress` | Vérifier format CloudEvent |
| Révision ProgressDeadlineExceeded | Déploiement bloqué | `kubectl describe revision <nom> -n <ns>` | Vérifier image et ressources |
| Container Logs — CONNECTING infini | Pod 2 containers, container non spécifié | `kubectl logs <pod> -n <ns> -c user-container` | Spécifier `-c user-container` |
| Jenkins spawn helper crash | `exit value: 1` après Kaniko | `kubectl rollout restart deployment/jenkins -n jenkins` | Voir section 17.2 |
| MetalLB IP pending | Service LoadBalancer sans IP | `kubectl get events -n metallb-system` | Vérifier IPAddressPool |
| Lag Kafka non affiché | `GET /api/kafka/topics/{id}` retourne lag=null | Logs backend | Fix appliqué : `getTopic()` appelle `fetchTopicMetrics()` |
| CrashLoopBackOff non détecté | Seuil non atteint | `kubectl get pods -A` | Attendre >5 restarts ou vérifier `CrashLoopScheduler` |

### 19.2 Problème containerd — `path escapes from parent`

**Symptôme :** `CreateContainerError` avec `openat etc/passwd: path escapes from parent`

**Cause :** Bug containerd v2.x avec certaines images qui ont des symlinks dans `/etc/passwd`.

```bash
# Diagnostiquer
kubectl get pod -n <namespace> -l app=<app> \
  -o jsonpath='{.items[0].status.containerStatuses[0].state}'

# Sur le nœud concerné
ssh sysadmin@vm02 "containerd --version"
ssh sysadmin@vm02 "sudo ctr -n k8s.io images rm docker.io/<image>:<tag>"
ssh sysadmin@vm02 "sudo systemctl restart containerd"
```

**Solution :** Utiliser un tag d'image spécifique à l'architecture ou changer l'image de base.

---

## 20. Référence rapide — Commandes essentielles

### Diagnostic immédiat (copier-coller)

```bash
# Vue d'ensemble complète
kubectl get nodes && \
kubectl get pods -A | grep -v -E "Running|Completed" && \
kubectl get ksvc -A | grep -v True && \
kubectl get broker -A && \
kubectl get kafkasource -A | grep -v True && \
kubectl get events -A --sort-by='.lastTimestamp' | tail -10
```

### Rolling restart d'un déploiement

```bash
kubectl rollout restart deployment/<nom> -n <namespace>
kubectl rollout status deployment/<nom> -n <namespace>
```

### Historique d'un déploiement

```bash
kubectl rollout history deployment/<nom> -n <namespace>
```

### Debug rapide d'un pod

```bash
kubectl describe pod <nom> -n <namespace>
kubectl logs <nom> -n <namespace> --tail=50
kubectl logs <nom> -n <namespace> --previous
```

### Port-forward pour debug local

```bash
kubectl port-forward svc/<nom-service> <port-local>:<port-service> -n <namespace>
```

### Ressources consommées

```bash
kubectl top nodes
kubectl top pods -A --sort-by=cpu
kubectl top pods -A --sort-by=memory
```

---

*Runbook généré à partir des fichiers réels du projet : `docs/COMMANDES_DIAGNOSTIC.md`, `k8s/tenant/network-policy.yaml`, `k8s/backend/rbac.yaml`, `k8s/monitoring/alert-rules.yaml`, `docs/FIX_07_CRASH_LOOP_DETECTION.md`, `docs/FIX_08_JENKINS_JNA_SPAWN_HELPER.md`, `docs/FIX_03_LAG_KAFKA.md`, `docs/AUDIT_EVENTING_KAFKA_COMPLET.md`.*
