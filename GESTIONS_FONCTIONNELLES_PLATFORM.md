# Gestions fonctionnelles de la plateforme PlatformServerless

Document produit par analyse directe du code (contrôleurs, services, entités, pages frontend) — cf. `PLATFORM_FUNCTIONALITIES.md` pour le détail acteur par acteur avec endpoints et statuts de confirmation. Ce document réorganise la même base de faits vérifiés, mais **par domaine fonctionnel** plutôt que par acteur, en vue de construire une architecture de sprints.

---

## 1. Vue globale des gestions

| # | Gestion | Périmètre en une phrase |
|---|---|---|
| 1 | Gestion des utilisateurs et des accès | Identité, rôles, équipe, clés d'API — tout ce qui concerne « qui peut se connecter et agir ». |
| 2 | Gestion des applications | Cycle de vie complet d'une application déployée (création à suppression forcée). |
| 3 | Gestion de la messagerie événementielle | Kafka (topics) et Knative Eventing (déclencheurs, publication) — un seul flux fonctionnel. |
| 4 | Gestion de la supervision et des journaux | Logs, métriques, introspection cluster, audit — tout ce qui permet d'observer la plateforme. |
| 5 | Gestion des comptes clients et des quotas | Administration des tenants eux-mêmes (suspension, limites de ressources), distincte de la gestion des utilisateurs individuels. |
| 6 | Gestion de la facturation et des paiements | Usage, moyens de paiement, factures, relances. |
| 7 | Gestion du statut public | Page de statut public, indépendante du reste. |

Ces 7 gestions couvrent l'intégralité des 33 fonctionnalités confirmées dans le code (cf. `PLATFORM_FUNCTIONALITIES.md`, section 5). Aucune fonctionnalité réelle n'est laissée hors de ce périmètre ; les 3 éléments non confirmés (catalogue d'images Docker, page Agenda, paiement par un MEMBER) sont signalés séparément en section 3.

---

## 2. Détail de chaque gestion

### Gestion 1 — Gestion des utilisateurs et des accès

**Fonctionnalités regroupées :**
- Inscription (création d'un compte, provisionné dans Keycloak).
- Connexion (Keycloak, OIDC/JWT).
- Consultation et modification de son propre profil.
- Lister l'ensemble des utilisateurs de la plateforme.
- Modifier le rôle d'un utilisateur.
- Créer, lister et révoquer une clé d'API.
- Inviter un membre d'équipe (identifiant/e-mail/mot de passe définis directement par le CLIENT_ADMIN).
- Lister les membres de son équipe.
- Modifier les permissions accordées à un membre.
- Supprimer un membre.

**Acteurs concernés :** ADMIN (rôles globaux), CLIENT_ADMIN (inscription, équipe), MEMBER (connexion, profil, clés d'API).

---

### Gestion 2 — Gestion des applications

**Fonctionnalités regroupées :**
- Créer/déployer une application à partir d'une image Docker.
- Consulter la liste des applications et leur statut en temps réel.
- Consulter le détail d'une application.
- Mettre à jour une application.
- Supprimer une application (par son propriétaire).
- Consulter l'historique des révisions et effectuer un rollback.
- Suppression forcée d'une application par un administrateur.
- Suspension d'une application par un administrateur.

**Acteurs concernés :** CLIENT_ADMIN et MEMBER (avec permission `DEPLOY_APP`/`DELETE_APP`), ADMIN (action forcée).

---

### Gestion 3 — Gestion de la messagerie événementielle

**Fonctionnalités regroupées :**
- Créer, lister et supprimer un topic Kafka.
- Suppression forcée d'un topic par un administrateur.
- Configurer un déclencheur (associer un sujet Kafka à une application).
- Publier un événement (CloudEvent) sur un sujet.

**Acteurs concernés :** CLIENT_ADMIN et MEMBER (avec permission `MANAGE_KAFKA`/`MANAGE_EVENTING`), ADMIN (action forcée).

---

### Gestion 4 — Gestion de la supervision et des journaux

**Fonctionnalités regroupées :**
- Consulter les journaux de déploiement d'une application.
- Consulter les journaux applicatifs en flux continu (temps réel).
- Consulter les métriques d'une application (requêtes/s, latence, CPU, mémoire).
- Consulter l'ensemble des journaux (vue administrateur).
- Introspection complète du cluster Kubernetes (nœuds, pods, namespaces, volumes, services Knative, courtiers Kafka, alertes, événements, vue d'ensemble système).
- Consulter les statistiques globales de la plateforme.
- Consulter et exporter le journal d'audit des actions administratives.

**Acteurs concernés :** CLIENT_ADMIN et MEMBER (avec permission `VIEW_LOGS`/`VIEW_MONITORING`, sur leurs propres applications), ADMIN (vue complète + audit).

---

### Gestion 5 — Gestion des comptes clients et des quotas

**Fonctionnalités regroupées :**
- Lister les comptes clients.
- Suspendre un compte client.
- Réactiver un compte client suspendu.
- Consulter les quotas de ressources d'un tenant (CPU, mémoire, nombre maximal d'applications).
- Modifier les quotas d'un tenant.

**Acteurs concernés :** ADMIN uniquement.

---

### Gestion 6 — Gestion de la facturation et des paiements

**Fonctionnalités regroupées :**
- Consulter son propre historique d'usage et de facturation.
- Consulter la facturation de l'ensemble des clients (vue administrateur).
- Déclencher manuellement un instantané (snapshot) d'usage.
- Exporter un rapport de facturation.
- Enregistrer un moyen de paiement (Stripe).
- Consulter ses transactions.
- Consulter et payer ses factures.
- Consulter la liste des factures impayées (vue administrateur).
- Suspendre un client pour non-paiement.

**Acteurs concernés :** CLIENT_ADMIN (usage, paiement), MEMBER (consultation/export selon permission `VIEW_BILLING`/`EXPORT_BILLING` — le paiement lui-même n'est pas confirmé pour ce rôle, cf. section 3), ADMIN (vue globale, relances).

---

### Gestion 7 — Gestion du statut public

**Fonctionnalités regroupées :**
- Consulter le statut de disponibilité des composants de la plateforme.
- Consulter l'historique des incidents.

**Acteurs concernés :** Public non authentifié, et accessible également à ADMIN, CLIENT_ADMIN, MEMBER une fois connectés.

---

## 3. Acteurs concernés par gestion

| Gestion | ADMIN | CLIENT_ADMIN | MEMBER | Public |
|---|:---:|:---:|:---:|:---:|
| 1. Utilisateurs et accès | ✔ (rôles) | ✔ (inscription, équipe) | ✔ (profil, clés API) | — |
| 2. Applications | ✔ (forcé) | ✔ | ✔ (permission) | — |
| 3. Messagerie événementielle | ✔ (forcé) | ✔ | ✔ (permission) | — |
| 4. Supervision et journaux | ✔ (complet) | ✔ (ses apps) | ✔ (permission) | — |
| 5. Comptes clients et quotas | ✔ | — | — | — |
| 6. Facturation et paiements | ✔ (global) | ✔ | ✔ (lecture, permission) | — |
| 7. Statut public | ✔ | ✔ | ✔ | ✔ |

**Fonctionnalités communes à plusieurs acteurs** : gestions 1 (partiellement), 2, 3, 4, 6 et 7 — chacune partagée entre au moins CLIENT_ADMIN et MEMBER, certaines étendues à ADMIN pour les actions de niveau plateforme.

**Fonctionnalités réservées à un seul acteur :**
- ADMIN uniquement : gestion 5 en intégralité (comptes clients et quotas), ainsi que la gestion des rôles globaux, l'audit et l'introspection cluster au sein des gestions 1 et 4.
- CLIENT_ADMIN uniquement : inscription initiale, gestion d'équipe (inviter/modifier/supprimer un membre), enregistrement d'un moyen de paiement.
- MEMBER : aucune fonctionnalité qui lui soit propre — son périmètre est toujours un sous-ensemble, conditionné par permission, de celui du CLIENT_ADMIN.

**Non confirmé dans le code (signalé séparément, non intégré aux gestions ci-dessus)** :
- Catalogue d'images Docker validées (entité `DockerImage` orpheline, sans service ni contrôleur).
- Fonctionnalité de type agenda/planning (page `Agenda.jsx` côté frontend, sans contrepartie backend identifiée).
- Paiement de facture effectué directement par un MEMBER (aucune permission dédiée dans l'énumération `Permission`).

---

## 4. Tableau de synthèse — Gestion → Fonctionnalités → Acteurs

| Gestion | Nombre de fonctionnalités | Acteurs |
|---|---|---|
| 1. Gestion des utilisateurs et des accès | 10 | ADMIN, CLIENT_ADMIN, MEMBER |
| 2. Gestion des applications | 8 | ADMIN, CLIENT_ADMIN, MEMBER |
| 3. Gestion de la messagerie événementielle | 4 | ADMIN, CLIENT_ADMIN, MEMBER |
| 4. Gestion de la supervision et des journaux | 7 | ADMIN, CLIENT_ADMIN, MEMBER |
| 5. Gestion des comptes clients et des quotas | 5 | ADMIN |
| 6. Gestion de la facturation et des paiements | 9 | ADMIN, CLIENT_ADMIN, MEMBER |
| 7. Gestion du statut public | 2 | ADMIN, CLIENT_ADMIN, MEMBER, Public |
| **Total** | **45 occurrences de fonctionnalité** (33 fonctionnalités distinctes, certaines déclinées par acteur — ADMIN forcé/global vs CLIENT_ADMIN/MEMBER propriétaire) | — |

---

## 5. Proposition d'ordre logique des gestions

L'ordre proposé suit une logique de **dépendance fonctionnelle réelle** : chaque gestion s'appuie sur ce que la précédente a mis en place, ce qui correspond à la manière dont le code lui-même est construit (permissions avant tout, applications comme socle, événementiel au-dessus des applications, supervision une fois qu'il y a quelque chose à observer, back-office en dernier).

1. **Gestion des utilisateurs et des accès** — prérequis absolu : aucune autre gestion ne peut être protégée par rôle/permission tant que l'identité et l'équipe n'existent pas.
2. **Gestion des applications** — cœur de la plateforme ; dépend uniquement de la gestion 1 (permissions déjà en place).
3. **Gestion de la messagerie événementielle** — un déclencheur relie toujours un sujet Kafka à une application déjà déployable (dépend de la gestion 2).
4. **Gestion de la supervision et des journaux** — n'a de sens que s'il existe des applications et des événements à observer (dépend des gestions 2 et 3).
5. **Gestion des comptes clients et des quotas** — administration de tenants qui ont désormais un usage réel à limiter/surveiller (dépend des gestions 2 à 4).
6. **Gestion de la facturation et des paiements** — la facturation repose sur l'usage réellement observé (dépend directement de la gestion 4, et indirectement de la gestion 5 pour la vue administrateur).
7. **Gestion du statut public** — indépendante des autres, peut être positionnée à tout moment ; proposée en dernier car la plus légère et la moins structurante.

Cet ordre n'est pas encore une proposition de sprints (non demandée à ce stade) : il donne uniquement la séquence dans laquelle les gestions devraient être abordées si elles servaient de base à une nouvelle architecture de sprints.
