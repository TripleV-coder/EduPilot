# Livrable 12 — Index des preuves

> Pour chaque constat important : où le vérifier (fichier:ligne), quel test le démontre ou le démontrerait, et comment le reproduire. Lignes relevées sur le commit `0d57d9c`.

## Anomalies confirmées

| ID | Fichiers et lignes | Test / reproduction |
|---|---|---|
| MS-01 Révocation sans effet sur les sessions | `src/lib/auth/config.ts:134` (24 h), `:403-447` (recalcul uniquement au changement d'école), `:451-480` (contrôle par requête) ; `grep -rn roleChangedAt src` : aucune écriture | `tests/integration-db/multi-school-teacher.test.ts`, 2 `it.fails` du bloc « Révocation » |
| MS-02 Notes de toute l'école lisibles par un enseignant | `src/app/api/grades/route.ts:25-80,148` ; comparer `src/app/api/students/route.ts:110-122` ; `src/app/api/grades/report-cards/route.ts:322-382` | `it.fails` « lit les notes d'une classe qu'il n'enseigne pas » |
| MS-03 Service worker : cache des API et des pages | `src/app/sw.ts:40-46` ; `node_modules/@serwist/turbopack/dist/index.worker.mjs` (règles `apis`, `pages-rsc`, `pages`, `others`) ; `src/app/layout.tsx:102` ; aucun `caches.delete` | E2E à écrire : build de production, connexion A, déconnexion, connexion B, réseau coupé, GET `/api/...` |
| MS-04 Brouillon d'inscription | `src/app/(dashboard)/dashboard/students/inscription/page.tsx:187,197` ; `src/components/students/inscription/types.ts:48-66` ; aucun `removeItem` | Test composant à écrire |
| MS-05 `root/users` sans liste blanche | `src/app/api/root/users/route.ts:101-130` ; `src/lib/security/require-root.ts:5-11` | Test API à écrire |
| DA-01 Doublons de présences possibles | `prisma/schema.prisma` (`Attendance @@unique` avec `timeSlot String?`) ; `prisma/migrations/20260412090843_sync_final/migration.sql:479` ; `src/app/api/attendance/bulk/route.ts:96-130` | Intégration à écrire : 2 `POST /api/attendance/bulk` simultanés, puis `count` |
| DA-03 Suppression définitive d'une école | `src/app/api/schools/[id]/route.ts:118-135` ; 52 cascades depuis `School` (annexe A3) | Revue |
| DA-04 Journal d'audit supprimé avec l'utilisateur | `prisma/schema.prisma`, modèle `AuditLog` (`user … onDelete: Cascade`) | Revue |
| DA-07 `isActive` modifiable par la direction | `src/app/api/schools/[id]/route.ts:10-30,79-115` ; `src/lib/auth/school-suspension.ts` | Test API à écrire : DIRECTOR PATCH `{isActive:false}` |
| DA-10 Échéancier non resynchronisé après un paiement en ligne *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | Recalcul : `src/lib/finance/helpers.ts:269-400` (`syncPaymentPlanLedger`) ; appels : `payments/cash/route.ts:91`, `payments/route.ts:284`, `payments/[id]/route.ts:128,192`, `finance/payments/route.ts:121`, `finance/payments/[id]/route.ts:89,161`, `payment-plans/[id]/installments/[installmentId]/pay/route.ts:126` ; **aucun appel** dans `src/lib/finance/online-payments.ts` ni dans les webhooks ; lectures de `paidAmount` et des échéances : `payments/cash/route.ts:67-74`, `finance/my-payments/route.ts:80`, `notifications/sms/route.ts:136-139`, `reminders.ts:130-153` | Intégration à écrire : échéancier, paiement en ligne confirmé par webhook → échéance encore PENDING ? relance envoyée ? puis guichet du même montant accepté ? |
| SC-B-11 Encaissements simultanés au guichet | `payments/cash/route.ts:67-74` (plafond hors transaction), transaction à `:76`, pas de `lockStudentFee` | Intégration à écrire : deux `POST /api/payments/cash` simultanés du montant total |
| NAV-01 Module RH inaccessible | `next.config.js:147-176` (`/dashboard/staff` → `/dashboard/users`) ; `src/app/(dashboard)/dashboard/staff/page.tsx:10-30` ; liens vers `staff/*` seulement dans ce fichier | Ouvrir `/dashboard/staff` : redirection vers `/dashboard/users` |
| NAV-02 Écrans non référencés | Annexe A2 (colonnes « Réf. » et « Accès menu ») ; méthode : livrable 4 | Recette de navigation par rôle |

## Protections confirmées

| Protection | Preuve |
|---|---|
| Garde central `?schoolId` | `src/lib/api/api-helpers.ts:374-389` ; test « Garde central » |
| `?schoolId` re-contrôlé dans les routes | Lectures suivies d'un garde : `voice-notifs/recent:9`, `schedules:21`, `accounting/overview:24`, `wellbeing/overview:11`, `wellbeing/reports:21`, `reference/config-options:34`, `wallet/overview:11`, `cagnottes:12`, `transport/lines:23`, `attendance/alerts:19`, `finance/dashboard:289`, `benchmark/latest:15`, `classes:18`, `periods:30`, `calendar/events:19`, `fees:25,61`, `finance/export:18`, `finance/stats:44`, `finance/reports/generate:21,112`, `finance/fees:15`, `class-levels:13`, `subjects:15`, `evaluation-types:12`, `academic-years:15`, `calendar/holidays:17`, `calendar/public-holidays:16`, `analytics/school/overview:289`, `analytics/dashboard:29`, `payments/reconcile:152`, `analytics/recalculate:25` (`canAccessSchool`) |
| `body.schoolId` réservé au SUPER_ADMIN | `users/route.ts:191`, `users/invite/route.ts:75-80`, `import/{classes,parents,students,teachers}/route.ts:33-37`, `teachers/route.ts:52-55,166-173`, `events/route.ts:81-82`, `announcements/route.ts:157`, `subjects/route.ts:66-69`, `class-levels/route.ts:44-47`, `evaluation-types/route.ts:46-48`, `academic-years/route.ts:62-64`, `compliance/retention/route.ts:43-62` |
| Changement d'école validé côté serveur | `src/lib/auth/config.ts:403-447` ; tests « Changement d'école » |
| Base de l'enseignant limitée à l'école active | `src/lib/db/session-db-context.ts:18` ; test « notes de sa classe B demandées depuis A » |
| Isolation des routes `[id]` | `tests/integration-db/tenant-isolation-sweep.test.ts` (70 routes) |
| RLS effective | 16 tables ; `tests/integration-db/rls-effective.test.ts` |
| Paiements en ligne | `src/lib/finance/online-payments.ts` ; `tests/integration-db/online-payments.test.ts` (18 cas) |
| Clés de cache par utilisateur et école | `src/lib/api/cache-helpers.ts:39` ; 15 appels (livrable 7 §6.1) ; test « même URL : cache par école » |

## Commandes de reproduction

```bash
npx vitest run --config vitest.integration.config.ts tests/integration-db/multi-school-teacher.test.ts
```

```bash
grep -rn "roleChangedAt" src --include=*.ts
```

```bash
grep -rn "syncPaymentPlanLedger(" src --include=*.ts
```

```bash
grep -n "source:" next.config.js
```

Les inventaires (annexes A1 à A5) ont été produits par des scripts d'extraction AST lancés hors dépôt. Leur logique est décrite en tête de chaque annexe.
