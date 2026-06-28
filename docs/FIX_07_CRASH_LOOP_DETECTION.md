# Point #7 — Détection automatique des crash loops

> Explication complète : le concept, le problème, et chaque ligne de code ajoutée.

---

## 1. Le concept — c'est quoi un "crash loop"

Quand le conteneur d'une app plante au démarrage (mauvaise config, erreur de code, dépendance manquante...), Kubernetes essaie de le relancer automatiquement. S'il replante encore et encore, Kubernetes finit par marquer le pod avec le statut `CrashLoopBackOff` et espace de plus en plus les tentatives de redémarrage.

```
Pod démarre → crash (exit code ≠ 0)
    ↓
Kubernetes relance immédiatement
    ↓
Pod démarre → crash à nouveau
    ↓
Kubernetes relance après 10s, puis 20s, 40s... (backoff exponentiel)
    ↓
Après plusieurs échecs → statut = CrashLoopBackOff
```

Chaque tentative incrémente un compteur visible dans le statut du pod : `restartCount`.

---

## 2. Pourquoi c'est utile dans cette plateforme précisément

Sans cette détection, un client qui déploie une app cassée ne le découvre que s'il va lui-même vérifier le statut ou les logs de son app. Avec cette détection, **la plateforme le prévient automatiquement**, en quelques minutes, via le même bandeau de notification déjà utilisé pour les déploiements et les alertes de budget.

---

## 3. Pourquoi c'était rapide à ajouter — réutilisation de l'existant

Exactement comme pour l'alerte budget (point #6), on réutilise le pipeline déjà construit :

```
DeploymentLog (entité)
    ↓
LogSseService.push(...)
    ↓
NotificationContext.jsx (bandeau 🔔, déjà générique)
```

Seule nouveauté technique réelle : **scanner les pods Kubernetes** pour détecter le problème — tout le reste (stockage, diffusion, affichage) existait déjà.

---

## 4. Le code ajouté, fichier par fichier, ligne par ligne

### 4.1 `KnativeService.java` — `findCrashLoopingPods()`

```java
public List<Map<String, Object>> findCrashLoopingPods(int restartThreshold) {
    if (!kubernetesEnabled) return List.of();
    try {
        var pods = kubernetesClient.pods().inAnyNamespace()
                .withLabel("serving.knative.dev/service")
                .list().getItems();
```

- `kubernetesClient.pods().inAnyNamespace()` → **différence clé** par rapport à toutes les autres méthodes de cette classe (`getReadyPods()`, `getFirstPodName()`...) qui scannent un namespace précis : ici on scanne **tous les namespaces du cluster en une seule fois**. C'est nécessaire parce que cette détection est un job de fond qui doit surveiller TOUS les clients en même temps, pas un client à la fois (sinon il faudrait faire une requête réseau séparée par client, ce qui serait beaucoup plus lent).
- `.withLabel("serving.knative.dev/service")` → filtre pour ne garder que les pods qui appartiennent à un service Knative (donc à une app de la plateforme) — exclut les pods systèmes (Keycloak, PostgreSQL, Prometheus...) qui n'ont pas ce label.
- Cette requête fonctionne grâce au `ClusterRole` qu'on avait configuré plus tôt dans ce projet (`pods: get/list/watch` au niveau `ClusterRole`, donc valide cluster-wide, pas limité à un seul namespace).

```java
        List<Map<String, Object>> result = new ArrayList<>();
        for (var pod : pods) {
            String serviceName = pod.getMetadata().getLabels().get("serving.knative.dev/service");
            String namespace = pod.getMetadata().getNamespace();
            var statuses = pod.getStatus() != null ? pod.getStatus().getContainerStatuses() : null;
            if (statuses == null) continue;
```

- `pod.getMetadata().getLabels().get(...)` → récupère le nom du service Knative directement depuis le label du pod (pas besoin de requête supplémentaire).
- `pod.getStatus().getContainerStatuses()` → la liste des statuts de **chaque conteneur** dans le pod (un pod peut avoir plusieurs conteneurs, même si dans ce projet c'est généralement un seul conteneur applicatif par pod).
- `if (statuses == null) continue;` → garde-fou : un pod qui vient juste d'être créé peut temporairement n'avoir aucun statut de conteneur encore renseigné — on l'ignore plutôt que de risquer un `NullPointerException`.

```java
            for (var cs : statuses) {
                boolean isCrashLoop = cs.getState() != null
                        && cs.getState().getWaiting() != null
                        && "CrashLoopBackOff".equals(cs.getState().getWaiting().getReason());
                int restarts = cs.getRestartCount() != null ? cs.getRestartCount() : 0;

                if (isCrashLoop || restarts >= restartThreshold) {
```

- `cs.getState().getWaiting().getReason()` → Kubernetes structure l'état d'un conteneur en 3 possibilités : `running`, `waiting`, ou `terminated`. Quand un conteneur est en crash loop, son état est `waiting` avec une `reason` égale exactement à la chaîne `"CrashLoopBackOff"` — c'est la donnée officielle exposée par l'API Kubernetes, pas une déduction approximative.
- `restarts >= restartThreshold` → **deuxième critère**, complémentaire au premier : même si Kubernetes n'a pas encore officiellement marqué le pod `CrashLoopBackOff` (ça prend quelques cycles de backoff avant ce label), un compteur de redémarrages déjà élevé (5 par défaut, configurable) est un signal d'alerte précoce. Détecter sur les 2 critères à la fois rend la détection plus réactive.

```java
                    Map<String, Object> info = new HashMap<>();
                    info.put("serviceName", serviceName);
                    info.put("namespace", namespace);
                    info.put("restartCount", restarts);
                    result.add(info);
                    break; // one alert per pod is enough, even with multiple containers
                }
            }
        }
        return result;
    } catch (Exception e) {
        log.warn("Could not scan for crash-looping pods: {}", e.getMessage());
        return List.of();
    }
}
```

- `break;` → si le **premier** conteneur en crash loop est trouvé, on arrête de vérifier les autres conteneurs du même pod — pas besoin de générer 2 alertes pour le même pod si jamais il a plusieurs conteneurs en échec simultanément.
- `catch (Exception e) { ... return List.of(); }` → si le scan échoue pour une raison quelconque (problème réseau temporaire avec l'API Kubernetes), on ne fait jamais planter tout le job planifié — on log l'erreur et on renvoie une liste vide, le prochain scan (5 minutes plus tard) réessaiera.

### 4.2 `DeploymentLogRepository.java` — déduplication par app

```java
boolean existsByAppIdAndTypeAndCreatedAtAfter(String appId, String type, LocalDateTime after);
```

- Même principe que `existsByUserIdAndTypeAndCreatedAtAfter` (créée au point #6), mais filtrée par `appId` au lieu de `userId`, et avec une fenêtre de temps plus courte (1 heure au lieu d'un mois entier) — voir section 4.3 pour le pourquoi de cette différence.

### 4.3 `AppService.java` — `checkCrashLoops()`

```java
private static final int CRASH_LOOP_RESTART_THRESHOLD = 5;
private static final int CRASH_LOOP_ALERT_COOLDOWN_HOURS = 1;
```

- `CRASH_LOOP_RESTART_THRESHOLD = 5` → seuil de redémarrages avant alerte. Volontairement pas trop bas (un redémarrage isolé peut arriver pour une raison bénigne — mise à jour de nœud, par exemple) ni trop haut (on veut alerter rapidement un vrai problème).
- `CRASH_LOOP_ALERT_COOLDOWN_HOURS = 1` → **différence importante avec l'alerte budget** : le budget se réinitialise une fois par mois (logique financière), mais un crash loop est un problème **technique en cours** — on veut re-alerter périodiquement (toutes les heures) tant que le problème persiste, pas une seule fois pour tout le mois. Sinon, un client pourrait ignorer une alerte vieille de 3 semaines pensant le problème résolu, alors qu'il continue.

```java
@Transactional
public void checkCrashLoops() {
    List<java.util.Map<String, Object>> crashing = knativeService.findCrashLoopingPods(CRASH_LOOP_RESTART_THRESHOLD);

    for (var info : crashing) {
        String serviceName = (String) info.get("serviceName");
        String namespace   = (String) info.get("namespace");
        int restartCount   = (int) info.get("restartCount");

        List<App> apps = appRepository.findByServiceNameAndNamespace(serviceName, namespace);
```

- `appRepository.findByServiceNameAndNamespace(...)` → méthode **déjà existante** dans `AppRepository` (visible dans le fichier depuis le début du projet), jamais utilisée auparavant dans ce contexte. Elle fait le lien entre "un pod technique Kubernetes" et "l'entité App en base PostgreSQL", ce qui permet de retrouver le `userId` propriétaire — indispensable pour envoyer l'alerte à la bonne personne (mécanisme multi-tenant).

```java
        for (App app : apps) {
            boolean alreadyAlerted = logRepository.existsByAppIdAndTypeAndCreatedAtAfter(
                    app.getId(), "CRASH_LOOP_ALERT",
                    LocalDateTime.now().minusHours(CRASH_LOOP_ALERT_COOLDOWN_HOURS));
            if (alreadyAlerted) continue;
```

- `LocalDateTime.now().minusHours(1)` → vérifie si une alerte a déjà été créée pour CETTE app dans **la dernière heure** — pas depuis le début du mois comme pour le budget. C'est le mécanisme anti-spam adapté à la fréquence du scan (toutes les 5 minutes) : sans ce garde-fou, la même alerte serait recréée 12 fois par heure (une fois par cycle de scan) tant que le pod continue de crasher.

```java
            DeploymentLog alert = logRepository.save(DeploymentLog.builder()
                    .appId(app.getId())
                    .appName(app.getName())
                    .userId(app.getUserId())
                    .message("L'application redémarre en boucle (CrashLoopBackOff) — "
                            + restartCount + " redémarrages détectés.")
                    .type("CRASH_LOOP_ALERT")
                    .build());

            logSseService.push(alert);
            log.warn("Crash-loop alert sent for app '{}' ({} restarts)", app.getName(), restartCount);
        }
    }
}
```

- Contrairement à l'alerte budget (`appId` laissé `null`, car concernant le compte entier), ici `appId` et `appName` sont **renseignés** — cette alerte concerne une app précise, et l'utilisateur doit savoir immédiatement laquelle sans avoir à enquêter.
- `log.warn(...)` plutôt que `log.info(...)` (utilisé pour le budget) → un crash loop est un problème technique actif, mérite un niveau de log plus visible dans les outils de supervision serveur.

### 4.4 `CrashLoopScheduler.java` — nouveau fichier, job planifié dédié

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class CrashLoopScheduler {

    private final AppService appService;

    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void scanForCrashLoops() {
        log.debug("Scanning cluster for crash-looping pods...");
        appService.checkCrashLoops();
    }
}
```

- **Pourquoi un scheduler séparé** (plutôt que d'ajouter cet appel dans `BillingScheduler`, qui existait déjà) : la fréquence est différente. La facturation a du sens une fois par heure (`cron = "0 0 * * * *"`), mais un crash loop doit être détecté **rapidement** — attendre une heure pour prévenir un client que son app est cassée serait inacceptable.
- `@Scheduled(fixedRate = 5 * 60 * 1000)` → contrairement à `cron` (qui déclenche à des horloges précises, ex: "à chaque heure pile"), `fixedRate` déclenche toutes les **5 minutes exactement** depuis le démarrage de l'application, peu importe l'heure de l'horloge — plus adapté pour une surveillance continue.
- `@Component` (pas `@Service`) → convention déjà suivie par `BillingScheduler` dans ce même projet — les classes de planification (scheduler) sont typiquement annotées `@Component`, les classes de logique métier `@Service`.

### 4.5 `NotificationContext.jsx` — reconnaissance frontend

```javascript
CRASH_LOOP_ALERT:   { emoji: '💥', color: '#EF4444' },
```

- Couleur rouge (`#EF4444`), la même que `DEPLOYMENT_FAIL` — cohérence visuelle : les deux types signalent un problème technique grave nécessitant l'attention immédiate du client.
- Comme pour `BUDGET_ALERT` et `ROLLBACK` précédemment, **une seule ligne suffit** — le reste du pipeline d'affichage (SSE, bandeau, compteur non-lu) fonctionne déjà génériquement.

---

## 5. Vérification de non-régression

- Aucune méthode existante modifiée — uniquement des ajouts (`findCrashLoopingPods()`, `checkCrashLoops()`, nouvelle classe `CrashLoopScheduler`, nouvelle méthode repository).
- `@EnableScheduling` était déjà actif dans `BackendApiApplication.java` (nécessaire pour que `BillingScheduler` fonctionne) — donc `CrashLoopScheduler` n'a nécessité aucune configuration supplémentaire pour démarrer.
- Compilation Maven réussie (`mvn compile`) sans erreur après l'ajout complet.

---

## 6. Résultat final — scénario complet

```
14h00 : un client déploie une app avec un bug de configuration
14h02 : le pod crash, redémarre, crash à nouveau (3ème tentative)
14h05 : CrashLoopScheduler.scanForCrashLoops() s'exécute (cycle des 5 minutes)
        → findCrashLoopingPods(5) ne détecte rien encore (restartCount = 3, sous le seuil de 5)
14h10 : nouveau scan → restartCount = 6 → seuil dépassé
        → checkCrashLoops() trouve l'app via appRepository.findByServiceNameAndNamespace(...)
        → aucune alerte CRASH_LOOP_ALERT dans la dernière heure pour cette app
        → crée l'alerte + push SSE
        → 🔔 le client voit immédiatement :
            "💥 L'application redémarre en boucle (CrashLoopBackOff) — 6 redémarrages détectés."
14h15, 14h20... : le pod continue de crasher, mais aucune NOUVELLE alerte n'est recréée
                  (cooldown d'1 heure actif)
15h10 : si le problème persiste encore, une NOUVELLE alerte sera envoyée
        (rappel utile : le client n'a peut-être pas encore corrigé le bug)
```

---

## 7. Fichiers modifiés / créés

| Fichier | Nature du changement |
|---|---|
| `backend-api/src/main/java/com/platform/api/app/KnativeService.java` | Ajout de `findCrashLoopingPods(int)` |
| `backend-api/src/main/java/com/platform/api/logs/DeploymentLogRepository.java` | Ajout de `existsByAppIdAndTypeAndCreatedAtAfter(...)` |
| `backend-api/src/main/java/com/platform/api/app/AppService.java` | Ajout de `checkCrashLoops()` + 2 constantes |
| `backend-api/src/main/java/com/platform/api/app/CrashLoopScheduler.java` | **Nouveau fichier** — job planifié toutes les 5 minutes |
| `web-portal/src/context/NotificationContext.jsx` | Ajout de `CRASH_LOOP_ALERT` dans `NOTIF_META` |

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — suite logique du point #6 (alerting), proposé comme idée d'enrichissement Monitoring + Administration Cluster.*
