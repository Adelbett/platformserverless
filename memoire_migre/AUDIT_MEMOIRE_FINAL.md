# Audit final du mémoire — PlatformServerless

Document interne de suivi, produit après l'enrichissement complet des chapitres `chapitre1.tex` à `chapitre5.tex` (Sprints 0 à 12). Ce fichier est un outil de travail pour Adel avant la soutenance — il n'est cité par aucun chapitre du mémoire lui-même, conformément à la règle de séparation entre documents internes et contenu académique final.

Légende : 🔴 CRITIQUE · 🟠 IMPORTANT · 🟡 AMÉLIORATION · 🟢 OPTIONNEL

---

## 1. Figures manquantes

Aucune figure structurelle manquante : chaque section dispose d'une figure réelle (images déjà présentes dans `image/`) ou d'un diagramme TikZ construit à partir de faits vérifiés dans le code/dépôt. Rien n'a été laissé en `\ref` orphelin.

🟢 Deux figures (`fig:archi-logique`, `fig:archi-physique`, chapitre0.tex) couvrent déjà l'architecture globale demandée (Users → Portails → Backend → K8s/Knative/Kafka → PostgreSQL/Keycloak/Monitoring) et le diagramme de déploiement physique — **aucune nouvelle figure d'architecture finale n'était nécessaire**, elles existaient déjà et sont cohérentes avec le contenu ajouté aux chapitres 1-5.

## 2. Captures manquantes

🔴 **Le point le plus important restant.** Toutes les captures d'écran réelles restent à fournir — chaque chapitre contient désormais des placeholders explicites `[CAPTURE À AJOUTER : ...]` précisant la commande ou l'écran exact attendu. Décompte approximatif par chapitre :
- `chapitre1.tex` (Sprint 0-2) : ~15 captures (nodes, namespaces, NetworkPolicy, Cilium, MetalLB, Kourier, ksvc, revisions, scale-to-zero x3, Kafka pods/cluster, Postman)
- `chapitre2.tex` (Sprint 3-5) : ~13 captures (KafkaSource/Broker/Trigger, logs Eventing, Keycloak, JWT, 401/403, isolation tenant, API deploy, ksvc/pods, pipeline Jenkins)
- `chapitre3.tex` (Sprint 6-7) : ~11 captures (Postman Kafka/Eventing, ressources K8s, Prometheus targets, Grafana, CPU/RAM/requêtes, Alertmanager, logs)
- `chapitre4.tex` (Sprint 8-10) : 4 captures déjà présentes (formulaire déploiement, supervision cluster, Kafka, facturation) + ~13 restantes (Login, Dashboard, AppsList, AppDetails, AdminDashboard, AdminClients, Eventing, LogsView, Monitoring, Team, AdminUsers, AdminAuditLog, pipeline CI/CD, build logs, Docker Hub)
- `chapitre5.tex` (Sprint 11-12) : ~6 captures (plan de test, rapports d'audit x2, Postman, sommaire doc, fiche correctif)

Seules 4 captures réelles existent aujourd'hui dans tout le mémoire (`deploy_app_form.png`, `cluster_management.png`, `kafka_topics.png`, `billing_view.png`), toutes au Sprint 8/9.

## 3. Diagrammes manquants

Aucun. Tous les diagrammes demandés dans le brief ont été construits ou existaient déjà :
- Architecture réseau, isolation Cilium, flux MetalLB, cycle scale-to-zero (chapitre1.tex)
- Chaîne événementielle Producer→Kafka→KafkaSource→Broker→Trigger→Knative→App (chapitre2.tex)
- Architecture Kafka/Eventing depuis le frontend, architecture logs réelle, architecture monitoring (chapitre3.tex)
- Navigation portail client + console admin, pipeline CI/CD backend (chapitre4.tex)
- Architecture logique/physique/composants globales (chapitre0.tex, préexistantes)

## 4. Tests manquants

🟠 Toutes les matrices de validation (une par sprint, plus la matrice globale T01-T15 au Sprint 11) sont rédigées mais leurs colonnes **Résultat obtenu** sont à `[À COMPLÉTER]` et **Statut** à `[À VÉRIFIER]` — aucun résultat n'a été présumé positif. C'est un choix délibéré (cohérent avec la règle « ne jamais inventer OK sans preuve ») mais cela signifie qu'aucun test n'est aujourd'hui formellement clos. Le plan de test manuel (84 cas, Sprint 11) est lui-même explicitement présenté comme une grille prête à l'exécution, pas comme une campagne tracée.

## 5. Sections incomplètes

Aucune. Les 12 sprints suivent désormais tous le même gabarit complet (Objectifs → Backlog 5 colonnes → Conception → Réalisation → Difficultés → Démonstration → Validation → Résultat → Definition of Done → Bilan du Sprint).

## 6. Données à vérifier

🟠 Versions non documentées de façon fiable dans le dépôt, donc volontairement absentes du texte : Kubernetes, Cilium, MetalLB, Kourier, Knative Serving, Kafka (broker), Strimzi, nombre exact de courtiers Kafka, caractéristiques CPU/RAM/OS des 3 nœuds.

🟡 Isolation tenant testée (T-S4-04 / T03) : le texte précise déjà que ce test ne vaut que « si cette règle est réellement implémentée » pour la ressource testée — à confirmer au cas par cas avant la soutenance.

## 7. Versions à compléter

🟡 Trois versions **sont** vérifiables dans `backend-api/pom.xml` mais ne sont citées nulle part dans `memoire_migre/` : Java 21, Spring Boot 3.2.3 (`spring-boot-starter-parent`), Fabric8 Kubernetes Client 6.10.0. Ajout possible dans un tableau « Technologies et versions » du Sprint 0 ou en synthèse de Release 0, si tu veux les inclure.

## 8. Références bibliographiques manquantes

🟡 `biblio.bib` contient déjà les entrées nécessaires, mais plusieurs ne sont **jamais citées** dans le texte alors que les technologies correspondantes sont abondamment décrites : `KeycloakDoc`, `PostgreSQLDoc`, `PrometheusDoc`, `GrafanaDoc`, `JenkinsDoc`, `KanikoDoc`, `DockerDoc`, `ReactDoc`, `SpringBootDoc`, `StripeDoc`. Un `\cite{}` à la première mention de chacune (Sprint 4 pour Keycloak/PostgreSQL, Sprint 7 pour Prometheus/Grafana, Sprint 5 pour Jenkins/Kaniko/Docker, Sprint 8 pour React) renforcerait la rigueur académique. Aucune citation orpheline en sens inverse — tout `\cite{}` utilisé a une entrée correspondante.

## 9. Problèmes LaTeX

🔴 **Corrigé pendant ce travail** : `\usetikzlibrary{positioning}` était absente de `main.tex` alors que plusieurs nouveaux diagrammes utilisent la syntaxe `right=X of Y` — ajoutée à la ligne 5 de `main.tex`. Sans ce correctif, la compilation aurait échoué sur tous les nouveaux diagrammes TikZ.

🟢 `\checkmark` (non défini par défaut sans `amssymb`) a été évité au profit de `\ding{51}` (pifont, déjà chargé) par précaution — `amssymb` est en réalité chargé dans ce template, donc les deux auraient fonctionné, mais `\ding{51}` reste sans risque.

Aucune autre erreur de compilation identifiée par relecture manuelle (labels, environnements `table`/`figure`/`tikzpicture` bien fermés). **Aucun compilateur LaTeX n'est disponible dans cet environnement de travail** — cette vérification reste donc à confirmer par une compilation réelle avant la soutenance.

## 10. Figures mal référencées

Aucune. Vérification systématique effectuée après chaque chapitre : aucun label dupliqué, aucune référence orpheline, tous les renvois croisés inter-chapitres (matrice globale du Sprint 11 vers les 10 matrices de sprint) resolvent correctement.

## 11. Tableaux manquants

Aucun des 14 types de tableaux demandés n'est manquant : technologies/versions (partiel, cf. point 6-7), Sprint Backlog (tous les sprints), critères d'acceptation (intégrés aux Backlogs), Definition of Done (tous les sprints), matrice de validation (tous les sprints + globale), composants Kubernetes (Réalisation Sprint 0), étapes CI/CD (Sprint 10), problèmes/solutions (Difficultés, tous les sprints), risques/limites (synthèse chapitre5.tex).

🟢 Non ajouté car non demandé explicitement pour un sprint précis : matrice des permissions détaillée (rôle × permission), tableau des flux réseau consolidé tous composants confondus (les flux existent mais dispersés par sprint plutôt que consolidés en un seul tableau global).

## 12. Incohérences techniques

🟠 **Identifiée et documentée honnêtement (chapitre3.tex, Sprint 7 / chapitre5.tex, Sprint 12)** : `spring-boot-starter-data-elasticsearch` est déclarée comme dépendance Maven et une tâche de sauvegarde (`k8s/backup/elasticsearch-snapshot-cronjob.yaml`) suppose l'existence d'une instance Elasticsearch — mais **aucune classe du code backend n'utilise réellement Elasticsearch**, et aucun manifeste de déploiement de l'instance elle-même n'a été retrouvé dans ce dépôt. Les journaux applicatifs réels transitent par un chemin différent (Fabric8 → `PodLogService` → SSE). Ce point est documenté comme une incohérence non résolue plutôt que masqué.

✅ Distinction Fabric8 (Knative/Eventing, CRD) vs `AdminClient` natif (Kafka, protocole natif) : correcte et cohérente sur l'ensemble des 5 chapitres, avec la clarification explicite que `KafkaTopic` désigne deux choses différentes (CRD Strimzi non utilisée vs entité JPA du backend).

## 13. Incohérences Scrum

🟡 Le plan de test du Sprint 11 (84 cas) est présenté honnêtement comme une grille prête à l'exécution, pas comme une campagne tracée — cohérent avec l'esprit de la consigne « ne pas fabriquer un historique Scrum », mais cela signifie que le mémoire ne peut pas revendiquer une couverture de test réellement exécutée tant que ces cas n'auront pas été effectivement joués et capturés.

Aucune date de réunion, ticket Jira, Daily Scrum ou story point n'a été inventé nulle part — conforme à la consigne.

## 14. Informations non prouvées

Toutes marquées explicitement `[À COMPLÉTER]` / `[À VÉRIFIER]` / `[CAPTURE À AJOUTER]` dans les 5 chapitres — aucune ne se présente comme acquise sans preuve. C'est le principe directeur qui a guidé l'ensemble de ce travail d'enrichissement.

## 15. Points forts

- 🟢 Traçabilité systématique : chaque affirmation technique renvoie soit à un fichier réel du dépôt (`k8s/tenant/network-policy.yaml`, `application-k8s.yml`, `k8s/grafana/platform-tenant-dashboard.json`, `backend-api/pom.xml`), soit à une classe de code identifiée.
- 🟢 Deux incohérences réelles détectées et documentées avec honnêteté plutôt que masquées (Elasticsearch, isolation tenant partielle).
- 🟢 Progression de sécurité mesurée et chiffrée (4/10 → 5,2/10), avec distinction explicite entre vulnérabilité corrigée et risque produit assumé.
- 🟢 Matrice globale de validation (T01-T15) qui relie chaque fonction transverse aux tests détaillés des sprints correspondants, évitant la duplication tout en donnant une vue d'ensemble.

## 16. Points faibles

- 🔴 Absence quasi totale de captures réelles (4 sur ~65 attendues).
- 🟠 Aucun test formellement exécuté et tracé à ce jour.
- 🟠 Versions des briques d'infrastructure non documentées (limite assumée, pas un oubli, mais reste une faiblesse pour un jury).
- 🟡 Pipelines CI/CD hétérogènes (seul le backend est robuste) — déjà documenté comme limite assumée.

## 17. Priorité des corrections avant soutenance

1. 🔴 Capturer au minimum les preuves listées en priorité par chaque sprint (`kubectl get nodes`, scale-to-zero x3, audit de sécurité x2, un E2E Eventing, un pipeline Jenkins) — les preuves les plus convaincantes pour un jury.
2. 🔴 Confirmer par une compilation LaTeX réelle qu'aucune erreur ne subsiste (non vérifiable dans cet environnement).
3. 🟠 Exécuter et tracer au moins les tests T01 à T09 de la matrice globale (fonctions cœur de la plateforme).
4. 🟡 Ajouter les `\cite{}` manquants pour les technologies déjà documentées dans `biblio.bib`.
5. 🟢 Compléter le tableau de versions avec Java/Spring Boot/Fabric8 si souhaité.
