# Placeholders de figures à créer

Document interne de suivi. Ne pas citer dans le mémoire. Liste des `[DIAGRAMME À CRÉER]` réellement présents dans les fichiers `.tex` — deux seulement, ajoutés lors de cette passe de réorganisation, là où aucune conception visuelle n'existait encore. Les diagrammes déjà rendus (TikZ ou images réelles) ne sont pas listés ici : voir `AUDIT_DIAGRAMMES_SPRINTS.md` pour la couverture complète.

---

## 1. Architecture fonctionnelle des applications frontend

- **Label** : `fig:sprint8-architecture-frontend`
- **Titre** : Architecture fonctionnelle des applications frontend (portail client et console d'administration)
- **Sprint** : Sprint 8 — Développement du Frontend (`chapitre4.tex`)
- **Type** : Architecture / diagramme de composants
- **Objectif** : Montrer que les deux applications React (portail client, console d'administration) partagent un socle technique commun tout en exposant des pages distinctes.
- **Contenu attendu** :
  - Un bloc « Socle commun » : `AuthContext` (authentification via `keycloak-js`), client API centralisé (`api/client.js`), module SSE (`api/sse.js`).
  - Deux branches issues de ce socle :
    - **Portail client** : `Dashboard`, `AppsList`, `DeployApp`, `AppDetails`, `Login`/`Register`.
    - **Console d'administration** : `AdminDashboard`, `AdminClients`, `ClusterManagement`.
  - Ne pas ajouter les pages livrées au Sprint 9 (`KafkaTopics`, `Billing`, `AdminUsers`, etc.) — elles sont déjà couvertes par les diagrammes de navigation du Sprint 9 (`fig:nav-portal`, `fig:nav-admin`), déjà présents dans le mémoire.
- **Emplacement LaTeX** : `chapitre4.tex`, section Sprint 8 → Conception → après le paragraphe « Console d'administration (\texttt{admin-console}) », juste avant `\subsection{Réalisation}`.

---

## 2. Stratégie de validation de la plateforme

- **Label** : `fig:sprint11-strategie-validation`
- **Titre** : Chaîne de validation fonctionnelle et technique de la plateforme
- **Sprint** : Sprint 11 — Tests, validation, corrections et stabilisation (`chapitre5.tex`)
- **Type** : Workflow / chaîne de processus
- **Objectif** : Donner une vue d'ensemble visuelle de la démarche de validation du sprint, qui combine test fonctionnel et audit de sécurité en deux temps.
- **Contenu attendu** (chaîne linéaire ou en étapes) :
  1. Plan de test (84 cas) + appels API via Postman (Kafka/Eventing)
  2. Exécution de la campagne de test
  3. Audit de sécurité initial → **score 4/10**
  4. Corrections (7 vulnérabilités corrigées / 9 identifiées, 2 risques assumés)
  5. Audit de sécurité final → **score 5,2/10**
  - Ne pas inventer de valeurs intermédiaires ou de dates — seuls les deux scores (4/10 et 5,2/10) et le ratio 7/9 sont vérifiés dans le mémoire.
- **Emplacement LaTeX** : `chapitre5.tex`, section Sprint 11 → Conception → sous-section « Méthodologie de test », juste avant « Audit de sécurité et amélioration de la posture de sécurité ».

---

## Rappel

Ces deux diagrammes sont les **seuls** que ce travail de réorganisation a jugés manquants sur les 12 sprints — tous les autres sprints disposaient déjà d'une représentation visuelle suffisante (diagrammes TikZ construits à partir du code, ou images réelles déjà présentes dans `image/`). Voir `AUDIT_DIAGRAMMES_SPRINTS.md` pour le détail sprint par sprint et les notes de justification (Sprint 2, Sprint 9, Sprint 12).

Pour les **captures d'écran** (distinctes de ces diagrammes de conception), la liste complète des `[CAPTURE À AJOUTER]` reste celle déjà documentée dans chaque section « Vérification et preuves » de chaque sprint — voir aussi `AUDIT_MEMOIRE_FINAL.md`, section 2, pour le décompte consolidé.
