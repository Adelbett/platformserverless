# Secrets en clair (Postgres / Keycloak admin / JWT mort)

## Problème

Des identifiants réels étaient codés en dur, versionnés dans Git, dans le profil Spring **réellement déployé en cluster** et dans les manifestes Kubernetes appliqués :
- Mot de passe Postgres `postgres`/`postgres` (profil par défaut, profil `k8s`, `k8s/backend/deployment.yaml`, `k8s/backup/postgres-backup-cronjob.yaml`).
- Identifiants admin Keycloak `admin`/`admin` codés en dur dans `application-k8s.yml`.
- Un "secret JWT" (`app.jwt.secret`) en base64 en dur dans `application.yml`, non lu par aucune classe Java du projet.

## Gravité

Critique

## Pourquoi c'était un problème

- Ces valeurs sont dans l'historique Git — toute personne ayant accès en lecture au dépôt les a immédiatement.
- Ce ne sont pas des valeurs de développement isolées : `k8s/backend/deployment.yaml` est le manifeste appliqué en cluster, la valeur `postgres`/`postgres` y était fournie explicitement comme variable d'environnement, pas comme simple filet de sécurité.
- Le compte admin Keycloak avec mot de passe `admin` donne accès à l'administration complète du realm (création/suppression d'utilisateurs, gestion des rôles pour toute la plateforme) — un identifiant devinable en une tentative.
- `app.jwt.secret` était un secret sensible codé en dur pour une fonctionnalité qui n'existe pas dans le code (recherche exhaustive : zéro classe Java le lit) — un risque gratuit.

Ces identifiants doivent être considérés comme compromis dès l'instant où ils sont dans l'historique Git, indépendamment de leur suppression du fichier actuel.

## Solution retenue

**Côté code** (fait) :
1. `application-k8s.yml` : suppression des valeurs par défaut sensibles.
   - `spring.datasource.password` : `${SPRING_DATASOURCE_PASSWORD:postgres}` → `${SPRING_DATASOURCE_PASSWORD}` (obligatoire, aucun fallback — Spring refusera de démarrer si la variable n'est pas fournie).
   - `app.keycloak.admin-password` : `admin` (en dur) → `${KEYCLOAK_ADMIN_PASSWORD}` (obligatoire).
   - `spring.datasource.username` et `app.keycloak.admin-username` gardent un défaut (`postgres`/`admin`) car ce sont des noms de compte, pas des secrets à proprement parler — mais ils sont eux aussi fournis via le `Secret` K8s pour une rotation atomique cohérente avec le mot de passe.
2. `application.yml` (profil de base) : `app.jwt.secret` externalisé vers `${APP_JWT_SECRET:}` (plus aucune valeur en dur), conservé car actuellement inutilisé mais susceptible de servir plus tard — choix confirmé par l'utilisateur (garder plutôt que supprimer).
3. `k8s/backend/deployment.yaml` : `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` passent de `value: "..."` en clair à `valueFrom.secretKeyRef` pointant vers un `Secret` Kubernetes `platform-api-secrets` (namespace `platform`).
4. `k8s/backup/postgres-backup-cronjob.yaml` : `PGUSER`/`PGPASSWORD` (utilisés par le `pg_dump` de sauvegarde) passent au même `secretKeyRef`, pour éviter une deuxième copie en clair du même mot de passe.

**Côté cluster** (à appliquer par l'utilisateur — accès direct au cluster non disponible depuis cette session) :
- Créer le `Secret` `platform-api-secrets` dans le namespace `platform` avec les **nouveaux** mots de passe (pas les anciens `postgres`/`admin`).
- Changer réellement le mot de passe du rôle Postgres et du compte admin Keycloak avant/pendant le déploiement.
- Appliquer les manifestes mis à jour dans le bon ordre (Secret d'abord, sinon le pod ne démarre plus).

Commandes détaillées fournies séparément ci-dessous.

## Alternatives étudiées

- **Sealed Secrets / External Secrets Operator** : permettrait de versionner les secrets chiffrés dans Git. Écartée pour cette correction — nécessiterait d'installer un opérateur supplémentaire sur le cluster, hors périmètre d'une correction unique ; le `Secret` K8s natif suffit et est standard. Option à reconsidérer plus tard si le besoin de GitOps sur les secrets se confirme.
- **Suppression pure de `app.jwt.secret`** (puisqu'inutilisé) : écartée sur décision explicite de l'utilisateur, qui préfère le garder disponible pour un usage futur, mais correctement externalisé.

## Fichiers modifiés

- `backend-api/src/main/resources/application.yml`
- `backend-api/src/main/resources/application-k8s.yml`
- `k8s/backend/deployment.yaml`
- `k8s/backup/postgres-backup-cronjob.yaml`

## Changements réalisés

- `application-k8s.yml` : `SPRING_DATASOURCE_PASSWORD` et `KEYCLOAK_ADMIN_PASSWORD` n'ont plus de valeur de repli — ils doivent être fournis par l'environnement, sinon le démarrage Spring échoue explicitement (fail-fast, préférable à un démarrage silencieux avec un mot de passe faible).
- `application.yml` : `app.jwt.secret` n'a plus de valeur en dur, lu depuis `APP_JWT_SECRET` (vide par défaut, n'empêche pas le démarrage puisque non consommé par le code).
- `k8s/backend/deployment.yaml` : 4 variables d'environnement passent de valeurs en clair à des références vers le `Secret` `platform-api-secrets` (clés : `postgres-username`, `postgres-password`, `keycloak-admin-username`, `keycloak-admin-password`).
- `k8s/backup/postgres-backup-cronjob.yaml` : `PGUSER`/`PGPASSWORD` référencent désormais le même `Secret`, plutôt qu'une deuxième copie en clair du mot de passe.

## Impact

- Aucun changement de comportement fonctionnel — uniquement la façon dont les identifiants sont fournis au processus.
- **Le pod `platform-api` ne démarrera plus tant que le `Secret` `platform-api-secrets` n'existe pas dans le namespace `platform`** — c'est voulu (fail-fast plutôt que démarrage silencieux avec un mot de passe faible), mais impose un ordre d'application strict côté cluster (voir commandes ci-dessous).
- Idem pour le `CronJob` `postgres-backup` : le prochain déclenchement échouera si le `Secret` n'existe pas encore.

## Risques

- **Risque de panne si l'ordre d'application n'est pas respecté** : appliquer le nouveau `deployment.yaml` avant d'avoir créé le `Secret` mettra `platform-api` en échec de démarrage. Voir la procédure ordonnée ci-dessous.
- **Pas de rotation des mots de passe (décision explicite)** : le `Secret` créé contient les mêmes valeurs (`postgres`/`postgres`, `admin`/`admin`) que celles qui étaient en clair dans le code. Cette correction empêche une **future** fuite via le dépôt Git, mais ne protège pas contre le fait que ces valeurs sont déjà visibles dans l'historique Git existant. La rotation reste possible à tout moment via les commandes en annexe.
- `application.yml`/`application-dev.yml`/`application-local.yml` (profils de développement local) gardent encore `postgres`/`postgres` en dur — volontairement laissés hors périmètre de ce ticket (credentials d'un Postgres local, non exposés en cluster) ; proposé séparément comme amélioration mineure si tu veux les aligner aussi.

## Commandes à exécuter toi-même sur le cluster (dans cet ordre)

**Décision explicite de l'utilisateur : pas de rotation des mots de passe pour cette correction.** Le `Secret` est créé avec les valeurs actuelles (`postgres`/`postgres`, `admin`/`admin`) — cette correction sort les identifiants du code en clair vers un `Secret` K8s, mais ne change pas leur valeur. Ces valeurs restent celles qui étaient dans l'historique Git ; une rotation reste possible plus tard, indépendamment de cette correction (commandes fournies en annexe ci-dessous si besoin futur).

**1. Créer le `Secret` Kubernetes avec les mots de passe actuels** :

```bash
kubectl create secret generic platform-api-secrets \
  --namespace platform \
  --from-literal=postgres-username=postgres \
  --from-literal=postgres-password=postgres \
  --from-literal=keycloak-admin-username=admin \
  --from-literal=keycloak-admin-password=admin
```

**2. Vérifier que le Secret existe et contient bien les 4 clés attendues** :

```bash
kubectl get secret platform-api-secrets -n platform -o jsonpath='{.data}' | jq 'keys'
# doit afficher : ["keycloak-admin-password","keycloak-admin-username","postgres-password","postgres-username"]
```

**3. Appliquer les manifestes mis à jour** :

```bash
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backup/postgres-backup-cronjob.yaml
```

**4. Vérifier le redémarrage propre du pod backend** :

```bash
kubectl rollout status deployment/platform-api -n platform
kubectl logs -n platform deploy/platform-api --tail=50
# vérifier l'absence d'erreur de connexion DB / Keycloak au démarrage
```

### Annexe — commandes de rotation (non exécutées, à conserver pour plus tard si tu changes d'avis)

```bash
# Postgres
kubectl exec -it -n platform deploy/postgres -- psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<NOUVEAU_MOT_DE_PASSE_POSTGRES>';"

# Keycloak
kubectl exec -it -n platform deploy/keycloak -- /opt/keycloak/bin/kcadm.sh set-password \
  --username admin --new-password '<NOUVEAU_MOT_DE_PASSE_KEYCLOAK>' \
  --target-realm master

# Puis mettre à jour le Secret avec les nouvelles valeurs :
kubectl create secret generic platform-api-secrets \
  --namespace platform \
  --from-literal=postgres-username=postgres \
  --from-literal=postgres-password='<NOUVEAU_MOT_DE_PASSE_POSTGRES>' \
  --from-literal=keycloak-admin-username=admin \
  --from-literal=keycloak-admin-password='<NOUVEAU_MOT_DE_PASSE_KEYCLOAK>' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/platform-api -n platform
```

**5. (Optionnel) Générer une valeur pour `APP_JWT_SECRET`** si tu veux éviter la chaîne vide par défaut (sans impact fonctionnel actuel, secret non consommé par le code) :

```bash
kubectl create secret generic platform-api-secrets \
  --namespace platform \
  --from-literal=postgres-username=postgres \
  --from-literal=postgres-password='<NOUVEAU_MOT_DE_PASSE_POSTGRES>' \
  --from-literal=keycloak-admin-username=admin \
  --from-literal=keycloak-admin-password='<NOUVEAU_MOT_DE_PASSE_KEYCLOAK>' \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --dry-run=client -o yaml | kubectl apply -f -
```
puis ajouter dans `k8s/backend/deployment.yaml` une variable `APP_JWT_SECRET` avec `secretKeyRef.key: jwt-secret` — je peux le faire dans une correction dédiée si tu veux l'activer.

## Tests à effectuer

- ✅ `mvn compile test-compile` — compilation complète sans erreur, aucun test cassé (aucun test ne charge le profil `k8s`).
- Manuel (cluster, après application) : confirmer que `platform-api` démarre et répond (`kubectl get pods -n platform`, `GET /actuator/health`).
- Manuel (cluster) : confirmer que l'ancien mot de passe Postgres/Keycloak ne fonctionne plus nulle part.
- Manuel (cluster) : au prochain déclenchement programmé (ou en le lançant manuellement via `kubectl create job --from=cronjob/postgres-backup postgres-backup-test -n platform`), vérifier que le `CronJob` de backup réussit toujours.

## Validation

1. `kubectl get secret platform-api-secrets -n platform` existe et contient les 4 clés.
2. `kubectl rollout status deployment/platform-api -n platform` se termine avec succès (pas de `CrashLoopBackOff`).
3. Connexion à l'application (login, listing des apps) fonctionne normalement.
4. `git log -p -- backend-api/src/main/resources/application-k8s.yml k8s/backend/deployment.yaml` ne montre plus aucun mot de passe en clair dans le fichier actuel (l'historique antérieur reste visible — rotation des mots de passe = mitigation, pas suppression de l'historique).

## Commit Git conseillé

```
fix(security): externalize hardcoded Postgres/Keycloak credentials to Kubernetes Secret
```
