# Registre de dette technique — EduPilot

> Mis à jour le **2026-08-04** (vérification `any` + CI).
> Chiffres **mesurés** sur le dépôt, pas estimés.

## Méthode

- **Effort** : jours-homme
- **Impact** : 1 (cosmétique) → 5 (bloque la croissance)
- **Risque** : 1 (négligeable) → 5 (sécurité / intégrité des données)
- **Priorité** = Impact × Risque ÷ Effort

## État de référence mesuré (2026-08-04)

| Indicateur | Valeur |
|---|---|
| Routes d'API | 283 |
| Routes via `createApiHandler` | **279 / 283** (~98 %) |
| `tsc --noEmit` | **0 erreur** (strict) |
| `eslint src` | **0 erreur** |
| `any` explicites (`: any` / `as any` / `any[]` / `Promise<any>`…) | **0 dans `src/` et `tests/`** |
| Couverture | include lib + components edu/messaging + `src/app/api/**` (seuils API 10/8/8) |

---

## Registre

| ID | Description | Effort | Impact | Risque | Priorité | Statut |
|----|-------------|--------|--------|--------|----------|--------|
| TD-001 | Second facteur non imposé hors `createApiHandler` | 1j | 5 | 5 | 25,0 | ✅ **Corrigé 2026-07-30** |
| TD-002 | Vérification TOTP sans plafond de tentatives | 0,5j | 4 | 5 | 40,0 | ✅ **Corrigé 2026-07-30** |
| TD-003 | Code 2FA erroné n'incrémente pas le verrouillage de compte | 0,5j | 4 | 4 | 32,0 | ✅ **Corrigé 2026-07-30** |
| TD-004 | Routes hors `createApiHandler` | 8j | 4 | 3 | 1,5 | ✅ **Corrigé 2026-08-03** (279/283) |
| TD-005 | Couverture tests des routes API encore faible | 10j | 4 | 3 | 1,2 | 🟡 Ouvert (seuils API 10/8/8) |
| TD-006 | Seuils de couverture sous les cibles long terme | 6j | 3 | 2 | 1,0 | 🟡 Ouvert |
| TD-007 | Occurrences de `any` résiduelles | 3j | 2 | 2 | 1,3 | ✅ **Corrigé 2026-08-04** (0 explicite) |
| TD-008 | Logique OTP dupliquée `/mfa-setup` | 0,5j | 2 | 1 | 4,0 | ✅ **Corrigé** (`OtpInput` partagé) |
| TD-009 | Double rate-limit Edge + handler + CSP sur API | 0,5j | 4 | 2 | 16,0 | ✅ **Corrigé 2026-08-03** |
| TD-010 | Fake metrics SMS / WhatsApp / carte transport | 0,5j | 3 | 2 | 12,0 | ✅ **Corrigé 2026-08-03** |
| TD-011 | SMS non branché sur `CommunicationTemplate` | 1j | 3 | 2 | 6,0 | ✅ **Corrigé 2026-08-03** |

---

## TD-004 — Routes hors `createApiHandler` *(corrigé)*

Inventaire 2026-08-03 : **279 fichiers** `route.ts` appellent `createApiHandler` ;
**1** route restante avec `await auth()` direct (hors webhooks / auth publics légitimes).

Le mode maintenance est couvert par `createApiHandler` + filet Edge Redis
(`maintenance-edge` dans `proxy.ts`).

---

## TD-005 / TD-006 — Couverture *(ouvert)*

`vitest.config.ts` inclut déjà `src/app/api/**/*.ts` avec seuils initiaux bas
(5/5/5). Objectif : remonter lot par lot vers 40/30/40 API et 60/50/60 lib.

---

## TD-007 — `any` résiduels *(corrigé)*

Audit 2026-08-04 : **0** occurrence explicite dans `src/` et `tests/`
(`: any`, `as any`, `any[]`, `Promise<any>`, `Record<string, any>`, etc.).
La seule mention restante est un commentaire pédagogique dans
`error-message.ts`.

Règle ESLint `@typescript-eslint/no-explicit-any` passée en **`error`** pour
bloquer toute réintroduction en CI.

Note : les anciens décomptes (~200 / ~166) mélangeaient le mot anglais « any »
dans les commentaires avec les annotations TypeScript — d'où la surestimation.

---

## TD-008 — Duplication OTP *(corrigé)*

`/mfa-setup` importe `OtpInput` depuis `@/components/auth/OtpInput` (même composant
que `/mfa-verify`).

---

## TD-009 — Latence proxy *(corrigé)*

Causes : (1) `pageResponse` (CSP/nonce) appliqué aux réponses API authentifiées ;
(2) rate-limit Redis doublé (Edge + `createApiHandler`).

Correctifs : passthrough API sans CSP ; header `x-edupilot-edge-rl` pour sauter le
second rate-limit handler.

---

## TD-010 — Fake data communication / transport *(corrigé)*

- SMS : suppression des métriques inventées ; état vide honnête.
- WhatsApp : comparaison canal sans pourcentages inventés.
- Transport : carte GPS factice remplacée par empty state explicite.

---

## TD-011 — Persistance modèles SMS *(corrigé)*

API `GET/POST /api/communication/templates` + `PATCH …/[id]` avec seed automatique
des 12 modèles par école. UI `/dashboard/notifications/sms` branchée (load / save /
create). Tests unitaires + API dédiés.

---

## Règles

- Toute dette ajoutée est enregistrée ici, sans exception.
- Priorité > 4 : traitée dans les deux sprints suivants.
- **Jamais** de dette volontaire sur une fonctionnalité de sécurité.
- Revue mensuelle : retirer les lignes résolues, réévaluer les priorités.
