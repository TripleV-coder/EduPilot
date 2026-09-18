# Registre de dette technique — EduPilot

> Mis à jour le **2026-09-18** (fin du Lot 8 de la remise à niveau production).
> Chiffres **mesurés** sur le dépôt, pas estimés.

## Méthode

- **Effort** : jours-homme
- **Impact** : 1 (cosmétique) → 5 (bloque la croissance)
- **Risque** : 1 (négligeable) → 5 (sécurité / intégrité des données)
- **Priorité** = Impact × Risque ÷ Effort

## État de référence mesuré (2026-09-18)

| Indicateur | Valeur |
|---|---|
| Routes d'API | 288 |
| Routes via `createApiHandler` | **286 / 288** (99,3 %) |
| `tsc --noEmit` | **0 erreur** (strict) |
| `eslint src` | **0 erreur** |
| `any` explicites | **0 en code de production** (2 occurrences : un commentaire pédagogique dans `error-message.ts`, un mock dans `tests/setup.ts`) |
| Tests unitaires et d'API | **2 959** (288 fichiers) |
| Tests d'intégration sur **vrai PostgreSQL** | **323** (51 fichiers) |
| Couverture `src/app/api/**` | lignes **71,2 %**, branches 59,1 %, fonctions 71,2 % — seuils 40/30/40 |
| Couverture `src/lib/**` | lignes **54,9 %**, branches 44,9 %, fonctions 53,5 % — seuils 40/32/38 |
| Couverture `src/components/**` (edu + messaging) | lignes **70,3 %**, branches 52,4 %, fonctions 55,3 % — seuils 50/40/35 |
| Ensemble du périmètre couvert | lignes 65,1 %, instructions 64,0 %, branches 53,2 %, fonctions 61,3 % |
| Routes d'API à **zéro** ligne couverte | **92 / 288** |

Les deux routes hors `createApiHandler` le sont légitimement : `/api/setup`
(création du premier compte, avant toute session) et
`/api/auth/[...nextauth]` (délégué à next-auth, enveloppé par la limite
d'échecs de connexion).

---

## Registre

| ID | Description | Effort | Impact | Risque | Priorité | Statut |
|----|-------------|--------|--------|--------|----------|--------|
| TD-001 | Second facteur non imposé hors `createApiHandler` | 1j | 5 | 5 | 25,0 | ✅ **Corrigé 2026-07-30** |
| TD-002 | Vérification TOTP sans plafond de tentatives | 0,5j | 4 | 5 | 40,0 | ✅ **Corrigé 2026-07-30** |
| TD-003 | Code 2FA erroné n'incrémente pas le verrouillage de compte | 0,5j | 4 | 4 | 32,0 | ✅ **Corrigé 2026-07-30** |
| TD-004 | Routes hors `createApiHandler` | 8j | 4 | 3 | 1,5 | ✅ **Corrigé 2026-08-03** (279/283) |
| TD-005 | Couverture tests des routes API encore faible | 10j | 4 | 3 | 1,2 | 🟡 En cours — **71,2 %** de lignes, seuils 40/30/40, mais **92 routes à zéro** |
| TD-006 | Seuils de couverture sous les cibles long terme | 6j | 3 | 2 | 1,0 | 🟡 Ouvert — cible `src/lib` 60/50/60, atteint 54,9/44,9/53,5 |
| TD-007 | Occurrences de `any` résiduelles | 3j | 2 | 2 | 1,3 | ✅ **Corrigé 2026-08-04** (0 explicite) |
| TD-008 | Logique OTP dupliquée `/mfa-setup` | 0,5j | 2 | 1 | 4,0 | ✅ **Corrigé** (`OtpInput` partagé) |
| TD-009 | Double rate-limit Edge + handler + CSP sur API | 0,5j | 4 | 2 | 16,0 | ✅ **Corrigé 2026-08-03** |
| TD-010 | Fake metrics SMS / WhatsApp / carte transport | 0,5j | 3 | 2 | 12,0 | ✅ **Corrigé 2026-08-03** |
| TD-011 | SMS non branché sur `CommunicationTemplate` | 1j | 3 | 2 | 6,0 | ✅ **Corrigé 2026-08-03** |
| TD-012 | Deux familles de primitives d'interface (`ui/` shadcn et `edu/` maison) | 15j | 3 | 1 | 0,2 | 🟡 Ouvert — **assumé**, à traiter par la refonte |
| TD-013 | Deux jeux de jetons de style décrivant la même charte | 4j | 2 | 1 | 0,5 | 🟡 Ouvert — **assumé**, à traiter par la refonte |
| TD-014 | 92 routes d'API sans aucun test unitaire | 8j | 3 | 3 | 1,1 | 🟡 Ouvert |
| TD-015 | Accueil publique : 913 Ko de JS, animations au défilement (framer-motion) | 2j | 2 | 1 | 1,0 | 🟡 Ouvert |
| TD-016 | Deux systèmes de notification (sonner + Radix toast) | 2j | 1 | 1 | 0,5 | 🟡 Ouvert — **assumé**, design gelé |
| TD-017 | « Facturation en masse » sans modèle de données : la page envoie `{classLevelId, feeId, academicYearId}`, l'API attend `{paymentIds}` → toujours 400 | 3j | 3 | 2 | 2,0 | 🔴 Ouvert — **décision produit** |
| TD-018 | Clôture d'année scolaire non implémentée (statut `CLOSED` jamais écrit, aucune API) | 3j | 3 | 2 | 2,0 | 🔴 Ouvert — **décision produit** |

---

## TD-004 — Routes hors `createApiHandler` *(corrigé)*

Inventaire 2026-08-03 : **279 fichiers** `route.ts` appellent `createApiHandler` ;
**1** route restante avec `await auth()` direct (hors webhooks / auth publics légitimes).

Le mode maintenance est couvert par `createApiHandler` + filet Edge Redis
(`maintenance-edge` dans `proxy.ts`).

---

## TD-005 / TD-006 — Couverture *(en cours)*

`vitest.config.ts` inclut `src/app/api/**/*.ts` avec seuils remontés lot par
lot. Objectif : 40/30/40 API et 60/50/60 lib.

Progression 2026-08-16 : API **12→16 %** (lignes), branches 9→12, fonctions
12→16 — seuils portés à 16/12/16. +68 tests : announcements (GET/POST + [id]
PATCH/DELETE), events (GET/POST + [id] + participate), library books &
borrowings, attendance stats & justifications, audit-logs/export, alumni/[id],
benchmark/latest, plus wellbeing climate-report, telemetry UX et
error-message. 1 251 tests verts.

Bug corrigé au passage : le branche isZodError de `POST /api/announcements`
renvoyait `NextResponse.json({ status: 400 })` (statut dans le body, HTTP 200)
— corrigé en `{ error, details }, { status: 400 }`.

Prochain lot : routes à fort volume restantes (announcements/events OK ;
cagnottes, attendance/bulk, students, ai/*, analytics/*).

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

## TD-012 / TD-013 — Interface : deux familles de primitives, deux jeux de jetons *(ouvert, assumé)*

Relevé complet et chiffré : [`docs/design/INVENTAIRE_UI.md`](docs/design/INVENTAIRE_UI.md).

- **31** composants `src/components/ui/` (shadcn : Radix + `class-variance-authority`,
  classes Tailwind, jetons HSL de `globals.css`), importés par **151** fichiers ;
- **17** composants `src/components/edu/` (maison : styles en ligne, jetons
  `--eduflow-*` de `edupilot-tokens.css`), importés par **124** fichiers ;
- **six** primitives — button, card, input, badge, avatar, progress — existent
  dans les deux, avec des variantes et des hauteurs différentes (40 px contre
  38 px pour le bouton courant) ;
- **315** jetons littéraux dans `edupilot-tokens.css` redisent la charte que
  `globals.css` déclare en HSL ;
- **113** couleurs hexadécimales et **140** classes Tailwind de couleur brute
  échappent aux jetons, surtout dans les graphiques Recharts (qui reçoivent des
  couleurs en propriété) et les écrans à code couleur métier.

Cette dette est **assumée telle quelle** : le design est gelé pendant la remise
à niveau (règle 9 de la mission). L'inventaire existe pour que la refonte parte
de l'état réel.

---

## TD-014 — Routes d'API sans test *(ouvert)*

**92 des 288 routes** n'ont aucune ligne couverte par les tests unitaires
(mesure du 2026-09-18, `npm run test:coverage`). Le chiffre global de 71,2 %
vient des routes très testées ; il masque cette moitié d'angle mort.

Atténuations en place : les 323 tests d'intégration sur PostgreSQL réel
couvrent transversalement l'isolation entre établissements (balayage des 70
routes `[id]`), les listes paginées, les limites de taille et les écritures
sensibles ; `createApiHandler` applique session, rôles, permissions, limites de
débit, taille de corps et maintenance à 286 routes sur 288, de sorte qu'une
route non testée hérite quand même des garanties.

---

## TD-015 — Accueil publique lente sur mobile *(ouvert)*

Mesure du 2026-09-18, machine au repos, build de production, Lighthouse 12
mobile (4G lente + CPU ÷4) : **perf 0,61**, LCP 5,4 s, TBT 686 ms, 531 Ko
transférés. L'audit mesurait 0,63 : **la page n'a pas progressé**, alors que le
tableau de bord est passé de 0,54 à 0,90.

Cause : 913 Ko de JavaScript, dont **116 Ko de framer-motion**. Contrairement au
tableau de bord — dont les animations, toutes des entrées simples, ont été
reprises en CSS avec 0,000 % de pixels différents — les sections de l'accueil
s'animent **au défilement** (`whileInView`, 5 composants). Les convertir demande
un observateur d'intersection et une vérification visuelle en défilement, que je
n'ai pas faite : le rapport coût/risque ne le justifiait pas pour une page
vitrine, face aux écrans de travail quotidiens.

Chemin si repris : hook de révélation partagé + `.edu-enter-up` déjà en place
dans `globals.css`, puis captures avant/après à plusieurs positions de
défilement (`scripts/quality/screenshots.mjs` ne capture aujourd'hui que l'état
initial).

---

## TD-016 — Deux systèmes de notification *(ouvert, assumé)*

`sonner` (26 fichiers) et le toast Radix via `useToast` (35 fichiers)
coexistent, tous deux montés dans la mise en page racine. Les unifier changerait
l'apparence des notifications : interdit tant que le design est gelé (règle 9 de
la remise à niveau). Coût mesuré : ~38 Ko sur chaque page.

---

## TD-017 / TD-018 — Deux fonctions promises sans implémentation *(ouvert, décision produit)*

Relevés au nettoyage du 2026-09-18 (déclarations jamais lues).

- **Facturation en masse** (`/dashboard/finance/bulk-invoice`) : la page promet
  de « générer des frais pour une classe ou un niveau entier ». Or le modèle
  n'a pas de facture impayée : `Payment` exige un moyen de paiement, et ce
  qu'un élève doit découle implicitement de `Fee.classLevelCode`. La route
  `/api/payments/bulk-invoice` ne fait que lister des URL de factures pour des
  paiements existants. Le formulaire reçoit donc toujours « Données
  invalides ». À trancher : créer un modèle d'échéance/facture, ou retirer la
  page.
- **Clôture d'année** : l'énum `AcademicYearStatus` prévoit `CLOSED` et
  `ARCHIVED`, mais rien ne les écrit. Le bouton « Clôturer l'année » de la page
  Promotion n'avait aucun gestionnaire, et un encart promettait notes figées et
  bulletins générés : retirés, le sélecteur d'année de destination manquant a
  été ajouté à leur place.

---

## Règles

- Toute dette ajoutée est enregistrée ici, sans exception.
- Priorité > 4 : traitée dans les deux sprints suivants.
- **Jamais** de dette volontaire sur une fonctionnalité de sécurité.
- Revue mensuelle : retirer les lignes résolues, réévaluer les priorités.
