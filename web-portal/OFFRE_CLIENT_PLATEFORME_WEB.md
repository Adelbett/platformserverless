# Plateforme Web NextStep - Offre Client et Capacites Utilisateur

## 1. Ce que la plateforme offre au client

La plateforme web NextStep est un portail de pilotage serverless qui permet a un client (equipe dev, ops, produit) de:

- Deployer des applications conteneurisees sur une infrastructure Knative.
- Superviser l etat des services en temps reel depuis un dashboard central.
- Gérer des flux event-driven avec Kafka (topics, publication d evenements).
- Consulter logs et metriques pour observer la sante des applications.
- Accelerer les mises en production avec une interface guidee (assistant de deploiement).

En pratique, le client dispose d une console unique pour exploiter ses workloads cloud natifs.

## 2. Valeur business pour le client

### 2.1 Rapidite de mise en production

- Creation de service via formulaire web sans ecrire tout le YAML manuellement.
- Parametrage simplifie: image Docker, port, ressources, replicas, variables d environnement.
- Preview YAML integree pour validation avant lancement.

### 2.2 Reduction de la complexite operationnelle

- Vue d ensemble immediate sur les services actifs et la sante globale.
- Interfaces dediees pour logs, monitoring, eventing, Kafka.
- Navigation structuree pour limiter la dispersion des outils.

### 2.3 Approche event-driven accessible

- Publication d evenements depuis UI.
- Configuration d un trigger Kafka cote deploiement.
- Gestion des topics sans passer par des commandes shell.

### 2.4 Visibilite et controle

- Tableaux de statuts, journaux filtrables, export des logs.
- Acces detaille application par application.
- Indicateurs cles pour detecter incidents et regressions.

## 3. Ce que le client peut faire dans la plateforme (detail fonctionnel)

## 3.1 Se connecter et demarrer une session

- Ouvrir une session via ecran Login.
- Acceder au dashboard principal apres authentification.
- Se deconnecter depuis la sidebar.

Fonctions disponibles:
- Login utilisateur.
- Inscription (Register) avec validation de mot de passe confirme.

## 3.2 Visualiser le systeme global (Dashboard)

Le client peut:
- Voir le nombre total de services actifs.
- Voir combien de services sont en statut RUNNING.
- Voir le nombre de pipelines Kafka (topics).
- Consulter un flux de telemetrie visuel.
- Ouvrir rapidement la creation d un nouveau service.
- Ouvrir la fiche detail d un service existant.

Resultat metier:
- Prise de decision rapide grace a une vue unifiee de l activite.

## 3.3 Deployer une nouvelle application

Le client peut configurer:
- Nom d application et namespace.
- Image Docker (name:tag).
- Port du conteneur.
- Description applicative.
- Min replicas / Max replicas.
- CPU request/limit et Memory request/limit.
- Variables d environnement (ajout, suppression, valeurs, mode secret visuel).
- Trigger Kafka (activation, topic, consumer group, filtre).

Le client peut aussi:
- Previsualiser la configuration de deploiement en resume.
- Afficher le YAML genere.
- Copier le YAML.
- Lancer le deploiement.

Resultat metier:
- Mise en ligne acceleree et standardisee des services.

## 3.4 Explorer le detail d une application

Le client peut:
- Consulter les metadonnees techniques du service:
  - image
  - namespace
  - statut
  - port
  - limites et requests
  - dates de deploiement/mise a jour
- Ouvrir l URL publique si disponible.
- Voir les logs recents de l application.
- Voir le payload metrics de l application.

Resultat metier:
- Diagnostic rapide service par service.

## 3.5 Administrer Kafka (Topics)

Le client peut:
- Lister les topics existants.
- Creer un topic avec partitions et replication factor.
- Definir retention et cleanup policy.
- Supprimer un topic avec confirmation.

Resultat metier:
- Gouvernance simple des canaux de messages.

## 3.6 Publier des evenements (Eventing)

Le client peut:
- Definir le type d evenement.
- Associer un appId (optionnel).
- Saisir un payload JSON.
- Publier l evenement vers le backend.
- Consulter un historique local des derniers evenements publies.

Resultat metier:
- Test rapide de scenarios event-driven et orchestration asynchrone.

## 3.7 Analyser les logs (Observability)

Le client peut:
- Charger ses logs utilisateur.
- Filtrer par application.
- Filtrer par niveau (INFO/WARN/ERROR/FAILED).
- Rechercher par mot-cle.
- Activer/desactiver word wrap.
- Activer/desactiver auto-scroll.
- Exporter les logs filtres en fichier texte.

Resultat metier:
- Reduction du temps de resolution incident.

## 3.8 Suivre le monitoring cluster

Le client peut:
- Voir les KPI globaux (apps, running, scale-to-zero, etat metrics).
- Afficher le payload metrics cluster.
- Consulter le statut de chaque application dans un tableau.

Resultat metier:
- Vision operationnelle continue de la plateforme.

## 4. Parcours utilisateur type (de bout en bout)

Parcours standard d un client:
1. Connexion a la plateforme.
2. Consultation dashboard pour etat global.
3. Creation d un nouveau service via Deploy App.
4. Verification dans App Details (statut, logs, metrics).
5. Configuration/verification Kafka si besoin.
6. Publication d evenements de test.
7. Suivi logs et monitoring pour valider la stabilite.

## 5. Fonctionnalites transverses utiles au client

- Navigation laterale structuree (services, pipelines, automations, observability, monitor).
- Header contextuel avec titre de page dynamique.
- Notifications visuelles (succes, warning, erreur, info).
- UX orientee operation avec cartes, tables, terminal-like viewers.

## 6. Ce que le client ne peut pas encore faire (limites actuelles)

Fonctions visibles mais non finalisees:
- Save as Draft dans l assistant de deploiement (pas de persistance backend).
- Update Image dans le detail app (bouton desactive).
- Delete App dans le detail app (bouton desactive).

Contraintes techniques actuelles:
- Authentification simplifiee en mode demo dans le front (contexte local).
- Certaines metriques sont partiellement visuelles selon disponibilite backend.

## 7. Public cible

Cette plateforme convient a:
- Equipes developpement backend/microservices.
- Equipes DevOps/SRE voulant un cockpit web d exploitation.
- Equipes produit souhaitant suivre l etat de deploiement des services.

## 8. Resume executif

La plateforme web NextStep offre au client un espace unique pour deployer, observer et piloter des applications serverless et event-driven.

Le client peut:
- Construire ses deploiements applicatifs de maniere guidee.
- Administrer les flux Kafka et publier des evenements.
- Diagnostiquer rapidement via logs et monitoring.

La valeur principale est la combinaison de vitesse de delivery, lisibilite operationnelle et simplification de l exploitation cloud-native.
