# IDOR sur la suppression de moyen de paiement Stripe

## Problème

L'endpoint `DELETE /api/payment/methods/{paymentMethodId}` supprimait (détachait) le moyen de paiement Stripe demandé sans jamais vérifier qu'il appartenait au client Stripe de l'utilisateur authentifié. N'importe quel utilisateur connecté pouvait donc supprimer la carte bancaire enregistrée d'un autre tenant en fournissant son `paymentMethodId`.

## Gravité

Critique

## Pourquoi c'était un problème

Même défaut que le ticket 001 (IDOR — OWASP A01:2021 Broken Access Control), mais sur une action **destructive** et non plus seulement une lecture : la victime perd son moyen de paiement enregistré sans l'avoir demandé, et doit ré-enregistrer sa carte auprès de Stripe.

Tous les autres endpoints de `PaymentController` résolvent `userId` via `resolveUserId(jwt)` puis scopent l'appel Stripe/DB à ce `userId` (via `getOrCreateCustomer(userId)`). `deleteMethod` était le seul endpoint du contrôleur à ne pas suivre ce pattern — un oubli isolé plutôt qu'un défaut de conception d'ensemble.

Facteur aggravant : les id de moyens de paiement (`pm_xxx`) sont renvoyés en clair au frontend par `GET /api/payment/methods`, donc atteignables par toute personne ayant eu un accès, même indirect, à cette réponse ou à des logs contenant cet id.

## Solution retenue

Réplique du principe déjà appliqué en 001, adapté à une ressource externe Stripe (pas d'entité JPA locale à comparer, mais un `customerId` Stripe) :

1. `PaymentController.deleteMethod` résout désormais `userId` via `resolveUserId(jwt)`, comme tous les autres endpoints du contrôleur, et le transmet au service.
2. `PaymentService.detachPaymentMethod(userId, paymentMethodId)` :
   - récupère le `customerId` Stripe de l'appelant via `getOrCreateCustomer(userId)`,
   - récupère le `PaymentMethod` Stripe demandé,
   - compare `paymentMethod.getCustomer()` au `customerId` de l'appelant,
   - lève `UnauthorizedException` (→ 403, cohérent avec le ticket 001) si ça ne correspond pas,
   - ne détache la carte que si la propriété est confirmée.

## Alternatives étudiées

- Aucune alternative structurelle de fond envisagée ici : le pattern (vérifier la propriété Stripe avant action) est la seule option raisonnable pour ce type de ressource externe. Seul le code HTTP de refus a été discuté — 403, gardé cohérent avec le ticket 001 plutôt que 404, pour uniformiser le comportement d'accès refusé sur toute l'API.

## Fichiers modifiés

- `backend-api/src/main/java/com/platform/api/payment/PaymentService.java`
- `backend-api/src/main/java/com/platform/api/payment/PaymentController.java`
- `backend-api/src/test/java/com/platform/api/payment/PaymentServiceTest.java` (nouveau)

## Changements réalisés

**`PaymentService.java`** :
- `detachPaymentMethod(String paymentMethodId)` devient `detachPaymentMethod(String userId, String paymentMethodId)`.
- Résout le `customerId` Stripe de l'appelant, vérifie que le `PaymentMethod` cible lui appartient (`pm.getCustomer().equals(customerId)`), lève `UnauthorizedException` sinon.

**`PaymentController.java`** :
- `deleteMethod` reçoit désormais `@AuthenticationPrincipal Jwt jwt`, résout `userId` via `resolveUserId(jwt)` et le transmet au service.

**`PaymentServiceTest.java`** (nouveau) : 2 tests unitaires Mockito (avec `mockStatic` sur `PaymentMethod.retrieve` — Mockito 5 inline mock maker, disponible par défaut avec la version fournie par Spring Boot 3.2.3) :
- refus (`UnauthorizedException`) + `detach()` jamais appelé quand la carte appartient à un autre `customerId` Stripe,
- détachement effectif quand la carte appartient à l'appelant.

## Impact

- Comportement inchangé pour la suppression de son propre moyen de paiement.
- Une tentative de suppression de la carte d'un autre tenant retourne désormais **403 Forbidden** au lieu de réussir silencieusement.
- Signature de `PaymentService.detachPaymentMethod` modifiée (ajout du paramètre `userId`) — seul appelant existant était `PaymentController.deleteMethod`, mis à jour en conséquence (vérifié par compilation complète du module).

## Risques

- Faible : changement strictement restrictif, aucun impact sur le flux légitime.
- Point de vigilance : `getOrCreateCustomer` crée un client Stripe si l'utilisateur n'en a pas encore — dans le cas d'une tentative de suppression malveillante par un utilisateur sans `stripeCustomerId`, cela crée un client Stripe "à vide" avant de rejeter la requête. Comportement mineur et sans risque de sécurité, mais pourrait être optimisé plus tard (vérifier `user.getStripeCustomerId() == null` → rejet direct sans appel Stripe) si tu le souhaites — proposé séparément comme amélioration, non réalisé ici pour rester sur une seule correction.

## Tests à effectuer

- ✅ `mvn -Dtest=PaymentServiceTest test` — 2/2 tests passent.
- ✅ `mvn compile test-compile` — compilation complète du module sans erreur.
- Manuel (recommandé avant déploiement) : avec deux comptes tenants A et B ayant chacun une carte enregistrée, tenter depuis le compte A un `DELETE /api/payment/methods/{id-carte-de-B}` → doit retourner 403 et la carte de B doit rester active côté Stripe.
- Manuel : vérifier que la suppression de sa propre carte fonctionne toujours normalement (204 No Content, carte retirée de `GET /api/payment/methods`).

## Validation

1. `mvn -Dtest=PaymentServiceTest test` dans `backend-api/` → 0 échec.
2. En environnement de test Stripe (mode test), confirmer qu'un tenant ne peut plus détacher la carte d'un autre tenant (403) et que la suppression de sa propre carte fonctionne toujours.

## Commit Git conseillé

```
fix(security): fix IDOR on Stripe payment method deletion
```
