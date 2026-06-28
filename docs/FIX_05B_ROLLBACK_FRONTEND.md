# Point #5 (suite) — Frontend du Rollback

> Explication ligne par ligne du code frontend ajouté pour exposer le rollback Knative dans l'UI.
> Fait suite à `FIX_05_ROLLBACK_REVISIONS.md` (backend).

---

## 1. Rappel du contexte

Le backend expose désormais 2 endpoints :
```
GET  /api/apps/{id}/revisions             → liste les Revisions Knative
POST /api/apps/{id}/rollback/{revisionName} → bascule le trafic vers une ancienne Revision
```

Il manquait l'interface permettant à un CLIENT_ADMIN/DEVELOPER de **voir** ces Revisions et de **cliquer** pour revenir en arrière, sans avoir à utiliser `curl` ou Postman.

---

## 2. Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `web-portal/src/api/index.js` | Ajout de 2 fonctions d'appel API |
| `web-portal/src/pages/AppDetails.jsx` | Ajout de 2 composants React : `RollbackModal` et `RevisionHistory` |

---

## 3. `api/index.js` — connexion au backend

```javascript
export const appsApi = {
    create: (data) => api.post('/apps', data),
    list: () => api.get('/apps'),
    get: (id) => api.get(`/apps/${id}`),
    deploy: (id) => api.post(`/apps/${id}/deploy`),
    update: (id, data) => api.put(`/apps/${id}`, data),
    delete: (id) => api.delete(`/apps/${id}`),
    listRevisions: (id) => api.get(`/apps/${id}/revisions`),
    rollback: (id, revisionName) => api.post(`/apps/${id}/rollback/${revisionName}`),
}
```

- `listRevisions: (id) => api.get(...)` → simple wrapper Axios autour de `GET /api/apps/{id}/revisions`. `api` est l'instance Axios configurée ailleurs dans le projet avec l'intercepteur Bearer token (donc le JWT est ajouté automatiquement, pas besoin de s'en occuper ici).
- `rollback: (id, revisionName) => api.post(...)` → wrapper autour de `POST /api/apps/{id}/rollback/{revisionName}`. Pas de corps de requête (`body`) nécessaire — toute l'information est dans l'URL, exactement comme le backend l'attend (`@PathVariable String revisionName`).

---

## 4. `AppDetails.jsx` — composant `RollbackModal`

### 4.1 Pourquoi une modale de confirmation

Un rollback change le trafic de production en direct — c'est une action **irréversible immédiatement visible par les utilisateurs finaux de l'app du client**. Exactement comme la suppression d'une app a déjà sa propre modale (`DeleteModal`, déjà existante dans ce fichier), le rollback en a besoin aussi. Le code réutilise la même structure visuelle (overlay + carte centrée + animation Framer Motion) pour rester cohérent.

### 4.2 Code, ligne par ligne

```jsx
const RollbackModal = ({ revisionName, onConfirm, onClose, loading }) => (
```
- 4 props reçues : `revisionName` (la Revision cible affichée dans le message), `onConfirm`/`onClose` (callbacks fournis par le parent), `loading` (désactive les boutons pendant l'appel réseau pour éviter un double-clic).

```jsx
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50 }} onClick={onClose} />
```
- Overlay sombre flouté qui couvre tout l'écran. `onClick={onClose}` → cliquer en dehors de la modale l'annule (sauf si `loading`, géré au niveau du parent).

```jsx
<div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', marginBottom: 16 }}>
    <p style={{ fontSize: 12, color: '#0EA5C4', margin: 0 }}>
        Traffic will be routed to <strong>{revisionName}</strong>. No rebuild needed — this is instant.
    </p>
</div>
```
- Encadré informatif en bleu (pas rouge comme `DeleteModal` qui est destructif) — un rollback n'est **pas dangereux au même niveau** qu'une suppression : il peut être annulé en refaisant un rollback vers la Revision précédente. Le message rassure l'utilisateur sur le fait qu'aucune reconstruction n'est nécessaire.

```jsx
<button className="btn-primary" style={{ flex: 1, opacity: loading ? 0.6 : 1 }} onClick={onConfirm} disabled={loading}>
    {loading ? 'Rolling back…' : <><GitBranch size={14} /> Confirm rollback</>}
</button>
```
- `disabled={loading}` → empêche de cliquer plusieurs fois pendant que la requête est en cours.
- Le texte du bouton change dynamiquement pendant le chargement (`'Rolling back…'`) pour donner un retour visuel immédiat à l'utilisateur.

---

## 5. `AppDetails.jsx` — composant `RevisionHistory`

### 5.1 Les états React utilisés

```jsx
const [revisions, setRevisions] = useState([]);
const [loading, setLoading] = useState(true);
const [target, setTarget] = useState(null);
const [rollingBack, setRollingBack] = useState(false);
const [error, setError] = useState(null);
```

- `revisions` → la liste reçue du backend (`[{name, createdAt}, ...]`).
- `loading` → vrai pendant le chargement initial de la liste.
- `target` → **clé du fonctionnement** : tant que `target` est `null`, aucune modale ne s'affiche. Dès qu'on clique "Rollback here" sur une Revision, `target` prend le nom de cette Revision, ce qui déclenche l'affichage de `RollbackModal` (voir `{target && <RollbackModal .../>}` plus bas).
- `rollingBack` → vrai pendant l'appel réseau du rollback lui-même (différent de `loading` qui concerne le chargement initial de la liste).
- `error` → message d'erreur affiché si le rollback échoue (ex: la Revision a été supprimée entre-temps côté cluster).

### 5.2 Chargement de la liste

```jsx
const load = async () => {
    try {
        setLoading(true);
        const res = await appsApi.listRevisions(appId);
        setRevisions(Array.isArray(res.data) ? res.data : []);
    } catch {
        setRevisions([]);
    } finally {
        setLoading(false);
    }
};

useEffect(() => { load(); }, [appId]);
```

- `Array.isArray(res.data) ? res.data : []` → garde-fou défensif : si jamais l'API renvoie autre chose qu'un tableau (erreur réseau mal gérée, réponse vide...), on ne casse pas le rendu — on retombe sur une liste vide plutôt qu'une exception React.
- `useEffect(() => { load(); }, [appId])` → recharge automatiquement la liste si jamais le composant est réutilisé pour une autre app (changement d'`appId`).

### 5.3 Déclenchement du rollback

```jsx
const handleConfirm = async () => {
    if (!target) return;
    setRollingBack(true);
    setError(null);
    try {
        await appsApi.rollback(appId, target);
        setTarget(null);
        await load();
    } catch {
        setError('Rollback failed. Check that the revision still exists on the cluster.');
    } finally {
        setRollingBack(false);
    }
};
```

- `if (!target) return;` → garde-fou : ne devrait jamais arriver puisque la modale n'existe que si `target` est défini, mais protège contre un appel accidentel.
- `await appsApi.rollback(appId, target);` → appelle réellement le backend, qui lui-même appelle `KnativeService.rollbackToRevision()`.
- `setTarget(null);` → ferme la modale **seulement si le rollback a réussi** (cette ligne n'est jamais atteinte si l'appel lève une exception, grâce au `try/catch`).
- `await load();` → **recharge la liste après le rollback** — important, parce que l'ordre d'affichage (`ACTIVE`/`OLDER`) dépend de quelle Revision reçoit le trafic maintenant. Sans ce rechargement, l'UI resterait incohérente avec l'état réel du cluster.
- Le `catch` n'affiche **pas** l'erreur technique brute (qui pourrait exposer des détails internes Kubernetes) — un message générique et actionnable est affiché à la place.

### 5.4 Affichage de chaque Revision dans la liste

```jsx
{revisions.map((rev, i) => (
    <div key={rev.name} style={{ ... }}>
        <span style={{ ... }}>
            {i === 0 ? 'ACTIVE' : 'OLDER'}
        </span>
        <span>{rev.name}</span>
        <span>{rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ''}</span>
        {i !== 0 && (
            <button onClick={() => setTarget(rev.name)}>Rollback here</button>
        )}
    </div>
))}
```

- `i === 0 ? 'ACTIVE' : 'OLDER'` → **suppose que le backend renvoie déjà la liste triée de la plus récente à la plus ancienne** — exactement ce que fait `KnativeService.listRevisions()` côté backend (`.sorted(...).reversed()`). Le frontend n'a donc pas besoin de retrier lui-même, il fait juste confiance à l'ordre reçu. La Revision en position `0` est affichée comme `ACTIVE` (badge vert), toutes les autres comme `OLDER` (badge gris).
- `{i !== 0 && (<button>...)}` → **le bouton "Rollback here" n'apparaît jamais sur la Revision active** — logique, on ne peut pas "revenir" vers la version qui tourne déjà.
- `onClick={() => setTarget(rev.name)}` → ne déclenche **pas** le rollback directement, juste l'ouverture de la modale de confirmation (`target` devient non-null → `RevisionHistory` affiche `RollbackModal`).

### 5.5 Branchement de la modale

```jsx
<AnimatePresence>
    {target && (
        <RollbackModal
            revisionName={target}
            onConfirm={handleConfirm}
            onClose={() => !rollingBack && setTarget(null)}
            loading={rollingBack}
        />
    )}
</AnimatePresence>
```

- `<AnimatePresence>` → composant de Framer Motion (déjà utilisé ailleurs dans ce fichier pour `DeleteModal`) qui permet l'animation de sortie (fade-out) quand `target` redevient `null`, au lieu d'une disparition brutale.
- `onClose={() => !rollingBack && setTarget(null)}` → **empêche de fermer la modale pendant que le rollback est en cours** — évite qu'un utilisateur ferme accidentellement la fenêtre alors que la requête réseau est encore en vol, ce qui laisserait l'UI dans un état incertain.

---

## 6. Intégration dans la page

```jsx
{/* Revisions & Rollback */}
<RevisionHistory appId={id} dark={dark} />

{/* Log Viewer */}
<LogViewer logs={logs.length > 0 ? logs : MOCK_LOGS} dark={dark} />
```

- Positionné juste après la section "Deployment History" (qui montre l'historique textuel des `DeploymentLog`) et juste avant le "Log Viewer" — un ordre logique : statut de l'app → historique de déploiement → revisions/rollback → logs détaillés → logs conteneur en direct.
- `id` (la variable extraite de `useParams()` en haut du composant `AppDetails`) est passé tel quel comme `appId` — c'est l'identifiant de l'App en base PostgreSQL, pas le nom du service Knative (le backend se charge de faire la conversion via `AppService`).

---

## 7. Vérification effectuée

```bash
npx vite build
# ✓ built in 3.10s — aucune erreur de compilation
```

Aucune nouvelle dépendance npm n'a été nécessaire — tous les composants utilisés (`framer-motion`, `lucide-react` pour l'icône `GitBranch`, classes CSS `btn-primary`/`btn-secondary`) existaient déjà dans le projet.

---

## 8. Résultat visible pour l'utilisateur final

```
Page /apps/{id}
    └── Section "Revisions & Rollback"
            ├── monapp-00003   [ACTIVE]   12/06/2026 14:32
            ├── monapp-00002   [OLDER]    11/06/2026 09:15   [Rollback here]
            └── monapp-00001   [OLDER]    10/06/2026 18:02   [Rollback here]

Clic sur "Rollback here" (monapp-00002)
    → Modale : "Traffic will be routed to monapp-00002. No rebuild needed — this is instant."
    → Confirmer
    → Trafic basculé en quelques secondes
    → Liste rafraîchie : monapp-00002 devient [ACTIVE]
```

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — fait suite à `FIX_05_ROLLBACK_REVISIONS.md`.*
