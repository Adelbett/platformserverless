# FIX 12 — Invoice Billing par Service

## Problème

La page Payment n'était pas liée aux services déployés. Le client ne savait pas
quoi payer ni pour quel service. L'admin n'avait aucun moyen de suspendre un
service en retard de paiement.

## Solution

Système de facturation par service avec alertes J-3 et suspension automatique.

## Flux complet

```
1er du mois → scheduler → génère une facture par app (basée sur BillingSnapshots)
                ↓
Billing → Payment → liste les factures avec statut
  ✅ On time   → plus de 3 jours restants
  ⚠️ 2d left  → alerte orange, J-3
  🔴 Overdue  → rouge, service risque suspension
                ↓
Client clique "Pay" → sélectionne carte → Stripe charge
                ↓
Service réactivé si suspendu
```

## Statuts des factures

| Statut     | Couleur | Déclencheur                        |
|---|---|---|
| PENDING    | —       | Facture générée le 1er du mois     |
| OVERDUE    | 🔴 rouge | Date échéance dépassée             |
| PAID       | ✅ vert  | Paiement Stripe réussi             |
| SUSPENDED  | 🔴 rouge | Admin suspend manuellement         |

## Fichiers créés / modifiés

| Fichier | Description |
|---|---|
| `billing/AppInvoice.java` | Entité facture (appId, userId, period, dueDate, status) |
| `billing/AppInvoiceRepository.java` | JPA — findByDueDate, findByStatus |
| `billing/InvoiceService.java` | Génération, paiement, alertes J-3, suspension |
| `billing/InvoiceController.java` | GET /api/invoices, POST /pay, admin endpoints |
| `billing/BillingScheduler.java` | +dailyInvoiceCheck() +monthlyInvoiceGeneration() |
| `web-portal/src/pages/Billing.jsx` | PaymentTab: liste factures par service |
| `web-portal/src/pages/admin/AdminClients.jsx` | Tableau factures en retard + bouton Suspend |
| `web-portal/src/api/index.js` | invoiceApi (list, pay, suspend, adminOverdue) |

## Schedulers

| Cron | Action |
|---|---|
| `0 0 * * * *` (toutes les heures) | Snapshot billing + budget alerts |
| `0 0 8 * * *` (tous les jours 8h) | Alertes J-3 + suspension overdue |
| `0 5 0 1 * *` (1er du mois 00:05) | Génération factures du mois précédent |

## Test manuel (démo PFE)

```bash
# Forcer la génération des factures (admin)
curl -X POST https://api.nextstep.tn/api/invoices/generate \
  -H "Authorization: Bearer <admin-token>"
```

Puis aller dans Billing → Payment pour voir les factures générées.
