# ADR-0010 : Flutterwave + Paystack pour le mobile money (Bénin)

**Statut** : Accepté
**Date** : 2025-04-01

## Contexte
Le Bénin a 2 opérateurs mobile money dominants : **MTN MoMo** et **Moov Money**. ~80 % des transactions parents se font via ces canaux (pas par carte bancaire). Il faut un agrégateur fiable + supportant les webhooks signés.

## Options évaluées

| Provider | MTN | Moov | Carte CB | Webhooks HMAC | Frais | Score |
|----------|-----|------|----------|---------------|-------|-------|
| **Flutterwave** | OK | OK | OK | OK | 1.4% | **8/10** |
| **Paystack** | OK (via Stitch) | partiel | OK | OK | 1.5% | **7/10** |
| FedaPay | OK | OK | non | partiel | 1.0% | 6/10 |
| Stripe | non | non | OK (international) | OK | 2.9% + 0.30 USD | 4/10 |
| Direct MTN API | OK uniquement | — | — | — | 1.0% | 3/10 (silos) |

## Décision
**Flutterwave** en provider principal, **Paystack** en provider de secours.

Architecture : `PaymentProviderFactory` (`src/lib/finance/factory.ts`) avec une interface commune `PaymentProvider`. L'établissement choisit son provider dans `/dashboard/settings/finance`.

```ts
interface PaymentProvider {
  name: string;
  initiatePayment(amount, currency, email, reference, metadata): Promise<{ paymentUrl, transactionId }>;
  verifyPayment(transactionId): Promise<{ status, rawData }>;
}
```

## Conséquences positives
- Couverture des 2 opérateurs principaux dès la V1
- Si l'un est en panne, bascule possible vers l'autre
- Frais inférieurs à Stripe (1.4 % vs 2.9 %) → marge préservée

## Conséquences négatives
- Maintenir 2 intégrations = 2x les tests, 2x les versions d'API à suivre
- Les webhooks signés en HMAC doivent être validés rigoureusement (cf. R2 dans `RUNBOOK.md`)
- Flutterwave a connu des incidents (2023) → c'est pourquoi on a Paystack en secours

## Règles
- **Toute** transaction passe par l'interface `PaymentProvider` — jamais d'appel direct au SDK provider depuis une route
- Les webhooks sont :
  - Signés HMAC-SHA256 avec un secret distinct par environnement
  - Idempotents : on stocke `transactionId` en DB, on rejette les replays
  - Tracés dans `WebhookDelivery` avec `attempts`, `responseStatus`, `responseBody`
- Les montants sont **toujours** en plus petite unité (centimes FCFA = FCFA × 1) pour éviter les erreurs de virgule
- La devise est **toujours** `XOF` (FCFA) pour les comptes Bénin
- Un **Reconciliation** mensuel compare les transactions Flutterwave/Paystack avec la table `Payment` interne ; tout écart > 1 % déclenche une alerte
