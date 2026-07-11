# FIX 14 — Jenkins bloqué après build backend (suite de FIX_08)

## Symptôme

Après un build via le job Jenkins du backend (`platform-backend`), tout nouveau build (peu importe le job) reste bloqué — il faut faire `kubectl rollout restart deployment/jenkins -n jenkins` pour débloquer. Le job admin (`platform-admin`), lui, ne pose jamais ce problème : on peut enchaîner les builds sans souci.

## Contexte : le fix précédent (FIX_08)

`docs/FIX_08_JENKINS_JNA_SPAWN_HELPER.md` documentait déjà ce problème : Jenkins extrait un binaire natif ("spawn helper" JNA) dans `/tmp/jna-XXXXX/` au démarrage, et **Kaniko** (le builder Docker du pipeline) perturbe `/tmp` pendant le build, corrompant ce spawn helper. La solution retenue à l'époque : rediriger `jna.tmpdir` hors de `/tmp`, vers un dossier persistant (`/var/jenkins_home/.jna-tmp`), via `JAVA_TOOL_OPTIONS` dans le Jenkinsfile.

## Pourquoi le problème persiste uniquement côté backend

`Jenkinsfile.backend` déclare bien `JAVA_TOOL_OPTIONS = '-Djna.tmpdir=/var/jenkins_home/.jna-tmp'`, **mais ce dossier n'était jamais créé** (`mkdir`) — ni dans le stage `Cleanup`, ni ailleurs. Si le dossier n'existe pas, JNA retombe silencieusement sur `/tmp`, annulant la protection.

Ce qui différencie concrètement le pipeline backend du pipeline admin :
- `Jenkinsfile.admin` : `npm install` + `npm run build` — **aucun processus Java** lancé.
- `Jenkinsfile.backend` : `mvn clean package` — un **second processus Java** (Maven, qui utilise aussi JNA) tourne sur le même pod que Jenkins, en plus de Kaniko. Ce cumul (JVM Jenkins + JVM Maven + Kaniko perturbant `/tmp`) augmente fortement la probabilité de corrompre le spawn helper de Jenkins lui-même. Le pipeline admin, sans JVM Maven, n'a pas ce risque cumulé.

## Correctif appliqué

Ajout de `mkdir -p /var/jenkins_home/.jna-tmp` dans le stage `Cleanup`, pour garantir que le dossier existe réellement avant que Maven et Kaniko ne démarrent — dans les 3 Jenkinsfiles concernés (par cohérence, même si seul le backend manifestait le symptôme) :
- `ci-cd/jenkins/pipelines/Jenkinsfile.backend`
- `ci-cd/jenkins/pipelines/Jenkinsfile.admin`
- `ci-cd/jenkins/pipelines/Jenkinsfile.frontend`

## Si le problème persiste malgré ce fix

Vérifier que le correctif "permanent" niveau cluster décrit dans FIX_08 (Étape 3 — patch du `Deployment jenkins` pour rediriger `JAVA_TOOL_OPTIONS` au niveau du pod, pas juste du pipeline) est toujours en place — il a pu être perdu si le Deployment Jenkins a été recréé/redéployé depuis :
```bash
kubectl get deployment jenkins -n jenkins -o jsonpath='{.spec.template.spec.containers[0].env}'
```
Si `JAVA_TOOL_OPTIONS` n'y figure plus (ou pointe encore vers `/tmp`), réappliquer le patch de FIX_08 (Étape 3), en alignant le chemin sur `/var/jenkins_home/.jna-tmp` pour rester cohérent avec les Jenkinsfiles.
