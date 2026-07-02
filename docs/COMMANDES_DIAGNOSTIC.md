# Commandes de diagnostic — PlatformServerless

Toutes les commandes utilisées pendant le débogage de la plateforme, organisées par catégorie.

---

## 1. Pods

```bash
# Lister tous les pods de tous les namespaces
kubectl get pods -A

# Lister les pods d'un namespace précis
kubectl get pods -n user-user
kubectl get pods -n platform
kubectl get pods -n knative-eventing

# Lister les pods avec leurs labels
kubectl get pods -n user-user --show-labels

# Lister les pods Knative uniquement (label serving)
kubectl get pods -A -l "serving.knative.dev/service"

# Voir le détail d'un pod (état, events, raison d'échec)
kubectl describe pod <nom-du-pod> -n <namespace>

# Voir les logs d'un pod (dernières 30 lignes)
kubectl logs <nom-du-pod> -n <namespace> --tail=30

# Voir les logs d'un pod par label (sans connaître le nom exact)
kubectl logs -n user-user -l serving.knative.dev/service=<nom-service> --tail=30

# Voir les logs du backend
kubectl logs -n platform -l app=backend-api --tail=30

# Voir les logs en temps réel (follow)
kubectl logs -n platform <nom-du-pod> -f

# Voir les logs d'un container spécifique dans un pod multi-container
kubectl logs <nom-du-pod> -n <namespace> -c user-container

# Lancer un pod de debug temporaire pour tester une image
kubectl run debug-pod --image=<image> --restart=Never -n <namespace> --port=<port>

# Supprimer le pod de debug après utilisation
kubectl delete pod debug-pod -n <namespace>

# Vérifier sur quel port écoute le container
kubectl exec <nom-du-pod> -n <namespace> -- netstat -tlnp

# Lire un fichier de config à l'intérieur du container
kubectl exec <nom-du-pod> -n <namespace> -- cat /etc/nginx/conf.d/default.conf
```

---

## 2. Services Knative (ksvc)

```bash
# Lister tous les services Knative dans tous les namespaces
kubectl get ksvc -A

# Lister les révisions d'un service Knative
kubectl get revisions -n <namespace>

# Voir le détail d'une révision (raison d'échec, image, port)
kubectl describe revision <nom-revision> -n <namespace>

# Filtrer les infos utiles d'une révision
kubectl describe revision <nom-revision> -n <namespace> \
  | grep -E "Message|Reason|Image|Port|Exit Code|State"
```

---

## 3. Eventing Knative

```bash
# Lister les KafkaSources dans tous les namespaces
kubectl get kafkasource -A

# Voir la config complète d'un KafkaSource (topics, sink, bootstrap)
kubectl get kafkasource -n default -o yaml

# Voir uniquement les topics écoutés
kubectl get kafkasource -n default -o jsonpath='{.items[*].spec.topics}'

# Lister les Triggers
kubectl get trigger -A

# Lister les Brokers
kubectl get broker -A

# Voir le statut du Broker (Ready, channel, URL)
kubectl get broker default -n default -o yaml | grep -E "Ready|reason|message|channel"

# Lister les InMemoryChannels
kubectl get inmemorychannels -n default

# Voir le statut d'un InMemoryChannel
kubectl get inmemorychannels default-kne-trigger -n default -o yaml \
  | grep -E "Ready|reason|message|status"
```

---

## 4. Events Kubernetes

```bash
# Voir tous les events d'un namespace (triés par date)
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Voir uniquement les events d'échec
kubectl get events -n <namespace> --field-selector reason=Failed

# Voir les derniers events (équivalent tail)
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -20
```

---

## 5. Logs des composants Knative

```bash
# Logs du broker-ingress (erreurs de dispatch)
kubectl logs -n knative-eventing mt-broker-ingress-<id> --tail=20

# Logs du broker-filter (erreurs de routage vers les triggers)
kubectl logs -n knative-eventing mt-broker-filter-<id> --tail=20

# Logs du dispatcher InMemoryChannel (erreurs fanout 502/400)
kubectl logs -n knative-eventing imc-dispatcher-<id> --tail=20

# Logs du dispatcher Kafka (KafkaSource)
kubectl logs -n knative-eventing kafka-source-dispatcher-0 --tail=20

# Trouver les noms exacts des pods knative-eventing
kubectl get pods -n knative-eventing
```

---

## 6. RBAC Kubernetes

```bash
# Voir le ServiceAccount du backend
kubectl get serviceaccount default -n platform -o yaml

# Voir le ClusterRole de la plateforme
kubectl get clusterrole platform-backend-role -o yaml

# Voir le ClusterRoleBinding
kubectl get clusterrolebinding platform-correct-binding -o yaml

# Vérifier les permissions d'un ServiceAccount
kubectl auth can-i list pods \
  --as=system:serviceaccount:platform:default -n user-user

kubectl auth can-i list services \
  --as=system:serviceaccount:platform:default -n knative-serving
```

---

## 7. Kafka (AdminClient / topics)

```bash
# Lister les topics Kafka via le pod Kafdrop (si déployé)
# → accéder à l'URL Kafdrop dans la plateforme

# Lister les topics via kubectl exec dans un pod Kafka
kubectl exec -n kafka my-cluster-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Décrire un topic
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
```

---

## 8. Backend API

```bash
# Trouver le pod backend
kubectl get pods -n platform | grep backend

# Voir les logs du backend (filtrer les erreurs)
kubectl logs -n platform <pod-backend> --tail=40 \
  | grep -iE "ERROR|WARN|event|publish|timeout"

# Voir tous les logs en temps réel
kubectl logs -n platform <pod-backend> -f

# Voir les logs depuis le démarrage
kubectl logs -n platform <pod-backend> --since=1h
```

---

## 9. Diagnostic rapide — checklist

```bash
# 1. Est-ce que les pods tournent ?
kubectl get pods -A | grep -v Running | grep -v Completed

# 2. Est-ce que les services Knative sont Ready ?
kubectl get ksvc -A | grep -v True

# 3. Est-ce que le broker est healthy ?
kubectl get broker -A

# 4. Est-ce que les triggers sont Ready ?
kubectl get trigger -A | grep -v True

# 5. Est-ce que les KafkaSources sont Ready ?
kubectl get kafkasource -A | grep -v True

# 6. Y a-t-il des erreurs récentes ?
kubectl get events -A --sort-by='.lastTimestamp' | tail -20
```

---

## 10. Commandes utiles diverses

```bash
# Voir les namespaces du cluster
kubectl get namespaces

# Voir les noeuds du cluster
kubectl get nodes

# Voir les ressources consommées par namespace
kubectl top pods -A

# Redémarrer un déploiement (rolling restart)
kubectl rollout restart deployment/<nom> -n <namespace>

# Voir l'historique d'un déploiement
kubectl rollout history deployment/<nom> -n <namespace>

# Port-forward pour accéder à un service en local
kubectl port-forward svc/<nom-service> 8080:80 -n <namespace>
```

---

## Problèmes rencontrés et commandes utilisées

| Problème | Commande clé |
|---|---|
| App FAILED — mauvais port | `kubectl exec <pod> -- netstat -tlnp` |
| Event 502 — app scaled to zero | `kubectl logs -n knative-eventing imc-dispatcher-<id> --tail=20` |
| Broker 500 | `kubectl logs -n knative-eventing mt-broker-ingress-<id> --tail=20` |
| Révision ProgressDeadlineExceeded | `kubectl describe revision <nom> -n <namespace>` |
| Vérifier si KafkaSource écoute le bon topic | `kubectl get kafkasource -n default -o jsonpath='{.items[*].spec.topics}'` |
| Trouver pourquoi un pod ne démarre pas | `kubectl describe pod <nom> -n <namespace>` |
| Voir les logs du notification-service | `kubectl logs -n user-user -l serving.knative.dev/service=<nom> --tail=30` |
