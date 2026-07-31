# Registre de dette technique — EduPilot

> Audit du 2026-07-30, branche `chore/p1-p3-completion`.
> Chiffres **mesurés** sur le dépôt, pas estimés.

## Méthode

- **Effort** : jours-homme
- **Impact** : 1 (cosmétique) → 5 (bloque la croissance)
- **Risque** : 1 (négligeable) → 5 (sécurité / intégrité des données)
- **Priorité** = Impact × Risque ÷ Effort

## État de référence mesuré

| Indicateur | Valeur |
|---|---|
| Fichiers TS/TSX | 863 (170 494 lignes) |
| Routes d'API | 283 |
| Pages | 174 |
| Modèles Prisma | 121 (3 160 lignes de schéma) |
| Migrations | 33 |
| Tests unitaires | 1 129 sur 115 fichiers — **tous verts** |
| Spécifications E2E | 13 (Playwright, dont a11y et 3 suites sécurité) |
| `tsc --noEmit` | **0 erreur** (strict) |
| `eslint src` | **0 erreur, 0 warning** |
| Couverture globale | 46,87 % lignes / 37,01 % branches |
| `TODO`/`FIXME`/`HACK` réels | **0** |
| `@ts-ignore` | 0 (2 `@ts-expect-error` justifiés) |
| `eslint-disable` | 13, tous commentés et légitimes |
| Occurrences de `any` | 204 |

Ce socle est **très au-dessus d'un MVP** : la CI est verte sur les quatre
portes (types, lint, tests, build), la dette déclarative est nulle, et la
sécurité de base (RBAC, isolation multi-tenant, CSP à nonce strict, chiffrement
AES-256-GCM des secrets TOTP, hachage bcrypt coût 12) est en place.

---

## Registre

| ID | Description | Effort | Impact | Risque | Priorité | Statut |
|----|-------------|--------|--------|--------|----------|--------|
| TD-001 | Second facteur non imposé hors `createApiHandler` | 1j | 5 | 5 | 25,0 | ✅ **Corrigé 2026-07-30** |
| TD-002 | Vérification TOTP sans plafond de tentatives | 0,5j | 4 | 5 | 40,0 | ✅ **Corrigé 2026-07-30** |
| TD-003 | Code 2FA erroné n'incrémente pas le verrouillage de compte | 0,5j | 4 | 4 | 32,0 | ✅ **Corrigé 2026-07-30** |
| TD-004 | 208/283 routes n'utilisent pas `createApiHandler` | 8j | 4 | 3 | 1,5 | 🟡 Ouvert |
| TD-005 | 12 % des routes d'API couvertes par des tests (34/283) | 10j | 4 | 3 | 1,2 | 🟡 Ouvert |
| TD-006 | Seuils de couverture sous les cibles long terme | 6j | 3 | 2 | 1,0 | 🟡 Ouvert |
| TD-007 | 204 occurrences de `any` | 3j | 2 | 2 | 1,3 | 🟡 Ouvert |
| TD-008 | Logique OTP dupliquée entre `/mfa-setup` et le composant partagé | 0,5j | 2 | 1 | 4,0 | 🟡 Ouvert |

---

## TD-001 — Second facteur non imposé *(corrigé)*

**Constat.** `authorize()` (`src/lib/auth/config.ts`) délivre volontairement une
session « pré-2FA » quand un compte a le 2FA activé et se connecte sans code :
`isTwoFactorAuthenticated: false`. C'est l'étape 1 d'un flux en deux temps dont
l'étape 2 existait déjà côté JWT (`update({ twoFactorCode })`).

Le problème : **rien n'imposait cet état intermédiaire**.

- `src/proxy.ts` ne vérifiait que l'existence de la session.
- Seules les routes passant par `createApiHandler` (75/283) et
  `/api/payments/initiate` testaient `isTwoFactorAuthenticated`.
- La page de login n'envoyait jamais `twoFactorCode` et aucune UI ne
  déclenchait l'étape 2.

**Conséquence.** Un attaquant disposant du mot de passe d'un compte protégé par
2FA obtenait une session pleinement privilégiée sur 192 routes d'API et la
totalité des pages. Le 2FA était **décoratif**.

**Correctif.** Garde au middleware — seul point d'étranglement couvrant à la
fois les 283 routes et les 174 pages :

- API → `403 { code: "MFA_REQUIRED" }`
- Page → redirection vers `/mfa-verify?callbackUrl=…`
- `/mfa-verify` reste la seule destination joignable dans cet état.

Page `/mfa-verify` créée (TOTP + codes de secours + déconnexion), branchée sur
`update({ twoFactorCode })`.

**Non-régression.** `tests/lib/auth/mfa-gate.test.ts` — 8 cas. Vérifié rouge
sans le correctif (3 échecs sur les cas de faille), vert avec.

---

## TD-002 / TD-003 — Force brute sur le second facteur *(corrigés)*

Un TOTP vaut 6 chiffres (10⁶ combinaisons) pour une fenêtre de ~30 s.

- **TD-002** : le callback JWT vérifiait le code sans aucun plafond.
  → `MFA_VERIFY_RATE_LIMIT` (5 tentatives / 10 min, par utilisateur), remis à
  zéro au succès, journalisé en `MFA_VERIFY_RATE_LIMITED`.
- **TD-003** : dans `authorize()`, un code erroné levait une exception **sans**
  appeler `recordFailedLoginAttempt` — le verrouillage de compte protégeait le
  mot de passe mais pas le second facteur.
  → Compteur incrémenté et audit `LOGIN_FAILED_2FA`.

Succès et usage d'un code de secours sont désormais tracés
(`MFA_VERIFIED`, `MFA_VERIFIED_BACKUP_CODE`).

---

## TD-004 — Routes hors `createApiHandler` *(ouvert)*

`createApiHandler` porte **huit** préoccupations transverses : rate limiting,
authentification, isolation multi-tenant sur `?schoolId`, second facteur, mode
maintenance, `allowedRoles`, `requiredPermissions`, traduction des erreurs
Prisma.

**208 routes sur 283 (73 %) ne l'utilisent pas.** Elles refont l'authentification
à la main (192 appellent `auth()` directement ; les 16 restantes sont
légitimement publiques : webhooks signés, `/api/auth/*`, `/api/public/*`,
health, cron protégé par `CRON_SECRET`).

**Vérifié — ce n'est PAS une faille :**

- Isolation multi-tenant : saine partout. Les 7 routes qui lisent `?schoolId`
  sans helper le gatent derrière `role === "SUPER_ADMIN"` ou `requireRoot()`.
- Rate limiting : assuré globalement par `src/proxy.ts` sur tout `/api/*`.
- Second facteur : désormais couvert par le middleware (TD-001).

**Reste réellement contourné : le mode maintenance.** `getMaintenanceState()`
dépend de Prisma, donc inutilisable dans un middleware Edge. Les pages sont
protégées par le layout dashboard ; les appels d'API directs passent.

**Plan.** Migrer par lots thématiques (finance → notes → vie scolaire → …), en
écrivant les tests de la route *avant* migration. Ne **pas** basculer le
middleware en runtime Node : cela ajouterait une requête DB au chemin chaud de
chaque requête, y compris statiques, pour un bénéfice limité.

---

## TD-005 / TD-006 — Couverture *(ouvert)*

34 routes sur 283 sont réellement importées par un test (12 %). La couverture
mesurée ne porte que sur `src/lib/**`, `src/components/edu/**` et
`src/components/messaging/**` : `src/app/**` (283 routes + 174 pages) est hors
périmètre du rapport.

Seuils actuels vs cibles déclarées dans `vitest.config.ts` :

| Périmètre | Actuel | Cible |
|---|---|---|
| `src/lib/**` | 40/32/38 | 60/50/60 |
| `src/components/**` | 50/40/35 | 70/60/60 |

**Plan.** Étendre `coverage.include` à `src/app/api/**` avec un seuil initial
bas mais non nul, puis le remonter lot par lot en suivant la migration TD-004 —
les deux chantiers se financent mutuellement.

---

## TD-007 — `any` résiduels *(ouvert)*

204 occurrences, concentrées dans les composants de graphiques et d'analytics
(`AcademicPerformancesTab` 7, `BasePieChart` 6, `classes/[id]/page` 6). Aucune
dans la couche d'authentification ni dans les helpers d'API.

**Plan.** Typer d'abord les payloads Recharts partagés, qui expliquent la
majorité des occurrences des graphiques.

---

## TD-008 — Duplication OTP *(ouvert)*

`src/components/auth/OtpInput.tsx` a été extrait pour `/mfa-verify` (focus,
collage, navigation clavier, styles). `/mfa-setup` conserve sa copie locale de
~80 lignes.

**Plan.** Substituer le composant partagé dans `/mfa-setup`. Écart volontaire :
cette page de 579 lignes n'a aucune couverture de test, la substitution doit
être faite avec une vérification manuelle du parcours d'activation.

---

## Règles

- Toute dette ajoutée est enregistrée ici, sans exception.
- Priorité > 4 : traitée dans les deux sprints suivants.
- **Jamais** de dette volontaire sur une fonctionnalité de sécurité.
- Revue mensuelle : retirer les lignes résolues, réévaluer les priorités.
