# Fonctionnalités Monitoring — Récapitulatif client

Ce document résume, en langage clair, toutes les fonctionnalités de monitoring livrées sur la page **Cluster Management** (`/cluster`) de l'admin console, ainsi que les évolutions annexes réalisées durant ce chantier.

## 1. Correction de bugs bloquants

| Fonctionnalité | Avant | Après |
|---|---|---|
| Nombre de nœuds Kubernetes | Affichait toujours **0** | Affiche les 3 nœuds réels du cluster (vm01, vm02, vm03) avec leur statut |
| Requêtes par seconde (REQ/SEC) | Toujours à **0.0** | Affiche le débit réel de trafic, mis à jour en continu |

## 2. Supervision des nœuds (serveurs)

Pour chaque nœud du cluster, affichage en temps réel de :
- **Usage CPU** (barre de progression, %)
- **Mémoire utilisée / totale**
- **Espace disque utilisé / total**

Code couleur : vert (normal), orange (charge élevée, 75-90%), rouge (charge critique, ≥90%).

## 3. Alertes actives

Une section dédiée affiche en direct les alertes déclenchées sur l'infrastructure (ex : composant système indisponible, tâche échouée, membres etcd insuffisants), avec :
- Niveau de sévérité (critique / avertissement / info)
- Description du problème
- Depuis quand l'alerte est active

Permet de repérer un problème d'infrastructure sans avoir à consulter un outil séparé.

## 4. Usage par client (tenant)

Le tableau des espaces clients ("Tenant Namespaces") affiche désormais, en plus du nombre d'applications :
- **CPU consommé**
- **Mémoire consommée**
- **Requêtes par seconde**

Permet d'identifier en un coup d'œil quel client consomme le plus de ressources sur la plateforme.

## 5. Stockage (volumes persistants)

Une section liste tous les volumes de stockage persistant utilisés par les applications (nom, capacité, statut, classe de stockage). Sur l'infrastructure actuelle, aucune application ne nécessite de stockage persistant (toutes sont sans état) — la section reflète donc correctement une liste vide.

## 6. Export du journal d'audit

Le journal d'audit (qui trace chaque action administrative : suspension, restauration, suppression forcée) peut désormais être **exporté en fichier CSV téléchargeable**, en respectant les filtres actifs (par action, par client, par date) — utile pour l'archivage ou la transmission à un auditeur externe.

## 7. Nettoyage de l'interface

Deux fonctionnalités non utilisées ont été retirées du menu administrateur pour simplifier l'interface :
- **Anomalies** (détection automatique de pics de coût/trafic)
- **Gestion des incidents** côté admin (la page de statut public affichée aux clients reste inchangée et fonctionnelle)

## Fonctionnalités évaluées mais non retenues (avec justification)

| Fonctionnalité demandée | Statut | Raison |
|---|---|---|
| Temps de démarrage à froid (cold-start) des applications | Non réalisable | Aucune métrique de latence de cold-start n'est exposée par l'infrastructure actuelle — seul un indicateur d'état ("en cours de démarrage") serait possible, pas un vrai chiffre en millisecondes |
| Historique du lag Kafka | Annulée | Aurait nécessité une nouvelle table en base de données ; retirée à la demande du client |
| Débit au niveau de la passerelle réseau (Kourier) | Reportée | Non explorée, à la demande du client |
| Tendances historiques (graphiques CPU/RAM/trafic dans le temps) | Reportée | Non explorée, à la demande du client |
| Posture de sécurité | Reportée | Périmètre à redéfinir plus précisément avant implémentation |
| Tableau de bord des coûts sur `/cluster` | Reportée | Cette fonctionnalité existe déjà en détail sur la page "Revenue" de l'admin console — pas de duplication nécessaire |

## Documentation technique détaillée

Chaque fonctionnalité listée ci-dessus dispose d'un rapport technique détaillé (fichiers modifiés, requêtes utilisées, vérifications effectuées) dans `docs/PHASE_0.md` à `docs/PHASE_11.md`.
