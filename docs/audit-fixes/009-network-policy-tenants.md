# Absence totale de NetworkPolicy (isolation réseau entre tenants)

## Problème

Aucune `NetworkPolicy` n'existait pour les namespaces clients (`user-*`). Par défaut, Kubernetes autorise tout le trafic pod-à-pod inter-namespace — le découpage "un namespace par client" ne fournissait donc qu'une isolation organisationnelle, pas une isolation réseau réelle.

## Gravité

Critique

## Pourquoi c'était un problème

Vérifié sur le cluster réel (`kubectl get networkpolicy -A`) : les seules `NetworkPolicy` existantes sont celles générées automatiquement par l'opérateur Strimzi pour protéger Kafka/Zookeeper en interne — aucune ne protège les 4 namespaces clients réels (`user-adel`, `user-mohame`, `user-test`, `user-user`). Sans restriction, une app déployée par un client pouvait en théorie atteindre directement le réseau d'un autre client, ou des services internes partagés (Postgres, Keycloak) auxquels elle n'a aucune raison légitime d'accéder — un vecteur direct de mouvement latéral en cas de compromission d'une seule image Docker déployée par un tenant.

Le CNI en place, **Cilium**, supporte pleinement les `NetworkPolicy` standard (et des politiques plus avancées via ses propres CRD si besoin plus tard) — rien ne bloquait techniquement la mise en place de cette isolation.

## Solution retenue

Ticket multi-composants (Kubernetes + Backend), en deux parties :

**1. Kubernetes — rattrapage des namespaces existants.** Un manifeste type `NetworkPolicy` (`k8s/tenant/network-policy.yaml`, avec un placeholder `NAMESPACE_PLACEHOLDER` à substituer) à appliquer aux 4 namespaces clients déjà présents sur le cluster.

**2. Backend — automatisation pour les futurs clients.** `KnativeService.ensureNamespaceExists()` (appelée à chaque déploiement d'app, avant la création du namespace du client s'il n'existe pas encore) appelle désormais aussi `ensureNetworkPolicyExists(namespace)`, qui crée le même objet `NetworkPolicy` via le client Fabric8 si aucun n'existe déjà pour ce namespace — idempotent, comme `ensureNamespaceExists`. Tout nouveau client aura donc son isolation réseau dès la création de son namespace, sans intervention manuelle.

**Règles retenues** (identiques dans le manifeste K8s et dans le code Java, pour que les namespaces existants et futurs aient exactement la même politique) :
- **Ingress autorisé** : trafic entre pods du même namespace tenant ; trafic entrant depuis `kourier-system` (routage public des requêtes vers les apps) ; depuis `knative-serving` (probes/contrôle du plan de données Knative) ; depuis `monitoring` (scraping Prometheus, cohérent avec le `PodMonitor` déjà en place sur les queue-proxy).
- **Egress autorisé** : trafic entre pods du même namespace ; DNS (`kube-system`, ports 53 UDP/TCP — indispensable, sinon plus aucune résolution de nom ne fonctionne, y compris vers Kafka) ; vers le namespace `kafka` (bus d'événements partagé) ; vers `knative-serving`/`kourier-system` (canal retour du plan de contrôle).
- **Tout le reste est refusé par défaut**, notamment : trafic direct vers un autre namespace tenant, et trafic direct vers `platform` (donc vers Postgres/Keycloak) — hypothèse retenue faute de réponse confirmée : **les apps des clients n'ont pas besoin d'un accès réseau direct à Postgres/Keycloak**, seul `platform-api` y accède. **Cette hypothèse est à confirmer** — si des apps tenantes ont besoin d'appeler l'API du backend ou d'autres services dans `platform`, une règle egress supplémentaire vers ce namespace devra être ajoutée (ticket de suivi si besoin).

## Alternatives étudiées

- **Un seul objet `NetworkPolicy` cluster-wide** (via une future `CiliumClusterwideNetworkPolicy`) plutôt qu'un objet par namespace : écarté pour rester sur les `NetworkPolicy` standard Kubernetes (portable, pas de dépendance à une CRD spécifique à Cilium), plus simple à auditer namespace par namespace.
- **Namespace créé sans son `NetworkPolicy`, à appliquer après coup via un outil externe (Kyverno, admission webhook)** : écarté — plus de complexité opérationnelle (nouvel opérateur à déployer) pour un gain équivalent à la solution retenue (création directe dans le code Java qui crée déjà le namespace).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/app/KnativeService.java`
- `k8s/tenant/network-policy.yaml` (nouveau)

## Changements réalisés

- `KnativeService.ensureNamespaceExists()` appelle désormais `ensureNetworkPolicyExists(namespace)` après la création (ou vérification d'existence) du namespace.
- Nouvelle méthode `ensureNetworkPolicyExists(namespace)` : idempotente (ne recrée pas l'objet s'il existe déjà), construit et applique un objet `NetworkPolicy` via le client Fabric8 avec les règles décrites ci-dessus.
- `k8s/tenant/network-policy.yaml` : même politique, en manifeste YAML autonome, pour rattraper les namespaces déjà existants sur le cluster.

## Impact

- **Futurs clients** : isolation réseau automatique dès la création de leur namespace, sans action manuelle.
- **Clients existants** (`user-adel`, `user-mohame`, `user-test`, `user-user`) : isolation appliquée seulement après que tu aies lancé les commandes ci-dessous.
- Aucun changement de comportement pour le trafic légitime déjà couvert par les règles (routage public via Kourier, Kafka, DNS, scraping Prometheus).
- **Risque de casse si l'hypothèse egress vers `platform` est fausse** : si une app tenant appelle aujourd'hui directement l'API backend ou un autre service du namespace `platform`, cet appel sera bloqué après application de la policy — à vérifier avant/juste après application (voir tests ci-dessous).

## Risques

- **Risque principal, à vérifier avant application en prod** : si des apps tenantes ont un besoin réseau non anticipé ici (ex. accès direct à un service dans `platform`, ou à un autre namespace non listé), elles seront bloquées silencieusement dès l'application de la policy — un `NetworkPolicy` ne génère pas d'erreur explicite côté application cliente, la connexion échoue simplement en timeout. Recommandation : appliquer d'abord sur un seul namespace de test (`user-test`) et valider le fonctionnement normal des apps qui y tournent avant de généraliser aux 3 autres.
- Aucun risque de régression côté backend/déploiement : la création de `NetworkPolicy` est enveloppée dans la même logique idempotente que la création de namespace, et n'échoue pas le déploiement en cas de policy déjà existante.
- Nécessite la permission RBAC `networkpolicies: get/create` pour le ServiceAccount `default` de `platform` — **non encore vérifiée** sur ce cluster (à tester, voir ci-dessous ; si absente, `ensureNetworkPolicyExists` échouera avec un 403 non catché, ce qui ferait échouer tout le déploiement d'app tant que ce n'est pas corrigé — contrairement au pattern "best-effort" de `QuotaService`).

## Tests à effectuer

- ✅ `mvn compile test-compile` — compilation complète sans erreur.
- **Avant tout déploiement** : `kubectl auth can-i create networkpolicies -n user-test --as=system:serviceaccount:platform:default` — si `no`, il faudra étendre `k8s/backend/rbac.yaml` (ticket 006) avec `networkpolicies: get/list/create` avant que cette correction fonctionne en pratique.
- Manuel (recommandé, sur `user-test` d'abord) : appliquer le manifeste sur un seul namespace, puis vérifier que les apps qui y tournent continuent de répondre normalement (URL publique accessible, métriques/logs toujours fonctionnels).
- Manuel : après application sur les 4 namespaces, tenter une connexion réseau d'un pod d'un namespace tenant vers un pod d'un autre namespace tenant — doit désormais échouer (timeout).
- Manuel : déployer une nouvelle app pour un tenant existant après le déploiement du backend mis à jour, vérifier dans les logs `platform-api` la ligne `NetworkPolicy 'tenant-default-isolation' created in namespace '...'`.

## Validation

1. `kubectl get networkpolicy -n user-test` (puis les 3 autres) → l'objet `tenant-default-isolation` existe.
2. Les apps existantes des 4 clients continuent de répondre normalement après application.
3. Un test de connectivité entre deux namespaces clients différents échoue.
4. Un nouveau client créé après déploiement du backend obtient automatiquement sa `NetworkPolicy` (visible dans les logs et via `kubectl get networkpolicy -n <nouveau-namespace>`).

## Commandes à exécuter toi-même sur le cluster

```bash
# 0. Vérifier d'abord que le RBAC autorise la création de NetworkPolicy
#    (sinon la partie backend de cette correction échouera silencieusement
#    au prochain déploiement — voir ticket 006)
kubectl auth can-i create networkpolicies -n user-test --as=system:serviceaccount:platform:default

# 1. Rattraper les 4 namespaces existants — recommandé de commencer par
#    UN SEUL namespace (user-test) et de valider avant de généraliser
for ns in user-test user-adel user-mohame user-user; do
  sed "s/NAMESPACE_PLACEHOLDER/${ns}/" k8s/tenant/network-policy.yaml | kubectl apply -f -
done

# 2. Vérifier que les 4 policies sont bien en place
kubectl get networkpolicy -A | grep tenant-default-isolation

# 3. Test de non-régression : une app existante dans un des namespaces
#    doit continuer à répondre normalement sur son URL publique
#    (remplace par une vraie URL d'app cliente)
curl -sf http://<url-app-tenant> -o /dev/null -w "%{http_code}\n"

# 4. Test d'isolation : depuis un pod d'un namespace tenant, tenter de
#    joindre un pod d'un AUTRE namespace tenant — doit désormais échouer
kubectl run netcheck --rm -it --image=busybox -n user-test --restart=Never -- \
  wget -qO- --timeout=3 http://<un-service>.user-adel.svc.cluster.local:<port>
# → doit timeout (c'est le comportement attendu, la policy bloque ce trafic)
```

## Commit Git conseillé

```
fix(security): add default-deny NetworkPolicy per tenant namespace (existing + auto-created)
```
