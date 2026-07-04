# FIX 08 — Jenkins CI/CD : spawn helper JNA / pipeline FAILURE

## Problème

Après chaque build du backend, Jenkins affichait `Finished: FAILURE` même si le déploiement avait réussi.  
De plus, après un build backend, le build frontend échouait immédiatement sans même démarrer.

---

## Cause racine

### 1. Le spawn helper JNA

Jenkins utilise la bibliothèque **JNA (Java Native Access)** pour exécuter des processus système (`git`, `sh`, `nohup`).  
Au démarrage, la JVM Jenkins extrait un binaire natif (le "spawn helper") dans `/tmp/jna-XXXXX/`.

**Kaniko** (le builder Docker utilisé dans le pipeline) tourne dans le même pod et perturbe `/tmp` pendant le build.  
Résultat : le spawn helper est corrompu ou supprimé **pendant** l'exécution du pipeline.

```
Build démarre → spawn helper OK → Kaniko tourne → spawn helper corrompu
→ post { always } essaie sh → FAILED
→ prochain build frontend essaie git → FAILED dès le démarrage
```

### 2. Le dossier `@script` corrompu

Jenkins utilise "Pipeline script from SCM" : il clone le dépôt dans un dossier `@script` pour lire le Jenkinsfile.  
Si ce dossier n'est pas supprimé entre les builds, le `.git` corrompu dedans fait échouer le checkout suivant.

---

## Ce qui a été essayé (et pourquoi ça n'a pas marché)

| Tentative | Résultat | Raison |
|---|---|---|
| `post { always { sh 'find @script ...' } }` | FAILED | `sh` utilise le spawn helper — déjà mort en `post` |
| `post { always { script { new File(...) } } }` | FAILED | `new java.io.File()` bloqué par le sandbox Jenkins |
| `JAVA_TOOL_OPTIONS` dans le Jenkinsfile | N'aide pas | Ne s'applique qu'aux processus enfants, pas à la JVM Jenkins déjà démarrée |

---

## Solution finale appliquée

### Étape 1 — Nettoyage **au début** du build (pas en post)

Le `sh` au début du build fonctionne car le spawn helper est encore intact (Kaniko n'a pas encore tourné).

**Fichiers modifiés :**
- `ci-cd/jenkins/pipelines/Jenkinsfile.backend`
- `ci-cd/jenkins/pipelines/Jenkinsfile.frontend`

```groovy
stage('Cleanup') {
    steps {
        sh '''
            // Supprime le @script du build précédent (corrupt .git)
            find /var/jenkins_home/workspace -maxdepth 1 -name "*@script*" -type d \
                -exec rm -rf {} + 2>/dev/null || true
            // Supprime les anciens répertoires JNA de /tmp
            find /tmp -maxdepth 1 -name "jna-*" -type d \
                -exec rm -rf {} + 2>/dev/null || true
        '''
    }
}
```

### Étape 2 — Supprimer `post { always }` entièrement

Aucun `sh` dans `post` — le spawn helper est mort à ce stade.  
Les `echo` (success/failure) ne nécessitent pas de shell → ils fonctionnent.

```groovy
post {
    success { echo "✅ Backend déployé avec succès — ${IMAGE_NAME}:${IMAGE_TAG}" }
    failure { echo "❌ Pipeline échoué — vérifier les logs" }
}
```

### Étape 3 — Fix permanent du spawn helper (niveau cluster)

Pour que le spawn helper survive à Kaniko, on demande à Jenkins de l'extraire sur le **PVC** (persistant) plutôt que dans `/tmp`.

```bash
kubectl patch deployment jenkins -n jenkins --type=json -p='[
  {
    "op": "remove",
    "path": "/spec/template/spec/containers/0/env/2"
  },
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/env/1",
    "value": {
      "name": "JAVA_TOOL_OPTIONS",
      "value": "-Djava.io.tmpdir=/var/jenkins_home/tmp -Djna.tmpdir=/var/jenkins_home/jna"
    }
  }
]'
```

**Explication des variables JVM :**

| Variable | Portée | Usage |
|---|---|---|
| `JAVA_OPTS` | Lu par le script de lancement Jenkins | Configure la JVM Jenkins au démarrage |
| `JAVA_TOOL_OPTIONS` | Lu par la JVM elle-même (standard JDK) | S'applique automatiquement à tous les processus Java |

La différence critique : `JAVA_OPTS` dans le Jenkinsfile ne s'applique qu'aux processus `sh` enfants, **pas** à la JVM Jenkins parent qui gère déjà le spawn helper.

### Étape 4 — CronJob Kubernetes de nettoyage nocturne

Fichier créé : `ci-cd/jenkins/jenkins-cleanup-cronjob.yaml`

```yaml
schedule: "0 2 * * *"  # chaque nuit à 2h00
```

Nettoie `@script` et `jna-*` chaque nuit — filet de sécurité si le build de la journée laisse des résidus.

---

## Résultat

```
Build N :
  Cleanup  → supprime @script(N-1) + jna-* (spawn helper encore intact)
  Checkout → OK car @script propre
  Build JAR / npm build → OK
  Kaniko → OK (spawn helper peut mourir ici, on s'en fout)
  post success → echo seulement, pas de sh → OK
  Finished: SUCCESS ✅

Build N+1 :
  Cleanup → supprime @script(N) → même logique
```

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `ci-cd/jenkins/pipelines/Jenkinsfile.backend` | Stage `Cleanup` au début, `JAVA_TOOL_OPTIONS` env, `post` sans `sh` |
| `ci-cd/jenkins/pipelines/Jenkinsfile.frontend` | Même chose |
| `ci-cd/jenkins/jenkins-cleanup-cronjob.yaml` | Nouveau — CronJob nettoyage nocturne |
