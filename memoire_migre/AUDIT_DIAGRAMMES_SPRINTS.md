# Audit des diagrammes par Sprint

Document interne de suivi. Ne pas citer dans le mémoire.

Légende : 🟢 complet · 🟡 figure à créer · 🔴 conception manquante

| Sprint | Architecture | Use Case | Séquence | Workflow | Captures | Statut |
|--------|--------------|----------|----------|----------|----------|--------|
| Sprint 0 — Kubernetes | ✓ (cluster-topology, architecture-reseau) | — (non applicable, socle technique) | — | ✓ (metallb-flux) | 9 placeholders `[CAPTURE À AJOUTER]` | 🟢 |
| Sprint 1 — Knative Serving | ✓ (knative-architecture, backend-knative-integration) | — (non applicable) | ✓ (tenant-workflow) | ✓ (scale-to-zero) | 4 + 3 (séquence scale-to-zero) placeholders | 🟢 |
| Sprint 2 — Kafka/Strimzi | ✓ (kafka-concepts, kafka-strimzi, backend-kafka-adminclient) | — (non applicable) | — (pas de séquence dédiée à la création de topic au niveau infra ; couverte au Sprint 6 côté API) | ✓ (kafka-concepts) | 4 placeholders | 🟢 (optionnel : séquence de création topic bas niveau, non ajoutée — jugée redondante avec Sprint 6) |
| Sprint 3 — Knative Eventing | ✓ (eventing-architecture) | — (non applicable) | ✓ (seq-eventing, réelle) | — | 5 placeholders | 🟢 |
| Sprint 4 — Auth/RBAC | — | ✓ (uc-securite) | ✓ (seq-login, réelle) | — | 7 placeholders | 🟢 |
| Sprint 5 — Gestion applications | — | ✓ (uc-apps) | ✓ (seq-deploy-detail, réelle, détaillée) | — | 6 placeholders | 🟢 |
| Sprint 6 — API Kafka/Eventing | ✓ (sprint6-architecture) | ✓ (uc-kafka) | ✓ (seq-create-topic, réelle) | — | 4 placeholders | 🟢 |
| Sprint 7 — Monitoring/Logs | ✓ (sprint7-logs, sprint7-monitoring) | ✓ (uc-monitoring) | ✓ (seq-logs, réelle) | — | 7 placeholders | 🟢 |
| Sprint 8 — Frontend Client | ✓ **ajouté cette passe** (sprint8-architecture-frontend, placeholder) | — (réutilise le UC global, justifié dans le texte) | — | — | 2 captures réelles + 7 placeholders | 🟡 → 🟢 (placeholder ajouté) |
| Sprint 9 — Admin Console/UX | — | — (pas de UC Admin dédié ; couvert par le UC global) | — | ✓ (nav-portal, nav-admin — diagrammes de navigation) | 2 captures réelles + 6 placeholders | 🟢 |
| Sprint 10 — CI/CD | ✓ (cicd-pipeline, avec tableau des étapes) | — (non applicable) | — | ✓ (cicd-pipeline sert aussi de workflow/pipeline) | 6 placeholders | 🟢 |
| Sprint 11 — Validation/Tests | ✓ **ajouté cette passe** (sprint11-strategie-validation, placeholder) | — (non applicable) | — | ✓ (via le placeholder) | 4 placeholders | 🟡 → 🟢 (placeholder ajouté) |
| Sprint 12 — Documentation | — | — | — | — (jugé non pertinent, cf. note) | 2 placeholders | 🟢 (aucun diagramme forcé — sprint purement administratif/documentaire, conforme à la consigne « ne pas créer de figure artificielle ») |

## Notes

- **Sprint 2** : aucune séquence dédiée à la création d'un topic au niveau infrastructure (AdminClient direct) n'a été ajoutée, car elle ferait doublon avec le diagramme de séquence réel déjà présent au Sprint 6 (`fig:seq-create-topic`, niveau API applicative). Si tu veux quand même une séquence bas niveau spécifique au Sprint 2, dis-le-moi.
- **Sprint 9** : pas de Use Case Admin dédié — la console d'administration est couverte par le diagramme de cas d'utilisation global du chapitre d'analyse (réutilisé et justifié explicitement au Sprint 8). Les deux diagrammes de navigation (portail + admin) couvrent la dimension structurelle demandée pour ce sprint.
- **Sprint 12** : volontairement sans diagramme. Le sprint documente un processus administratif (consolidation documentaire, plan de sauvegarde) sans architecture ni flux technique nouveau à représenter — ajouter un "cycle d'exploitation" artificiel n'aurait apporté aucune valeur, conformément à la consigne du brief.
- Les diagrammes marqués comme figures TikZ existantes (et non `[DIAGRAMME À CRÉER]`) sont déjà rendus dans le `.tex` — ce ne sont pas des placeholders, ce sont des figures complètes construites à partir de faits vérifiés dans le code/dépôt.
