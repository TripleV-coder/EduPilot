# Annexe A1 — Inventaire des routes API

> Généré le 2026-10-15 par extraction automatique du code (AST TypeScript / analyse du schéma Prisma), branche `feat/enseignant-multi-ecoles`, commit `0d57d9c`. Colonnes « garde » = fonctions de contrôle appelées dans le fichier (présence ≠ preuve d'application sur chaque chemin). « Interface » = nombre de fichiers de `src/` contenant une URL littérale vers la route (0 = appelée seulement par tests, scripts, fournisseurs ou URL construite dynamiquement — à confirmer).

Total : **313 routes**, **506 gestionnaires** (499 via `createApiHandler`).

Légende drapeaux : T = transaction, C = cache HTTP serveur, M = mémoïsation, I = invalidation de cache, N = notification, J = file de tâches, A = journal d'audit, R = limitation de débit, Z = validation Zod, S = contexte système (contourne la RLS), Q = SQL brut, F = génération de fichier.

## academic-years (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/academic-years/[id]/status` | **PATCH** { requireAuth: true, requiredPermissions: [Permission.ACADEMIC_YEAR_CLOSE], } | **academicYear**, enrollment | canAccessSchool | I A Z |  | 1 |
| `/api/academic-years` | **GET** { requireAuth: true, requiredPermissions: [Permission.ACADEMIC_YEAR_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.ACADEMIC_YEAR_CREATE], } | academicConfig, **academicYear**, **period** | ensureRequestedSchoolAccess, école active | Z |  | 12 |

## access-control (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/access-control/badges/regenerate` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], } | **auditLog**, **badge**, class, enrollment | école active | T A Z |  | 1 |
| `/api/access-control/logs` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.SCHOOL_READ], } | scanLog | école active |  |  | 1 |
| `/api/access-control/scan-points` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.SCHOOL_READ], }<br>**POST** { // Opération vie scolaire : restreinte par rôle (STAFF inclus). allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], } | **scanPoint** | école active | Z |  | 2 |
| `/api/access-control/scan` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.SCHOOL_READ], } | badge, **scanLog**, scanPoint, studentProfile | école active | Z |  | 0 |

## accounting (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/accounting/entries` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, fiscalYear, **journalEntry**, **ohadaAccount** | école active | A |  | 1 |
| `/api/accounting/export` | **GET** { requireAuth: true } | journalEntry |  | Z F |  | 1 |
| `/api/accounting/fiscal-year` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], requiredPermissions: [Permission.SCHOOL_READ], } | fiscalYear | école active |  |  | 1 |
| `/api/accounting/journal/send` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | fiscalYear, journalEntry, **message**, user | école active | I N A R Z |  | 1 |
| `/api/accounting/overview` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | fiscalYear, journalEntry, ohadaAccount | ensureRequestedSchoolAccess, école active |  | momo | 1 |

## admin (6)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/admin/config/reforms` | **GET** { requireAuth: true, requiredPermissions: [Permission.SYSTEM_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.SYSTEM_WRITE], } | **configOption** |  | Z |  | 1 |
| `/api/admin/curriculum-config` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }<br>**PATCH** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"] } | class, **classSubject**, grade, school, **subject** |  | Z |  | 2 |
| `/api/admin/pending-actions` | **GET** { requireAuth: true, requiredPermissions: [Permission.SYSTEM_READ], } | behaviorIncident, dataAccessRequest, payment, school, user |  |  |  | 1 |
| `/api/admin/subjects/[id]` | **PUT** <br>**DELETE**  | classSubject, **subject** | école active |  |  | 0 |
| `/api/admin/subjects` | **GET** <br>**POST** <br>**PUT**  | **subject** | école active |  |  | 1 |
| `/api/admin/system/info` | **GET** { allowedRoles: ["SUPER_ADMIN"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN"] } | **auditLog**, enrollment, grade, school, studentProfile, teacherProfile, user |  | A |  | 1 |

## ai (10)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/ai/analyze-risk` | **POST**  |  | école active | R |  | 1 |
| `/api/ai/analyze` | **POST**  | parentProfile, parentStudent, **studentAnalytics**, studentProfile | ensureSchoolAccess | R | n8n | 0 |
| `/api/ai/chatbot` | **POST**  |  | école active | R | n8n | 0 |
| `/api/ai/local` | **GET** <br>**POST**  |  | école active | R Z |  | 0 |
| `/api/ai/predict-failure` | **POST**  | studentProfile | ensureSchoolAccess | R | n8n | 0 |
| `/api/ai/predictions/class` | **POST** <br>**GET**  | class | école active |  |  | 0 |
| `/api/ai/predictions/student` | **POST** <br>**GET**  | parentProfile, studentProfile | école active |  |  | 1 |
| `/api/ai/v2/chat` | **POST** <br>**GET**  |  | école active | J R | n8n | 1 |
| `/api/ai/v2/governance` | **POST** <br>**GET**  |  | école active | R |  | 0 |
| `/api/ai/v2` | **POST** <br>**GET**  |  | école active | R |  | 2 |

## alumni (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/alumni/[id]` | **PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **alumni**, **auditLog** | école active | A Z |  | 0 |
| `/api/alumni` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF", "TEACHER"], requiredPermissions: [Permission.SCHOOL_READ], }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], } | **alumni**, **auditLog** | école active | A Z |  | 2 |

## analytics (13)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/analytics/bi` | **GET** { requireAuth: true, requiredPermissions: [Permission.ANALYTICS_VIEW], } | academicYear, attendance, payment, studentProfile | école active |  |  | 1 |
| `/api/analytics/class-comparison` | **GET**  | class, enrollment, studentAnalytics | canAccessSchool |  |  | 1 |
| `/api/analytics/class/[classId]` | **GET**  | academicYear, class, enrollment, period, studentAnalytics | école active |  |  | 2 |
| `/api/analytics/class/[classId]/subject/[subjectId]` | **GET**  | academicYear, classSubject, enrollment, evaluation, subjectPerformance | canAccessSchool |  |  | 3 |
| `/api/analytics/dashboard` | **GET**  | academicYear | ensureRequestedSchoolAccess, école active | C |  | 0 |
| `/api/analytics/organization/overview` | **GET**  | organization | école active |  |  | 1 |
| `/api/analytics/period-comparison` | **GET**  | academicYear, class, period, studentAnalytics | canAccessSchool |  |  | 1 |
| `/api/analytics/recalculate` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | academicYear | canAccessSchool, école active |  |  | 0 |
| `/api/analytics` | **GET** { allowedRoles: ANALYTICS_ALLOWED_ROLES } |  | école active | C |  | 0 |
| `/api/analytics/school/overview` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | academicYear, attendance, enrollment, period, studentAnalytics, studentProfile | ensureRequestedSchoolAccess, école active | M |  | 0 |
| `/api/analytics/students` | **GET** <br>**POST**  | academicYear, attendance, classSubject, enrollment, parentProfile, studentAnalytics, studentProfile, teacherProfile | canAccessSchool, école active | C |  | 4 |
| `/api/analytics/sync-all` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | academicYear | école active | Z |  | 1 |
| `/api/analytics/web-vitals` | **POST** { requireAuth: false } | **performanceMetric** |  | R Z |  | 1 |

## announcements (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/announcements/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **announcement**, **auditLog** | école active | I A Z |  | 1 |
| `/api/announcements` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **announcement**, **auditLog**, **notification**, user | école active | C I A Z |  | 2 |

## appointments (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/appointments/[id]` | **GET** <br>**PATCH** <br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **appointment**, **notification** | assertModelAccess | Z |  | 1 |
| `/api/appointments/options` | **GET** { allowedRoles: ["PARENT"] } | parentProfile |  |  |  | 1 |
| `/api/appointments` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT"] } | **appointment**, **notification**, parentProfile, parentStudent, studentProfile, teacherProfile | canAccessSchool, école active | Z |  | 2 |

## attendance (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/attendance/alerts` | **GET**  | attendance | ensureRequestedSchoolAccess |  |  | 0 |
| `/api/attendance/bulk` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }<br>**GET**  | **attendance**, class, enrollment, teacherProfile | canAccessSchool, guardAttendanceDateWritable | T I N Z |  | 1 |
| `/api/attendance/justifications` | **GET** { allowedRoles: [...REVIEWER_ROLES, "ACCOUNTANT", ...FAMILY_ROLES] }<br>**POST** { allowedRoles: [...REVIEWER_ROLES, ...FAMILY_ROLES] } | **attendance** | assertModelAccess, getOwnStudentIds, guardAttendanceDateWritable, école active | I N Z |  | 2 |
| `/api/attendance` | **GET** { requireAuth: true, requiredPermissions: [Permission.ATTENDANCE_READ], } | attendance, parentProfile | école active |  |  | 1 |
| `/api/attendance/stats` | **GET**  | attendance, parentProfile, studentProfile | école active | C |  | 0 |

## audit-logs (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/audit-logs/export` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | auditLog, user | école active | F |  | 1 |
| `/api/audit-logs` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], } | auditLog, user | école active |  |  | 1 |

## auth (8)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | **POST** _(function)_ <br>**GET** _(function)_  |  |  |  |  | 2 |
| `/api/auth/first-login` | **GET** { requireAuth: false }<br>**POST** { requireAuth: false } | **auditLog**, **firstLoginToken**, **user** |  | T A Z |  | 1 |
| `/api/auth/forgot-password` | **POST** { requireAuth: false } | **passwordResetToken**, user |  | R Z |  | 4 |
| `/api/auth/initial-setup` | **POST** { requireAuth: false }<br>**GET** { requireAuth: false } | **auditLog**, **user** |  | T A R Z |  | 3 |
| `/api/auth/mfa/setup` | **POST**  | **auditLog**, **user** |  | A Z |  | 2 |
| `/api/auth/register` | **POST** { requireAuth: false } |  |  |  |  | 0 |
| `/api/auth/reset-password` | **POST** { requireAuth: false }<br>**GET** { requireAuth: false } | **auditLog**, **passwordResetToken**, **user** |  | A R Z |  | 1 |
| `/api/auth/verify-email` | **GET** { requireAuth: false }<br>**POST** { requireAuth: false } | **user**, **verificationToken** |  | R |  | 1 |

## benchmark (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/benchmark/latest` | **GET**  | benchmarkSnapshot | ensureRequestedSchoolAccess, école active |  |  | 1 |

## bulletins (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/bulletins` | **GET**  | attendance, behaviorIncident, parentProfile, parentStudent, period, school, studentFormula, studentProfile | école active |  |  | 1 |

## cagnottes (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/cagnottes/[cagnotteId]/contributions` | **POST** { allowedRoles: ["PARENT", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"] } | cagnotte, **cagnotteContribution**, **cagnotteJournalEntry**, user | école active | T | momo | 1 |
| `/api/cagnottes/[cagnotteId]` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"] } | cagnotte | école active |  |  | 1 |
| `/api/cagnottes` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **cagnotte**, **cagnotteJournalEntry**, class | ensureRequestedSchoolAccess, école active | T |  | 2 |

## calendar (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/calendar/events` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | academicYear, **schoolCalendarEvent**, schoolEvent | canAccessSchool, ensureRequestedSchoolAccess, école active | Z |  | 1 |
| `/api/calendar/holidays/[id]` | **GET** { requireAuth: true, }<br>**PUT** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **schoolHoliday** | canAccessSchool | Z |  | 0 |
| `/api/calendar/holidays` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | academicYear, **schoolHoliday** | canAccessSchool, ensureRequestedSchoolAccess, école active | Z |  | 1 |
| `/api/calendar/public-holidays` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **publicHoliday** | ensureRequestedSchoolAccess, école active | Z |  | 1 |

## canteen (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/canteen/menu` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } |  | école active | C |  | 1 |
| `/api/canteen/tickets` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **mealTicket**, parentProfile, user | école active | Z |  | 1 |

## certificates (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/certificates/[id]` | **GET** <br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, **certificate**, parentProfile, studentProfile | assertModelAccess | A |  | 1 |

## class-levels (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/class-levels` | **GET** { requireAuth: true, requiredPermissions: [Permission.SCHOOL_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.SCHOOL_UPDATE], } | **classLevel** | ensureRequestedSchoolAccess, école active | Z |  | 6 |

## class-subjects (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/class-subjects/[id]/formula` | **GET** { allowedRoles: READ_ROLES }<br>**PUT** { allowedRoles: ["TEACHER"] } | **auditLog**, **classSubject**, period | assertSubjectTeacher, canAccessSchool | T A Z |  | 2 |
| `/api/class-subjects/batch` | **POST** { requireAuth: true, requiredPermissions: [Permission.SUBJECT_UPDATE], } | class, **classSubject**, subject, teacherProfile | assertModelAccess, école active | T Z |  | 1 |
| `/api/class-subjects` | **GET** { requireAuth: true, requiredPermissions: [Permission.SUBJECT_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.SUBJECT_UPDATE], } | class, **classSubject**, subject, teacherProfile | assertModelAccess, école active | Z |  | 7 |

## classes (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/classes/[id]/cards` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.SCHOOL_READ], } | class, enrollment, school | canAccessSchool |  |  | 1 |
| `/api/classes/[id]/promote` | **POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } |  | école active | Z |  | 1 |
| `/api/classes/[id]` | **GET** { requireAuth: true, requiredPermissions: [Permission.CLASS_READ], } | class | école active |  |  | 2 |
| `/api/classes` | **GET** { requireAuth: true, requiredPermissions: [Permission.CLASS_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.CLASS_CREATE], } | **class**, classLevel, school, teacherProfile | ensureRequestedSchoolAccess, école active | C I Z |  | 25 |

## clubs (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/clubs/[id]/members` | **POST** { requireAuth: true }<br>**DELETE** { requireAuth: true } | club, **clubMembership**, studentProfile | canManageClubs, école active |  |  | 1 |
| `/api/clubs/[id]` | **PATCH** { requireAuth: true }<br>**DELETE** { requireAuth: true } | **club**, teacherProfile | canManageClubs, école active | Z |  | 1 |
| `/api/clubs` | **GET** { requireAuth: true }<br>**POST** { requireAuth: true } | **club**, studentProfile, teacherProfile | canManageClubs, école active | Z |  | 1 |

## communication (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/communication/templates/[id]` | **PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **communicationTemplate** | école active | Z |  | 1 |
| `/api/communication/templates` | **GET** { allowedRoles: [...STAFF_ROLES] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **communicationTemplate** | école active | Z |  | 1 |

## competences (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/competences` | **GET** { allowedRoles: ROLES }<br>**POST** { allowedRoles: ["TEACHER"] } | class, **evaluation**, **evaluationType**, period | assertNotCouncilLocked, assertSubjectTeacher, guardPeriodWritable, école active | Z |  | 1 |

## compliance (6)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/compliance/consents` | **GET** <br>**POST**  | parentProfile |  | A Z |  | 2 |
| `/api/compliance/dashboard` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | auditLog, dataAccessRequest, dataConsent, dataRetentionPolicy, user | école active |  |  | 2 |
| `/api/compliance/data-requests/[id]/fulfill` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **dataAccessRequest**, enrollment | école active | Z |  | 1 |
| `/api/compliance/data-requests/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **auditLog**, **dataAccessRequest**, **notification**, user | école active | A Z |  | 0 |
| `/api/compliance/data-requests` | **GET** <br>**POST**  | **auditLog**, **dataAccessRequest**, **notification**, user | école active | A Z |  | 2 |
| `/api/compliance/retention` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] }<br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **dataRetentionPolicy**, school | école active | A Z |  | 1 |

## config (7)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/config/academic` | **GET** <br>**PATCH**  | **academicConfig**, academicYear, **auditLog** | école active | A Z |  | 1 |
| `/api/config/benin` | **GET**  |  |  |  |  | 0 |
| `/api/config/council-rules` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }<br>**PUT** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog** | école active | A Z |  | 1 |
| `/api/config/grading` | **GET** { allowedRoles: READ_ROLES }<br>**PUT** { allowedRoles: WRITE_ROLES } | academicConfig, academicYear | école active | Z |  | 4 |
| `/api/config/parameters` | **GET** { allowedRoles: READ_ROLES }<br>**PUT** { allowedRoles: WRITE_ROLES } | academicYear | école active | Z |  | 1 |
| `/api/config/setup-status` | **GET**  | academicYear, class, studentProfile, teacherProfile |  |  |  | 1 |
| `/api/config/thresholds` | **GET**  |  | école active |  |  | 1 |

## config-options (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/config-options/[id]` | **GET** { requireAuth: true }<br>**PATCH** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], } | **configOption** | école active | Z |  | 2 |
| `/api/config-options` | **GET** { requireAuth: true }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], } | **configOption** | école active | Z |  | 2 |

## courses (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/courses/[id]/enroll` | **POST** { requireAuth: true, requiredPermissions: [Permission.STUDENT_READ_OWN] }<br>**DELETE** { requireAuth: true, requiredPermissions: [Permission.STUDENT_READ_OWN] } | course, **courseEnrollment**, studentProfile |  |  |  | 0 |
| `/api/courses/[id]` | **GET** <br>**PATCH** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, **course**, courseEnrollment, enrollment, lessonCompletion, **notification**, studentProfile, teacherProfile | assertModelAccess | A Z |  | 1 |
| `/api/courses/lessons/complete` | **POST**  | **courseEnrollment**, enrollment, lesson, **lessonCompletion**, studentProfile | assertModelAccess | T |  | 0 |
| `/api/courses/progress` | **GET** { allowedRoles: ["STUDENT"] } | courseEnrollment, lessonCompletion, studentProfile |  |  |  | 1 |
| `/api/courses` | **GET** <br>**POST** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"] } | **auditLog**, classSubject, **course**, enrollment, **notification**, parentProfile, studentProfile, teacherProfile | canAccessSchool, école active | T A Z |  | 2 |

## dashboard (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/dashboard/nav-counts` | **GET**  | classSubject, enrollment, evaluation, message, notification, parentProfile, payment, school, studentProfile, teacherProfile, user | école active |  |  | 1 |

## debug (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/debug/session` | **GET**  |  | école active |  |  | 0 |

## docs (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/docs` | **GET** { requireAuth: false } |  |  |  |  | 1 |

## documents (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/documents/generate` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, school, studentProfile | école active | A Z F |  | 1 |

## evaluation-types (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/evaluation-types/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **auditLog**, evaluation, **evaluationType** | canAccessSchool | T A Z |  | 1 |
| `/api/evaluation-types` | **GET** { requireAuth: true, // Permissions? Usually shared config read, or public within school? // Let's assume generic read permission or auth required. // Original permitted all auth. }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], // Or permissions: // requiredPermissions: [Permission.EVALUATION_TYPE_CREATE], // assuming it exists } | **evaluationType** | ensureRequestedSchoolAccess, école active | Z |  | 5 |

## evaluations (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/evaluations` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, // Seul l'enseignant de la matière crée ses évaluations allowedRoles: ["TEACHER"], } | classSubject, enrollment, **evaluation**, evaluationType, grade, period | assertNotCouncilLocked, assertSubjectTeacher, canAccessSchool, getOwnStudentIds, guardPeriodWritable, école active | Z |  | 4 |

## events (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/events/[id]/participate` | **POST**  | **eventParticipation**, **notification**, parentProfile, parentStudent, schoolEvent, studentProfile | école active | T Z |  | 0 |
| `/api/events/[id]` | **GET** <br>**PATCH** <br>**DELETE**  | **schoolEvent** | école active | Z |  | 0 |
| `/api/events` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **notification**, **schoolEvent**, user | école active | Z |  | 1 |

## exams (8)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/exams/[id]/questions/[questionId]` | **DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **examTemplate**, **question** | assertModelAccess, canEditExam | T |  | 1 |
| `/api/exams/[id]/questions` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **examTemplate**, **question** | assertModelAccess, canEditExam | T |  | 1 |
| `/api/exams/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **auditLog**, **examTemplate** | assertModelAccess, canEditExam | A Z |  | 4 |
| `/api/exams/[id]/start` | **POST** { allowedRoles: ["STUDENT"] } | enrollment, **examSession**, examTemplate, studentProfile | assertModelAccess |  |  | 0 |
| `/api/exams/[id]/submit` | **POST** { allowedRoles: ["STUDENT"] } | enrollment, **examAnswer**, **examSession**, examTemplate, studentProfile | assertModelAccess | T Z |  | 1 |
| `/api/exams/prep` | **GET**  | class, studentProfile | canAccessSchool |  |  | 1 |
| `/api/exams` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | classSubject, **examTemplate**, teacherProfile | canAccessSchool, école active | Z |  | 3 |
| `/api/exams/sessions/[id]/submit` | **POST** { allowedRoles: ["STUDENT"] } | **examAnswer**, **examSession**, **notification** | assertModelAccess | Z |  | 0 |

## explorer (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/explorer/overview` | **GET** { requireAuth: false } | class, school, studentProfile, teacherProfile |  | S |  | 3 |
| `/api/explorer/schools` | **GET** { requireAuth: false } | school | école active | S |  | 2 |

## fees (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/fees/[id]` | **PATCH** { allowedRoles: [...FINANCE_ROLES] }<br>**DELETE** { allowedRoles: [...FINANCE_ROLES] } | **fee** | canAccessSchool | Z |  | 1 |
| `/api/fees` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], } | **fee** | ensureRequestedSchoolAccess, école active | Z |  | 3 |

## finance (10)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/finance/dashboard` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], requiredPermissions: [Permission.FINANCE_READ], } | payment, paymentPlan, period | ensureRequestedSchoolAccess, école active | M |  | 3 |
| `/api/finance/export` | **GET**  | payment | ensureRequestedSchoolAccess, école active | F |  | 1 |
| `/api/finance/fees` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **fee** | ensureRequestedSchoolAccess, école active | Z |  | 0 |
| `/api/finance/my-payments` | **GET**  | parentProfile, payment |  |  |  | 1 |
| `/api/finance/payment-notices` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } |  | canAccessSchool | Z |  | 1 |
| `/api/finance/payments/[id]` | **PUT** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] } | **payment** | canAccessSchool | T I Z |  | 0 |
| `/api/finance/payments` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] } | fee, **payment**, studentProfile | école active | T I Z |  | 2 |
| `/api/finance/reminders` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], requiredPermissions: [Permission.FINANCE_READ], } | parentStudent, paymentPlan | école active | N J |  | 1 |
| `/api/finance/reports/generate` | **GET** <br>**POST**  | fee, payment, paymentPlan, school | ensureRequestedSchoolAccess, école active |  |  | 1 |
| `/api/finance/stats` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] } | classLevel, fee, payment, paymentPlan | ensureRequestedSchoolAccess, école active | C |  | 3 |

## gamification (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/gamification/achievements/award` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }<br>**GET**  | achievement, **auditLog**, user |  | A Z |  | 1 |
| `/api/gamification/achievements` | **GET**  |  |  | C |  | 0 |
| `/api/gamification/leaderboard` | **GET**  |  | école active | C |  | 1 |

## grades (10)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/grades/[id]` | **GET** { requireAuth: true, requiredPermissions: [Permission.GRADE_READ], }<br>**PATCH** { requireAuth: true, requiredPermissions: [Permission.GRADE_UPDATE], }<br>**DELETE** { requireAuth: true, // Seul l'enseignant de la matière supprime ses notes (vérifié ci-dessus) ; // la permission GRADE_DELETE, réservée à la direction, ne suffisait jamais allowedRoles: ["TEACHER"], } | **grade** | assertModelAccess, assertNotCouncilLocked, assertSubjectTeacher, guardPeriodWritable | I Z |  | 2 |
| `/api/grades/batch` | **POST** { requireAuth: true, // Seul l'enseignant de la matière saisit ses notes allowedRoles: ["TEACHER"] } | enrollment, evaluation, **grade** | assertNotCouncilLocked, assertSubjectTeacher, canAccessSchool, guardPeriodWritable | T I Z |  | 1 |
| `/api/grades/cahier` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | class, classSubject, enrollment, evaluation, studentFormula | assertModelAccess |  |  | 4 |
| `/api/grades/corrections/[id]` | **PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, **grade**, **gradeCorrectionRequest** | canAccessSchool | T I A Z |  | 1 |
| `/api/grades/corrections/appointment` | **POST** { allowedRoles: ["STUDENT", "PARENT"] } | **appointment**, grade, parentProfile | getOwnStudentIds | Z |  | 1 |
| `/api/grades/corrections` | **GET** { allowedRoles: READ_ROLES }<br>**POST** { allowedRoles: ["TEACHER"] } | **auditLog**, classCouncil, enrollment, evaluation, **gradeCorrectionRequest** | assertSubjectTeacher, canAccessSchool, école active | T A Z |  | 1 |
| `/api/grades/councils` | **GET** { allowedRoles: COUNCIL_ROLES }<br>**POST** { allowedRoles: VALIDATE_ROLES } | **auditLog**, class, **classCouncil**, enrollment, period, schoolCalendarEvent | école active | A |  | 1 |
| `/api/grades/report-cards` | **GET** <br>**POST** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"] } | attendance, grade, parentProfile, period, studentProfile | ensureSchoolAccess |  |  | 0 |
| `/api/grades` | **GET** { requiredPermissions: [Permission.GRADE_READ] } | grade | getOwnStudentIds, école active |  |  | 6 |
| `/api/grades/statistics` | **GET**  | class, classSubject, period | getOwnStudentIds, école active | C |  | 3 |

## health (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/health/emergency-contacts` | **GET** <br>**POST** <br>**PUT** <br>**DELETE** <br>**PATCH**  | **auditLog**, **emergencyContact** | ensureEmergencyContactHealthAccess, ensureMedicalRecordHealthAccess, ensureStudentHealthAccess | T A Z |  | 1 |
| `/api/health/medical-records` | **GET** <br>**POST** <br>**PUT**  | **auditLog**, **medicalRecord** | ensureMedicalRecordHealthAccess, ensureStudentHealthAccess | A Z |  | 2 |
| `/api/health` | **GET** { requireAuth: false } |  |  | Q |  | 2 |
| `/api/health/vaccinations` | **GET** <br>**POST** <br>**PUT** <br>**DELETE**  | **auditLog**, medicalRecord, **vaccination** | ensureMedicalRecordHealthAccess, ensureStudentHealthAccess, ensureVaccinationHealthAccess | A Z |  | 1 |

## homework (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/homework/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **homework**, studentProfile, teacherProfile | assertModelAccess | I Z |  | 2 |
| `/api/homework/[id]/submit` | **POST** { allowedRoles: ["STUDENT"] } | homework, **homeworkSubmission**, studentProfile | assertModelAccess | I Z |  | 1 |
| `/api/homework` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | classSubject, enrollment, **homework**, **notification**, parentProfile, studentProfile, teacherProfile | canAccessSchool, école active | I Z |  | 4 |
| `/api/homework/submissions/[id]/grade` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **homeworkSubmission**, **notification**, teacherProfile | assertModelAccess | Z |  | 1 |

## import (9)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/import/classes` | **POST** { allowedRoles: ALLOWED_ROLES } | school, user | école active | I |  | 1 |
| `/api/import/parents` | **POST** { allowedRoles: ALLOWED_ROLES } | school, user | école active | I |  | 1 |
| `/api/import/preview` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], requiredPermissions: [Permission.STUDENT_READ], // kept for role-permission consistency rateLimit: true, } |  |  | R Z |  | 0 |
| `/api/import` | **POST** { requireAuth: true, requiredPermissions: [Permission.STUDENT_CREATE, Permission.USER_CREATE], } | school | école active | I |  | 0 |
| `/api/import/schedules` | **POST** { allowedRoles: ALLOWED_ROLES } | class, classSubject, **schedule** | école active | T |  | 0 |
| `/api/import/students` | **POST** { allowedRoles: ALLOWED_ROLES } | school, user | école active | I |  | 1 |
| `/api/import/teachers` | **POST** { allowedRoles: ALLOWED_ROLES } | school, user | école active | I |  | 1 |
| `/api/import/templates/[id]` | **GET** { allowedRoles: ALLOWED_TEMPLATE_ROLES }<br>**PUT** { allowedRoles: ALLOWED_TEMPLATE_ROLES }<br>**DELETE** { allowedRoles: ALLOWED_TEMPLATE_ROLES } | **importTemplate** | école active | Z |  | 0 |
| `/api/import/templates` | **GET** { allowedRoles: ALLOWED_TEMPLATE_ROLES }<br>**POST** { allowedRoles: ALLOWED_TEMPLATE_ROLES } | **importTemplate** | école active | Z |  | 0 |

## incidents (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/incidents/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **behaviorIncident** | assertModelAccess | I Z |  | 1 |
| `/api/incidents/[id]/sanctions` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **sanction** | assertModelAccess | Z |  | 1 |
| `/api/incidents/notifications` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **notification**, user | école active |  |  | 0 |
| `/api/incidents` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **auditLog**, **behaviorIncident**, **notification**, parentProfile, period, studentProfile | école active | I A Z |  | 5 |
| `/api/incidents/statistics` | **GET**  | behaviorIncident, parentProfile, studentProfile | école active | C |  | 2 |

## integrations (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/integrations/fedapay` | **GET** { requireAuth: true } |  |  |  | fedapay | 0 |
| `/api/integrations/momo` | **GET** { requireAuth: true } |  |  |  | momo | 1 |
| `/api/integrations/whatsapp` | **GET** { requireAuth: true } | configOption, user | école active |  |  | 1 |

## lessons (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/lessons/[id]/complete` | **POST** { allowedRoles: ["STUDENT"] }<br>**DELETE** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, classSubject, **courseEnrollment**, lesson, **lessonCompletion**, **notification**, studentProfile, teacherProfile | assertModelAccess | A |  | 2 |
| `/api/lessons/[id]` | **GET**  | lesson | assertModelAccess |  |  | 1 |

## liaison (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/liaison` | **GET**  | announcement, appointment, attendance, behaviorIncident, classSubject, parentProfile, parentStudent, studentProfile | école active |  |  | 1 |

## library (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/library/books` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **book** | école active | Z |  | 1 |
| `/api/library/borrowings` | **POST** <br>**PUT** <br>**GET**  | book, borrowingRecord, studentProfile | école active |  |  | 1 |

## me (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/me/subjects` | **GET**  | classSubject, teacherProfile | école active |  |  | 3 |

## medical-records (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/medical-records/[id]/allergies` | **POST** <br>**DELETE**  | **allergy** | ensureMedicalRecordHealthAccess | Z |  | 0 |
| `/api/medical-records/[id]/emergency-contacts` | **POST** <br>**PUT** <br>**DELETE**  | **emergencyContact** | ensureMedicalRecordHealthAccess | Z |  | 0 |
| `/api/medical-records/[id]/vaccinations` | **POST** <br>**DELETE**  | **vaccination** | ensureMedicalRecordHealthAccess | Z |  | 0 |
| `/api/medical-records` | **GET** { requireAuth: true, requiredPermissions: [Permission.MEDICAL_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.MEDICAL_READ], } | **auditLog**, **medicalRecord** | ensureStudentHealthAccess | A Z |  | 0 |

## messages (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/messages/[id]` | **GET** <br>**PATCH** <br>**DELETE**  | **message** |  | I Z |  | 1 |
| `/api/messages/broadcast` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | class, classSubject, enrollment, **message** | école active | I N R Z |  | 1 |
| `/api/messages/recipients` | **GET**  |  | école active |  |  | 1 |
| `/api/messages` | **GET** <br>**POST**  | **message**, user | ensureSchoolAccess, école active | C I N R Z |  | 3 |

## metrics (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/metrics` | **GET** _(function)_  |  |  |  |  | 1 |

## modules (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/modules/[id]/lessons` | **GET** <br>**POST** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, courseModule, **lesson**, teacherProfile | assertModelAccess | A Z |  | 1 |
| `/api/modules/[id]` | **GET** <br>**PATCH** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, **courseModule**, teacherProfile | assertModelAccess | A Z |  | 0 |
| `/api/modules` | **POST** { allowedRoles: ["SUPER_ADMIN", "TEACHER", "SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, course, **courseModule**, teacherProfile | assertModelAccess | A Z |  | 1 |

## notifications (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/notifications/[id]` | **GET** <br>**PATCH** <br>**DELETE**  | **notification** |  |  |  | 1 |
| `/api/notifications/feed` | **GET**  | notification |  |  |  | 2 |
| `/api/notifications` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }<br>**PATCH**  | **notification**, user | école active | N Z |  | 2 |
| `/api/notifications/sms` | **POST**  | parentProfile, paymentPlan, user | école active | Z |  | 0 |
| `/api/notifications/stream` | **GET**  | notification |  | J Z |  | 0 |

## organizations (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/organizations/members` | **POST**  | **auditLog**, organization, **organizationMembership**, user |  | A Z |  | 0 |
| `/api/organizations` | **GET**  | organization |  |  |  | 1 |

## orientation (8)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/orientation/[id]/recommendations` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **auditLog**, **orientationRecommendation**, **studentOrientation** | école active | A Z |  | 1 |
| `/api/orientation/[id]/validate` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **orientationRecommendation**, **studentOrientation** | école active | Z |  | 0 |
| `/api/orientation/batch-analyze` | **POST**  | enrollment | école active |  |  | 2 |
| `/api/orientation/cep` | **GET** <br>**POST** { allowedRoles: ROLES } | class, enrollment, period, **studentOrientation** | école active |  |  | 1 |
| `/api/orientation/council` | **GET**  | class, enrollment | école active |  |  | 1 |
| `/api/orientation/generate-ai` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } |  |  |  |  | 1 |
| `/api/orientation/me` | **GET** { allowedRoles: ["STUDENT"] } | academicYear, enrollment, grade, studentOrientation, studentProfile |  |  |  | 1 |
| `/api/orientation` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | **auditLog**, **studentOrientation** | école active | A R Z |  | 1 |

## parents (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/parents/dashboard` | **GET** { allowedRoles: ["PARENT"] } | attendance, behaviorIncident, grade, homework, homeworkSubmission, parentProfile |  |  |  | 0 |
| `/api/parents/link-child` | **POST** { allowedRoles: ["PARENT"] } | **auditLog**, parentProfile, **parentStudent**, **studentLinkCode**, studentProfile | école active | A Z |  | 1 |

## payment-plans (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/payment-plans/[id]/installments/[installmentId]/pay` | **POST** { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, **installmentPayment**, **notification**, **payment**, **paymentPlan** | assertModelAccess | I A Z |  | 1 |
| `/api/payment-plans/[id]` | **GET** <br>**DELETE** { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, **notification**, **paymentPlan**, studentProfile | assertModelAccess | A |  | 0 |
| `/api/payment-plans` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, fee, **notification**, parentProfile, **paymentPlan**, scholarship, studentProfile | canAccessSchool, école active | A Z |  | 2 |

## payments (11)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/payments/[id]/invoice` | **GET**  | parentProfile, payment, studentProfile | canAccessSchool | F |  | 1 |
| `/api/payments/[id]` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] }<br>**PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }<br>**DELETE** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | parentProfile, **payment** | canAccessSchool | T I Z |  | 0 |
| `/api/payments/cash` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | fee, **payment**, paymentPlan, studentProfile | canAccessSchool | T I Z |  | 1 |
| `/api/payments/fedapay/initiate` | **POST**  | parentProfile, **payment**, user | ensureSchoolAccess | R Z | fedapay | 0 |
| `/api/payments/fedapay/webhook` | **POST** { requireAuth: false } |  |  | S | fedapay | 1 |
| `/api/payments/initiate` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] } | fee, parentProfile, **payment**, studentProfile | canAccessSchool | T Z | momo, fedapay | 1 |
| `/api/payments/momo/webhook` | **POST** { requireAuth: false } |  |  | Z S | momo | 2 |
| `/api/payments/online-status` | **GET** { allowedRoles: ["PARENT", "STUDENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } |  |  |  | fedapay, momo | 1 |
| `/api/payments/reconcile` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }<br>**GET**  | **payment** | ensureRequestedSchoolAccess, école active | T |  | 1 |
| `/api/payments` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"], }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], } | fee, parentProfile, **payment**, studentProfile | canAccessSchool, école active | T C I Z |  | 2 |
| `/api/payments/webhook` | **POST** { requireAuth: false } |  |  | I Z S | flutterwave, paystack | 1 |

## performance (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/performance/dashboard` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], } | performanceMetric |  |  |  | 0 |

## performances (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/performances` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] } | academicYear, evaluation, grade, period | école active |  |  | 1 |

## periods (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/periods/[id]` | **GET** <br>**PUT** { allowedRoles: MANAGE_ROLES }<br>**DELETE** { allowedRoles: MANAGE_ROLES } | grade, **period** | canAccessSchool | Z |  | 1 |
| `/api/periods` | **GET** <br>**POST** { allowedRoles: MANAGE_ROLES } | academicYear, **period** | canAccessSchool, ensureRequestedSchoolAccess, école active | Z |  | 9 |

## public (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/public/plans` | **GET** { requireAuth: false } | subscriptionPlan |  |  |  | 1 |
| `/api/public/schools/[code]` | **GET** { requireAuth: false } | school |  |  |  | 0 |
| `/api/public/schools` | **GET** { requireAuth: false } | school |  |  |  | 1 |

## reference (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/reference/cities` | **GET** {}<br>**POST** { allowedRoles: ["SUPER_ADMIN"] } | **city** |  |  |  | 0 |
| `/api/reference/config-options` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **configOption** | ensureRequestedSchoolAccess, école active | Z |  | 0 |
| `/api/reference/nationalities` | **GET** {}<br>**POST** { allowedRoles: ["SUPER_ADMIN"] } | **nationality** |  |  |  | 0 |
| `/api/reference/professions` | **GET** {}<br>**POST** { allowedRoles: ["SUPER_ADMIN"] } | **profession** |  |  |  | 0 |

## resources (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/resources/[id]/download` | **POST**  | **auditLog**, **resource** | école active | A |  | 0 |
| `/api/resources/[id]` | **GET** <br>**PATCH** { allowedRoles: [ "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", ] }<br>**DELETE** { allowedRoles: [ "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", ] } | **auditLog**, **resource** | assertModelAccess | I A Z |  | 0 |
| `/api/resources` | **GET** <br>**POST** { allowedRoles: [ "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", ] } | **auditLog**, **resource** | école active | I A Z |  | 2 |

## root (15)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/root/analytics` | **GET** {} |  |  | Q |  | 1 |
| `/api/root/analytics/summary` | **GET** {} |  |  |  |  | 1 |
| `/api/root/auth` | **POST** {} |  |  |  |  | 0 |
| `/api/root/dashboard` | **GET** { allowedRoles: ["SUPER_ADMIN"] } | auditLog, class, dataAccessRequest, payment, school, studentProfile, teacherProfile, user |  | Q |  | 0 |
| `/api/root/data-requests` | **GET** {}<br>**PATCH** {} | **dataAccessRequest** |  |  |  | 1 |
| `/api/root/finance/summary` | **GET** {} | payment, school, subscriptionPlan |  |  |  | 1 |
| `/api/root/logs` | **GET** {} | auditLog |  |  |  | 1 |
| `/api/root/monitoring` | **GET** { allowedRoles: ["SUPER_ADMIN"] } | auditLog, dataAccessRequest, session, systemSetting |  | Q |  | 1 |
| `/api/root/organizations` | **GET** {} | organization |  |  |  | 1 |
| `/api/root/plans` | **GET** {}<br>**POST** {}<br>**PATCH** {}<br>**DELETE** {} | school, **subscriptionPlan** |  | Z |  | 2 |
| `/api/root/schools` | **GET** {}<br>**PATCH** {}<br>**POST** {} | **school**, studentProfile, teacherProfile, teacherSchoolAssignment, user |  | T I R Z |  | 2 |
| `/api/root/session` | **GET** {} |  |  |  |  | 0 |
| `/api/root/system-map` | **GET** {} |  |  |  |  | 1 |
| `/api/root/system/maintenance` | **GET** _(function)_ <br>**POST** _(function)_  | **systemSetting** |  |  |  | 1 |
| `/api/root/users` | **GET** { allowedRoles: ["SUPER_ADMIN"] }<br>**PATCH** { allowedRoles: ["SUPER_ADMIN"] } | **user** |  |  |  | 1 |

## schedules (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/schedules` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | classSubject, enrollment, **schedule**, teacherProfile | assertModelAccess, canAccessSchool, ensureRequestedSchoolAccess, getOwnStudentIds, école active | Z |  | 3 |

## scholarships (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/scholarships/[id]` | **GET** <br>**PATCH** { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR"] }<br>**DELETE** { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR"] } | **auditLog**, **notification**, **scholarship**, studentProfile | assertModelAccess | A Z |  | 0 |
| `/api/scholarships` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, **notification**, parentProfile, **scholarship**, studentProfile | école active | A Z |  | 2 |

## schools (5)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/schools/[id]/levels` | **GET** <br>**PATCH**  | classLevel, **school** | ensureRequestedSchoolAccess | Z |  | 1 |
| `/api/schools/[id]/modules` | **GET** <br>**PATCH**  | **school** | ensureRequestedSchoolAccess | A Z |  | 1 |
| `/api/schools/[id]` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], }<br>**PATCH** { requireAuth: true, requiredPermissions: [Permission.SCHOOL_UPDATE], }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"], requiredPermissions: [Permission.SCHOOL_DELETE], } | **school** | canAccessSchool | I Z |  | 1 |
| `/api/schools/context` | **GET**  | school | école active |  |  | 1 |
| `/api/schools` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"], requiredPermissions: [Permission.SCHOOL_CREATE], } | school | école active | T I Z |  | 7 |

## settings (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/settings/configs` | **GET** <br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] } | **configOption** | école active | Z |  | 0 |

## setup (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/setup` | **GET** _(re-export)_ export { GET, POST } from "@/app/api/auth/initial-setup/route";<br>**POST** _(re-export)_ export { GET, POST } from "@/app/api/auth/initial-setup/route"; |  |  |  |  | 1 |

## signatures (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/signatures/[id]/verify` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STAFF", "ACCOUNTANT"] } | documentSignature | école active | Z |  | 0 |
| `/api/signatures` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STAFF", "ACCOUNTANT"] }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT"] } | certificate, **documentSignature**, studentProfile, user | canSignDocType, école active | Z |  | 1 |

## staff (7)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/staff/attendance/bulk` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **staffAttendance**, user | école active | T Z |  | 1 |
| `/api/staff/attendance` | **GET** { allowedRoles: STAFF_MEMBER_ROLES }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | **staffAttendance**, user | école active | Z |  | 1 |
| `/api/staff/leaves/[id]` | **PATCH** { allowedRoles: STAFF_MEMBER_ROLES } | **leaveRequest** | école active | Z |  | 1 |
| `/api/staff/leaves` | **GET** { allowedRoles: STAFF_MEMBER_ROLES }<br>**POST** { allowedRoles: STAFF_MEMBER_ROLES } | **leaveRequest** | école active | Z |  | 1 |
| `/api/staff/payroll/[id]` | **PATCH** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **auditLog**, fiscalYear, **journalEntry**, **ohadaAccount**, **payrollEntry** | école active | T A Z |  | 1 |
| `/api/staff/payroll` | **GET** { allowedRoles: STAFF_MEMBER_ROLES }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | **payrollEntry**, user | école active | Z |  | 1 |
| `/api/staff` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | user | école active |  |  | 1 |

## student-formulas (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/student-formulas` | **GET** { allowedRoles: READ_ROLES }<br>**PUT** { allowedRoles: ["TEACHER"] } | **auditLog**, class, classSubject, enrollment, period, **studentFormula** | assertNotCouncilLocked, assertSubjectTeacher, canAccessSchool | T A Z |  | 1 |

## students (7)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/students/[id]/balances` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], } | studentProfile | canAccessSchool |  |  | 0 |
| `/api/students/[id]/card` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.SCHOOL_READ], } | studentProfile | canAccessSchool |  |  | 2 |
| `/api/students/[id]/link-code` | **POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"], requiredPermissions: [Permission.STUDENT_UPDATE], } | **auditLog**, **studentLinkCode**, studentProfile | canAccessSchool | T A |  | 1 |
| `/api/students/[id]/profile-360` | **GET** { requireAuth: true, requiredPermissions: [Permission.STUDENT_READ], } | attendance, classSubject, grade, payment, paymentPlan, studentAnalytics, studentProfile | canAccessSchool |  |  | 1 |
| `/api/students/[id]` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"], }<br>**PATCH** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | class, **enrollment**, parentProfile, **studentProfile**, **user** | canAccessSchool | T I Z |  | 3 |
| `/api/students/bulk-import` | **POST** { requireAuth: true, requiredPermissions: [Permission.STUDENT_CREATE], }<br>**GET** { requireAuth: true, requiredPermissions: [Permission.STUDENT_CREATE], } |  | école active | I Z F |  | 0 |
| `/api/students` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT"], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.STUDENT_CREATE], } | academicYear, class, **enrollment**, parentProfile, **studentGuardian**, **studentProfile**, **user** | canAccessSchool, taughtClassIds, école active | T Z |  | 14 |

## subject-categories (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/subject-categories/[id]` | **GET** { requireAuth: true }<br>**PATCH** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], }<br>**DELETE** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **subjectCategory** | école active | Z |  | 1 |
| `/api/subject-categories` | **GET** { requireAuth: true }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **subjectCategory** | école active | Z |  | 2 |

## subjects (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/subjects/categories/[id]` | **GET** <br>**PATCH** { allowedRoles: MANAGE_ROLES }<br>**DELETE** { allowedRoles: MANAGE_ROLES } | **subjectCategory** | canAccessSchool | Z |  | 0 |
| `/api/subjects/categories` | **GET** <br>**POST** { allowedRoles: MANAGE_ROLES } | **subjectCategory** | école active | Z |  | 0 |
| `/api/subjects` | **GET** { requireAuth: true, requiredPermissions: [Permission.SUBJECT_READ], }<br>**POST** { requireAuth: true, requiredPermissions: [Permission.SUBJECT_CREATE], } | **subject** | ensureRequestedSchoolAccess, école active | C I Z |  | 6 |

## system (6)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/system/activity` | **GET** { allowedRoles: ["SUPER_ADMIN"] } | auditLog |  |  |  | 0 |
| `/api/system/automation` | **GET** { requireAuth: false }<br>**POST** { requireAuth: false } |  |  | J S |  | 1 |
| `/api/system/backup` | **POST** { allowedRoles: ["SUPER_ADMIN"] }<br>**GET** { allowedRoles: ["SUPER_ADMIN"] } |  |  |  |  | 1 |
| `/api/system/clean-logs` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"], } | **auditLog** |  |  |  | 0 |
| `/api/system/health` | **GET** { allowedRoles: ["SUPER_ADMIN"] } | school, user |  | Q |  | 0 |
| `/api/system/retention` | **GET** { requireAuth: false }<br>**POST** { requireAuth: false } | school |  | S | n8n | 2 |

## teachers (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/teachers/[id]/availability` | **GET** <br>**POST** <br>**DELETE**  | appointment, **teacherAvailability**, teacherProfile | école active | Z |  | 2 |
| `/api/teachers/[id]` | **GET** { allowedRoles: READ_ROLES }<br>**PATCH** { allowedRoles: MANAGE_ROLES }<br>**DELETE** { allowedRoles: MANAGE_ROLES } | **class**, **classSubject**, schedule, school, **teacherAvailability**, **teacherProfile**, **teacherSchoolAssignment**, **user** | école active | T Z |  | 2 |
| `/api/teachers` | **GET** { allowedRoles: ALLOWED_ROLES }<br>**POST** { allowedRoles: ALLOWED_ROLES } | school, **teacherProfile**, **teacherSchoolAssignment**, **user** | école active | T C I Z |  | 9 |

## transport (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/transport/lines` | **GET** { requireAuth: true }<br>**POST** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"] } | bus, studentTransport, **transportLine** | ensureRequestedSchoolAccess, école active |  |  | 1 |

## upload (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/upload` | **POST** { maxBodyBytes: MAX_FILE_SIZE + 256 * 1024 }<br>**GET**  | **user** | école active | Z |  | 4 |

## uploads (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/uploads/[type]/[filename]` | **GET**  |  |  | Z |  | 0 |

## user (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/user/data` | **GET** <br>**DELETE**  | **dataAccessRequest**, **notification**, user | école active | A |  | 1 |
| `/api/user/profile` | **GET** { requireAuth: true }<br>**PATCH** { requireAuth: true } | **user** |  | Z |  | 8 |

## users (4)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/users/[id]/delete` | **POST**  | **account**, **attendance**, **auditLog**, **class**, **classSubject**, **enrollment**, **grade**, **homeworkSubmission**, **message**, **notification**, **parentProfile**, **parentStudent**, **payment**, **session**, **studentProfile**, **teacherProfile**, **user** |  | T A Z |  | 2 |
| `/api/users/invite` | **POST**  | **parentProfile**, **studentProfile**, **teacherProfile**, **teacherSchoolAssignment**, **user** | canCreateRole, école active | T I Z |  | 0 |
| `/api/users/role-counts` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | user | école active |  |  | 1 |
| `/api/users` | **GET** { requireAuth: true, }<br>**POST** { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], } | **parentProfile**, **teacherProfile**, **teacherSchoolAssignment**, **user** | canCreateRole, école active | T Z |  | 5 |

## ux (2)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/ux/analytics` | **GET** { requireAuth: true, allowedRoles: ["SUPER_ADMIN"], } |  |  |  |  | 1 |
| `/api/ux/events` | **POST** { requireAuth: false } | **telemetryEvent** |  | R Z |  | 1 |

## voice-notifs (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/voice-notifs/recent` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] } | voiceCampaign | ensureRequestedSchoolAccess, école active |  |  | 1 |

## wallet (1)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/wallet/overview` | **GET** { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] } | scheduledDisbursement, walletAccount, walletTransaction | ensureRequestedSchoolAccess, école active |  |  | 1 |

## wellbeing (3)

| Route | Méthodes et options | Modèles lus/écrits | Gardes | Drapeaux | Externe | Interface |
|---|---|---|---|---|---|---|
| `/api/wellbeing/overview` | **GET** { allowedRoles: [...ALLOWED_ROLES] } | climatePulseWeek, psyAppointment, wellbeingReport | ensureRequestedSchoolAccess, école active |  |  | 1 |
| `/api/wellbeing/reports/[id]` | **GET** { allowedRoles: [...ALLOWED_ROLES] }<br>**PATCH** { allowedRoles: [...ALLOWED_ROLES] } | **auditLog**, psyAppointment, **wellbeingReport** | école active | A Z |  | 1 |
| `/api/wellbeing/reports` | **GET** { allowedRoles: [...ALLOWED_ROLES] }<br>**POST** { allowedRoles: [...ALLOWED_ROLES, "TEACHER", "STAFF", "PARENT", "STUDENT"] } | **auditLog**, user, **wellbeingReport** | ensureRequestedSchoolAccess, école active | A Z |  | 1 |

