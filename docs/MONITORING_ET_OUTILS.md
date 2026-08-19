# Monitoring & Outils de diagnostic — PlatformServerless

Document de référence regroupant : (1) la stack de monitoring de la plateforme telle qu'elle existe réellement, (2) tous les outils/commandes utilisés pendant les sessions de debug pour diagnostiquer et valider le pipeline Kafka/Knative Eventing/Serving.

---

## 1. Stack de monitoring de la plateforme

| Composant | Rôle | État |
|---|---|---|
| **Prometheus** | Collecte des métriques (cluster, apps, queue-proxy Knative) | ⚠️ Probablement inactif pour le backend — mismatch de labels non corrigé (ticket 015, `alert-rules.yaml`/`service-monitor.yaml` portent `release: prometheus` au lieu de `release: monitoring-stack`) |
| **Grafana** | Dashboards (`k8s/grafana/platform-tenant-dashboard.json`) | Dépend des métriques Prometheus — à revalider une fois le ticket 015 corrigé |
| **Alertmanager** | Alertes (`k8s/monitoring/alertmanager-config.yaml`) | Config présente, dépend d'une substitution manuelle `envsubst` non automatisée |
| **Spring Boot Actuator** | Health check applicatif (`/actuator/health`, `/actuator/prometheus`) | Actif, mais `show-details: always` (fuite d'info, ticket ouvert) |
| **SSE Logs** (`LogSseService`) | Logs de déploiement en temps réel dans l'UI | ✅ Corrigé (tickets 011, 046) |
| **Event Log** (page Eventing) | Historique des CloudEvents publiés | Présent, alimenté par `localStorage` côté frontend (pas une vraie trace serveur persistée) |
| **Recent Publishes** (panneau Publish Event) | Confirmation immédiate après publication | ⚠️ Le texte "→ triggered X" est une **estimation côté frontend** (filtre de Trigger correspondant), pas une confirmation réelle de livraison — bug UX identifié, non corrigé |

## 2. Ce qu'on a découvert sur le monitoring pendant cette session

- **Bug réel** : `EventService.publish()` retombe sur un topic Kafka par défaut codé en dur (`knative-demo`) si le frontend n'envoie pas explicitement de `topic` — cause de plusieurs faux positifs pendant les tests ("Test sent" affiché avec succès, mais l'événement partait sur le mauvais topic, donc jamais livré).
- **Bug UX** : le message `"✅ Event published → triggered X"` dans `Eventing.jsx` est calculé localement par correspondance de filtre (`triggers.find(t => t.filter === form.type)`), **sans confirmation réelle** que l'app a reçu/traité l'événement.
- **Incohérence de vocabulaire UI** : la page "Applications" affiche `SCALED TO ZERO` comme statut principal, alors que le Dashboard affiche `RUNNING` pour la même app au même moment — les deux sont corrects (l'un décrit la santé du déploiement Knative, l'autre le nombre de pods actifs) mais le vocabulaire diffère entre les deux pages, source de confusion.
- **Doublons en base de données** : `AppService.createApp()` insère une ligne en base avant la fin réelle du déploiement Knative ; comme le nom du service généré est déterministe (image + compte), des tentatives répétées créent plusieurs lignes `apps` pointant vers la **même** ressource Knative réelle — visible dans l'UI comme des "doublons d'app" qui n'existent pas réellement sur le cluster.

---

## 3. Commandes `kubectl` de diagnostic — Applications / Déploiement

```bash
# État général des pods d'un namespace tenant, triés par date de création
kubectl get pods -n <namespace> --sort-by=.metadata.creationTimestamp -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,CREATED:.metadata.creationTimestamp

# Watch en direct (essentiel pour observer le scale-from-zero de Knative Serving)
kubectl get pods -n <namespace> -w

# Voir tous les pods d'un service précis (label Knative standard)
kubectl get pods -n <namespace> -l serving.knative.dev/service=<nom-du-service>

# Logs d'un pod (le conteneur applicatif s'appelle "user-container" chez Knative,
# --tail=0 -f pour ne voir que le futur, pratique pendant un test en direct)
kubectl logs -n <namespace> <nom-du-pod> -f
kubectl logs -n <namespace> -l app=platform-api --tail=0 -f

# Rechercher un pod par mot-clé sur tout le cluster (utile si on ne sait plus
# dans quel namespace/tenant il se trouve)
kubectl get pods -A | grep -i "<mot-clé>"

# Knative Services (apps) — statut réel, indépendant de ce qu'affiche l'UI
kubectl get ksvc -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get ksvc -n <namespace> -o custom-columns=NAME:.metadata.name,URL:.status.url
```

## 4. Commandes `kubectl` de diagnostic — Kafka / Knative Eventing

```bash
# KafkaSource — vérifier le vrai statut Ready (indépendant de ce qu'affiche l'UI)
kubectl get kafkasource -n <namespace> -o wide
kubectl get kafkasource <nom> -n <namespace> -o custom-columns=NAME:.metadata.name,TOPICS:.spec.topics
kubectl describe kafkasource <nom> -n <namespace>

# Triggers — statut Ready + filtre + abonné
kubectl get trigger -n <namespace> -o wide

# Brokers
kubectl get broker -n <namespace>

# Vérifier une permission RBAC précise pour le ServiceAccount du backend
kubectl auth can-i get kafkasources.sources.knative.dev -n <namespace> --as=system:serviceaccount:platform:default
```

## 5. Commandes de diagnostic — Base de données (Postgres)

```bash
# Rôle et statut d'un utilisateur
kubectl exec -n platform deploy/postgres -- psql -U postgres -d platformserverless -c \
  "SELECT id, username, role, suspended FROM users WHERE username = '<username>';"

# Détecter des doublons d'app en base pour un tenant (même service_name, plusieurs lignes)
kubectl exec -n platform deploy/postgres -- psql -U postgres -d platformserverless -c \
  "SELECT id, name, service_name, status, updated_at FROM apps WHERE user_id = (SELECT id FROM users WHERE username='<username>') ORDER BY service_name, updated_at;"

# Nettoyer un doublon (garder 1 ligne par service_name, marquer les autres DELETED)
kubectl exec -n platform deploy/postgres -- psql -U postgres -d platformserverless -c \
  "UPDATE apps SET status='DELETED' WHERE id IN ('<uuid-1>', '<uuid-2>');"
```

## 6. Diagnostic réseau / authentification (voir aussi `docs/audit-fixes/047-*.md`)

```bash
# Tester la joignabilité de Keycloak depuis l'intérieur du cluster (pas de curl
# dans l'image backend — utiliser wget, ou un pod jetable curlimages/curl)
kubectl exec -n platform deploy/platform-api -- wget -qO- --server-response \
  http://<keycloak-host>:8080/realms/<realm>/.well-known/openid-configuration

# Vérifier une variable d'environnement réellement déployée sur un Deployment
kubectl get deployment <nom> -n <namespace> -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name=="<NOM_VAR>")'

# Changer une variable d'environnement immédiatement (sans nouveau build d'image)
kubectl set env deployment/<nom> -n <namespace> <VAR>="<valeur>"
```

## 7. Test de bout en bout du pipeline Kafka → Eventing → Serving

```bash
# 1. Récupérer l'URL publique de l'app productrice
kubectl get ksvc <nom-producteur> -n <namespace> -o jsonpath='{.status.url}'

# 2. Déclencher un vrai événement via l'app elle-même (pas via "Publish Event",
#    qui court-circuite le producteur et ne teste pas son code)
curl -X POST <url-producteur>/orders -H "Content-Type: application/json" \
  -d '{"userId":"user-001","amount":42.5}'

# 3. Observer le scale-from-zero du consommateur en direct
kubectl get pods -n <namespace> -w

# 4. Vérifier la réception réelle de l'événement
kubectl logs -n <namespace> <pod-du-consommateur> --tail=30
```

**Piège à éviter** : le panneau "Publish Event" / bouton "Test" de l'UI publie **directement sur un topic Kafka**, en court-circuitant l'app productrice. C'est utile pour tester isolément la chaîne KafkaSource→Broker→Trigger→consommateur, mais ça ne teste **jamais** le code du producteur lui-même. Pour un test de bout en bout complet (producteur + consommateur), il faut appeler l'endpoint HTTP réel du producteur (étape 2 ci-dessus).

**Piège n°2** : dans le panneau "Publish Event", le champ **"Target Topic" doit être réglé explicitement** sur le vrai nom du topic (visible via `kubectl get kafkasource`) — le laisser sur "Auto (broker default)" envoie l'événement vers un topic par défaut (`knative-demo`) que rien n'écoute, à cause d'un bug backend non encore corrigé (voir §2).

---

## 8. Outils utilisés pendant cette session

| Outil | Usage |
|---|---|
| `kubectl` (exécuté par l'utilisateur sur `vm01`) | Diagnostic cluster — pods, logs, describe, RBAC, exec |
| `psql` (via `kubectl exec` sur le pod Postgres) | Inspection/correction directe de la base de données |
| DevTools navigateur (onglets Network / Console) | Diagnostic des erreurs frontend (401, 403, CORS, `WWW-Authenticate`) |
| `jwt.io` | Décodage manuel de tokens JWT pour lire `iss`, `alg`, claims |
| `ngrok` | Tunnel public temporaire vers Jenkins pour activer le webhook GitHub (déclenchement automatique des builds au push) |
| Playwright (Python, headless Chromium) | Audit UX/UI automatisé — captures d'écran, lecture console, injection axe-core |
| `git log -p` | Investigation de l'historique d'un fichier pour dater l'origine d'un bug de configuration |

---

*Document généré en complément du suivi détaillé dans `docs/audit-fixes/` (chaque correction y est documentée individuellement avec cause, solution, fichiers modifiés, et validation).*
