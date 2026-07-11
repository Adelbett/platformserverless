# Fonctionnalités de la plateforme — côté client (web-portal)

Ce document liste toutes les fonctionnalités disponibles pour un client de la plateforme (utilisateur `MEMBER` ou `CLIENT_ADMIN`), sur l'application **web-portal**. Ne couvre pas l'administration interne (voir `docs/FONCTIONNALITES-MONITORING-CLIENT.md` pour l'admin console).

## 1. Compte et connexion

- Créer un compte, se connecter.
- Consulter et modifier les paramètres de son compte.

## 2. Tableau de bord (Dashboard)

- Vue d'ensemble : nombre d'applications déployées, résumé des métriques du cluster, logs récents.
- Accès rapide au déploiement d'une nouvelle application.

## 3. Gestion des applications serverless

- **Déployer une nouvelle application** : nom, image Docker, configuration.
- **Lister/rechercher/filtrer** ses applications déployées.
- **Voir le détail d'une application** : statut, configuration.
- **Modifier / mettre à jour** une application existante.
- **Supprimer** une application.
- **Historique des révisions** : voir toutes les versions déployées d'une application.
- **Rollback** : revenir à une version antérieure en un clic.
- **Logs** : consulter les logs d'une application spécifique.
- **Métriques** : voir les métriques de performance (CPU, mémoire, requêtes/sec, erreurs) d'une application.

## 4. Kafka (messagerie événementielle)

- Créer, lister et supprimer des topics Kafka.

## 5. Eventing (architecture événementielle)

- Créer des sources d'événements et des triggers (déclencheurs).
- Lister et supprimer des triggers existants.
- Publier des événements manuellement.

## 6. Logs

- Consulter tous ses propres logs, ou filtrer par application.

## 7. Monitoring

- Tableau de bord de supervision : métriques par application et métriques globales du cluster.

## 8. Facturation

- Consulter le résumé de facturation (coût du mois en cours, projection de fin de mois).
- Gérer ses moyens de paiement.
- Consulter et payer ses factures.
- **Exporter un rapport de facturation au format Excel.**

## 9. Gestion d'équipe (réservé aux CLIENT_ADMIN)

Accessible uniquement aux comptes avec le rôle **CLIENT_ADMIN** (pas aux membres simples) :
- Ajouter / retirer des membres de l'équipe.
- Attribuer des permissions granulaires par membre, parmi :
  - Déployer une application
  - Supprimer une application
  - Gérer Kafka
  - Gérer l'Eventing
  - Voir les logs
  - Voir le monitoring
  - Voir la facturation
  - Exporter la facturation

## 10. Page de statut public

- Accessible sans connexion : état de santé global de la plateforme et historique des incidents.

## Note sur les rôles

- **MEMBER** : accès aux fonctionnalités selon les permissions accordées par le CLIENT_ADMIN de son équipe.
- **CLIENT_ADMIN** : accès complet + gestion de l'équipe.
- Pas de restriction par palier d'abonnement (plan gratuit/payant) identifiée — la facturation fonctionne à l'usage réel, pas par plan.
