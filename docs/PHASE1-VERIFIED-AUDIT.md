# Phase 1 Verified Audit

Audit produit a partir de la lecture directe du code reel au `2026-04-09`.

## Perimetre reel lu

- Schema: `prisma/schema.prisma`
- API: `src/app/api/**/route.ts`
- Auth / RBAC / isolation tenant: `src/lib/auth/**`, `src/lib/api/api-helpers.ts`, `src/lib/api/tenant-isolation.ts`, `src/lib/rbac/**`, `src/proxy.ts`
- Logique metier: `src/lib/services/**`, `src/lib/analytics/**`, `src/lib/finance/**`, `src/lib/notifications/**`, `src/lib/ai/**`, `src/domain/apogee/**`
- Frontend: `src/app/**/page.tsx`, `src/components/**`

Artifacts de travail generes pendant l audit:

- `/tmp/phase1-schema-audit.md`: details modele par modele
- `/tmp/api-route-inventory.json`: inventaire route par route
- `/tmp/frontend-inventory.json`: inventaire pages / composants / refs API

## 1. Schema Prisma

Constats verifies:

- `86` modeles Prisma
- `43` enums Prisma
- `21` modeles avec `schoolId` obligatoire
- `5` modeles avec `schoolId` optionnel
- `60` modeles sans `schoolId` direct

Correction importante:

- `docs/PHASE1-CARTOGRAPHY.md` annonce `63` modeles et `37` enums
- le schema reel contient `86` modeles et `43` enums

Hubs relationnels:

- `User`
- `School`
- `StudentProfile`
- `AcademicYear`
- `Class`
- `ClassSubject`
- `Subject`
- `TeacherProfile`
- `StudentOrientation`
- `Appointment`

Plans et scope:

- `GLOBAL`: `SubscriptionPlan`, `Organization`, `OrganizationMembership`, `SystemSetting`, `City`, `Profession`, `Nationality`, une partie de `User`, `AuditLog`, `ConfigOption`, `SubjectCategory`, `PublicHoliday`
- `TENANT`: `School` et ses racines fonctionnelles (`AcademicYear`, `Class`, `Subject`, `Fee`, `Announcement`, `SchoolEvent`, `Book`, `CanteenMenu`, `MealTicket`, `Leaderboard`, etc.)
- `HYBRID / relationnel`: beaucoup de modeles sans `schoolId` direct restent tenant via leurs relations (`Enrollment`, `Grade`, `Attendance`, `Payment`, `Homework`, `Message`, `StudentAnalytics`, etc.)

Tables pivot explicites:

- `OrganizationMembership`
- `TeacherSchoolAssignment`
- `ParentStudent`
- `ClassSubject`
- `Enrollment`
- `Grade`
- `HomeworkSubmission`
- `EventParticipation`
- `CourseEnrollment`
- `LessonCompletion`
- `ExamAnswer`
- `UserAchievement`

Modeles audit / conformite:

- `AuditLog`
- `Notification`
- `DataConsent`
- `DataAccessRequest`
- `PasswordResetToken`
- `FirstLoginToken`
- `VerificationToken`
- `Session`

Modeles analytics / cache metier:

- `StudentAnalytics`
- `SubjectPerformance`
- `GradeHistory`
- `SubjectGroupAnalysis`
- `Leaderboard`

Note:

- la cartographie exhaustive champs / relations / indexes / enums associes est deja consolidee dans `/tmp/phase1-schema-audit.md`

## 2. Cartographie API

Constats verifies:

- `219` fichiers `route.ts` sous `src/app/api`
- methodes detectees: `GET 130`, `POST 101`, `PATCH 21`, `DELETE 29`, `PUT 10`

Repartition par domaines les plus denses:

- `root`: `14`
- `analytics`: `11`
- `ai`: `10`
- `import`: `9`
- `auth`: `8`
- `finance`: `8`
- `payments`: `8`
- `admin`: `6`
- `exams`: `6`
- `grades`: `6`
- `attendance`: `5`
- `courses`: `5`
- `incidents`: `5`
- `orientation`: `5`
- `system`: `5`

Routes domaine global / super admin lues explicitement:

- `/api/root/schools`
- `/api/root/plans`
- `/api/root/finance/summary`
- `/api/root/analytics`
- `/api/root/analytics/summary`
- `/api/root/logs`
- `/api/root/monitoring`
- `/api/root/system/maintenance`

Routes auth / publiques confirmees:

- `/api/auth/[...nextauth]`
- `/api/auth/initial-setup`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/verify-email`
- `/api/auth/first-login`
- `/api/auth/mfa/setup`
- `/api/docs`
- `/api/explorer/overview`
- `/api/system/health`
- `/api/payments/webhook`
- `/api/ai/v2/chat`

Routes metier lues explicitement:

- `/api/students`
- `/api/users`
- `/api/schools`
- `/api/payments`
- `/api/messages`
- `/api/notifications`
- `/api/incidents`
- `/api/attendance/alerts`
- `/api/analytics`
- `/api/analytics/dashboard`
- `/api/analytics/students`
- `/api/analytics/organization/overview`

Faits notables verifies dans les handlers:

- beaucoup de routes utilisent `createApiHandler(...)`, pas `export async function GET(...)`
- plusieurs reponses sont paginees sous la forme `{ data, pagination }`
- les effets de bord recurrentes sont:
  - invalidation de cache applicatif
  - creation de `Notification`
  - creation de `AuditLog`
  - synchronisation analytics (`syncAnalyticsAfterGradeChange`, `syncAnalyticsAfterStudentActivityChange`, `persistStudentAnalyticsSnapshot`)
  - synchronisation finance (`syncPaymentPlanLedger`)

Note:

- l inventaire par route avec params, schemas, modeles Prisma, codes de statut et effets de bord est consolide dans `/tmp/api-route-inventory.json`

## 3. Authentification, RBAC et isolation tenant

Constats verifies:

- il n y a pas de `middleware.ts`
- le gate global reel est `src/proxy.ts`
- la session NextAuth utilise une strategie `jwt`

Roles existants:

- `SUPER_ADMIN`
- `SCHOOL_ADMIN`
- `DIRECTOR`
- `TEACHER`
- `STUDENT`
- `PARENT`
- `ACCOUNTANT`
- `STAFF`

Permissions:

- la matrice exhaustive est definie dans `src/lib/rbac/permissions.ts`
- familles presentes:
  - school
  - user
  - student
  - teacher
  - class
  - subject
  - grade
  - evaluation
  - schedule
  - finance / fee / payment
  - report / statistics
  - notification
  - academic_year
  - calendar / holiday
  - orientation
  - analytics
  - AI
  - attendance
  - incident
  - medical / canteen / library
  - system

Session / JWT contient:

- `id`
- `role`
- `roles`
- `permissions`
- `primaryOrganizationId`
- `organizationIds`
- `isOrganizationManager`
- `primarySchoolId`
- `schoolId`
- `accessibleSchoolIds`
- `firstName`
- `lastName`
- `avatar`
- `isTwoFactorEnabled`
- `isTwoFactorAuthenticated`

Isolation tenant:

- `createApiHandler` exige une session sauf `requireAuth: false`
- pour les non `SUPER_ADMIN`, l ecole active est resolue via `getActiveSchoolId(session)`
- si un `schoolId` de query est fourni, il est verifie contre les ecoles accessibles
- le changement d etablissement cote UI passe par `session.update({ schoolId })` dans `SchoolProvider`

Routes publiques connues dans `src/proxy.ts`:

- `/api/auth`
- `/api/setup`
- `/api/explorer`
- `/api/docs`
- `/api/system/health`
- `/api/payments/webhook`
- `/api/ai/v2/chat`

## 4. Services et logique metier

Services critiques verifies:

- `src/lib/services/student-analytics.ts`
- `src/lib/services/analytics-sync.ts`
- `src/lib/services/analytics-dashboard.ts`
- `src/lib/services/organization-dashboard.ts`
- `src/lib/services/notification.service.ts`
- `src/lib/services/orientation.ts`
- `src/lib/finance/helpers.ts`
- `src/lib/analytics/service.ts`
- `src/lib/ai/ai-service.ts`
- `src/lib/services/ai-predictive/*`
- `src/domain/apogee/telemetry.ts`

Calcul des moyennes:

- normalisation des notes sur `/20`
- moyenne matiere = moyenne ponderee des evaluations via `Evaluation.coefficient`
- moyenne generale = moyenne ponderee des matieres via `ClassSubject.coefficient`
- niveau de performance derive de la moyenne (`EXCELLENT` a `WEAK`)

Calcul des risques:

- moteur simple dans `student-analytics.ts`
- facteurs:
  - moyenne
  - assiduite
  - incidents
- score:
  - moyenne `< 6` => `+40`
  - moyenne `< 8` => `+30`
  - moyenne `< 10` => `+15`
  - assiduite `< 70%` => `+30`
  - assiduite `< 85%` => `+15`
  - incidents `>= 5` => `+20`
  - incidents `>= 3` => `+10`
- seuils:
  - `>= 60`: `CRITICAL`
  - `>= 40`: `HIGH`
  - `>= 20`: `MEDIUM`
  - `> 0`: `LOW`

Sync analytics:

- `persistStudentAnalyticsSnapshot(studentId, periodId, academicYearId)`
- `syncAnalyticsAfterGradeChange(evaluationId, changedStudentIds)`
- `syncAnalyticsAfterStudentActivityChange(studentIds, occurredAt)`
- `syncAllStudentsForSchool(schoolId, academicYearId)`

Notifications:

- `createNotification` ecrit en base
- push temps reel via Redis si `REDIS_URL`
- fallback SSE + polling DB via `/api/notifications/stream`
- helpers metier: nouvelle note, paiement, bulletin, inscription, notif globale ecole

Finance:

- `syncPaymentPlanLedger` recompte les paiements verifies / rapproches
- met a jour chaque echeance en `PENDING`, `PAID` ou `OVERDUE`
- met a jour le `PaymentPlan` en `ACTIVE`, `COMPLETED` ou `OVERDUE`

Organisation multisite:

- `getOrganizationDashboardData(...)` consolide sites comparables
- rapproche annees / periodes / classes / matieres a travers l organisation

## 5. Frontend existant

Constats verifies:

- `115` pages `page.tsx`
- `89` fichiers composants TypeScript dans `src/components`
- `106` pages avec au moins une ref `/api/*`
- `88` pages avec garde explicite (`PageGuard` roles / permissions)

Elements deja implementes:

- `Sidebar` GSAP avec etat persiste
- `NotificationCenter` en `Sheet`
- `GlobalSearch` / palette `Cmd+K`
- modes `comfort` / `dense` / `focus`
- `SchoolProvider` pour l etablissement actif, l annee et la periode
- `dashboard/page.tsx` server-side qui appelle directement les services analytics, sans passer par HTTP

Pages ou sections manifestement partielles / statiques:

- `/dashboard/settings/security`
- `/dashboard/settings/notifications`
- `/dashboard/settings`
- plusieurs cartes de parametres affichent des controles UI sans persistance backend

Note tenant importante:

- le frontend n injecte pas toujours `schoolId` en query param
- l isolation repose souvent sur la session active et `getActiveSchoolId(session)`, ce qui est coherent avec le backend reel

## 6. Inventaire des incoherences

### Categorie A — API existante sans page ou composant frontend detecte

Critique / Important:

- `ConfigOption`
  - backend: `/api/config-options`, `/api/config-options/[id]`
  - frontend: aucune page ni composant detecte
  - priorite: `Important`
- `SubjectCategory`
  - backend: `/api/subject-categories`, `/api/subject-categories/[id]`
  - frontend: aucune page ni composant detecte
  - priorite: `Important`
- `MedicalRecord` legacy suite
  - backend: `/api/medical-records`, `/api/medical-records/[id]/allergies`, `/api/medical-records/[id]/emergency-contacts`, `/api/medical-records/[id]/vaccinations`
  - frontend: UI branchee sur `/api/health/*`, pas sur cette suite legacy
  - priorite: `Important`
- `Parent dashboard`
  - backend: `/api/parents/dashboard`
  - frontend: aucune page dediee detectee
  - priorite: `Important`
- `Upload`
  - backend: `/api/upload`, `/api/uploads/[type]/[filename]`
  - frontend: aucune UI dediee detectee
  - priorite: `Important`

Mineur / technique:

- `/api/config/benin`
- `/api/debug/session`
- `/api/setup`

### Categorie B — Frontend incorrect par rapport au backend reel

Corrige dans cette passe:

- `UsersPage`
  - frontend initial: `DELETE /api/users/${id}`
  - backend reel: pas de `DELETE /api/users/[id]`
  - route existante la plus proche: `POST /api/users/[id]/delete`
  - contrainte backend: suppression RGPD avec `confirmEmail`, `deleteType`, reservee au compte lui-meme ou a `SUPER_ADMIN`
  - action: la page utilise maintenant la vraie route RGPD et masque l action hors `SUPER_ADMIN`
  - priorite: `Critique`
- `ParentsPage`
  - frontend initial: `DELETE /api/users/${id}` + lien vers `/dashboard/users/[id]` inexistant
  - backend reel: `POST /api/users/[id]/delete`, pas de page detail utilisateur generique
  - action: suppression alignee sur la route RGPD existante, action reservee au `SUPER_ADMIN`
  - priorite: `Critique`
- `Academic settings`
  - frontend initial: `PATCH /api/academic-years/${id}`
  - backend reel: aucune route `src/app/api/academic-years/[id]/route.ts`
  - action: les boutons d activation / edition / suppression sont desactives tant que le backend reste create-only
  - priorite: `Important`

Reste a traiter:

- `/dashboard/settings/security`
  - UI 2FA / mot de passe statique alors que le backend auth / MFA existe
  - priorite: `Important`
- `/dashboard/settings/notifications`
  - UI de preferences statique, sans persistance
  - priorite: `Important`

### Categorie C — Modeles Prisma sans exposition API directe claire

Candidates verifies:

- `SubjectGroupAnalysis`
  - utilise comme cache d analyse orientation
  - aucune route dediee detectee
  - priorite: `Mineur`
- `GradeHistory`
  - utilise par analytics / prediction
  - aucune route dediee detectee
  - priorite: `Mineur`
- `MealTicket`
  - service metier existe dans `src/lib/canteen/service.ts`
  - aucune route frontend/API dediee detectee pour achat / consommation / liste
  - priorite: `Important`
- `Account`
  - modele NextAuth interne, pas de route custom dediee
  - priorite: `Mineur`

## 7. Points de synchronisation pour la Phase 2

Priorites frontend deja confirmees par le code reel:

- reconstruire la sidebar a partir de la matrice RBAC reelle, pas a partir des maquettes
- brancher les badges dynamiques sur des routes existantes et des shapes reelles
- finir les pages settings aujourd hui statiques (`security`, `notifications`)
- couvrir les APIs sans UI: `config-options`, `subject-categories`, `meal tickets` ou bien les declasser explicitement en interne-only
- verifier les pages analytics pour les `7` onglets demandes: l existant couvre partiellement le besoin, pas integralement

## 8. Rapport de couverture API actuel

Couverture mecanique detectee sur `219` routes:

- `152` routes `✅ Couvert`
- `53` routes `⚠️ Partiel`
- `14` routes `❌ Absent`

Routes `❌ Absent` detectees:

- `/api/config/benin`
- `/api/config-options`
- `/api/config-options/[id]`
- `/api/debug/session`
- `/api/medical-records`
- `/api/medical-records/[id]/allergies`
- `/api/medical-records/[id]/emergency-contacts`
- `/api/medical-records/[id]/vaccinations`
- `/api/parents/dashboard`
- `/api/setup`
- `/api/subject-categories`
- `/api/subject-categories/[id]`
- `/api/upload`
- `/api/uploads/[type]/[filename]`

Cette page sert de synthese verifiee. Les details exhaustifs route par route et page par page restent dans les artifacts `/tmp/*` generes pendant l audit.
