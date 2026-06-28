# Plan de Test — PlatformServerless

> Plan de test fonctionnel complet, organisé par acteur (CLIENT_ADMIN / DEVELOPER) et par module.
> Format : ID | Titre | Préconditions | Étapes | Résultat attendu | Statut (à remplir pendant le test)

---

## Légende des statuts à remplir

```
✅ PASS   — comportement conforme
❌ FAIL   — comportement incorrect (noter le détail)
⚠️ PARTIEL — fonctionne mais avec un défaut mineur
⏭️ SKIP   — non testable dans cet environnement
```

---

## 0. Pré-requis avant de commencer

| # | Action |
|---|---|
| 0.1 | Créer un compte CLIENT_ADMIN "EntrepriseA" via `/register` |
| 0.2 | Depuis ce compte, ajouter un membre DEVELOPER "dev-a" (Team → Add member) |
| 0.3 | Créer un 2ème compte CLIENT_ADMIN "EntrepriseB" (pour tester l'isolation multi-tenant) |
| 0.4 | Récupérer un compte ADMIN existant (ou en créer un via Keycloak) |
| 0.5 | Préparer 2 images de test : `gcr.io/knative-samples/helloworld-go` (saine) et `alpine` (crash loop) |

---

## 1. AUTHENTIFICATION (tous rôles)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| AUTH-01 | Inscription | Public | `POST /api/auth/register` avec username/email/password valides | Compte créé, rôle CLIENT_ADMIN par défaut | |
| AUTH-02 | Connexion | CLIENT_ADMIN | Login via Keycloak avec les identifiants | Token JWT obtenu, redirection dashboard | |
| AUTH-03 | Connexion DEVELOPER | DEVELOPER | Login avec le compte membre créé en 0.2 | Connexion réussie, namespace = celui de EntrepriseA | |
| AUTH-04 | Token expiré | Tous | Attendre expiration du JWT (ou forcer), faire un appel API | 401 Unauthorized, redirection `/login` | |
| AUTH-05 | Profil | Tous | `GET /api/users/me` | Renvoie username/email/role corrects, jamais le password | |

---

## 2. GESTION D'ÉQUIPE (CLIENT_ADMIN uniquement)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| TEAM-01 | Lister l'équipe | CLIENT_ADMIN | `GET /api/team/members` | Liste des membres de SON équipe uniquement | |
| TEAM-02 | Ajouter un membre | CLIENT_ADMIN | Ajouter "dev-a" avec rôle MEMBER | Membre créé en DB + Keycloak, peut se connecter | |
| TEAM-03 | DEVELOPER ne peut pas gérer l'équipe | DEVELOPER | Tenter `GET /api/team/members` avec token DEVELOPER | **403 Forbidden** (`@PreAuthorize hasRole('CLIENT_ADMIN')`) | |
| TEAM-04 | Modifier permissions d'un membre | CLIENT_ADMIN | Retirer `DEPLOY_APP` et `DELETE_APP` au membre "dev-a" | Permissions mises à jour en base | |
| TEAM-05 | Supprimer un membre | CLIENT_ADMIN | Supprimer "dev-a" | Membre supprimé de la DB et de Keycloak, ne peut plus se connecter | |
| TEAM-06 | Isolation inter-équipes | CLIENT_ADMIN A | Tenter de lister/modifier un membre de EntrepriseB en devinant son `memberId` | 403/404 — aucun accès croisé | |

---

## 3. RBAC — TEST CRITIQUE (le bug qu'on a corrigé au point #1)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| RBAC-01 | MEMBER sans DEPLOY_APP ne peut pas déployer | DEVELOPER (permissions retirées en TEAM-04) | `POST /api/apps` avec un payload valide | **403 Forbidden** | |
| RBAC-02 | MEMBER sans DEPLOY_APP ne peut pas redéployer | idem | `POST /api/apps/{id}/deploy` | **403 Forbidden** ← bug corrigé, à vérifier en priorité | |
| RBAC-03 | MEMBER sans DEPLOY_APP ne peut pas modifier | idem | `PUT /api/apps/{id}` | **403 Forbidden** ← bug corrigé, à vérifier en priorité | |
| RBAC-04 | MEMBER sans DELETE_APP ne peut pas supprimer | idem | `DELETE /api/apps/{id}` | **403 Forbidden** | |
| RBAC-05 | MEMBER sans MANAGE_EVENTING ne peut pas publier d'event | idem | `POST /api/events` | **403 Forbidden** ← 2ème bug corrigé | |
| RBAC-06 | MEMBER avec DEPLOY_APP peut déployer | DEVELOPER (avec permission ré-accordée) | Redonner `DEPLOY_APP` puis `POST /api/apps` | 201 Created | |
| RBAC-07 | CLIENT_ADMIN bypass toujours autorisé | CLIENT_ADMIN | N'importe quelle action de mutation | Toujours autorisé (pas de check granulaire) | |
| RBAC-08 | DEVELOPER ne peut pas accéder à l'admin | DEVELOPER | `GET /api/admin/stats` | **403 Forbidden** | |

---

## 4. APPLICATIONS — Déploiement & cycle de vie

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| APP-01 | Déployer une app saine | CLIENT_ADMIN | Déployer `gcr.io/knative-samples/helloworld-go`, port 8080 | Statut `DEPLOYING` → `RUNNING`, URL générée | |
| APP-02 | Lister ses apps | CLIENT_ADMIN | `GET /api/apps` | Renvoie uniquement les apps de cet utilisateur/équipe | |
| APP-03 | Détail d'une app — statut synchronisé | CLIENT_ADMIN | Ouvrir `AppDetails`, attendre scale-to-zero, recharger la page | Badge passe de RUNNING à **IDLE** ← bug corrigé, à vérifier | |
| APP-04 | Namespace non visible côté client | CLIENT_ADMIN | Observer la page détail + liste des apps | **Aucune mention de `ns:` ou du nom du namespace** ← correctif sécurité | |
| APP-05 | Mise à jour d'une app | CLIENT_ADMIN | `PUT /api/apps/{id}` avec nouveau tag d'image | Nouvelle Revision créée, app redéployée | |
| APP-06 | Suppression d'une app | CLIENT_ADMIN | `DELETE /api/apps/{id}` | Service Knative supprimé du cluster, statut DB = `DELETED` (pas de suppression physique, historique billing conservé) | |
| APP-07 | Isolation multi-tenant | CLIENT_ADMIN B | Tenter `GET /api/apps/{id}` sur une app appartenant à EntrepriseA | **403/404 Unauthorized** | |
| APP-08 | DEVELOPER voit les apps de son équipe | DEVELOPER | `GET /api/apps` | Renvoie les apps du CLIENT_ADMIN propriétaire (délégation `UserContextService`) | |

---

## 5. ROLLBACK DE REVISIONS (point #5 — nouvelle fonctionnalité)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| ROLL-01 | Lister les Revisions | CLIENT_ADMIN | Déployer 2 fois la même app (image différente), `GET /api/apps/{id}/revisions` | 2 Revisions renvoyées, triées de la plus récente à la plus ancienne | |
| ROLL-02 | Rollback réussi | CLIENT_ADMIN | `POST /api/apps/{id}/rollback/{ancienne-revision}` | Trafic basculé à 100% vers l'ancienne Revision, `DeploymentLog` type=`ROLLBACK` créé | |
| ROLL-03 | Notification de rollback | CLIENT_ADMIN | Après ROLL-02, observer le bandeau cloche | Notification `↩️ ROLLBACK` apparaît en temps réel (SSE) | |
| ROLL-04 | DEVELOPER sans DEPLOY_APP ne peut pas rollback | DEVELOPER (permission retirée) | Tenter le rollback | **403 Forbidden** | |
| ROLL-05 | Rollback sur app d'un autre client | CLIENT_ADMIN B | Tenter rollback sur une app de EntrepriseA | 403 Unauthorized (ownership check) | |
| ROLL-06 | UI Rollback visible | CLIENT_ADMIN | Page `AppDetails` → section "Revisions & Rollback" | Liste affichée, bouton rollback fonctionnel sur les anciennes revisions | |

---

## 6. LOGS

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| LOG-01 | Logs de déploiement par app | CLIENT_ADMIN | `GET /api/logs/apps/{id}` | Historique complet renvoyé | |
| LOG-02 | Filtrage par niveau (point #2) | CLIENT_ADMIN | `GET /api/logs/apps/{id}?level=ERROR` | Seuls les logs `DEPLOYMENT_FAIL`/contenant FAIL/ERROR renvoyés | |
| LOG-03 | Filtrage INFO | CLIENT_ADMIN | `GET /api/logs/apps/{id}?level=INFO` | Logs `DEPLOYMENT_SUCCESS`, `DELETE`, etc. renvoyés, pas les FAIL | |
| LOG-04 | Stream SSE logs de déploiement | CLIENT_ADMIN | Ouvrir `/api/logs/stream`, déclencher un déploiement dans un autre onglet | Nouveau log apparaît en direct sans rafraîchir | |
| LOG-05 | Logs conteneur live (pod-logs) — app RUNNING | CLIENT_ADMIN | App avec ≥1 replica actif, ouvrir page détail | Badge `LIVE`, vraies lignes stdout affichées | |
| LOG-06 | Logs conteneur — app IDLE (correctif appliqué) | CLIENT_ADMIN | App scale-to-zero, ouvrir page détail | Badge **`NO ACTIVE POD`** + message explicite, PAS de "CONNECTING" infini ← bug corrigé | |
| LOG-07 | Isolation logs conteneur | CLIENT_ADMIN B | Tenter `GET /api/logs/apps/{id}/pod-logs/stream` sur une app de EntrepriseA | 403 Unauthorized | |

---

## 7. KAFKA

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| KAFKA-01 | Créer un topic | CLIENT_ADMIN | `POST /api/kafka/topics` | Topic créé en DB + cluster Kafka réel | |
| KAFKA-02 | Lister les topics avec métriques | CLIENT_ADMIN | `GET /api/kafka/topics` | `messageCount` et `consumerLag` renseignés | |
| KAFKA-03 | Détail d'un topic — lag visible (point #3) | CLIENT_ADMIN | `GET /api/kafka/topics/{id}` | `consumerLag` renseigné (pas `null`) ← bug corrigé, à vérifier en priorité | |
| KAFKA-04 | DEVELOPER sans MANAGE_KAFKA ne peut pas créer | DEVELOPER (permission retirée) | `POST /api/kafka/topics` | **403 Forbidden** | |
| KAFKA-05 | Suppression d'un topic | CLIENT_ADMIN | `DELETE /api/kafka/topics/{id}` | Supprimé du cluster Kafka et de la DB | |

---

## 8. EVENTING

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| EVT-01 | Créer une KafkaSource | CLIENT_ADMIN | `POST /api/eventing/sources` | Source créée, liée au bon topic | |
| EVT-02 | Créer un Trigger | CLIENT_ADMIN | `POST /api/eventing/triggers` | Trigger créé, filtre appliqué | |
| EVT-03 | Publier un CloudEvent | CLIENT_ADMIN | `POST /api/events` avec payload valide | 202 Accepted, événement reçu par le broker | |
| EVT-04 | DEVELOPER sans permission ne peut pas publier | DEVELOPER (permission retirée) | `POST /api/events` | **403 Forbidden** ← bug corrigé | |
| EVT-05 | Suppression d'un trigger | CLIENT_ADMIN | `DELETE /api/eventing/triggers/{id}` | Supprimé du cluster | |

---

## 9. FACTURATION (BILLING)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| BILL-01 | Consulter sa facturation | CLIENT_ADMIN | `GET /api/billing/me` | Historique mensuel avec agrégation journalière | |
| BILL-02 | Export Excel | CLIENT_ADMIN | `GET /api/billing/export` | Fichier XLSX téléchargé, données cohérentes | |
| BILL-03 | DEVELOPER sans VIEW_BILLING ne peut pas consulter | DEVELOPER (permission retirée) | `GET /api/billing/me` | **403 Forbidden** | |
| BILL-04 | ADMIN voit la facturation globale | ADMIN | `GET /api/billing/admin` | Tous les clients listés avec leurs coûts | |

---

## 10. ALERTING BUDGET (point #6 — nouvelle fonctionnalité)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| ALERT-01 | Pas d'alerte sous le seuil | CLIENT_ADMIN | Consommation < seuil configuré | Aucune notification `BUDGET_ALERT` | |
| ALERT-02 | Alerte déclenchée au dépassement | CLIENT_ADMIN | Déployer plusieurs apps pour dépasser le seuil (ou abaisser temporairement le seuil en config pour tester plus vite) | Notification `💰 BUDGET_ALERT` apparaît dans le bandeau, message formulé en "estimation facture" (pas un débit) | |
| ALERT-03 | Pas de doublon dans l'heure suivante | CLIENT_ADMIN | Attendre le prochain cycle horaire du scheduler | Aucune 2ème alerte identique créée (cooldown mensuel) | |
| ALERT-04 | Isolation — alerte visible uniquement par le bon client | CLIENT_ADMIN B | Vérifier qu'aucune alerte de EntrepriseA n'apparaît chez EntrepriseB | Aucune fuite cross-tenant | |

---

## 11. DÉTECTION CRASH LOOP (point #7 — nouvelle fonctionnalité)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| CRASH-01 | Déployer une image qui crash | CLIENT_ADMIN | Déployer `alpine:latest` | Pod démarre puis crash en boucle (`kubectl get pods` → `CrashLoopBackOff`) | |
| CRASH-02 | Détection sous le seuil | CLIENT_ADMIN | Observer avant que `restartCount` atteigne 5 | Aucune alerte encore | |
| CRASH-03 | Alerte déclenchée | CLIENT_ADMIN | Attendre que `restartCount ≥ 5` (max 1 cycle de scan, 5 min) | Notification `💥 CRASH_LOOP_ALERT` apparaît avec le nombre de redémarrages | |
| CRASH-04 | Pas de spam dans l'heure | CLIENT_ADMIN | Attendre 2-3 cycles de scan supplémentaires (10-15 min) | Aucune nouvelle alerte tant que le cooldown d'1h n'est pas écoulé | |
| CRASH-05 | Nettoyage | CLIENT_ADMIN | Supprimer l'app `alpine` de test | App supprimée, plus de scan inutile sur ce service | |

---

## 12. MONITORING

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| MON-01 | Métriques par app | CLIENT_ADMIN | `GET /api/metrics/apps/{id}` | CPU, mémoire, requêtes, latence P95, erreurs renvoyés | |
| MON-02 | Stream SSE métriques | CLIENT_ADMIN | Ouvrir `/api/metrics/apps/{id}/stream` | Nouvelle donnée toutes les ~5-10s | |
| MON-03 | CPU vs Mémoire — clarté affichage | CLIENT_ADMIN | Observer `AppDetails` | Sous-libellés "of X allocated" / "requested (no live data)" visibles ← amélioration appliquée | |
| MON-04 | Métriques cluster | ADMIN | `GET /api/metrics/cluster` | Données agrégées tout le cluster | |
| MON-05 | DEVELOPER sans VIEW_MONITORING ne peut pas consulter | DEVELOPER (permission retirée) | `GET /api/metrics/apps/{id}` | **403 Forbidden** | |

---

## 13. ADMINISTRATION (ADMIN uniquement)

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| ADM-01 | Stats globales | ADMIN | `GET /api/admin/stats` | Données plateforme entière | |
| ADM-02 | Vue d'ensemble cluster | ADMIN | `GET /api/admin/cluster/overview` | Nœuds, pods, namespaces, Kafka, Knative | |
| ADM-03 | Suspendre un client | ADMIN | `POST /api/admin/clients/{userId}/suspend` | Toutes les apps du client passent en scale-to-zero forcé, `suspended=true` | |
| ADM-04 | Client suspendu ne peut plus agir | CLIENT_ADMIN (suspendu) | Tenter `POST /api/apps` | 403 ou comportement bloqué selon implémentation — **à vérifier précisément** | |
| ADM-05 | Restaurer un client | ADMIN | `POST /api/admin/clients/{userId}/restore` | `suspended=false`, apps redéployables | |
| ADM-06 | Lister tous les clients | ADMIN | `GET /api/admin/clients` | Tous les CLIENT_ADMIN avec leur statut | |
| ADM-07 | CLIENT_ADMIN ne peut pas accéder à l'admin | CLIENT_ADMIN | `GET /api/admin/stats` | **403 Forbidden** | |

---

## 14. SÉCURITÉ KUBERNETES (vérification infra, pas applicative)

| ID | Titre | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|
| K8S-01 | ServiceAccount restrictif actif | `kubectl get clusterrolebinding \| grep platform` | `platform-correct-binding` présent, **`platform-api-admin` (cluster-admin) absent** | |
| K8S-02 | Permissions suffisantes | `kubectl auth can-i create services.serving.knative.dev --as=system:serviceaccount:platform:default -n platform` | `yes` | |
| K8S-03 | Permissions limitées | `kubectl auth can-i delete nodes --as=system:serviceaccount:platform:default` | `no` | |
| K8S-04 | Lecture des logs de pod autorisée | `kubectl auth can-i get pods/log --as=system:serviceaccount:platform:default -n user-entreprisea` | `yes` (nécessaire pour le point logs conteneur) | |

---

## 15. FRONTEND — Vérifications visuelles transverses

| ID | Titre | Rôle | Étapes | Résultat attendu | Statut |
|---|---|---|---|---|---|
| UI-01 | Aucune fuite de namespace | CLIENT_ADMIN/DEVELOPER | Parcourir `AppsList`, `AppDetails` | Aucune mention de `ns:` ou nom de namespace visible | |
| UI-02 | Bandeau notifications — tous les nouveaux types | CLIENT_ADMIN | Déclencher rollback + alerte budget + crash loop successivement | Les 3 types (`↩️`, `💰`, `💥`) s'affichent avec icône/couleur distincte | |
| UI-03 | Filtres logs fonctionnels | CLIENT_ADMIN | Page `Logs`, cliquer ALL/INFO/WARN/ERROR | Liste filtrée correctement côté UI | |
| UI-04 | Responsive / pas de crash console | Tous | Naviguer sur toutes les pages avec DevTools ouvert | Aucune erreur JS dans la console | |

---

## Résumé d'exécution (à remplir après la campagne de test)

| Module | Total tests | ✅ Pass | ❌ Fail | ⚠️ Partiel |
|---|---|---|---|---|
| Authentification | 5 | | | |
| Gestion d'équipe | 6 | | | |
| RBAC (critique) | 8 | | | |
| Applications | 8 | | | |
| Rollback Revisions | 6 | | | |
| Logs | 7 | | | |
| Kafka | 5 | | | |
| Eventing | 5 | | | |
| Facturation | 4 | | | |
| Alerting Budget | 4 | | | |
| Crash Loop | 5 | | | |
| Monitoring | 5 | | | |
| Administration | 7 | | | |
| Sécurité K8s | 4 | | | |
| Frontend transverse | 4 | | | |
| **TOTAL** | **84** | | | |

---

## Priorité d'exécution recommandée

```
1. RBAC-01 à RBAC-08   ← failles de sécurité, à valider en premier
2. APP-03, APP-04      ← bugs frontend corrigés récemment
3. LOG-06               ← bug frontend corrigé récemment
4. KAFKA-03             ← bug backend corrigé récemment
5. ROLL-01 à ROLL-06    ← nouvelle fonctionnalité complète
6. ALERT-01 à ALERT-04  ← nouvelle fonctionnalité complète
7. CRASH-01 à CRASH-05  ← nouvelle fonctionnalité complète
8. Le reste, par ordre de criticité métier
```

---

*Document à utiliser comme checklist pendant la campagne de test manuelle sur le cluster réel. Noter pour chaque ❌ FAIL : comportement observé, logs backend (`kubectl logs`), et requête exacte effectuée pour reproduction.*
