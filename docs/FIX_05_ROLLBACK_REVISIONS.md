# Point #5 — Rollback des Revisions Knative dans l'UI

> Explication complète du concept, du problème identifié et de la correction appliquée, ligne par ligne.

---

## 1. Le concept Knative à comprendre avant tout

### 1.1 C'est quoi une `Revision`

Knative ne déploie jamais une app "en place" — chaque fois qu'un `Knative Service` est créé ou modifié (nouvelle image, nouvelle config CPU/RAM...), Knative crée automatiquement un nouvel objet `Revision`. C'est un **snapshot immuable** de l'état de l'app à cet instant précis.

```
App "monapp" déployée 3 fois dans le temps :

Revision monapp-00001   (image nginx:1.0)   ← ancienne, toujours présente
Revision monapp-00002   (image nginx:2.0)   ← ancienne, toujours présente
Revision monapp-00003   (image nginx:3.0)   ← actuelle, reçoit 100% du trafic
```

Les anciennes Revisions ne sont **jamais supprimées automatiquement** par Knative — elles restent disponibles (généralement scale-to-zero, donc sans coût de calcul actif), prêtes à être réactivées.

### 1.2 C'est quoi "rollback" dans ce contexte précis

Le routage du trafic d'un Knative Service est défini dans `spec.traffic` :

```yaml
spec:
  traffic:
    - revisionName: monapp-00003
      percent: 100
```

**Faire un rollback = changer ce champ pour pointer vers une ancienne Revision.** Ce n'est PAS un redéploiement, PAS une reconstruction d'image — c'est une simple bascule de trafic, donc quasi instantanée (quelques secondes, le temps que les pods scale-to-zero "se réveillent" si besoin).

---

## 2. Le problème — qu'est-ce qui manquait

### 2.1 Constat dans le code

```bash
grep -ri "revision" backend-api/src/main/java/com/platform/api/app/
# → un seul résultat : un commentaire dans KnativeServiceHelper.java
#   "Deploying with the same service name creates a new revision in Knative."
```

Le code **savait** que Knative créait des Revisions (c'était mentionné en commentaire), mais **rien dans le code** ne :
1. Listait les Revisions existantes d'une app
2. Permettait de revenir à une ancienne Revision

Aucun endpoint REST, aucune méthode dans `KnativeService.java` ne touchait au champ `spec.traffic`.

### 2.2 Pourquoi c'est un manque important

Sans cette fonctionnalité, si un client déploie une nouvelle version cassée de son app, **la seule solution est de redéployer manuellement l'ancienne image** en remplissant à nouveau le formulaire de déploiement avec l'ancien tag d'image — en espérant se souvenir lequel c'était. Avec le rollback, il suffit de cliquer sur une ancienne Revision dans une liste.

C'est aussi un argument différenciant fort : **Knative gère déjà ça nativement et gratuitement** — il suffisait de l'exposer dans l'API et l'UI.

---

## 3. La solution appliquée — ligne par ligne

### 3.1 `KnativeService.java` — `listRevisions()`

```java
public List<Map<String, String>> listRevisions(String serviceName, String namespace) {
    String ns = namespace != null ? namespace : defaultNamespace;
    if (!kubernetesEnabled) return List.of();
    try {
        var revisions = kubernetesClient
                .genericKubernetesResources("serving.knative.dev/v1", "Revision")
                .inNamespace(ns)
                .withLabel("serving.knative.dev/service", serviceName)
                .list().getItems();

        return revisions.stream()
                .sorted(Comparator.comparing(
                        (GenericKubernetesResource r) -> r.getMetadata().getCreationTimestamp()
                ).reversed())
                .map(r -> {
                    Map<String, String> info = new java.util.HashMap<>();
                    info.put("name", r.getMetadata().getName());
                    info.put("createdAt", r.getMetadata().getCreationTimestamp());
                    return info;
                })
                .collect(Collectors.toList());
    } catch (Exception e) {
        log.warn("Could not list revisions for '{}': {}", serviceName, e.getMessage());
        return List.of();
    }
}
```

- `String ns = namespace != null ? namespace : defaultNamespace;` → même garde-fou que toutes les autres méthodes de cette classe (`deploy()`, `getRealStatus()`...) : utilise le namespace par défaut si celui de l'app n'est pas renseigné.
- `if (!kubernetesEnabled) return List.of();` → en mode mock (développement local sans cluster réel), on ne tente même pas d'appeler Kubernetes — on renvoie une liste vide plutôt qu'une erreur.
- `kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Revision")` → demande à l'API Kubernetes les objets de type `Revision` (pas `Service` cette fois) — exactement la même technique Fabric8 générique déjà utilisée pour les Knative Services dans `deploy()` et `getRealStatus()`.
- `.withLabel("serving.knative.dev/service", serviceName)` → **point clé** : Knative étiquette automatiquement chaque Revision qu'il crée avec le nom du Service parent. C'est exactement le même label déjà utilisé dans `getReadyPods()` (ligne 226 du fichier) pour retrouver les pods d'un service — ici on l'utilise pour retrouver les Revisions à la place des pods.
- `.sorted(Comparator.comparing(...).reversed())` → trie les Revisions de la plus récente à la plus ancienne, pour que l'UI affiche naturellement "la dernière en premier".
- `.map(r -> {...})` → construit, pour chaque Revision, une petite Map avec son nom (`monapp-00002`) et sa date de création — assez d'information pour que l'utilisateur puisse choisir dans une liste, sans avoir besoin du détail complet du manifeste Kubernetes.
- `catch (Exception e) { ... return List.of(); }` → si quoi que ce soit échoue (ex: permission Kubernetes manquante, service inexistant), on log l'erreur mais on ne fait pas planter toute la requête — on renvoie juste une liste vide.

### 3.2 `KnativeService.java` — `rollbackToRevision()`

```java
public void rollbackToRevision(String serviceName, String namespace, String revisionName) {
    String ns = namespace != null ? namespace : defaultNamespace;
    if (!kubernetesEnabled) {
        log.info("[MOCK] Rolling back '{}' to revision '{}'", serviceName, revisionName);
        return;
    }
    try {
        GenericKubernetesResource ksvc = kubernetesClient
                .genericKubernetesResources("serving.knative.dev/v1", "Service")
                .inNamespace(ns).withName(serviceName).get();

        if (ksvc == null) {
            throw new RuntimeException("Knative service not found: " + serviceName);
        }

        Map<String, Object> spec = (Map<String, Object>) ksvc.getAdditionalProperties().get("spec");
        spec.put("traffic", List.of(Map.of(
                "revisionName", revisionName,
                "percent", 100
        )));

        kubernetesClient.genericKubernetesResources("serving.knative.dev/v1", "Service")
                .inNamespace(ns).resource(ksvc).update();

        log.info("Rolled back '{}' to revision '{}'", serviceName, revisionName);
    } catch (Exception e) {
        log.error("Failed to rollback '{}' to revision '{}': {}", serviceName, revisionName, e.getMessage());
        throw new RuntimeException("Rollback failed: " + e.getMessage(), e);
    }
}
```

- `kubernetesClient...get()` → récupère le Knative Service complet **tel qu'il existe actuellement** sur le cluster — pas une copie locale, le vrai objet à jour.
- `if (ksvc == null) throw ...` → si le service n'existe plus (ex: l'app a été supprimée entre-temps), on échoue proprement avec un message clair plutôt qu'un `NullPointerException`.
- `Map<String, Object> spec = ...` → récupère la section `spec` du manifeste — exactement la même technique de manipulation que `scaleService()` (déjà existante dans ce fichier) utilise pour modifier les annotations d'autoscaling.
- `spec.put("traffic", List.of(Map.of("revisionName", revisionName, "percent", 100)));` → **le cœur du rollback**. On remplace la règle de routage de trafic pour pointer 100% vers l'ancienne Revision demandée. C'est la seule chose qui change dans le manifeste — l'image, les ressources CPU/RAM de l'app ne sont PAS modifiées (elles restent celles définies par la Revision actuelle si jamais on revient en avant plus tard).
- `kubernetesClient...update()` → envoie ce manifeste modifié à l'API Kubernetes. Knative voit le changement de `spec.traffic` et bascule immédiatement le trafic.
- `catch (Exception e) { ... throw ... }` → contrairement à `listRevisions()` (qui peut échouer silencieusement, ce n'est qu'une liste d'information), ici une erreur **doit** remonter clairement à l'utilisateur — un rollback raté silencieusement serait dangereux.

### 3.3 `AppService.java` — couche métier (ownership + multi-tenant)

```java
public List<Map<String, String>> listRevisions(String appId, String username) {
    UserContextService.UserContext ctx = userContextService.resolve(username);
    App app = requireOwned(appId, ctx.effectiveUserId());
    return knativeService.listRevisions(app.getServiceName(), app.getNamespace());
}

@Transactional
public void rollback(String appId, String revisionName, String username) {
    UserContextService.UserContext ctx = userContextService.resolve(username);
    App app = requireOwned(appId, ctx.effectiveUserId());
    knativeService.rollbackToRevision(app.getServiceName(), app.getNamespace(), revisionName);
    addLog(appId, ctx.effectiveUserId(), "Rolled back to revision " + revisionName, "ROLLBACK");
}
```

- `userContextService.resolve(username)` → résout l'utilisateur effectif (délégation DEVELOPER → CLIENT_ADMIN si c'est un membre d'équipe) — **exactement le même mécanisme multi-tenant** que `deleteApp()` et toutes les autres méthodes de ce service utilisent déjà.
- `App app = requireOwned(appId, ctx.effectiveUserId());` → **vérification d'ownership obligatoire**, identique au pattern vu pour `DELETE_APP` : empêche un utilisateur de faire un rollback sur l'app d'un AUTRE client, même s'il connaît son `appId`.
- `knativeService.listRevisions(app.getServiceName(), app.getNamespace())` → délègue à la couche Kubernetes, en passant le `serviceName` et le `namespace` réels de CETTE app précise (pas ceux d'une autre).
- `addLog(appId, ctx.effectiveUserId(), "Rolled back to revision " + revisionName, "ROLLBACK")` → **trace l'action dans `DeploymentLog`**, avec un nouveau type `"ROLLBACK"` (visible dans l'historique des logs de déploiement, comme `DEPLOYMENT_SUCCESS` ou `DELETE`). C'est important : un rollback est une action significative, elle doit apparaître dans l'audit trail de l'app.

### 3.4 `AppController.java` — exposition REST + sécurité RBAC

```java
@GetMapping("/{id}/revisions")
@Operation(summary = "List Knative revisions for this app (for rollback)")
public ResponseEntity<List<Map<String, String>>> listRevisions(@PathVariable String id, Authentication auth) {
    return ResponseEntity.ok(appService.listRevisions(id, auth.getName()));
}

@PostMapping("/{id}/rollback/{revisionName}")
@PreAuthorize("@permissionService.has(authentication.name, 'DEPLOY_APP')")
@Operation(summary = "Roll traffic back to a previous revision")
public ResponseEntity<Void> rollback(@PathVariable String id, @PathVariable String revisionName, Authentication auth) {
    appService.rollback(id, revisionName, auth.getName());
    return ResponseEntity.noContent().build();
}
```

- `GET /{id}/revisions` → **pas de `@PreAuthorize` spécifique** ici, volontairement : lister les Revisions est une opération de lecture, équivalente à consulter le détail d'une app — déjà protégée par la règle globale `anyRequest().authenticated()` + l'ownership check dans `AppService`. Pas besoin d'une permission de mutation pour une simple liste.
- `POST /{id}/rollback/{revisionName}` → **`@PreAuthorize("DEPLOY_APP")` obligatoire**. C'est exactement la leçon tirée du point #1 de ce plan d'optimisation (le bug VIEWER) : toute action qui **change l'état du système** doit être protégée par une permission de mutation, jamais laissée sans annotation. Un rollback change le trafic en production — c'est aussi sensible qu'un déploiement classique, donc la même permission `DEPLOY_APP` s'applique logiquement.

---

## 4. Vérification de non-régression

- Aucune méthode existante n'a été modifiée — seulement des méthodes **ajoutées** dans `KnativeService.java` et `AppService.java`, et 2 endpoints **ajoutés** (pas remplacés) dans `AppController.java`.
- Compilation Maven réussie après chaque étape (3 vérifications intermédiaires pendant le développement, pour corriger 2 avertissements de code mort/cast inutile signalés par l'IDE).
- `addLog(...)` réutilise une méthode déjà existante et déjà éprouvée par toutes les autres actions (`deleteApp()`, `updateApp()`...).

---

## 5. Résultat final — nouveaux endpoints disponibles

| Endpoint | Méthode | Protection | Effet |
|---|---|---|---|
| `/api/apps/{id}/revisions` | `GET` | Authentification + ownership | Liste les Revisions Knative de cette app, triées de la plus récente à la plus ancienne |
| `/api/apps/{id}/rollback/{revisionName}` | `POST` | `DEPLOY_APP` + ownership | Bascule 100% du trafic vers la Revision indiquée |

---

## 6. Ce qui reste à faire côté frontend (non inclus dans cette correction backend)

- Un composant React listant les Revisions sur la page `AppDetails.jsx` (ex: `RevisionHistory.jsx`), avec un bouton "Rollback" sur chaque ancienne Revision.
- Appel `POST /api/apps/{id}/rollback/{revisionName}` au clic, avec confirmation utilisateur (action sensible, doit avoir une modale de confirmation comme celle déjà existante pour la suppression d'app — `DeleteModal` dans `AppDetails.jsx`).

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — voir `AUDIT_CONCURRENCE_ET_MONITORING.md` section 6.2.*
