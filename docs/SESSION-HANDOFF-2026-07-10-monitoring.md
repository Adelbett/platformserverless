# Handoff — Chantier "Monitoring enrichi admin-console" (session du 2026-07-10)

Ce fichier résume ce qui a été fait, ce qui reste, et sert de contexte pour démarrer un nouveau chat sans tout ré-expliquer.

## Contexte général

Le projet a deux frontends séparés :
- `web-portal` : côté client, aucune fonctionnalité admin.
- `admin-console` : appli admin séparée (Vite/React), exposée en `NodePort` sur le cluster (port `30081`), déployée via Jenkins (`platform-admin`).

Règle de fonctionnement établie et à respecter dans toute nouvelle session :
**Je (l'assistant) ne touche jamais au cluster ni n'exécute aucune commande (kubectl, docker, mvn, npm...), même en local.** Je modifie uniquement les fichiers du repo. L'utilisateur exécute toutes les commandes (build, déploiement, vérifications) lui-même et me colle les résultats.

## Mission en cours (donnée par l'utilisateur, PAS encore terminée)

L'utilisateur a fourni un brief en 11 phases pour enrichir massivement la page `/cluster` d'admin-console (nœuds CPU/RAM/disque, cold-start Knative, lag Kafka historique, req/sec via Kourier/Prometheus, alertes Alertmanager actives, tendances historiques, usage par tenant, stockage/PVC, posture sécurité, coût, export d'audit enrichi).

Règles du brief à respecter dans les prochaines étapes :
- Périmètre strictement limité à `admin-console` (ne pas toucher `web-portal`).
- Réutiliser les endpoints backend existants au maximum.
- Ne jamais deviner la forme des objets fabric8 (nodes, pods, etc.) — vérifier avant de coder.
- Avancer **phase par phase**, avec confirmation de l'utilisateur avant de passer à la phase suivante.
- Si une donnée n'est pas techniquement exposée, le dire clairement plutôt que d'inventer une valeur.

**Avant de démarrer les phases 1 à 11, il fallait d'abord corriger deux bugs bloquants (Phase 0)** :
1. "Kubernetes Nodes (0)" — affichait 0 alors qu'il y a 3 vrais nœuds Ready.
2. "REQ/SEC" — toujours à 0.0, jamais branché sur une vraie source de métriques.

**Le plan détaillé phase par phase (fichiers à créer/modifier pour les phases 1-11) n'a PAS encore été présenté à l'utilisateur.** C'est la prochaine étape une fois la Phase 0 confirmée entièrement résolue.

## Ce qui a été fait dans cette session

### Bug 1 — Nodes (0) → RÉSOLU et confirmé par l'utilisateur (screenshot "Kubernetes Nodes (3)")

Cause racine : le ServiceAccount `default` du namespace `platform` n'avait pas les droits RBAC cluster-scope sur `nodes`/`events`, et `AdminController.getNodes()` avalait silencieusement l'erreur 403 en renvoyant `200 + []` au lieu de remonter l'erreur.

Fichiers modifiés :
- `k8s/backend/rbac.yaml` (nouveau) — `ClusterRole` + `ClusterRoleBinding` donnant `get/list/watch` sur `nodes`/`events` au SA `default` du namespace `platform`.
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — `getNodes()` ne masque plus l'exception : retourne `502` avec le détail de l'erreur au lieu de `200 + []`.

Déployé et vérifié en direct sur le cluster (via l'utilisateur) : appliqué avec `kubectl apply -f <raw GitHub URL>` sur `vm01`, confirmé par `kubectl get clusterrolebinding` et par un screenshot montrant les 3 nœuds (vm01/vm02/vm03) listés correctement dans admin-console.

### Bug 2 — REQ/SEC = 0.0 → EN COURS, diagnostic terminé, correctif écrit mais PAS ENCORE appliqué sur le cluster

Étapes de diagnostic (faites en direct avec l'utilisateur via l'UI Prometheus) :
1. Mauvais nom de service DNS Prometheus suspecté au départ (`prometheus.monitoring...` au lieu du vrai `monitoring-stack-kube-prom-prometheus`) → corrigé dans :
   - `k8s/backend/deployment.yaml` (`APP_PROMETHEUS_URL`)
   - `backend-api/src/main/resources/application-k8s.yml` (valeur par défaut `app.prometheus.url`)
   → Connectivité confirmée OK ensuite (`up{namespace="knative-serving"}=1`).
2. Métrique `activator_request_count` (utilisée dans `MetricsService.java`) n'existe pas du tout — seules des métriques internes Go (`activator_go_*`) sont présentes.
3. Métrique alternative `revision_request_count` testée → vide aussi.
4. Diagnostic plus poussé : `up{namespace=~"user-.*"}` → **vide**. Ça veut dire que Prometheus ne scrape même pas les pods des apps clientes (namespaces `user-*`) — aucun `ServiceMonitor`/`PodMonitor` ne les couvre.
5. Vérification du ConfigMap Knative `config-observability` (namespace `knative-serving`) : `metrics.request-metrics-backend-destination: prometheus` est **déjà activé** côté Knative. Donc le sidecar `queue-proxy` de chaque pod d'app est censé exposer ses métriques — le problème n'est pas côté Knative, il est côté Prometheus qui ne va jamais les chercher.
6. Confirmé sur le cluster réel :
   - `queue-proxy` expose ses métriques sur le port **`9091`**, nommé **`http-usermetric`** (vérifié sur un pod réel dans `user-user`).
   - Le CRD `Prometheus` (namespace `monitoring`, release `monitoring-stack`) a :
     - `podMonitorNamespaceSelector: {}` → accepte des `PodMonitor` dans n'importe quel namespace.
     - `podMonitorSelector: {matchLabels: {release: monitoring-stack}}` → **tout `PodMonitor` doit porter le label `release: monitoring-stack`**, sinon il est ignoré silencieusement.

**Correctif écrit (fichier créé, PAS ENCORE appliqué sur le cluster) :**
- `k8s/monitoring/queue-proxy-podmonitor.yaml` — nouveau `PodMonitor` :
  - `namespace: monitoring`, label `release: monitoring-stack` (obligatoire pour être pris en compte)
  - sélectionne tous les pods portant le label `serving.knative.dev/revision` (donc toute revision Knative, dans n'importe quel namespace, présent et futur — pas de liste figée de namespaces tenants)
  - `namespaceSelector: {any: true}`
  - scrape le port `http-usermetric` (9091), chemin `/metrics`, intervalle `15s`

## Ce qu'il reste à faire (prochaine étape immédiate)

1. **L'utilisateur doit encore pusher et appliquer `k8s/monitoring/queue-proxy-podmonitor.yaml` sur le cluster** :
   ```bash
   git add k8s/monitoring/queue-proxy-podmonitor.yaml
   git commit -m "fix(monitoring): add PodMonitor to scrape Knative queue-proxy request metrics"
   git push
   ```
   Puis sur `vm01` (ou en local avec le repo cloné) :
   ```bash
   kubectl apply -f k8s/monitoring/queue-proxy-podmonitor.yaml
   ```
   (blocage en cours : il faut connaître l'URL GitHub exacte du repo — demander `git remote -v` à l'utilisateur si on repart via une URL raw pour `vm01`)

2. **Vérifier que Prometheus a bien pris la cible** :
   ```bash
   kubectl get podmonitor -n monitoring knative-queue-proxy
   ```
   puis dans l'UI Prometheus, retester `up{namespace=~"user-.*"}` (doit maintenant renvoyer des séries `1`).

3. **Générer du trafic réel** vers une app Knative tenant (ex: `curl` l'URL publique de `helloworld-go` dans `user-user`) puis retester dans Prometheus :
   ```
   revision_request_count
   ```
   Si cette métrique apparaît enfin, il faudra corriger `MetricsService.java` (actuellement il interroge `activator_request_count`, qui n'existe pas) pour utiliser le bon nom de métrique — **fichier pas encore modifié, à faire une fois la métrique confirmée disponible dans Prometheus**.

4. **`AnomalyDetectionService.java`** utilise aussi `activator_request_count` en PromQL pour la détection d'anomalies de trafic (P3.9) — même correctif à prévoir une fois le bon nom de métrique confirmé.

5. **Décision différée** : faut-il aussi corriger le pattern "catch silencieux → 0" dans `MetricsService.java` (même classe de bug que celle corrigée dans `getNodes()`) ? L'utilisateur avait choisi de d'abord vérifier manuellement dans Prometheus avant de trancher — à reconfirmer une fois REQ/SEC réellement réparé.

6. **Une fois Phase 0 (les 2 bugs) totalement validée en prod** : présenter le plan détaillé fichier-par-fichier des phases 1 à 11 du brief monitoring, et attendre confirmation avant d'implémenter quoi que ce soit.

## Fichiers créés/modifiés dans cette session

- `k8s/backend/rbac.yaml` (nouveau)
- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` (modifié — `getNodes()`)
- `k8s/backend/deployment.yaml` (modifié — `APP_PROMETHEUS_URL`)
- `backend-api/src/main/resources/application-k8s.yml` (modifié — `app.prometheus.url` défaut)
- `k8s/monitoring/queue-proxy-podmonitor.yaml` (nouveau — **pas encore appliqué sur le cluster**)

## Règle à rappeler dans le prochain chat

Ne jamais exécuter de commande (Bash/PowerShell/kubectl/docker/mvn/npm) — uniquement éditer des fichiers. Donner toutes les commandes à l'utilisateur pour qu'il les exécute lui-même et rapporte le résultat.
