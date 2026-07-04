# FIX 10 — Intégration Stripe Payment

## Ce qui a été ajouté

Système de paiement complet avec Stripe (mode test ou production).

---

## Architecture

```
Frontend (React)                   Backend (Spring Boot)              Stripe API
─────────────────                  ──────────────────────             ──────────
Billing.jsx                        PaymentController                  Stripe servers
  └─ PaymentTab                      POST /api/payment/setup-intent
       ├─ AddCardForm                GET  /api/payment/methods
       ├─ PayInvoiceForm             DELETE /api/payment/methods/{id}
       └─ Transaction history        POST /api/payment/pay
                                     GET  /api/payment/transactions
                                     POST /api/payment/webhook
                                     GET  /api/payment/config
```

---

## Fichiers créés / modifiés

| Fichier | Type | Description |
|---|---|---|
| `backend-api/pom.xml` | Modifié | Ajout dépendance `stripe-java:25.3.0` |
| `backend-api/src/main/resources/application.yml` | Modifié | Config `app.stripe.*` |
| `backend-api/.../user/User.java` | Modifié | Ajout champ `stripeCustomerId` |
| `backend-api/.../payment/PaymentTransaction.java` | Nouveau | Entité BDD — historique des paiements |
| `backend-api/.../payment/PaymentTransactionRepository.java` | Nouveau | JPA repository |
| `backend-api/.../payment/PaymentService.java` | Nouveau | Logique Stripe (customer, SetupIntent, PaymentIntent, webhook) |
| `backend-api/.../payment/PaymentController.java` | Nouveau | REST endpoints `/api/payment/*` |
| `backend-api/.../security/SecurityConfig.java` | Modifié | `/api/payment/webhook` en public (Stripe signe lui-même) |
| `web-portal/src/api/index.js` | Modifié | Ajout `paymentApi` |
| `web-portal/src/pages/Billing.jsx` | Modifié | Onglet "Payment" + composants Stripe |

---

## Fonctionnalités

### 1. Affichage du solde dû
- Montant du mois en cours affiché en haut de l'onglet Payment
- Bouton "Pay Now" pour régler immédiatement

### 2. Gestion des cartes bancaires
- Formulaire de saisie sécurisé via Stripe Elements (CardElement)
- Sauvegarde via SetupIntent (carte stockée chez Stripe, jamais sur nos serveurs)
- Liste des cartes sauvegardées avec marque + 4 derniers chiffres + expiration
- Suppression d'une carte (detach Stripe)

### 3. Paiement de facture
- Sélection d'une carte sauvegardée ou saisie d'une nouvelle
- Confirmation immédiate via PaymentIntent
- Feedback visuel : "Processing…" → "Payment successful!" ✅

### 4. Historique des transactions
- Table avec date, description, carte utilisée, montant, statut
- Statuts : `pending` | `succeeded` | `failed`
- Mise à jour en temps réel via webhook Stripe

### 5. Webhook Stripe
- `POST /api/payment/webhook` (public, vérifié par signature Stripe)
- Gère `payment_intent.succeeded` et `payment_intent.payment_failed`
- Met à jour le statut en base automatiquement

---

## Configuration requise

### Variables d'environnement (Kubernetes Secret)

```bash
kubectl create secret generic stripe-credentials \
  --from-literal=STRIPE_SECRET_KEY=sk_test_xxxx \
  --from-literal=STRIPE_PUBLISHABLE_KEY=pk_test_xxxx \
  --from-literal=STRIPE_WEBHOOK_SECRET=whsec_xxxx \
  -n platform
```

Ajouter dans le Deployment backend :
```yaml
env:
  - name: STRIPE_SECRET_KEY
    valueFrom:
      secretKeyRef:
        name: stripe-credentials
        key: STRIPE_SECRET_KEY
  - name: STRIPE_PUBLISHABLE_KEY
    valueFrom:
      secretKeyRef:
        name: stripe-credentials
        key: STRIPE_PUBLISHABLE_KEY
  - name: STRIPE_WEBHOOK_SECRET
    valueFrom:
      secretKeyRef:
        name: stripe-credentials
        key: STRIPE_WEBHOOK_SECRET
```

### Obtenir les clés Stripe (mode test)
1. Créer un compte sur [stripe.com](https://stripe.com)
2. Dashboard → Developers → API Keys
3. Copier la clé secrète (`sk_test_...`) et la clé publique (`pk_test_...`)

### Configurer le webhook
```bash
# En local avec Stripe CLI :
stripe listen --forward-to http://<backend-url>/api/payment/webhook
```

### Carte de test Stripe
- Numéro : `4242 4242 4242 4242`
- Expiration : n'importe quelle date future
- CVV : `123`
- Code postal : `12345`

---

## Sécurité

- Les données de carte ne transitent **jamais** par notre backend — Stripe Elements les envoie directement aux serveurs Stripe
- Le backend ne reçoit que le `paymentMethodId` (token opaque)
- Le webhook est vérifié par signature HMAC (`Stripe-Signature` header)
- La clé secrète Stripe est stockée dans un Kubernetes Secret, pas dans le code
