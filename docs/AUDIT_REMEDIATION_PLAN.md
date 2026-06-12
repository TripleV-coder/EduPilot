# Plan de correction EduPilot — Dette technique & manques fonctionnels

> **But de ce fichier** : plan de remédiation reprenable dans n'importe quelle session.
> Coche les cases au fur et à mesure. Chaque tâche a : fichiers concernés, action,
> critère de validation (« Done quand »), et commande de vérif.
>
> **Source** : audit du 2026-06-10 (746 fichiers TS, 246 routes API, 105 modèles Prisma).
> **Convention** : `[ ]` à faire · `[~]` en cours · `[x]` fait (mets la date + commit court).
>
> **Avant de commencer une session** : lis ce fichier en entier, puis `git log --oneline -10`
> pour voir ce qui a déjà été fait. Mets ce fichier à jour AVANT de committer.

---

## Comment vérifier une tâche (commandes de référence)

```bash
npm run type-check     # tsc --noEmit
npm run lint           # eslint src
npm run test           # vitest run
npm run test:e2e       # playwright
npm run build          # next build
```

---

## P0 — Sécurité & intégrité (à faire en premier, rapide & risqué)

### [x] P0.1 — Fuite cross-tenant RGPD dans `/api/compliance/dashboard` (fait 2026-06-10)
- **Constat révisé après lecture du code** : PAS besoin d'ajouter de colonne `schoolId`.
  La convention du codebase filtre via la **relation** `user: { schoolId }`. Les routes
  `data-requests` (liste + `[id]`) filtraient DÉJÀ correctement. La seule vraie fuite était
  `compliance/dashboard/route.ts` (6 requêtes sans filtre).
- **Fait** : scopé par `schoolId` (null pour SUPER_ADMIN) dans `compliance/dashboard/route.ts` :
  - `dataAccessRequest.count` (pending) + `findMany` (recent) → `user: { schoolId }`
  - `dataConsent.groupBy` → `where: { user: { schoolId } }`
  - 4 requêtes `auditLog` (count x3 + groupBy) → filtre `auditSchoolFilter = { user: { schoolId } }`
- **Vérifié hors périmètre** : `/api/admin/pending-actions` et `/api/root/*` sont gardés par
  `SYSTEM_READ` (SUPER_ADMIN uniquement) → vue système globale intentionnelle, pas une fuite.
- **Vérif faite** : `npx tsc --noEmit` → exit 0.
- **Reste** : test e2e d'isolation à ajouter (cf P1.1).

### [x] P0.2 — `/api/grades` n'utilise pas `createApiHandler` (RBAC absent) (fait 2026-06-10)
- **Problème (CONFIRMÉ)** : `src/app/api/grades/route.ts` GET utilise `auth()` manuel,
  pas de contrôle de permission formel (isolation école présente, mais pas de `Permission.GRADE_READ`).
- **Fichier** : `src/app/api/grades/route.ts`
- **Action** : migrer GET (et POST si présent) vers `createApiHandler` avec
  `allowedRoles`/permission, en conservant le filtre `schoolId` existant.
- **Done quand** : la route passe par le helper ; un rôle non autorisé reçoit 403 ;
  comportement inchangé pour rôles légitimes.
- **Vérif** : `npm run test:e2e -- security-rbac` (ajouter grades si absent).

### [x] P0.3 — IDOR `/api/payments/[id]` (fait 2026-06-10)
- **Problème** : `findUnique({where:{id}})` puis check parent **après** fetch.
- **Fichier** : `src/app/api/payments/[id]/route.ts` (~ligne 64-78)
- **Action** : déplacer le contrôle dans le `where` :
  `where: { id, student: { id: { in: childrenIds } } }` pour le rôle PARENT.
- **Done quand** : un parent qui demande un paiement d'un enfant non lié reçoit 404/403
  sans que l'objet soit lu.
- **Vérif** : test d'intégration ciblé (cf P1.1).

### [x] P0.4 — Empty catch blocks (perte silencieuse) (fait 2026-06-10)
- **Fichiers** :
  - `src/app/api/upload/route.ts:77,85`
  - `src/app/api/uploads/[type]/[filename]/route.ts:38,46`
- **Action** : remplacer `catch {}` par un `catch (e) { logger.warn(...) }` + fallback explicite.
- **Done quand** : aucune erreur FS/JSON n'est avalée sans trace.
- **Vérif** : `grep -rn "catch {" src/app/api` → 0 résultat injustifié.

### [x] P0.5 — Rate limiting manquant sur endpoints sensibles (fait 2026-06-10)
- **Fichiers** : `src/app/api/setup/route.ts`, `src/app/api/auth/initial-setup/route.ts`
- **Action** : appliquer le rate limiter existant (`src/lib/auth/rate-limiter.ts`).
- **Done quand** : N tentatives rapides → 429.

### [x] P0.6 — Token reset password non isolé par école (fait 2026-06-10 — lié à userId plutôt que schoolId : email globalement unique, le risque réel était la ré-attribution d'email après suppression de compte)
- **Fichier** : `src/app/api/auth/forgot-password/route.ts` (~48-64) + `PasswordResetToken` model
- **Action** : associer `schoolId` au token et le valider à la consommation.
- **Done quand** : un token émis pour l'école A ne fonctionne pas pour le même email en école B.

---

## P1 — Filet de sécurité métier (tests d'intégration)

> Aujourd'hui : **2 routes testées / 246**, couverture CI à 17 %. Domaines financiers = 0 test.

### [x] P1.1 — Suite de tests d'intégration API financiers (fait 2026-06-11)
- **Cibles prioritaires** :
  - [x] Paiements : `tests/api/payments.test.ts` (22 tests) — liste/POST/IDOR P0.3/cash/plafond solde
  - [x] Plans de paiement : `tests/api/payment-plans.test.ts` (15) — création, bourses, pay échéance
  - [x] Comptabilité OHADA : `tests/api/accounting.test.ts` (6) — soldes 57x/52x/53x, résultat, partie double
  - [x] Grades : `tests/api/grades.test.ts` (15) — batch (anti-fraude, barème, période close), statistics (+ régression 50k notes)
  - [x] Examens : `tests/api/exams.test.ts` (12) — start (publication, inscription, P2002), submit (scoring, isPassed)
  - [x] Moteur ledger : `tests/lib/finance-helpers.test.ts` (20) — `syncPaymentPlanLedger`, allocation, statuts
- **Convention retenue** : handlers de route testés avec `@/lib/prisma`/`@/lib/auth` mockés
  (pattern homework.test.ts) ; helpers communs dans `tests/api/test-helpers.ts`.
- **Bug réel trouvé et corrigé** : `withCache` (cache-helpers) ré-encapsulait les réponses sans
  `status` (403→200) et cachait les erreurs.
- **Complété 2026-06-11 (2e lot)** : `tests/api/report-cards.test.ts` (8) — moyennes pondérées
  par coefficients matière/évaluation, rang de classe, assiduité, accès STUDENT/PARENT/cross-tenant.
- **Done** : chaque domaine a nominal + refus d'accès + cross-tenant. 846 tests verts.

### [x] P1.2 — Remonter le seuil de couverture CI (17 → 40 fait 2026-06-11)
- **Fichier** : config Vitest coverage + `.github/workflows/ci.yml`
- **Action** : passer le seuil statements de 17 % → 40 % progressivement.
- **Fait en 2 paliers le 2026-06-11** : 17→23 (lot P1.1), puis 23→**40** (mesuré
  41.40/33.07/39.66, seuils 40/32/38). Nouveaux tests : algorithmes ai-predictive
  (statistics, regression, predict-grade/failure/student), services (student-analytics,
  analytics-dashboard builders, analytics-sync), validations (business-rules), parsers
  (csv-parser, mapping-utils), sanitize, status-styles, rate-limit (régression buckets
  fallback), email.
- **Reste (cible long terme 60/50/60)** : ai-service.ts (406 l.), auth/config.ts,
  organization-dashboard, inference.ts, orientation.ts.

### [x] P1.3 — Validation Zod des inputs date (fait 2026-06-11)
- **Fichier** : `src/app/api/audit-logs/route.ts` (~48-55) et routes similaires
- **Fait** : helper partagé `src/lib/validations/date-range.ts` (`parseDateRangeParams`,
  z.coerce.date + contrôle start ≤ end, 400 explicite) appliqué aux 6 routes qui faisaient
  `new Date(searchParams)` sans validation : audit-logs, audit-logs/export, attendance/stats,
  incidents/statistics, finance/payments, finance/export. Tests : validations-date-range (7)
  + audit-logs (6).

### [x] P1.4 — Détection MIME indépendante sur upload (vérifié 2026-06-11 : déjà implémenté)
- **Fichier** : `src/app/api/upload/route.ts`
- **Constat** : la route avait déjà une validation magic bytes maison (`MAGIC_BYTES` +
  `validateMagicBytes`, lignes 27-66) appliquée au buffer avant écriture — équivalent de la
  lib `file-type` pour les types autorisés. Verrouillé par `tests/api/upload.test.ts` (9 tests :
  ELF déguisé en PNG, PDF déclaré JPEG, avatar non-image, path traversal du paramètre type).

---

## P2 — Décisions produit (À ARBITRER avec le propriétaire avant dev)

> Ces features sont volontairement désactivées en UI (`disabled` + title « à venir »).
> Ne PAS coder sans décision business. Cocher quand la décision est prise.

### [x] P2.1 — Intégration paiement MTN MoMo (fait 2026-06-12)
- [x] **Webhook** : `src/app/api/payments/momo/webhook/route.ts` — HMAC-SHA256, rapprochement
  PENDING→VERIFIED sur `MOBILE_MONEY_MTN/MOOV`, 503 si `MOMO_WEBHOOK_SECRET` absent.
- [x] **Config-gate** : `src/app/api/integrations/momo/route.ts` — retourne `{ configured, requiredEnvVars }`.
  Le Wallet consomme cette route (useSWR) et affiche une bannière de configuration + active les boutons décaissement quand `configured=true`.
- **Reste** (nécessite credentials réels) : initiation de paiement MoMo côté serveur, QR code, Cagnotte.
- Variables : `MOMO_WEBHOOK_SECRET`, `MOMO_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY`, `MOMO_BASE_URL` — documentées dans `.env.example`.

### [x] P2.2 — WhatsApp Business API (fait 2026-06-12)
- [x] `src/app/api/integrations/whatsapp/route.ts` — retourne statut réel basé sur `WHATSAPP_PHONE_ID` + `WHATSAPP_ACCESS_TOKEN` (env); lit `ConfigOption(category="whatsapp")` pour phone_number/verified_at; compte les parents actifs comme subscribers.
- [x] `whatsapp/page.tsx` — passe de setTimeout hardcodé à `fetch("/api/integrations/whatsapp")` réel.
- **Reste** (nécessite Meta BSP) : envoi de messages, templates, webhook entrant.
- Variables : `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` — documentées dans `.env.example`.

### [x] P2.3 — Export comptable DGI iTAS (fait 2026-06-12)
- [x] `src/app/api/accounting/export/route.ts` — CSV SYSCOHADA format DGI (`DATE;JOURNAL;PIECE;LIBELLE;COMPTE_DEBIT;…;MONTANT_FCFA`), filtres fiscalYearId + startDate/endDate, extensions `.csv` et `.itas`.
- [x] Bouton « Export DGI · iTAS » activé dans `accounting/page.tsx` — `window.open()` avec `fiscalYearId` courant.
- **Reste** (nécessite spec officielle iTAS) : connecteur API iTAS DGI pour soumission électronique directe.

### [x] P2.4 — Modèles Prisma manquants (fait 2026-06-12, décision propriétaire « fais tout »)
- [x] **Transport** : modèles `TransportLine/Bus/BusRoute/StudentTransport` + route
  `/api/transport/lines` branchée (lignes, statuts FR, chauffeurs, effectifs, notifications,
  `configured=false` si école sans flotte) + `prisma/seed-transport.ts` (idempotent).
  `morningLatencyAvg` reste null assumé : pas de source GPS réelle.
- [x] **Performance** : modèle `PerformanceMetric` + NOUVELLE route POST
  `/api/analytics/web-vitals` (le client web-vitals.ts postait dans le vide : 404) ;
  `/api/performance/dashboard` agrège désormais le p75 réel 24 h avec les seuils web.dev.
  Flag `NEXT_PUBLIC_ANALYTICS_ENABLED` documenté dans .env.example.
- [x] **Télémétrie UX** : modèle `TelemetryEvent` ; `/api/ux/events` persiste (userId de
  session si présent, anonyme sinon, rate-limit IP).
- **Migration** `20260611231803_add_transport_telemetry_and_reset_token_user` : capture aussi
  le drift `PasswordResetToken.userId` (P0.6 appliqué en db push sans migration — la prod en
  `migrate deploy` ne l'aurait jamais reçu). DB dev reset + re-seed avec accord propriétaire.
- Tests : `tests/api/observability.test.ts` (12).

### [x] P2.5 — Modules sans dépendance externe (fait 2026-06-11/12)
- [x] **Wellbeing** : `src/lib/wellbeing/climate-report.ts` (PDF MEMP, jspdf-autotable v5) + `api/wellbeing/reports` POST/GET/PATCH (audit, anti-IDOR, statut OPEN→CLOSED) + `NewReportButton`/`ReportDossierButton` dialogs dans `wellbeing/page.tsx`.
- [x] **BEPC-prep** : `bepc-prep/page.tsx` branché — annales depuis `/api/exams` (filtre BEPC subjects), readiness depuis `/api/exams/prep?exam=BEPC&studentId=` (nécessite studentProfile), plan de révision fallback si pas d'élève. Profil API étendu avec `studentProfile.id`.
- [x] **Orientation** : `computeIndicativeRecommendations` dans `src/lib/services/orientation.ts` + `api/orientation/me` retourne `indicative.recommendations[]` quand pas de dossier conseil ; `orientation/me/page.tsx` affiche les recommandations indicatives.
- [x] **Onboarding** : découpé en `src/components/onboarding/` (5 sous-composants par rôle : teacher, parent, student, super-admin, fallback). Parcours complets dans chaque composant.

---

## P3 — Hygiène de code (non bloquant)

### [x] P3.1 — Découper les fichiers > 1200 lignes (fait 2026-06-11)
- [x] `src/lib/ai/ai-service.ts` — déjà splitté à la vérification (283 l. ; inference/
  external-client/llm-client séparés dans src/lib/ai/)
- [x] `onboarding/page.tsx` 1441 → 46 + `src/components/onboarding/` (shell + 1 fichier/rôle)
- [x] `students/inscription/page.tsx` 1421 → 465 + `src/components/students/inscription/`
  (types, fields, 5 steps)
- [x] `grades/cahier/page.tsx` 1349 → 851 + `src/components/grades/cahier/` (types, components)
- [x] `grades/entry/page.tsx` 1218 → 847 + `src/components/grades/entry/` (types, components)
- [x] `analytics-dashboard.ts` 1205 → découpe par rôle dans `src/lib/services/analytics-dashboard/`
  (types, builders, admin, teacher, family, staff) + shim de ré-export : aucun import à changer.

### [x] P3.2 — Factoriser duplication (fait 2026-06-11)
- [x] `<FormPageTemplate>` créé (`src/components/layout/form-page-template.tsx` : PageGuard +
  conteneur + bouton retour + PageHeader) et appliqué à students/teachers/users/classes `*/new`.
  incidents/new garde son en-tête à breadcrumbs (structure différente, pas de duplication).
- [x] Variantes PieChart : constat à la vérification — DÉJÀ factorisé (`BasePieChart` + 
  RiskPieChart/CategoryPieChart/InteractiveRiskPieChart en dérivés props).

### [~] P3.3 — Éradiquer les `any` de formulaires (critique + 6 pages faits 2026-06-11)
- [x] Critique : `compliance/data-requests/[id]/route.ts` — `updateData as any` remplacé par un
  snapshot JSON explicite typé `Prisma.InputJsonValue` (le connect Prisma et la Date n'étaient
  pas sérialisables tels quels dans la colonne Json de l'audit RGPD).
- [x] 6 fichiers décastés (users/new, courses/new, classes/new, teachers/new,
  teachers/[teacherId], EvaluationSheet). **Recette** : zod 4 type l'entrée de `z.coerce.*`
  en `unknown` → déclarer l'entrée (`z.coerce.date<string | Date>()`,
  `z.coerce.number<string | number>()` dans validations/user.ts et school.ts) puis
  `useForm<z.input<typeof schema>, unknown, FormValues>` au lieu de `resolver as any`.
- [ ] Reste (dette structurelle, non bloquant) : students/new, student-edit-dialog,
  incidents/new — RHF 7.76 rend `Control<T>` invariant, les composants partagés
  `Control<any>` (student-basic-fields) n'acceptent plus un control typé → refactor
  `useFormContext` requis. parent-finance-view : typage jspdf-autotable.

### [x] P3.4 — `console.log` en prod (fait 2026-06-11)
- [x] `src/lib/email.ts` : dump console (destinataire + HTML complet) remplacé par
  `logger.info` avec destinataire masqué (`maskEmail`) + contenu relégué en `logger.debug`.
  L'erreur prod « provider non configuré » masque aussi l'adresse. Verrouillé par
  `tests/lib/email.test.ts` (8 tests dont « jamais l'adresse en clair »).
- [x] 7 error boundaries (`**/error.tsx`) : `console.error` → `logger.error` centralisé
  (module `error-boundary/*`, digest inclus).

### [x] P3.5 — Sécuriser le fallback config Bénin (fait 2026-06-11)
- `src/lib/services/config-service.ts` retombe sur la config hardcodée si DB non seedée.
- **Fait** : `logger.warn` explicite sur les deux fallbacks (NATIONAL_EXAMS et
  GRADE_SETTINGS/MENTIONS) pointant vers le seed manquant. Le fallback embarqué reste le
  secours voulu (l'app ne casse pas), mais l'emprunt est désormais visible en logs.

---

## Journal d'avancement (à remplir)

| Date | Tâche | Commit | Notes |
|------|-------|--------|-------|
| 2026-06-10 | P0.1 | e1a7c19 | Isolation tenant `compliance/dashboard`. Pas de migration : filtre via relation `user.schoolId` (convention existante). |
| 2026-06-10 | P0.2 | (cette branche) | `/api/grades` GET migré vers `createApiHandler` + `Permission.GRADE_READ` (tous rôles scolaires l'ont, restrictions enfants/école conservées). |
| 2026-06-10 | P0.3 | (cette branche) | IDOR payments : contrainte de propriété dans le `where` (`findFirst`), 404 indistinguable, plus aucun fetch avant contrôle. |
| 2026-06-10 | P0.4 | (cette branche) | Catches vides upload/uploads → `logger.warn` + commentaire de fallback. |
| 2026-06-10 | P0.5 | (cette branche) | `initial-setup` (et `/api/setup` qui le ré-exporte) : rate limit IP 5/15min + Retry-After. |
| 2026-06-10 | P0.6 | (cette branche) | `PasswordResetToken.userId` (nullable, db push) renseigné à l'émission, vérifié à la consommation. |
| 2026-06-10 | a11y | 36aa103 | Suite axe 13/13 verte (contraste tokens, Avatar, NotifItem/Toast/MetricCard, landmarks, heading-order). e2e 77/77. |
| 2026-06-11 | P1.1 | 8a84674 + (branche B) | 90 tests d'intégration (payments, payment-plans, accounting, grades, exams, upload, audit-logs) + 20 tests ledger. Bug réel corrigé : withCache transformait les 403 en 200 et cachait les erreurs. |
| 2026-06-11 | P1.3 | (branche B) | Helper date-range Zod partagé, 6 routes patchées, 400 explicite sur dates invalides. |
| 2026-06-11 | P1.4 | (branche B) | Déjà implémenté (magic bytes maison) — verrouillé par 9 tests anti-spoofing. |
| 2026-06-11 | P1.2 | (branche B) | Couverture 18.76→24.09 statements ; seuils CI ratchetés 17/12/17 → 23/19/23. Cible 40 au prochain lot. |
| 2026-06-11 | P1.1 fin + P1.2 fin | chore/p1-p3-completion | report-cards testé (8) ; +141 tests lib (algorithmes, services, validations, parsers, email) ; couverture 24→41.4 statements, seuils 40/32/38. **P1 complet.** |
| 2026-06-11 | P3.3 critique + P3.4 + P3.5 | chore/p1-p3-completion | Audit RGPD : snapshot JSON typé au lieu de `as any` ; email : logger + maskEmail ; 7 error boundaries → logger centralisé ; config-service : warn sur fallback Bénin. |
| 2026-06-11 | P3.3 (6 pages) | chore/p1-p3-completion | Resolvers décastés via entrées coerce typées (zod 4) + `useForm<z.input, unknown, Output>`. Reste : 3 pages bloquées par l'invariance `Control<T>` de RHF 7.76 (refactor useFormContext) + jspdf. |
| 2026-06-12 | Durcissement post-audit | chore/p1-p3-completion | **Lighthouse** : a11y/bp/seo en `error` (0.9/0.85/0.85), 5 URLs publiques. **Sidebar** : nav-counts complétés (teacherMessages, teacherGradeEntry, networkAlerts, notifications parent) — plus aucun placeholder. **Messagerie** : sanitize subject/content, anti auto-envoi, rate limit strict, TEACHER limité à ses classes en broadcast, publisher Redis singleton (était 1 connexion/destinataire), liens notifications normalisés (`normalizeNotificationLink` + writers corrigés) — 12 tests. **IA/n8n** : signature HMAC `X-EduPilot-Signature` (N8N_WEBHOOK_SECRET), callN8n unifié sur la politique réseau partagée (retry/timeout), `checkN8nHealth` exposé dans le statut — 11 tests. **Import** : mot de passe partagé "00000000" remplacé par secret aléatoire/lot (5 routes), cap 500 lignes/lot (4 routes). **Export** : `escapeCsvCell` anti formula-injection (exportToCSV + export DGI) — 13 tests. |
| 2026-06-12 | Frontend completion (réf. EduPilot (1)) | chore/p1-p3-completion | **Cagnottes** : POST création (+ journal CREATED), GET détail (journal public, contributions pseudonymisées), POST contributions (validation parent cross-tenant, kind CONTRIBUTION_PAID) ; pages new + détail ; boutons Créer/Payer/Détails dé-grisés (création masquée aux parents). **Écritures comptables** : /api/accounting/entries GET+POST (partie double Σdébits=Σcrédits, comptes tenant-scoped, pièce auto PIECE-YYYY-MM-NNNN, soldes mis à jour, audit log) + page de saisie ; bouton dé-grisé. **Wellbeing** : GET liste ajouté, GET détail enrichi (RDV psy liés, labels anonymat), PATCH statut+sévérité ; pages dédiées new + [reportId] remplacent les dialogs P2.5. **Composant Input edu** étendu (id/min/max/step/required/aria-label). Restent disabled (hors scope assumé) : messagerie groupe cagnotte, envoi messagerie pro accounting. |
