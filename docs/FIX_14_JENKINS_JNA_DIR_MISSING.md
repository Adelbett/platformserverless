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

## Suite — le fix ci-dessus n'a pas suffi

Après application du fix `mkdir` ci-dessus, le problème est réapparu, mais avec une **erreur différente et plus parlante** :

```
java.io.IOException: error=0, Failed to exec spawn helper: pid: 532, exit value: 1
Caused: java.io.IOException: Cannot run program "git" (in directory "/var/jenkins_home/caches/git-...")
Caused: hudson.plugins.git.GitException: Error performing git command: git init /var/jenkins_home/caches/git-...
	at ... GitSCMFileSystem$BuilderImpl.build
	at ... CpsScmFlowDefinition.create
	at ... WorkflowRun.run
Finished: FAILURE
```

### Pourquoi c'est différent (et plus grave) que prévu

Cette erreur se produit **avant même le début du pipeline** `platform-admin` — Jenkins essaie juste de lire le `Jenkinsfile` depuis Git (`git init` dans `/var/jenkins_home/caches/git-...`) pour savoir quoi exécuter, et ça plante déjà.

Ça prouve que le spawn helper cassé n'est pas celui d'un build (Maven/Kaniko dans un pipeline) — c'est celui de la **JVM Jenkins elle-même** (le process "master"), qui gère TOUT (y compris la simple lecture du Jenkinsfile). Cette JVM est démarrée **une seule fois** au lancement du pod Jenkins, et extrait son spawn helper à ce moment-là. Une fois corrompu pendant un build backend (Kaniko + Maven perturbant `/tmp`), rien dans un Jenkinsfile ne peut le réparer — il faut que **le pod Jenkins entier démarre avec `jna.tmpdir` pointé ailleurs que `/tmp` dès le lancement**, pas seulement pendant l'exécution d'un pipeline.

C'est exactement l'étape 3 du fix précédent (`FIX_08`, "Fix permanent du spawn helper — niveau cluster") — qui a dû être perdue depuis (probablement un redéploiement de Jenkins qui a écrasé le patch).

### Commandes à exécuter (dans l'ordre)

**1. Vérifier si le patch est toujours en place :**
```bash
kubectl get deployment jenkins -n jenkins -o jsonpath='{.spec.template.spec.containers[0].env}' | jq
```
Si tu ne vois **pas** de `JAVA_TOOL_OPTIONS` avec `-Djna.tmpdir=/var/jenkins_home/.jna-tmp` dedans (ou qu'il pointe encore vers `/tmp`), continue avec les étapes suivantes.

**2. Créer les dossiers persistants AVANT le redémarrage** (sur le pod Jenkins actuel, encore vivant) :
```bash
kubectl exec -n jenkins deployment/jenkins -- mkdir -p /var/jenkins_home/tmp /var/jenkins_home/.jna-tmp
```

**3. Patcher le Deployment pour que la JVM Jenkins démarre avec ces chemins :**
```bash
kubectl set env deployment/jenkins -n jenkins \
  JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=/var/jenkins_home/tmp -Djna.tmpdir=/var/jenkins_home/.jna-tmp"
```

**4. Redémarrer pour que la JVM reparte avec cette config dès le démarrage :**
```bash
kubectl rollout restart deployment/jenkins -n jenkins
```

**5. Vérifier après redémarrage que la variable est bien appliquée :**
```bash
kubectl get deployment jenkins -n jenkins -o jsonpath='{.spec.template.spec.containers[0].env}' | jq
```

### Test final

Build `platform-backend`, puis directement `platform-admin` juste après — **sans** `kubectl rollout restart` entre les deux. Si ça passe cette fois, le problème est résolu : la JVM Jenkins n'écrit plus dans `/tmp`, donc Kaniko ne peut plus la corrompre, peu importe le nombre de builds enchaînés.

### Si ça ne suffit toujours pas

Il est possible que le volume persistant (`jenkins-pvc`) monté sur `/var/jenkins_home` ait un souci de permissions empêchant l'écriture dans les nouveaux sous-dossiers. Vérifier avec :
```bash
kubectl exec -n jenkins deployment/jenkins -- ls -la /var/jenkins_home/ | grep -E "tmp|jna"
```
Les dossiers `tmp` et `.jna-tmp` doivent appartenir au même utilisateur que le process Jenkins (généralement `jenkins`, uid 1000) et être accessibles en écriture.
