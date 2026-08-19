# Diagramme de composants — descriptif détaillé pour la création du diagramme

Ce document sert de script détaillé pour produire le diagramme `diagrammes/diagramme_composants.png` référencé dans le mémoire (`\includegraphics[width=13.5cm]{diagrammes/diagramme_composants.png}`, label `fig:archi-composants`). Les dépendances listées ci-dessous ont été extraites directement des imports réels du code (`grep` sur les instructions `import com.platform.api.*` de chaque package), pas supposées.

---

## 1. Objectif du diagramme

Montrer les **modules internes du backend Spring Boot** (organisation *package-by-feature*, un package = un domaine métier), leurs dépendances réelles les unes envers les autres, et leurs dépendances externes communes (Fabric8/Kubernetes, PostgreSQL, Keycloak, Stripe). Ce n'est pas un diagramme de classes (pas d'attributs/méthodes) : chaque composant est une boîte représentant un package entier.

## 2. Les composants (21 packages réels du backend, vérifiés par exploration du dépôt)

| Composant | Rôle | Classes clés |
|---|---|---|
| `app` | Cycle de vie des applications déployées, orchestration Knative | `App`, `AppController`, `AppService`, `AppDeploymentAsyncRunner`, `KnativeService`, `KnativeWatcher`, `CrashLoopScheduler` |
| `admin` | Agrégateur des fonctions d'administration de la plateforme | `AdminController` |
| `billing` | Facturation à l'usage et facturation mensuelle | `BillingSnapshot`, `AppInvoice`, `BillingService`, `BillingScheduler`, `InvoiceService` |
| `eventing` | Knative Eventing (KafkaSource, Trigger, Broker) | `KafkaSource`, `Trigger`, `EventingService`, `EventingController` |
| `kafka` | Gestion des sujets Kafka (topics) | `KafkaTopic`, `KafkaService`, `KafkaController` |
| `quota` | Quotas de ressources par tenant | `TenantQuota`, `QuotaService` |
| `user` | Identité, rôles, permissions, délégation de propriété | `User`, `UserRole`, `Permission`, `PermissionService`, `UserContextService` |
| `apikey` | Clés d'API pour pilotage machine-à-machine | `ApiKey`, `ApiKeyService` |
| `security` | Filtres d'authentification (JWT, clé d'API, SSE) | `KeycloakJwtAuthConverter`, `UserSyncFilter`, `ApiKeyFilter`, `SseTokenFilter`, `SecurityConfig` |
| `logs` | Journaux de déploiement et diffusion temps réel | `DeploymentLog`, `LogSseService`, `PodLogService`, `PodLogStreamService` |
| `payment` | Intégration Stripe | `PaymentTransaction`, `PaymentService` |
| `metrics` | Métriques applicatives (Prometheus) | `MetricsService` |
| `status` | Statut public de la plateforme | `Incident`, `StatusController`, `StatusService`, `StatusRateLimitFilter` |
| `audit` | Journal d'audit des actions administrateur | `AdminAuditLog`, `AdminAuditLogService` |
| `team` | Gestion des membres d'équipe côté client | `TeamController` |
| `auth` | Inscription des comptes | `AuthController`, `AuthService` |
| `DockerImage` | Entité orpheline (aucun service/contrôleur ne l'utilise) | `DockerImage` |
| `config`, `exception`, `repository` | Transverses : configuration Spring, exceptions métier, interfaces JPA communes | — |

## 3. Dépendances réelles entre composants (issues des imports du code — à représenter par des flèches pleines)

```
app        → eventing, logs, user
admin      → app, audit, eventing, kafka, logs, metrics, quota, user
billing    → app, kafka, logs, payment, user
eventing   → kafka, logs, user
kafka      → eventing, user
quota      → app, user
apikey     → user
security   → apikey, status, user
logs       → app, user
payment    → user
metrics    → app
team       → auth, user
```

Composants **sans dépendance sortante vers un autre module métier** (uniquement `exception`/`config`/persistance) : `user`, `status`, `audit`, `DockerImage`.

> Note de fidélité : ce sont les dépendances **réellement observées dans le code** (imports Java), pas une supposition d'architecture idéale. Par exemple, `kafka` dépend de `eventing` (et pas l'inverse uniquement) car `KafkaController`/`KafkaService` référencent des classes du package `eventing` — à respecter tel quel dans le diagramme même si ça peut sembler à contre-sens du flux fonctionnel Kafka→Eventing décrit ailleurs dans le mémoire (le flux *fonctionnel* et la dépendance *de code* ne sont pas toujours dans le même sens).

## 4. Dépendances externes communes (à dessiner comme un socle partagé sous tous les composants)

| Dépendance externe | Utilisée par |
|---|---|
| **Fabric8 KubernetesClient** | `app` (KnativeService), `eventing` (ressources Broker/Trigger/KafkaSource), `kafka` (AdminClient natif, pas de CRD), `quota` (ResourceQuota), `admin` (lecture directe du cluster) |
| **PostgreSQL (Spring Data JPA)** | Tous les packages porteurs d'entités `@Entity` : `app`, `billing`, `eventing`, `kafka`, `quota`, `user`, `apikey`, `logs`, `payment`, `status`, `audit`, `DockerImage` |
| **Keycloak (OAuth2 Resource Server)** | `security` (validation des JWT), utilisé transversalement par tous les contrôleurs via Spring Security |
| **Stripe SDK** | `payment` uniquement |
| **Prometheus (Micrometer)** | `metrics` uniquement |

## 5. Composants externes au backend (à dessiner en dehors du grand rectangle "backend-api")

- **Portail client (web-portal)** → dépend de l'ensemble de l'API REST du backend
- **Console d'administration (admin-console)** → dépend principalement de `admin`, `audit`, `metrics`, `quota`, `billing`
- **Pipeline CI/CD externe** → dépend de `apikey` (authentification) puis de `eventing` (`POST /api/events`)

## 6. Recommandations de représentation visuelle

- Notation UML de composants : rectangles avec le petit symbole "component" (⧉) en haut à gauche de chaque boîte, connecteurs `require/provide` (ligne + cercle "lollipop") si tu veux un rendu UML strict ; sinon de simples flèches pleines orientées suffisent pour un diagramme de composants de mémoire d'ingénieur (moins formel, plus lisible).
- Mets `app` et `admin` visuellement au centre (ce sont les deux composants avec le plus de dépendances sortantes — `app` est le cœur métier, `admin` est l'agrégateur transversal).
- Regroupe visuellement par zone de couleur (sans les enfermer dans des cadres qui alourdiraient le schéma) : sécurité/identité (`user`, `security`, `apikey`) en bleu, métier applicatif (`app`, `eventing`, `kafka`, `quota`) en vert, facturation (`billing`, `payment`) en orange, observabilité (`logs`, `metrics`, `status`, `audit`) en gris.
- Place le socle "Fabric8 / PostgreSQL / Keycloak / Stripe / Prometheus" en bande horizontale en bas du diagramme, avec des flèches montantes génériques plutôt que de multiplier les flèches individuelles vers chaque composant (pour ne pas surcharger).
- `DockerImage` peut être représenté en grisé/pointillé avec une petite annotation "(non utilisé — entité orpheline)" : c'est un fait vérifié et déjà documenté comme dette technique, autant le rendre visible plutôt que de l'omettre silencieusement.
- Format cible : 13,5 cm de large dans le mémoire — privilégier un agencement large (paysage) plutôt que haut.

## 7. Fichiers sources vérifiés (traçabilité)

- Structure des 21 packages : exploration directe de `backend-api/src/main/java/com/platform/api/`
- Dépendances inter-packages : `grep -rhoE "import com\.platform\.api\.[a-zA-Z]+"` exécuté sur chaque package (résultat reproduit tel quel en section 3, sans ajout ni suppression)
- `memoire/Chapter2.tex` (section "Diagramme de composants") — texte du mémoire que ce diagramme doit illustrer, à ne pas contredire
- Dette technique `DockerImage` déjà mentionnée dans `RAPPORT_AUDIT_PFE.md`
