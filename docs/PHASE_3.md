# Phase 3 : Lag Kafka historique

Phase 3 du brief "Monitoring enrichi admin-console" (voir [PHASE_0.md](PHASE_0.md) pour le contexte général).

## Statut : IMPLÉMENTÉE — en attente de déploiement/vérification en prod

## Objectif

Afficher une tendance historique du lag des consumer groups Kafka par topic, sur la page `/cluster`.

## Vérification faite avant de coder

`{__name__=~".*consumer.*lag.*"}` dans Prometheus → vide. **Aucun exporter Kafka n'est branché sur Prometheus** sur ce cluster (pas de `kafka-lag-exporter`, `kminion`, `burrow`, etc.). Donc pas d'historique disponible côté Prometheus — il faut le construire nous-mêmes.

## Décisions prises avec l'utilisateur

- Fréquence de capture : **toutes les 5 minutes**.
- Rétention : **7 jours** (purge automatique au-delà).

## Design

Le calcul de lag existant (`KafkaService.fetchTopicMetrics()`) est scopé à un seul utilisateur (`findByUserId`) et ne fait qu'un snapshot instantané — pas utilisable tel quel pour une vue admin globale historisée. Nouveau package dédié, cohérent avec le pattern existant (`anomaly/`, `billing/` : entité + repo + service + scheduler dans un même package) :

## Fichiers créés

- `backend-api/src/main/java/com/platform/api/kafka/lag/KafkaConsumerLagSnapshot.java` — entité JPA (`topicName`, `consumerGroup`, `lag`, `capturedAt`), table auto-créée par Hibernate (`ddl-auto: update`, pas de Flyway sur ce projet).
- `backend-api/src/main/java/com/platform/api/kafka/lag/KafkaConsumerLagSnapshotRepository.java` — requêtes dérivées (par topic + date, purge par date).
- `backend-api/src/main/java/com/platform/api/kafka/lag/KafkaLagHistoryService.java` — `captureSnapshot()` (admin-wide : parcourt tous les topics/tous les consumer groups via `KafkaTopicRepository.findAll()` + `KafkaSourceRepository`, réutilise la logique Kafka AdminClient de `KafkaService`), `purgeOlderThan()`, `getHistory()`/`getAllHistory()`.
- `backend-api/src/main/java/com/platform/api/kafka/lag/KafkaLagHistoryScheduler.java` — capture toutes les 5 min (`@Scheduled(fixedRate = 300000)`), purge quotidienne à 08h45 (`> 7 jours`).

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/admin/AdminController.java` — nouvel endpoint `GET /admin/cluster/kafka/lag-history?topic=xxx&hours=168`, injection de `KafkaLagHistoryService`.
- `admin-console/src/api/index.js` — `adminApi.getKafkaLagHistory(topic, hours)`.
- `admin-console/src/pages/admin/ClusterManagement.jsx` — onglet Kafka : sélecteur de topic + graphique de tendance (Recharts `LineChart`, déjà présent en dépendance `recharts@^2.10.0` — pas de nouvelle lib ajoutée). Remplace la note "Consumer group lag is not shown".

## Prochaine étape

Push + déploiement backend + frontend, puis attendre au moins 5-10 minutes après déploiement pour qu'un premier point d'historique soit capturé, avant de vérifier le graphique sur `/cluster` → onglet Kafka.
