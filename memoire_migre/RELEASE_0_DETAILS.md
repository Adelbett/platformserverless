# Chapitre III — Release 0 : Mise en place de la plateforme Cloud Native — dossier détaillé

Ce document rassemble **tout ce qui concerne le Chapitre III** (`chapitre1.tex`) : contenu du mémoire, détails techniques vérifiés dans le code, écarts corrigés, et pistes pour enrichir encore le chapitre si besoin. Il sert de référence complète, au-delà de ce qui tient dans le texte du mémoire.

---

## 1. Vue d'ensemble de la Release

| | |
|---|---|
| **Sprints couverts** | Sprint 0, Sprint 1, Sprint 2 |
| **Objectif de la release** | Construire le socle *cloud native* (infrastructure) avant toute logique métier |
| **Release suivante** | Release 1 (chapitre2.tex) — développement du backend applicatif |
| **Particularité** | Aucun cas d'utilisation humain, aucun diagramme de cas d'utilisation — travail 100% infrastructure |

---

## 2. Sprint 0 — Mise en place de l'infrastructure Kubernetes

### 2.1 Objectif
Établir le cluster Kubernetes et les briques réseau qui hébergeront toute la plateforme.

### 2.2 Composants mis en place
| Composant | Rôle |
|---|---|
| Cluster Kubernetes (3 nœuds) | 1 control-plane (`vm01`) + 2 workers (`vm02`, `vm03`) |
| Cilium (CNI) | Réseau de conteneurs + application des `NetworkPolicy` |
| MetalLB | Attribution d'IP externes de type `LoadBalancer` (pas de load balancer cloud natif) |
| Kourier | Passerelle d'entrée pour Knative Serving (installée pleinement au Sprint 1) |

### 2.3 Convention de namespaces
- `platform` : composants de la plateforme (backend, 2 frontends, PostgreSQL, Keycloak)
- `user-<username>` (ou équivalent) : un namespace par tenant, créé **dynamiquement** au premier déploiement, pas à l'avance

### 2.4 Classes/méthodes backend concernées (viennent au Sprint 1, mais la convention est décidée ici)
- `KnativeService.ensureNamespaceExists(...)`
- `KnativeService.ensureNetworkPolicyExists(...)`

### 2.5 Limite assumée
Aucun manifeste versionné pour le cluster lui-même (nœuds, CNI, MetalLB, Kourier) — provisionné manuellement, hors dépôt Git. Reprise en synthèse des limites au Chapitre Validation (`chapitre5.tex`).

---

## 3. Sprint 1 — Déploiement de Knative Serving

### 3.1 Objectif
Rendre le cluster capable d'exécuter des applications avec autoscaling, y compris scale-to-zero.

### 3.2 Classe centrale : `KnativeService`
Toutes les interactions passent par le **client Fabric8**, via l'API générique de ressources personnalisées (`genericKubernetesResources`), car **Knative Serving n'a pas de client Java officiel typé**.

| Méthode / responsabilité | Détail |
|---|---|
| `ensureNamespaceExists` | Création idempotente du namespace tenant |
| `ensureNetworkPolicyExists` | Isolation réseau automatique du tenant |
| Création/MAJ ressource `Service` Knative | Champs : `spec.template.spec.containers[0].image`, `ports`, `resources`, annotations `autoscaling.knative.dev/minScale` et `maxScale` |
| Lecture de l'état d'une révision | Conditions `Ready`, `ContainerHealthy` — utilisées pour synchroniser le statut applicatif |
| `deploy(...)` | Point d'entrée principal, appelé au Sprint 5 par `AppDeploymentAsyncRunner` |
| `getRealStatus(...)`, `getReadyPods(...)` | Lecture d'état à la demande (utilisé par `AppService`) |

### 3.3 Détail du manifeste Knative généré (structure standard)
```
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: <serviceName>
  namespace: <tenant-namespace>
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "<minReplicas>"
        autoscaling.knative.dev/maxScale: "<maxReplicas>"
    spec:
      containers:
        - image: <imageName>:<imageTag>
          ports:
            - containerPort: <port>
          resources:
            requests:
              cpu: <cpuRequest>
              memory: <memoryRequest>
```

### 3.4 Gestion des conflits (HTTP 409)
Le code gère explicitement le cas où une ressource existe déjà (`KubernetesClientException` code 409) : suppression puis re-création après une courte pause (`Thread.sleep(2000)`), avant de relancer la création. Sinon, propagation de l'erreur (`RuntimeException("Kubernetes API error: ...")`).

### 3.5 Limite assumée
Utilisation de l'API générique de Fabric8 (au lieu d'un client typé officiel), plus verbeuse et moins sûre au typage — choix assumé et reproduit de façon homogène pour Knative Eventing au Sprint 3.

---

## 4. Sprint 2 — Mise en place de Kafka et Strimzi

### 4.1 Objectif
Disposer d'un bus d'événements Kafka opéré par Strimzi, exploitable par les applications clientes et, plus tard, par Knative Eventing.

### 4.2 ⚠️ Point corrigé (important, déjà appliqué dans `chapitre1.tex`)
Une version précédente du mémoire affirmait que la gestion des topics passait par la ressource personnalisée Kubernetes `KafkaTopic` de Strimzi (comme Knative Serving/Eventing, via Fabric8). **Ce n'est pas ce que fait le code réel.**

Vérifié dans `backend-api/src/main/java/com/platform/api/kafka/KafkaService.java` :
- Les topics sont créés/listés/supprimés via l'**`AdminClient` natif d'Apache Kafka** (bibliothèque cliente Kafka standard, pas Kubernetes) :
  ```java
  try (AdminClient admin = AdminClient.create(Map.of(
          AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
          AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000",
          AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "5000"))) { ... }
  ```
- `KafkaTopic` dans le code Java est en réalité une **entité JPA** (`@Entity`, table `kafka_topics`), qui stocke les métadonnées (nom, partitions, réplicas, `userId`) en PostgreSQL — **pas** une ressource Kubernetes CRD.
- Il n'existe **aucun appel Fabric8/`genericKubernetesResources`** dans `KafkaService.java`.

**Conséquence pour le mémoire** : le Sprint 2 est le seul des trois sprints de cette release à **ne pas** utiliser le pattern Fabric8/CRD — c'est une différence technique réelle à assumer, pas une erreur de rédaction à cacher.

### 4.3 Ce qui reste vrai
- Le cluster Kafka lui-même (courtiers, stockage) est bien opéré par **Strimzi** sur Kubernetes — mais son provisionnement (ressource `Kafka` de Strimzi) a été fait manuellement, hors dépôt.
- Le backend ne crée donc que les **topics** applicatifs (au niveau protocole Kafka), pas le cluster Kafka lui-même (au niveau Kubernetes).

### 4.4 Limite assumée
Provisionnement du cluster Kafka non versionné (cohérent avec la limite déjà notée au Sprint 0 pour l'ensemble du socle).

---

## 5. Synthèse comparative des 3 sprints

| Sprint | Brique | Mécanisme d'accès au cluster | Client Java utilisé |
|---|---|---|---|
| Sprint 0 | Cluster K8s (nœuds, CNI, MetalLB) | Provisionné manuellement, hors backend | — |
| Sprint 1 | Knative Serving | Ressource personnalisée Kubernetes (CRD) | Fabric8 (API générique) |
| Sprint 2 | Kafka (topics) | Protocole Kafka natif (pas Kubernetes) | `AdminClient` Kafka |

Cette synthèse est utile pour anticiper une question de jury du type *« Pourquoi Kafka n'utilise-t-il pas Fabric8 comme les deux autres ? »* : parce que la gestion des topics est une opération de protocole Kafka standard (créer/lister/supprimer un topic), pas une opération Kubernetes — il n'y a donc pas besoin de passer par l'API Kubernetes pour ça, contrairement à Knative Serving/Eventing qui sont eux-mêmes des CRD Kubernetes.

---

## 6. Sprint Backlogs (tel que dans le mémoire)

**Sprint 0**
- Disposer d'un cluster Kubernetes fonctionnel — Réalisé
- Isoler le trafic réseau entre tenants — Réalisé
- Exposer un service avec une IP externe — Réalisé

**Sprint 1**
- Knative Serving opérationnel sur le cluster — Réalisé
- Créer une ressource Knative Service par programmation — Réalisé
- Création automatique du namespace tenant au premier déploiement — Réalisé

**Sprint 2**
- Disposer d'un cluster Kafka opéré par Strimzi — Réalisé
- Créer/supprimer un topic Kafka par programmation — Réalisé

---

## 7. Fichiers sources vérifiés
- `backend-api/src/main/java/com/platform/api/app/KnativeService.java`
- `backend-api/src/main/java/com/platform/api/kafka/KafkaService.java`
- `backend-api/src/main/java/com/platform/api/kafka/KafkaTopic.java` (entité JPA)
- `PROJECT_DOCUMENTATION.md`, `AUDIT_PRODUCTION_READINESS.md` (topologie cluster, absence d'IaC)
- `memoire_migre/chapitre1.tex` (contenu actuel du chapitre, déjà corrigé pour ce point)

## 8. Pistes pour enrichir encore le chapitre (au choix, non obligatoire)
- Ajouter un extrait de code réel (`ensureNetworkPolicyExists`) en annexe pour illustrer concrètement le Sprint 0/1.
- Ajouter un schéma comparatif (tableau de la section 5) directement dans le mémoire, dans la conclusion de la Release.
- Préciser dans le mémoire, comme ici, la nuance AdminClient vs CRD — actuellement corrigée mais pas explicitement justifiée pédagogiquement dans le texte (pourquoi c'est différent). Je peux l'ajouter si tu veux.
