# ADR-0005 : Zod pour toutes les validations entrantes

**Statut** : Accepté
**Date** : 2025-02-10

## Contexte
Validation des body, query, params sur toutes les routes API. Nécessité d'avoir des messages d'erreur en français pour l'UI, et un type-checking strict TS dérivé.

## Options évaluées

| Lib | Pros | Cons | Score |
|-----|------|------|-------|
| **Zod** | DSL fluent, `.infer<>` génère le type TS, messages personnalisables | API parfois verbose, parseur plus lent que valibot | **9/10** |
| Valibot | 10x plus léger en bundle | Écosystème jeune, moins de helpers | 7/10 |
| Yup | Mature | TS support moyen | 6/10 |
| class-validator | OOP-friendly | Décorateurs lourds, pas d'inference | 5/10 |
| Joi | Mature | Pas type-safe sans wrapper | 4/10 |

## Décision
**Zod 4.x**. Schemas centralisés dans `src/lib/validations/*` par domaine. Types dérivés via `z.infer<>` puis exportés.

## Conséquences positives
- Une seule source de vérité : `feeSchema` valide ET fournit le type `FeeInput`
- Messages d'erreur en français localement, validation côté serveur ET côté client (RHF + zodResolver)
- Composition aisée : `strongPasswordSchema.refine(...)` → `veryStrongPasswordSchema`

## Conséquences négatives
- Bundle frontend +30 ko gzipped à cause de Zod
- Quelques cas (validation conditionnelle complexe) nécessitent `superRefine`, syntaxe lourde

## Règles
- **Toutes** les entrées API passent par un `safeParse()` ou `parse()` dans le handler
- Les messages d'erreur sont en français (cible utilisateur Bénin)
- Les schemas réutilisables (email, phone, password) sont définis une seule fois et importés (`strongPasswordSchema`, `phoneSchema`)
- Le type est **toujours** dérivé du schema via `z.infer<>`, jamais redéfini à la main

## Exemple canonique
```ts
// src/lib/validations/finance.ts
export const paymentSchema = z.object({
  studentId: z.string().cuid("ID étudiant invalide"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", ...]),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// Dans la route
const body = await request.json();
const parsed = paymentSchema.safeParse(body);
if (!parsed.success) {
  return validationErrorResponse("Données invalides", parsed.error.flatten());
}
// parsed.data est typé PaymentInput
```
