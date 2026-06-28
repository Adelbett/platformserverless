# Point #3 — Lag Kafka sur le détail d'un topic

> Explication ligne par ligne du problème identifié et de la correction appliquée.

---

## 1. Le problème — une découverte différente de ce qui était attendu

Le document d'audit (`AUDIT_CONCURRENCE_ET_MONITORING.md`, section 5.1) annonçait un endpoint `GET /api/kafka/topics/:name/lag` **manquant**, à créer de zéro avec `AdminClient`.

En lisant le code réel de `KafkaService.java`, la situation est différente : **le calcul du lag existe déjà**, mais il n'est branché que sur un seul des deux endpoints qui en ont besoin.

### 1.1 Ce qui existait déjà — `fetchTopicMetrics()`

```java
private Map<String, long[]> fetchTopicMetrics(List<String> topicNames, String userId) {
    ...
}
```
Cette méthode utilise `org.apache.kafka.clients.admin.AdminClient` pour :
1. Décrire les topics demandés (`describeTopics`) pour connaître leurs partitions
2. Récupérer l'offset de fin de chaque partition (`listOffsets` avec `OffsetSpec.latest()`) — ça donne le **nombre total de messages produits**
3. Pour chaque topic, retrouver les `consumerGroup` associés (via `KafkaSourceRepository`)
4. Récupérer l'offset **committé** par chaque consumer group (`listConsumerGroupOffsets`)
5. Calculer `lag = endOffset - committedOffset` par partition, sommé par topic

C'est exactement le calcul de lag Kafka standard — déjà écrit, déjà fonctionnel.

### 1.2 Le vrai trou — `getTopic()` n'utilisait pas cette méthode

```java
// AVANT la correction
public KafkaTopicDto getTopic(String topicId, String userId) {
    KafkaTopic topic = requireOwned(topicId, userId);
    return toDto(topic);   // ← toDto() simple, SANS métriques
}
```

- `requireOwned(topicId, userId)` → vérifie l'ownership (multi-tenant), inchangé.
- `toDto(topic)` → convertit l'entité en DTO **sans jamais appeler `fetchTopicMetrics()`**. Regarde la méthode `toDto()` plus bas dans le fichier : elle ne renseigne ni `messageCount` ni `consumerLag` dans le DTO retourné — ces champs restent `null`.

### 1.3 Comparaison avec `listTopics()` qui, lui, fonctionnait déjà

```java
public List<KafkaTopicDto> listTopics(String userId) {
    List<KafkaTopic> topics = topicRepository.findByUserId(userId);
    if (!kafkaEnabled || topics.isEmpty()) {
        return topics.stream().map(this::toDto).collect(Collectors.toList());
    }
    Map<String, long[]> metricsMap = fetchTopicMetrics(
            topics.stream().map(KafkaTopic::getName).collect(Collectors.toList()),
            userId
    );
    return topics.stream()
            .map(t -> toDtoWithMetrics(t, metricsMap.getOrDefault(t.getName(), null)))
            .collect(Collectors.toList());
}
```

- Ici, `fetchTopicMetrics(...)` est bien appelée, et `toDtoWithMetrics()` (pas `toDto()`) est utilisée pour construire chaque DTO — donc la **liste** des topics affichait déjà le lag correctement.

### 1.4 Résumé du problème

```
GET /api/kafka/topics        → appelle fetchTopicMetrics() → lag ✅ présent
GET /api/kafka/topics/{id}   → n'appelle PAS fetchTopicMetrics() → lag ❌ absent (null)
```

Incohérence : la page de liste d'un topic montre le lag, mais cliquer sur "Détails" d'un topic précis le fait disparaître.

---

## 2. La solution appliquée

### 2.1 Principe

Ne pas réécrire un nouveau calcul de lag — **réutiliser** `fetchTopicMetrics()`, exactement comme `listTopics()` le fait, mais avec une liste d'un seul élément (`List.of(topic.getName())`).

### 2.2 Code modifié, ligne par ligne

```java
public KafkaTopicDto getTopic(String topicId, String userId) {
    KafkaTopic topic = requireOwned(topicId, userId);
    if (!kafkaEnabled) return toDto(topic);
    Map<String, long[]> metricsMap = fetchTopicMetrics(List.of(topic.getName()), userId);
    return toDtoWithMetrics(topic, metricsMap.get(topic.getName()));
}
```

- `KafkaTopic topic = requireOwned(topicId, userId);` → **inchangé**. Vérifie que ce topic appartient bien à l'utilisateur (ou à son équipe via délégation multi-tenant), sinon lève `UnauthorizedException`.
- `if (!kafkaEnabled) return toDto(topic);` → **nouveau garde-fou**. Si Kafka est désactivé (mode mock, ex: en développement local sans cluster Kafka réel), on ne tente même pas d'appeler `AdminClient` — ça échouerait de toute façon puisqu'aucun broker n'est joignable. On retombe sur `toDto()` simple, comme avant.
- `Map<String, long[]> metricsMap = fetchTopicMetrics(List.of(topic.getName()), userId);` → **nouveau**. Appelle la méthode de calcul de métriques existante, avec une liste contenant uniquement le nom de CE topic (au lieu de tous les topics de l'utilisateur comme dans `listTopics()`). `fetchTopicMetrics()` accepte déjà une `List<String>` en paramètre, donc aucune modification de cette méthode n'était nécessaire.
- `return toDtoWithMetrics(topic, metricsMap.get(topic.getName()));` → **changé** (remplace `return toDto(topic);`). Utilise `toDtoWithMetrics()` au lieu de `toDto()` — la même méthode de conversion que `listTopics()` utilise déjà, qui sait lire le tableau `long[]` (`[messageCount, consumerLag]`) et remplir les bons champs du DTO.

### 2.3 Pourquoi cette approche plutôt que créer un endpoint `/lag` séparé

| Option | Avantage | Inconvénient |
|---|---|---|
| Créer `GET /api/kafka/topics/{id}/lag` (proposé initialement par l'audit) | Endpoint dédié explicite | Dupliquerait `fetchTopicMetrics()`, 2 appels réseau au lieu d'1 si le frontend veut détails + lag |
| **Inclure le lag dans `GET /api/kafka/topics/{id}` (solution retenue)** | Réutilise le code existant, 1 seul appel réseau, cohérent avec `listTopics()` | Aucun — c'était juste un oubli de branchement |

---

## 3. Vérification de non-régression

- `fetchTopicMetrics()` n'a **pas été modifiée** — seule son utilisation a changé dans `getTopic()`.
- `toDtoWithMetrics()` n'a **pas été modifiée** — déjà utilisée ailleurs (`listTopics()`), donc son comportement est déjà éprouvé.
- Compilation Maven (`mvn compile`) réussie sans erreur après la modification.

---

## 4. Résultat final — comportement de l'API

| Requête | Avant | Après |
|---|---|---|
| `GET /api/kafka/topics` | `messageCount` + `consumerLag` présents | Inchangé (déjà correct) |
| `GET /api/kafka/topics/{id}` | `messageCount` + `consumerLag` toujours `null` | `messageCount` + `consumerLag` calculés en temps réel |

---

## 5. Fichier modifié

| Fichier | Nature du changement |
|---|---|
| `backend-api/src/main/java/com/platform/api/kafka/KafkaService.java` | `getTopic()` appelle désormais `fetchTopicMetrics()` + `toDtoWithMetrics()` au lieu de `toDto()` seul |

---

*Document généré dans le cadre du plan d'optimisation RBAC/Logs/Monitoring — voir `AUDIT_CONCURRENCE_ET_MONITORING.md` section 5.1.*
