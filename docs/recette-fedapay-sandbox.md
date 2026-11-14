# Recette FedaPay sandbox — procédure (préparée le 2026-10-24, non exécutée)

Statut : **bloquée faute d'identifiants sandbox** (aucune clé `sk_sandbox_…` ni secret de webhook
disponibles dans l'environnement de travail ; aucun n'a été inventé). Aucune action en production.

## Ce qui manque (à fournir par le responsable)
1. Deux comptes FedaPay **sandbox** distincts (un par école synthétique A et B) : clé secrète
   `sk_sandbox_…` et secret de webhook de chaque compte.
2. Une adresse **HTTPS publique** de l'environnement de recette (FedaPay doit joindre le webhook) :
   préproduction ou tunnel dédié. `NEXT_PUBLIC_APP_URL` doit la refléter (URL de retour).
3. `PAYMENT_SECRETS_KEY` propre à la recette (`openssl rand -hex 32`), jamais celle de production.
4. `PAYMENTS_LIVE_ENABLED` **absent** (seuls les comptes SANDBOX encaissent).
5. Une base jetable dédiée (jamais la base de développement ni de production).

## Mise en place
1. Base jetable : `scripts/quality/disposable-pg.mjs`, `prisma migrate deploy`, `scripts/db/setup-app-role.mjs`.
2. Données synthétiques : 2 écoles (A, B), 1 parent avec un enfant dans chacune, frais + échéancier.
3. Pour chaque école, en administrateur d'école : *Paramètres › Paiement en ligne* → enregistrer la
   clé sandbox et le secret de webhook → **Tester** → **Activer**.
4. Dans chaque tableau de bord FedaPay sandbox : webhook = `https://<recette>/api/payments/fedapay/webhook/<id du compte>`
   (affiché sur la page Paiement en ligne), événements `transaction.approved`, `transaction.declined`, `transaction.canceled`.

## Scénarios (chacun rejoué pour l'école A puis B ; vérifier qu'aucune donnée ne passe de l'une à l'autre)
| # | Scénario | Attendu | Vérification |
|---|---|---|---|
| 1 | Création d'un paiement (échéance) | 200, essai PENDING lié au compte de l'école | base : `paymentAccountId` = compte de l'école |
| 2 | Redirection | lien `https` de FedaPay sandbox | navigateur |
| 3 | Retour vers EduPilot | page Retour : « en cours » tant que non confirmé | `/dashboard/finance/retour-paiement?ref=` |
| 4 | Confirmation par webhook (paiement sandbox réussi) | VERIFIED, une seule fois | base + journal |
| 5 | Rafraîchissement du statut | « Paiement confirmé » sans action | page Retour |
| 6 | Solde | payé +montant, reste −montant, échéance réglée | page Paiements |
| 7 | Reçu | téléchargeable, montant et référence de la base | bouton Reçu |
| 8 | Paiement laissé en attente | « en attente », montant réservé, pas de reçu | page Paiements |
| 9 | Erreur fournisseur (paiement sandbox refusé) | CANCELLED, réservation libérée | base + page |
| 10 | Double clic sur Payer | un seul essai, un seul appel fournisseur | base |
| 11 | Webhook rejoué (renvoi depuis FedaPay) | ALREADY_PROCESSED, pas de double comptage | base |
| 12 | Référence incohérente (webhook du compte B pour un paiement de A) | refusé, paiement de A inchangé | base |
| 13 | Compte marchand révoqué | paiement en ligne indisponible, économat proposé | page Paiements |

## Nettoyage
Supprimer la base jetable ; révoquer les clés sandbox dans FedaPay après la recette ; ne rien
conserver dans un `.env` partagé.

## Déjà couvert localement (FedaPay simulé au niveau HTTP)
Scénarios 1, 3, 5–13 : `tests/integration-db/parent-payment-journey.test.ts`,
`school-payment-accounts.test.ts`, `online-payments.test.ts` ; recette Playwright 100 profils.
Seule la chaîne réelle (2, 4 et 9 contre FedaPay sandbox) reste à prouver.
