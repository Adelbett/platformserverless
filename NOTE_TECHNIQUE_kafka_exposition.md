# Note technique — Exposition externe du cluster Kafka

**Projet :** PlatformServerless (PFE, NextStep IT)
**Date :** 16 août 2026
**Objet :** constatation faite lors de la rédaction du Chapitre III, analyse, et modifications apportées au mémoire

---

## 1. Résumé en trois phrases

Le cluster Kafka de la plateforme publie un point d'accès sur le réseau local, à l'adresse
`10.9.21.233:9093`, **sans chiffrement TLS ni authentification**. Toute machine du réseau
peut donc lire, écrire et supprimer les sujets de n'importe quel client de la plateforme.
La constatation est intervenue en fin de projet ; elle est documentée dans le mémoire au
chapitre de validation, avec la remédiation identifiée.

---

## 2. Les faits, tels que constatés

Tous les éléments ci-dessous proviennent de commandes exécutées sur le cluster, et non
d'une déduction.

### 2.1 Version et état de l'opérateur

| Élément | Valeur constatée |
|---|---|
| Version de Strimzi | `0.45.0` (`operatorLastSuccessfulVersion`) |
| Identifiant du cluster | `h5qwpnCFQBqZNIcm00gQzg` |
| État de la ressource `Kafka` | `READY: True` |
| Mode de métadonnées | ZooKeeper (et non KRaft) |
| Avertissements | `WARNINGS: True` |

L'avertissement remonté par l'opérateur est le suivant :

> Support for ZooKeeper-based Apache Kafka clusters will be removed in the next Strimzi
> release (0.46.0). Please migrate to KRaft.

### 2.2 Dimensionnement

| Composant | Réplicas | Stockage |
|---|---|---|
| Kafka | 1 (`registeredNodeIds: [0]`) | 1 Gio, classe `local-path`, `persistent-claim` |
| ZooKeeper | 1 | 1 Gio, classe `local-path`, `persistent-claim` |

### 2.3 Écouteurs déclarés dans la ressource `Kafka`

```yaml
listeners:
- name: plain
  port: 9092
  tls: false
  type: internal
- name: external
  port: 9093
  tls: false          # <-- pas de chiffrement
  type: loadbalancer  # <-- publié hors du cluster
```

Aucune section `authentication:` n'est présente sur l'un ou l'autre des écouteurs.

### 2.4 Services correspondants

| Service | Type | IP externe | Port | Âge |
|---|---|---|---|---|
| `my-cluster-kafka-bootstrap` | ClusterIP | — | 9091, 9092 | 156 j |
| `my-cluster-kafka-brokers` | ClusterIP (headless) | — | 9090, 9091, 8443, 9092 | 156 j |
| `my-cluster-kafka-external-0` | **LoadBalancer** | **10.9.21.234** | 9093 | 110 j |
| `my-cluster-kafka-external-bootstrap` | **LoadBalancer** | **10.9.21.233** | 9093 | 110 j |
| `my-cluster-zookeeper-client` | ClusterIP | — | 2181 | 156 j |
| `my-cluster-zookeeper-nodes` | ClusterIP (headless) | — | 2181, 2888, 3888 | 156 j |

**Lecture des âges :** les services internes existent depuis 156 jours, les deux
LoadBalancer depuis 110 jours. L'écouteur externe a donc été ajouté environ 46 jours
après le provisionnement initial du cluster.

---

## 3. Pourquoi y a-t-il *deux* LoadBalancer, et non un seul ?

Ce point est souvent mal compris, et il vaut mieux savoir l'expliquer devant un jury.

**Ce n'est pas une redondance ni une erreur.** C'est la conséquence directe du
fonctionnement du protocole Kafka.

1. Un client Kafka se connecte d'abord au **bootstrap**. Ce point d'entrée ne transporte
   aucune donnée : il répond en donnant la liste des courtiers du cluster et l'adresse
   annoncée de chacun.
2. Le client se connecte **ensuite directement au courtier** qui détient la partition
   qu'il veut lire ou écrire. Contrairement à un proxy HTTP classique, le bootstrap ne
   relaie pas le trafic.

Pour qu'un client extérieur au cluster puisse suivre ces deux étapes, Strimzi crée donc :

- **un LoadBalancer pour le bootstrap** → `my-cluster-kafka-external-bootstrap` (10.9.21.233)
- **un LoadBalancer par courtier** → `my-cluster-kafka-external-0` (10.9.21.234)

**Conséquence utile :** le nombre de services `external-N` révèle le nombre de courtiers.
Ici il n'existe que `external-0`, sans `external-1` ni `external-2`, ce qui corrobore le
`replicas: 1` lu dans la ressource.

Les adresses `10.9.21.233` et `10.9.21.234` sont attribuées par **MetalLB**, mis en place
au Sprint 0 précisément parce qu'un cluster on-premise ne dispose pas d'attribution
automatique d'adresses externes.

---

## 4. Pourquoi cet écouteur externe a-t-il été activé ?

**Ce qui est établi :** l'écouteur `external` de type `loadbalancer` est déclaré
explicitement dans la ressource `Kafka`. Il ne s'agit pas d'un comportement par défaut de
Strimzi — un cluster créé sans cette déclaration n'expose rien à l'extérieur. Quelqu'un
l'a donc ajouté volontairement, environ 46 jours après la création du cluster.

**Ce qui relève de l'hypothèse** (à ne pas présenter comme un fait) : ce type d'écouteur
est presque toujours ajouté pour l'une des raisons suivantes :

- produire ou consommer des messages de test depuis un poste de développement, sans avoir
  à passer par un `kubectl exec` dans le pod du courtier ;
- utiliser un outil graphique d'inspection Kafka (Offset Explorer, Conduktor, Kafka UI)
  installé hors du cluster ;
- déboguer la chaîne Eventing du Sprint 3, où il est commode de publier un événement
  depuis l'extérieur pour observer le réveil d'une application.

Le backend, lui, **n'emprunte pas ce chemin** : sa configuration pointe vers le service
interne `my-cluster-kafka-bootstrap.kafka.svc:9092`. L'écouteur externe est donc un outil
de confort de développement, resté actif.

---

## 5. En quoi est-ce un problème ?

### 5.1 Ce qu'un tiers peut faire

Depuis n'importe quelle machine du réseau `10.9.21.0/24`, sans identifiant :

```bash
# lister tous les sujets, tous clients confondus
kafka-topics.sh --bootstrap-server 10.9.21.233:9093 --list

# lire l'intégralité des messages d'un client
kafka-console-consumer.sh --bootstrap-server 10.9.21.233:9093 \
  --topic <sujet-d-un-autre-client> --from-beginning

# supprimer le sujet d'un client
kafka-topics.sh --bootstrap-server 10.9.21.233:9093 \
  --delete --topic <sujet-d-un-autre-client>
```

L'absence de TLS ajoute que le trafic circule en clair : il est lisible par écoute
passive du réseau.

### 5.2 Pourquoi la NetworkPolicy du Sprint 0 ne protège pas

C'est le point important, et la source de la confusion.

La `NetworkPolicy` *default-deny* mise en place au Sprint 0 filtre le trafic **entre pods
et entre espaces de noms, à l'intérieur du cluster**. Elle fait correctement son travail.

Un service de type `LoadBalancer` fonctionne à un autre niveau : il demande explicitement
à MetalLB de **publier le service hors du cluster**. Le trafic entrant n'est pas un trafic
inter-namespace, il arrive de l'extérieur vers un point d'entrée volontairement ouvert.
La NetworkPolicy n'a rien à filtrer.

Autrement dit : le modèle d'isolation multi-tenant décrit au Sprint 0 reste valide pour ce
qu'il couvre, mais il ne couvre pas ce cas. Ce n'est pas une défaillance du modèle, c'est
une porte ouverte à côté de lui.

### 5.3 Portée

Tous les clients de la plateforme partagent **un seul cluster Kafka**. L'accès non
authentifié ne concerne donc pas un client, mais l'ensemble des sujets de tous les
tenants.

---

## 6. Comment corriger

### Option A — Retirer l'écouteur externe (la plus simple)

Si l'accès depuis l'extérieur n'est plus nécessaire, supprimer le bloc `external` de la
ressource `Kafka`. Strimzi supprimera automatiquement les deux LoadBalancer et libérera
les adresses MetalLB.

```yaml
listeners:
- name: plain
  port: 9092
  tls: false
  type: internal
# bloc 'external' supprimé
```

### Option B — Sécuriser l'écouteur

Si l'accès externe doit être conservé :

```yaml
listeners:
- name: plain
  port: 9092
  tls: false
  type: internal
- name: external
  port: 9093
  tls: true                      # chiffrement
  type: loadbalancer
  authentication:
    type: scram-sha-512          # authentification par identifiants
```

Puis créer un utilisateur avec des droits limités :

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaUser
metadata:
  name: dev-externe
  namespace: kafka
  labels:
    strimzi.io/cluster: my-cluster
spec:
  authentication:
    type: scram-sha-512
  authorization:
    type: simple
    acls:
      - resource:
          type: topic
          name: test-
          patternType: prefix
        operations: [Read, Write, Describe]
```

**Attention :** activer `authentication` sur cet écouteur n'affecte pas l'écouteur
`plain` interne, donc le backend continue de fonctionner sans modification. Vérifier
malgré tout après application.

### Vérification après correction

```bash
kubectl get kafka my-cluster -n kafka -o yaml | grep -A 25 "listeners:"
kubectl get svc -n kafka
```

---

## 7. Ce qui a été modifié dans le mémoire

Le principe retenu : **la Réalisation d'un sprint décrit ce qui a été construit ; l'audit
de sécurité appartient au chapitre de validation.** La constatation n'est donc pas
dramatisée au Sprint 2, mais elle n'est pas dissimulée non plus.

### 7.1 Chapitre III — Sprint 2 (`chapitre1.tex`)

**Ajouté :** trois captures dans la Réalisation, chacune avec une description de deux
lignes.

| Figure | Commande | Ce qu'elle prouve |
|---|---|---|
| Composants du cluster Kafka | `kubectl get pods -n kafka` | opérateur, courtier, ZooKeeper en Running |
| Ressource `Kafka` | `kubectl get kafka -n kafka` | état Ready, mode ZooKeeper, réplicas |
| Services du namespace | `kubectl get svc -n kafka` | bootstrap interne et points d'accès externes |

**Modifié :** deux paragraphes factuels indiquant Strimzi 0.45.0, un courtier, une
instance ZooKeeper, stockage local de 1 Gio, présentés comme un dimensionnement de
développement. Les deux LoadBalancer sont mentionnés en une phrase, avec renvoi au
chapitre de validation. Aucune occurrence des mots « vulnérabilité », « faille » ou
« surface d'attaque » à cet endroit.

**Corrigé :** la phrase de la Conception qui affirmait « un accès limité au seul réseau du
cluster », devenue inexacte. Le cartouche de la figure III.14 a été ajusté en conséquence.

### 7.2 Chapitre VII — Validation (`chapitre5.tex`)

**Ajouté :**

- un paragraphe dans la section d'audit expliquant la constatation et sa remédiation ;
- une ligne dans le tableau de traitement des vulnérabilités :
  *Écouteur Kafka externe sans TLS ni authentification (`tls: false`, port 9093) →
  Identifié en fin de projet ; correction planifiée* ;
- trois lignes dans la synthèse des limites : écouteur non chiffré, courtier unique,
  mode ZooKeeper déprécié.

---

## 8. Si le jury pose la question

La figure des services affiche `EXTERNAL-IP 10.9.21.233`. Un membre du jury familier de
Kubernetes peut le relever. Réponse possible, en trois temps :

1. **Reconnaître le fait.** « Cet écouteur externe est déclaré sans TLS ni
   authentification. Nous l'avons constaté en inspectant la ressource `Kafka` en fin de
   projet. »
2. **Expliquer l'origine.** « Il a été ajouté en cours de développement pour tester la
   chaîne événementielle depuis l'extérieur du cluster, et n'a pas été retiré ensuite. Le
   backend, lui, utilise exclusivement l'écouteur interne. »
3. **Donner la remédiation.** « La correction consiste soit à supprimer cet écouteur,
   soit à activer TLS et une authentification SCRAM avec des ACL par tenant. C'est
   documenté dans la synthèse des limites du mémoire. »

Cette réponse vaut mieux que le silence : elle montre que le système a été audité et que
la correction est comprise.

---

## 9. Autres faits utiles issus de la même inspection

Le mémoire signalait à plusieurs reprises l'absence de versions documentées. Cette
inspection en fournit :

- **Strimzi 0.45.0** — désormais cité dans le Chapitre III ;
- **mode ZooKeeper**, déprécié et retiré à partir de Strimzi 0.46.0, ce qui explique
  l'avertissement `WARNINGS: True` visible sur la capture de la ressource `Kafka` ;
- **stockage** : classe `local-path`, 1 Gio par composant, en `persistent-claim`.

À noter également, sans conséquence immédiate : le pod `my-cluster-entity-operator`
affiche 12 redémarrages sur 18 jours. Cela n'empêche pas le fonctionnement, mais mériterait
un examen des journaux si le comportement persiste.
