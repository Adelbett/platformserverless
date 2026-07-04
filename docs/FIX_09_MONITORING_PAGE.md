# FIX 09 — Page Monitoring : spinners infinis, doublons, status IDLE

## Problème

La page Monitoring (vue développeur) présentait trois défauts :

1. **Spinners infinis** dans "Per-App Metrics" — les 4 graphiques affichaient "Waiting for data…" indéfiniment
2. **Doublons dans "All Services"** — la même app (`platform-web`) apparaissait deux fois
3. **Status "IDLE" sans couleur** — les apps scaled-to-zero affichaient une couleur grise générique sans style distinct

---

## Cause racine

### 1. Spinners infinis

`AppMetricsPanel` se connecte via SSE à `/api/metrics/apps/${appId}/stream`.  
Quand une app est **scaled to zero (IDLE)**, elle ne reçoit aucun trafic → le backend ne produit aucune métrique → le SSE ne renvoie jamais de message.  
Le composant attendait `reqHistory.length > 0` pour afficher les graphiques — cette condition n'était jamais vraie.  
**Résultat : spinner éternel.**

### 2. Doublons dans la table

L'API `/api/apps` retourne parfois plusieurs entrées pour la même app (ex: une app redéployée avec un nouveau service Knative mais même `id` en base).  
Le composant affichait directement `apps.map(...)` sans déduplication.

### 3. Status IDLE non géré

`statusColor()` ne connaissait pas `IDLE` → fallback sur gris générique `#5A7080`.  
Pas de distinction visuelle entre "inconnu" et "volontairement à zéro".

---

## Solution

### Fix 1 — Timeout + état "scaled to zero"

**Fichier :** `web-portal/src/pages/Monitoring.jsx` — composant `AppMetricsPanel`

Ajout d'un timer de 6 secondes. Si aucune donnée SSE n'arrive dans ce délai, on passe à l'état `noData = true` et on affiche un message clair au lieu d'un spinner.

```javascript
// Après 6s sans données SSE → app scaled to zero
timerRef.current = setTimeout(() => setNoData(true), 6000);

es.onmessage = (e) => {
    clearTimeout(timerRef.current);  // données reçues → annule le timeout
    setNoData(false);
    // ... traitement normal
};
```

**Affichage quand `noData = true` :**
```
💤  Requests / sec
    App scaled to zero — no metrics
    Metrics appear when app receives traffic
```

### Fix 2 — Déduplication des apps

**Fichier :** `web-portal/src/pages/Monitoring.jsx` — fonction `loadData`

```javascript
const raw = Array.isArray(appsRes.data) ? appsRes.data : [];
const appList = raw.filter((a, idx, arr) => arr.findIndex(b => b.id === a.id) === idx);
```

Garde uniquement la première occurrence de chaque `id`.

### Fix 3 — Couleur pour status IDLE

**Fichier :** `web-portal/src/pages/Monitoring.jsx` — fonction `statusColor`

```javascript
const statusColor = s => ({
    RUNNING: '#3FB950', Running: '#3FB950',
    FAILED:  '#F85149', Failed:  '#F85149',
    SCALING: '#E8A838', Pending: '#E8A838',
    Succeeded: '#4A9EF5',
    IDLE: '#5A7080', SCALED_TO_ZERO: '#5A7080',  // ← ajouté
}[s] || '#5A7080');
```

---

## Résultat

| Avant | Après |
|---|---|
| Spinner infini pour app IDLE | Message "App scaled to zero — no metrics" après 6s |
| `platform-web` apparaît 2 fois | Affiché une seule fois (déduplication par `id`) |
| Status IDLE → couleur générique | Status IDLE → gris clair avec mapping explicite |

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `web-portal/src/pages/Monitoring.jsx` | Timeout SSE, déduplication apps, mapping IDLE |
