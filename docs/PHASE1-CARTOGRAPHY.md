# PHASE 1 — CARTOGRAPHIE EXHAUSTIVE DU BACKEND EDUPILOT

*Date de production : 2026-04-09*

---

## TABLE DES MATIÈRES

1. [Schéma Prisma — Modèles, relations, enums](#1-schéma-prisma)
2. [Cartographie des routes API](#2-routes-api)
3. [Authentification et autorisation (RBAC)](#3-authentification-et-rbac)
4. [Services et logique métier](#4-services-et-logique-métier)
5. [Cartographie du frontend existant](#5-frontend-existant)
6. [Inventaire des incohérences (Catégories A, B, C)](#6-inventaire-des-incohérences)

---

## 1. SCHÉMA PRISMA

### 1.1 Inventaire complet des modèles (63 modèles)

#### PLAN GLOBAL (pas de schoolId — données système / SUPER_ADMIN)

| Modèle | Champs clés | Timestamps | Soft Delete |
|--------|-------------|------------|-------------|
| **SubscriptionPlan** | name @unique, code @unique, maxStudents, maxTeachers, maxStorageGB, features[], priceMonthly, priceYearly, isActive | ✅ | isActive |
| **Organization** | name, code @unique, isActive | ✅ | isActive |
| **OrganizationMembership** | organizationId, userId, title, isOwner, canManageSites @@unique([orgId, userId]) | ✅ | — |
| **User** | email @unique, password, firstName, lastName, role (UserRole), roles[] (hybrid), schoolId?, isActive, failedLoginAttempts, lockedUntil, 2FA fields, preferences (Json) | ✅ | isActive |
| **Account** | userId, provider, providerAccountId @@unique([provider, providerAccountId]) | — | — |
| **Session** | sessionToken @unique, userId, expires | — | — |
| **VerificationToken** | identifier, token @unique, expires | — | — |
| **PasswordResetToken** | email, token @unique, expires | createdAt | — |
| **FirstLoginToken** | userId, token @unique, tempPassword?, expiresAt, usedAt? | ✅ | — |
| **SystemSetting** | key @unique, value, type, isSecret | ✅ | — |
| **City** | name, countryCode ("BJ"), region?, population? @@unique([name, countryCode]) | ✅ | isActive |
| **Profession** | name @unique, category (ProfessionCategory) | ✅ | isActive |
| **Nationality** | name @unique, code @unique | createdAt | isActive |
| **Achievement** | code @unique, name, description, icon?, points, category? | — | isActive |

#### PLAN TENANT (avec schoolId — données école)

| Modèle | schoolId | Champs clés | Timestamps | Soft Delete |
|--------|----------|-------------|------------|-------------|
| **School** | (IS the school) | organizationId?, name, code @unique, type, level, siteType, planId?, parentSchoolId?, subscriptionStatus | ✅ | isActive |
| **AcademicConfig** | ✅ (unique) | periodType, periodsCount, maxGrade, passingGrade | ✅ | — |
| **AcademicYear** | ✅ | name, startDate, endDate, isCurrent, status @@unique([schoolId, name]) | ✅ | — |
| **Period** | (via AcademicYear) | academicYearId, name, type, startDate, endDate, sequence @@unique([academicYearId, sequence]) | ✅ | — |
| **TeacherProfile** | ✅ | userId @unique, matricule?, specialization?, hireDate? | ✅ | deletedAt |
| **TeacherSchoolAssignment** | ✅ | teacherId, userId, schoolId, status, isPrimary @@unique([teacherId, schoolId]) | ✅ | — |
| **StudentProfile** | ✅ | userId @unique, matricule, dateOfBirth?, gender?, birthPlace?, nationality?, address? | ✅ | deletedAt |
| **ParentProfile** | — | userId @unique, profession? | ✅ | — |
| **ParentStudent** | — | parentId, studentId, relationship, isPrimary @@unique([parentId, studentId]) | createdAt | — |
| **ClassLevel** | ✅ | name, code, level (SchoolLevel), sequence @@unique([schoolId, code]) | ✅ | — |
| **Class** | ✅ | classLevelId, name, capacity?, mainTeacherId? @@unique([schoolId, classLevelId, name]) | ✅ | deletedAt |
| **Subject** | ✅ | name, code, category?, coefficient, isActive @@unique([schoolId, code]) | ✅ | deletedAt |
| **ClassSubject** | (via Class) | classId, subjectId, teacherId?, coefficient, weeklyHours? @@unique([classId, subjectId]) | ✅ | — |
| **Enrollment** | (via Class) | studentId, classId, academicYearId, status @@index([studentId, academicYearId]) | ✅ | deletedAt |
| **EvaluationType** | ✅ | name, code, weight, maxCount?, isActive @@unique([schoolId, code]) | ✅ | — |
| **Evaluation** | (via ClassSubject) | classSubjectId, periodId, typeId, title?, date, maxGrade, coefficient | ✅ | — |
| **Grade** | (via Evaluation) | evaluationId, studentId, value?, isAbsent, isExcused, comment? @@unique([evaluationId, studentId]) | ✅ | deletedAt |
| **Schedule** | (via Class) | classId, classSubjectId?, dayOfWeek, startTime, endTime, room? | ✅ | — |
| **Fee** | ✅ | academicYearId?, name, description?, amount, classLevelCode?, dueDate?, isRequired, isActive | ✅ | deletedAt |
| **Payment** | (via Student) | studentId, feeId, amount, method, reference? @unique, paidAt?, status, receivedBy?, reconciledBy? | ✅ | deletedAt |
| **PaymentPlan** | (via Student) | studentId, feeId, totalAmount, installments, paidAmount, status | ✅ | — |
| **InstallmentPayment** | (via PaymentPlan) | paymentPlanId, amount, dueDate, paidAt?, status | ✅ | — |
| **Scholarship** | (via Student) | studentId, name, type, amount, percentage?, startDate, endDate?, isActive | ✅ | — |
| **Attendance** | (via Class) | studentId, classId, date, timeSlot?, status, reason?, justificationDocument?, recordedById? @@unique([studentId, classId, date, timeSlot]) | ✅ | — |
| **Homework** | (via ClassSubject) | classSubjectId, title, description, dueDate, maxGrade?, coefficient, attachments[], isPublished, createdById? | ✅ | deletedAt |
| **HomeworkSubmission** | (via Homework) | homeworkId, studentId, content?, attachments[], grade?, feedback?, gradedById? @@unique([homeworkId, studentId]) | ✅ | — |
| **Message** | — | senderId, recipientId, subject, content, parentId?, isRead, isArchived, deletedBySender, deletedByRecipient | ✅ | deletedAt |
| **Notification** | — | userId, type, title, message, link?, isRead | createdAt | — |
| **AuditLog** | schoolId? | userId, action, entity, entityId?, oldValues?, newValues?, ipAddress?, userAgent? | createdAt | — |
| **Resource** | ✅ | title, description?, type, category?, subjectId?, classLevelId?, fileUrl, fileType, fileSize?, isPublic, uploadedById?, downloads | ✅ | deletedAt |
| **Announcement** | ✅ | title, content, type, priority, targetRoles[], isPublished, publishedAt?, expiresAt?, authorId? | ✅ | deletedAt |
| **Certificate** | (via Student) | studentId, type, academicYearId?, reason?, issuedById?, validUntil?, certificateNumber @unique, pdfUrl? | createdAt | — |
| **Appointment** | (via Teacher/Parent/Student) | teacherId, parentId, studentId, scheduledAt, duration, type, status, meetingLink?, createdById? | ✅ | — |
| **TeacherAvailability** | (via Teacher) | teacherId, dayOfWeek, startTime, endTime, isActive | ✅ | — |
| **DataConsent** | — | userId, consentType, isGranted, grantedAt?, revokedAt? @@unique([userId, consentType]) | ✅ | — |
| **DataRetentionPolicy** | ✅ | dataType, retentionPeriod, isActive @@unique([schoolId, dataType]) | ✅ | — |
| **DataAccessRequest** | — | userId, requestType, status, requestedAt, completedAt?, downloadUrl?, processedBy? | ✅ | — |
| **BehaviorIncident** | (via Student) | studentId, reportedById?, incidentType, severity, date, location?, description, actionTaken?, isResolved | ✅ | — |
| **Sanction** | (via Incident) | incidentId, type, description?, startDate, endDate?, isServed, assignedById? | ✅ | — |
| **MedicalRecord** | (via Student) | studentId @unique, bloodType?, medicalHistory?, medications[], conditions[], notes? | ✅ | — |
| **Allergy** | (via MedicalRecord) | medicalRecordId, allergen, severity, reaction?, treatment? | ✅ | — |
| **Vaccination** | (via MedicalRecord) | medicalRecordId, vaccineName, dateGiven, nextDueDate?, administeredBy?, batchNumber? | ✅ | — |
| **EmergencyContact** | (via MedicalRecord) | medicalRecordId, name, relationship, phone, alternatePhone?, isPrimary | ✅ | — |
| **SchoolEvent** | ✅ | title, description?, type, startDate, endDate?, location?, maxParticipants?, fee?, requiresPermission, isPublished, createdById? | ✅ | — |
| **EventParticipation** | (via Event) | eventId, studentId, status, permissionGiven, paymentStatus? @@unique([eventId, studentId]) | ✅ | — |
| **ExamTemplate** | (via ClassSubject) | classSubjectId, title, description?, duration, totalPoints, passingScore, isPublished, createdById? | ✅ | — |
| **Question** | (via ExamTemplate) | examTemplateId, type, question, points, order, options[], correctAnswer?, explanation? | ✅ | — |
| **ExamSession** | (via ExamTemplate) | examTemplateId, studentId, attempt, startedAt, submittedAt?, timeSpent?, score?, totalPoints, isPassed? @@unique([examTemplateId, studentId, attempt]) | ✅ | — |
| **ExamAnswer** | (via ExamSession) | examSessionId, questionId, answer?, isCorrect?, pointsEarned @@unique([examSessionId, questionId]) | createdAt | — |
| **Course** | (via ClassSubject) | classSubjectId, title, description?, thumbnail?, isPublished, createdById? | ✅ | — |
| **CourseModule** | (via Course) | courseId, title, description?, order | ✅ | — |
| **Lesson** | (via Module) | moduleId, title, content, type, videoUrl?, fileUrl?, duration?, order | ✅ | — |
| **CourseEnrollment** | (via Course) | courseId, studentId, progress, completedAt? @@unique([courseId, studentId]) | ✅ | — |
| **LessonCompletion** | (via Lesson) | lessonId, studentId, completedAt @@unique([lessonId, studentId]) | — | — |
| **SchoolHoliday** | ✅ | academicYearId, name, type, startDate, endDate | ✅ | — |
| **PublicHoliday** | schoolId? | name, date, type, isRecurring | ✅ | — |
| **SchoolCalendarEvent** | ✅ | academicYearId, name, type, startDate, endDate?, isAllDay, isPublic, targetRoles[] | ✅ | — |
| **StudentOrientation** | (via Student) | studentId, academicYearId, classLevelId, status @@unique([studentId, academicYearId]) | ✅ | — |
| **OrientationRecommendation** | (via Orientation) | orientationId, recommendedSeries, rank, score, justification, strengths[], warnings[], isValidated, validatedById? | ✅ | — |
| **SubjectGroupAnalysis** | (via Orientation) | orientationId, subjectGroup, averageScore, trend, consistency, gradesCount @@unique([orientationId, subjectGroup]) | createdAt | — |
| **StudentAnalytics** | (via Student) | studentId, periodId, academicYearId, generalAverage?, classRank?, classSize?, performanceLevel?, progressionRate?, consistencyRate?, riskLevel, riskFactors[] @@unique([studentId, periodId]) | ✅ | — |
| **SubjectPerformance** | (via Analytics) | analyticsId, subjectId, average?, gradesCount, minGrade?, maxGrade?, standardDev?, isStrength, isWeakness, trend?, progressionRate? @@unique([analyticsId, subjectId]) | createdAt | — |
| **GradeHistory** | (via Student) | studentId, subjectId?, periodId, academicYearId, average, rank?, classSize? @@unique([studentId, subjectId, periodId]) | ✅ | — |
| **SubjectCategory** | schoolId? | name, code, description?, color?, icon?, order @@unique([schoolId, code]) | ✅ | isActive |
| **ConfigOption** | schoolId? | category, code, label, description?, order, metadata? @@unique([schoolId, category, code]) | ✅ | isActive |
| **ImportTemplate** | ✅ | name, type, mappings (Json), settings?, isDefault, createdById @@unique([schoolId, name, type]) | ✅ | — |
| **CanteenMenu** | ✅ | date, weekNumber?, starterName?, mainCourse, sideDish?, dessert?, vegetarian, allergens[], priceStudent, priceStaff?, isPublished @@unique([schoolId, date]) | ✅ | — |
| **MealTicket** | ✅ | userId, qrCode @unique, balance, usedAt?, expiresAt?, isUsed, purchasedAt, paymentId? | ✅ | deletedAt |
| **UserAchievement** | — | userId, achievementId, unlockedAt @@unique([userId, achievementId]) | — | — |
| **Leaderboard** | ✅ | userId, points, rank?, period? @@unique([schoolId, userId, period]) | updatedAt | — |
| **Book** | ✅ | title, author, isbn?, category?, description?, quantity, available, location? | ✅ | — |
| **BorrowingRecord** | (via Book) | bookId, studentId, borrowedAt, dueDate, returnedAt?, fine?, isPending | ✅ | — |

### 1.2 Enums complets (37 enums)

| Enum | Valeurs |
|------|---------|
| **SiteType** | MAIN, ANNEXE |
| **SchoolType** | PUBLIC, PRIVATE, RELIGIOUS, INTERNATIONAL |
| **SchoolLevel** | PRIMARY, SECONDARY_COLLEGE, SECONDARY_LYCEE, MIXED |
| **PeriodType** | TRIMESTER, SEMESTER, HYBRID |
| **UserRole** | SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT, ACCOUNTANT, STAFF |
| **TeacherAssignmentStatus** | ACTIVE, INACTIVE, ARCHIVED |
| **AcademicYearStatus** | PLANNING, ACTIVE, ARCHIVED, CLOSED |
| **Gender** | MALE, FEMALE |
| **EnrollmentStatus** | ACTIVE, TRANSFERRED, GRADUATED, DROPPED, SUSPENDED |
| **PaymentMethod** | CASH, MOBILE_MONEY_MTN, MOBILE_MONEY_MOOV, BANK_TRANSFER, CHECK, OTHER |
| **PaymentStatus** | PENDING, VERIFIED, RECONCILED, CANCELLED |
| **NotificationType** | INFO, SUCCESS, WARNING, ERROR, GRADE, PAYMENT, BULLETIN, ENROLLMENT, SYSTEM, MESSAGE, ATTENDANCE |
| **AttendanceStatus** | PRESENT, ABSENT, LATE, EXCUSED |
| **ResourceType** | LESSON, EXERCISE, EXAM, CORRECTION, DOCUMENT, VIDEO, AUDIO, OTHER |
| **AnnouncementType** | GENERAL, ACADEMIC, EVENT, URGENT, MAINTENANCE, HOLIDAY |
| **AnnouncementPriority** | LOW, NORMAL, HIGH, URGENT |
| **CertificateType** | ENROLLMENT, ATTENDANCE, CONDUCT, SUCCESS, CUSTOM |
| **AppointmentType** | IN_PERSON, VIDEO_CALL, PHONE_CALL |
| **AppointmentStatus** | PENDING, CONFIRMED, COMPLETED, CANCELED, NO_SHOW |
| **DataAccessType** | EXPORT, RECTIFICATION, DELETION, PORTABILITY |
| **DataAccessStatus** | PENDING, IN_PROGRESS, COMPLETED, REJECTED |
| **IncidentType** | LATE, ABSENCE_UNEXCUSED, DISRESPECT, DISRUPTION, CHEATING, BULLYING, VIOLENCE, VANDALISM, THEFT, SUBSTANCE, INAPPROPRIATE_LANGUAGE, DRESS_CODE, TECHNOLOGY_MISUSE, OTHER |
| **IncidentSeverity** | LOW, MEDIUM, HIGH, CRITICAL |
| **SanctionType** | WARNING, DETENTION, SUSPENSION, EXPULSION, COMMUNITY_SERVICE, LOSS_OF_PRIVILEGE, PARENT_CONFERENCE, COUNSELING, OTHER |
| **EventType** | GENERAL, SPORTS, CULTURAL, ACADEMIC, FIELD_TRIP, ASSEMBLY, PARENT_MEETING, GRADUATION, COMPETITION, WORKSHOP |
| **EventParticipationStatus** | REGISTERED, CONFIRMED, ATTENDED, ABSENT, CANCELED |
| **QuestionType** | MCQ, TRUE_FALSE, SHORT_ANSWER, ESSAY, FILL_BLANK |
| **LessonType** | TEXT, VIDEO, PDF, QUIZ, ASSIGNMENT |
| **HolidayType** | CHRISTMAS, NEW_YEAR, EASTER, SUMMER, FEBRUARY, SPRING, TOUSSAINT, OTHER |
| **PublicHolidayType** | NATIONAL, RELIGIOUS, INTERNATIONAL, LOCAL |
| **CalendarEventType** | PRE_RENTREE, RENTREE, FIN_TRIMESTRE, FIN_SEMESTRE, CONSEIL_CLASSE, REUNION_PARENTS, EXAMEN, COMPOSITION, REMISE_BULLETINS, CEREMONIE, JOURNEE_PEDAGOGIQUE, FORMATION, FIN_ANNEE, OTHER |
| **OrientationStatus** | PENDING, ANALYZED, RECOMMENDED, VALIDATED, ACCEPTED, REJECTED |
| **RecommendedSeries** | SERIE_A1, SERIE_A2, SERIE_B, SERIE_C, SERIE_D, SERIE_E, SERIE_F1, SERIE_F2, SERIE_F3, SERIE_F4, SERIE_G1, SERIE_G2, SERIE_G3, STI, STA, EFS, MMV, TOUR, HR, FORMATION_PRO, APPRENTISSAGE |
| **SubjectGroup** | LITTERAIRE, SCIENTIFIQUE, ECONOMIQUE, TECHNIQUE, LANGUES, ARTS, SPORT |
| **PerformanceTrend** | STRONG_INCREASE, INCREASE, STABLE, DECREASE, STRONG_DECREASE |
| **PerformanceLevel** | EXCELLENT, VERY_GOOD, GOOD, AVERAGE, INSUFFICIENT, WEAK |
| **RiskLevel** | NONE, LOW, MEDIUM, HIGH, CRITICAL |
| **ProfessionCategory** | AGRICULTURE, ARTISANAT, COMMERCE, EDUCATION, SANTE, FONCTION_PUBLIQUE, LIBERAL, TECHNIQUE, SERVICE, SANS_EMPLOI, AUTRE |
| **ImportType** | STUDENTS, TEACHERS, CLASSES, PARENTS, SUBJECTS |
| **PaymentPlanStatus** | ACTIVE, COMPLETED, CANCELLED, OVERDUE |
| **InstallmentStatus** | PENDING, PAID, OVERDUE, CANCELLED |
| **SubscriptionStatus** | TRIAL, ACTIVE, PAST_DUE, CANCELED |
| **ScholarshipType** | MERIT, NEED_BASED, ATHLETIC, PARTIAL, FULL, OTHER |

### 1.3 Graphe relationnel

```
                     ┌──────────────────┐
                     │  Organization    │
                     └────────┬─────────┘
                              │ 1-N
                     ┌────────▼─────────┐
                     │  OrgMembership   │◄────── User
                     └──────────────────┘
                              
    SubscriptionPlan ──1-N──► School ◄──self-ref (parent/child)
                              │
          ┌───────────────────┼───────────────────────────────────────┐
          │                   │                                       │
    AcademicConfig    AcademicYear ──1-N──► Period                   │
          │                   │              │                        │
          │           Enrollment    ◄────── Class ──1-N──► Schedule  │
          │           Fee ──1-N──► Payment   │                       │
          │                   │    ◄── PaymentPlan ──► Installment   │
          │                   │                                       │
    ClassLevel ──1-N──► Class ──1-N──► ClassSubject ──► Teacher      │
                              │              │                        │
                              │    ┌─────────┴──────────┐            │
                              │    │                     │            │
                         Evaluation    Course ──► Module ──► Lesson  │
                              │         │                  │          │
                           Grade   CourseEnrollment  LessonCompletion│
                                                                      │
    User ──1-1──► StudentProfile ──► Enrollment                      │
         ──1-1──► TeacherProfile ──► TeacherSchoolAssignment         │
         ──1-1──► ParentProfile  ──► ParentStudent                   │
                                                                      │
    StudentProfile ──► Attendance, BehaviorIncident ──► Sanction     │
                   ──► MedicalRecord ──► Allergy, Vaccination, EmergencyContact
                   ──► StudentAnalytics ──► SubjectPerformance       │
                   ──► GradeHistory                                   │
                   ──► StudentOrientation ──► OrientationRecommendation
                   │                     ──► SubjectGroupAnalysis     │
                   ──► Scholarship, Certificate, BorrowingRecord     │
                   ──► ExamSession ──► ExamAnswer                    │
                   ──► EventParticipation                            │
                   ──► HomeworkSubmission                             │
                                                                      │
    School ──1-N──► Announcement, Resource, SchoolEvent, Book        │
                ──► CanteenMenu, MealTicket, SchoolHoliday           │
                ──► PublicHoliday, SchoolCalendarEvent               │
                ──► EvaluationType, ConfigOption, ImportTemplate      │
                ──► SubjectCategory, Leaderboard                     │
                                                                      │
    User ──1-N──► Message (sender/recipient), Notification           │
             ──► AuditLog, DataConsent, DataAccessRequest            │
             ──► Achievement ──► UserAchievement                     │
```

**Hub models** (most connected): User, School, StudentProfile, Class, ClassSubject, AcademicYear
**Leaf models**: Allergy, Vaccination, EmergencyContact, ExamAnswer, LessonCompletion, SubjectGroupAnalysis

---

## 2. ROUTES API

### 2.1 Organisation par domaine (~191 fichiers route.ts)

#### AUTHENTIFICATION (9 routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | Mixed | NextAuth handler, rate-limited login |
| `/api/auth/register` | POST | ❌ | DEPRECATED (410) |
| `/api/auth/initial-setup` | GET, POST | ❌ | First-time SUPER_ADMIN creation |
| `/api/auth/forgot-password` | POST | ❌ | Password reset email |
| `/api/auth/reset-password` | GET, POST | ❌ | Validate/use reset token |
| `/api/auth/verify-email` | GET, POST | Mixed | Email verification |
| `/api/auth/first-login` | GET, POST | ❌ | Mandatory password change |
| `/api/auth/mfa/setup` | POST | ✅ | MFA generate/enable/disable |
| `/api/root/auth` | POST | ✅ SUPER_ADMIN | Root authentication |
| `/api/root/session` | GET | ✅ SUPER_ADMIN | Check root session |

#### SUPER_ADMIN — Plan Global (11 routes)
| Route | Méthodes | Description |
|-------|----------|-------------|
| `/api/root/users` | GET, PATCH | List/update admin users |
| `/api/root/analytics` | GET | Global analytics |
| `/api/root/monitoring` | GET | System monitoring |
| `/api/root/logs` | GET | System logs |
| `/api/root/plans` | GET, POST | Subscription plans |
| `/api/root/finance/summary` | GET | Global finance summary |
| `/api/root/system/maintenance` | POST | Maintenance mode |
| `/api/root/data-requests` | GET | GDPR data requests |
| `/api/root/dashboard` | GET | Root dashboard |
| `/api/root/organizations` | GET, POST | Organization management |

#### CONFIGURATION (12 routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/academic-years` | GET, POST | ✅ ADMIN | Academic years |
| `/api/periods` | GET, POST | ✅ ADMIN | Grading periods |
| `/api/periods/[id]` | GET, PATCH, DELETE | ✅ ADMIN | Period CRUD |
| `/api/class-levels` | GET, POST | ✅ ADMIN | Grade levels |
| `/api/subjects` | GET, POST | ✅ ADMIN | Subject management |
| `/api/evaluation-types` | GET, POST | ✅ ADMIN | Evaluation types |
| `/api/evaluation-types/[id]` | GET, PATCH, DELETE | ✅ ADMIN | Type CRUD |
| `/api/class-subjects` | GET, POST | ✅ ADMIN | Class-subject assignments |
| `/api/calendar/events` | GET, POST | ✅ | Calendar events |
| `/api/calendar/holidays` | GET, POST | ✅ ADMIN | School holidays |
| `/api/calendar/public-holidays` | GET | ✅ | Public holidays |
| `/api/reference/*` | GET | ✅ | Cities, nationalities, professions, config |

#### UTILISATEURS (15+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/students` | GET, POST | ✅ | Students CRUD |
| `/api/students/[id]` | GET, PATCH, DELETE | ✅ | Student detail |
| `/api/students/bulk-import` | POST | ✅ ADMIN | CSV import |
| `/api/teachers` | GET, POST | ✅ | Teachers CRUD |
| `/api/teachers/[id]` | GET, PATCH, DELETE | ✅ | Teacher detail |
| `/api/teachers/[id]/availability` | GET, POST | ✅ | Availability |
| `/api/parents/dashboard` | GET | ✅ PARENT | Parent dashboard |
| `/api/users/[id]` | GET, PATCH | ✅ ADMIN | Admin user mgmt |
| `/api/users/[id]/delete` | DELETE | ✅ | Soft-delete user |
| `/api/users/invite` | POST | ✅ ADMIN | Invite user |
| `/api/user/profile` | GET, PATCH | ✅ | Own profile |
| `/api/user/data` | GET, DELETE | ✅ | GDPR data export/delete |

#### PÉDAGOGIE (30+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/classes` | GET, POST | ✅ | Classes CRUD |
| `/api/classes/[id]` | GET, PATCH, DELETE | ✅ | Class detail |
| `/api/schedules` | GET | ✅ | View schedules |
| `/api/attendance` | GET, POST | ✅ | Attendance records |
| `/api/attendance/bulk` | POST | ✅ | Bulk attendance |
| `/api/attendance/justifications` | GET, POST | ✅ | Justifications |
| `/api/attendance/stats` | GET | ✅ | Attendance stats |
| `/api/attendance/alerts` | GET | ✅ | Low attendance alerts |
| `/api/courses` | GET, POST | ✅ | Course CRUD |
| `/api/courses/[id]` | GET, PATCH | ✅ | Course detail |
| `/api/courses/[id]/enroll` | POST | ✅ STUDENT | Enroll |
| `/api/courses/progress` | GET | ✅ | Progress tracking |
| `/api/lessons/[id]/complete` | POST | ✅ STUDENT | Mark complete |
| `/api/grades` | GET | ✅ | List grades |
| `/api/grades/[id]` | GET, PATCH, DELETE | ✅ | Grade CRUD |
| `/api/grades/batch` | POST | ✅ TEACHER | Bulk upsert grades |
| `/api/grades/report-cards` | GET | ✅ | Report cards (bulletins) |
| `/api/grades/cahier` | GET | ✅ | Grade book |
| `/api/grades/statistics` | GET | ✅ | Grade statistics |
| `/api/evaluations` | GET, POST | ✅ | Evaluation CRUD |
| `/api/homework` | GET, POST | ✅ | Homework CRUD |
| `/api/homework/[id]` | GET, PATCH, DELETE | ✅ | Homework detail |
| `/api/homework/submissions/[id]/grade` | POST | ✅ TEACHER | Grade submission |
| `/api/exams` | GET, POST | ✅ | Exam templates |
| `/api/exams/[id]` | GET | ✅ | Exam detail |
| `/api/exams/[id]/start` | POST | ✅ STUDENT | Start exam |
| `/api/exams/[id]/submit` | POST | ✅ STUDENT | Submit exam |

#### VIE SCOLAIRE (15+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/incidents` | GET, POST | ✅ | Behavior incidents |
| `/api/incidents/[id]` | GET, PATCH, DELETE | ✅ | Incident detail |
| `/api/incidents/[id]/sanctions` | GET, POST | ✅ ADMIN | Sanctions |
| `/api/medical-records` | GET, POST, PUT | ✅ | Medical records |
| `/api/medical-records/[id]/allergies` | GET, POST | ✅ | Allergies |
| `/api/medical-records/[id]/vaccinations` | GET, POST | ✅ | Vaccinations |
| `/api/medical-records/[id]/emergency-contacts` | GET, POST | ✅ | Contacts |
| `/api/canteen/menu` | GET, POST | ✅ | Canteen menus |
| `/api/orientation/*` | GET, POST | ✅ | Orientation |
| `/api/gamification/achievements` | GET | ✅ | Achievements |
| `/api/gamification/achievements/award` | POST | ✅ TEACHER | Award achievement |
| `/api/gamification/leaderboard` | GET | ✅ | Leaderboard |
| `/api/library/books` | GET, POST | ✅ | Library books |
| `/api/library/borrowings` | GET, POST | ✅ | Borrowings |

#### FINANCES (15+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/fees` | GET, POST | ✅ ADMIN | Fee management |
| `/api/payments` | GET, POST | ✅ | Payments |
| `/api/payments/[id]` | GET | ✅ | Payment detail |
| `/api/payments/[id]/invoice` | GET | ✅ | Generate invoice |
| `/api/payments/initiate` | POST | ✅ STUDENT | Start payment |
| `/api/payments/webhook` | POST | ❌ | Payment gateway webhook |
| `/api/payments/reconcile` | POST | ✅ ACCOUNTANT | Reconcile |
| `/api/payments/cash` | POST | ✅ ACCOUNTANT | Cash payment |
| `/api/payment-plans` | GET, POST | ✅ | Payment plans |
| `/api/payment-plans/[id]` | GET, PATCH, DELETE | ✅ | Plan detail |
| `/api/payment-plans/[id]/installments/[id]/pay` | POST | ✅ | Pay installment |
| `/api/finance/dashboard` | GET | ✅ ADMIN | Finance dashboard |
| `/api/finance/stats` | GET | ✅ ADMIN | Finance stats |
| `/api/finance/export` | GET | ✅ ADMIN | Export data |
| `/api/finance/my-payments` | GET | ✅ STUDENT/PARENT | Own payments |
| `/api/scholarships` | GET, POST | ✅ ADMIN | Scholarships |

#### COMMUNICATION (10+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/messages` | GET, POST | ✅ | Messages inbox/send |
| `/api/messages/[id]` | GET, PATCH, DELETE | ✅ | Message detail |
| `/api/messages/broadcast` | POST | ✅ ADMIN | Broadcast |
| `/api/notifications` | GET, POST, PATCH | ✅ | Notifications |
| `/api/notifications/[id]` | GET, PATCH | ✅ | Single notification |
| `/api/notifications/stream` | GET | ✅ | SSE real-time stream |
| `/api/notifications/sms` | POST | ✅ ADMIN | SMS notifications |
| `/api/announcements` | GET, POST | ✅ | Announcements |
| `/api/appointments` | GET, POST | ✅ | Appointments |
| `/api/appointments/[id]` | GET, PATCH, DELETE | ✅ | Appointment detail |
| `/api/events` | GET, POST | ✅ | School events |

#### ANALYTIQUE (10+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/analytics` | GET | ✅ ADMIN | Main analytics |
| `/api/analytics/dashboard` | GET | ✅ ADMIN | Dashboard analytics |
| `/api/analytics/sync-all` | POST | ✅ ADMIN | Full sync |
| `/api/analytics/class/[classId]` | GET | ✅ | Class analytics |
| `/api/analytics/class/[classId]/subject/[subjectId]` | GET | ✅ | Class-subject |
| `/api/analytics/class-comparison` | GET | ✅ | Compare classes |
| `/api/analytics/period-comparison` | GET | ✅ | Compare periods |
| `/api/analytics/students` | GET | ✅ | Student analytics |
| `/api/analytics/school/overview` | GET | ✅ | School overview |
| `/api/analytics/organization/overview` | GET | ✅ SUPER_ADMIN | Org overview |
| `/api/performance/dashboard` | GET | ✅ | Performance metrics |

#### AI & PRÉDICTIONS (8 routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/ai/v2` | POST, GET | ✅ | Unified AI API |
| `/api/ai/v2/chat` | POST | ✅ | AI Chat |
| `/api/ai/analyze` | POST | ✅ TEACHER | Analyze student |
| `/api/ai/analyze-risk` | POST | ✅ ADMIN | Risk detection |
| `/api/ai/predict-failure` | POST | ✅ TEACHER | Failure prediction |
| `/api/ai/predictions/student` | GET | ✅ | Student predictions |
| `/api/ai/predictions/class` | GET | ✅ TEACHER | Class predictions |
| `/api/orientation/generate-ai` | POST | ✅ | AI orientation |

#### ADMINISTRATION & SYSTÈME (15+ routes)
| Route | Méthodes | Auth | Description |
|-------|----------|------|-------------|
| `/api/health` | GET | ❌ | Health check |
| `/api/system/health` | GET | ✅ ADMIN | System health |
| `/api/system/activity` | GET | ✅ ADMIN | Activity log |
| `/api/system/backup` | POST | ✅ ADMIN | Database backup |
| `/api/system/retention` | GET, POST | ✅ ADMIN | Data retention |
| `/api/audit-logs` | GET | ✅ ADMIN | Audit trail |
| `/api/audit-logs/export` | GET | ✅ ADMIN | Export audit |
| `/api/compliance/dashboard` | GET | ✅ ADMIN | Compliance overview |
| `/api/compliance/data-requests` | GET, POST | ✅ | Data requests |
| `/api/import/*` | POST | ✅ ADMIN | Data import (students, teachers, classes, parents, schedules) |
| `/api/resources` | GET, POST | ✅ | Educational resources |
| `/api/certificates/[id]` | GET | ✅ | Certificates |
| `/api/documents/generate` | POST | ✅ ADMIN | Generate documents |

---

## 3. AUTHENTIFICATION ET RBAC

### 3.1 Rôles (8)

| Rôle | Hiérarchie | Description FR |
|------|------------|----------------|
| SUPER_ADMIN | 100 | Administrateur système global |
| SCHOOL_ADMIN | 80 | Administrateur d'établissement |
| DIRECTOR | 80 | Directeur d'établissement |
| ACCOUNTANT | 60 | Comptable |
| STAFF | 55 | Personnel administratif |
| TEACHER | 50 | Enseignant |
| PARENT | 20 | Parent d'élève |
| STUDENT | 10 | Élève |

### 3.2 Permissions (100+)

Organisées par ressource : SCHOOL, USER, STUDENT, TEACHER, CLASS, SUBJECT, GRADE, EVALUATION, SCHEDULE, FEE, FINANCE, PAYMENT, REPORT, STATISTICS, NOTIFICATION, ACADEMIC_YEAR, STUDENT_PROMOTION, CALENDAR, HOLIDAY, ORIENTATION, ANALYTICS, AI_PREDICT, ATTENDANCE, INCIDENT, MEDICAL, CANTEEN, LIBRARY, SYSTEM

**Points clés :**
- SUPER_ADMIN : toutes les permissions
- SCHOOL_ADMIN : toutes les permissions école + DELETE sur certaines entités
- DIRECTOR : lecture/création/mise à jour (pas de DELETE)
- TEACHER : CRUD sur notes + évaluations, lecture sur le reste
- STUDENT : lecture propre (READ_OWN)
- PARENT : lecture enfants (READ_CHILDREN)
- ACCOUNTANT : CRUD finances uniquement
- STAFF : lecture + création sur présences/incidents

### 3.3 Isolation tenant

1. **Session** : `accessibleSchoolIds[]` + `schoolId` (contexte actif)
2. **createApiHandler** : valide schoolId query param vs accessibleSchoolIds
3. **getSchoolFilter()** : retourne `{ schoolId }` pour les requêtes Prisma
4. **SUPER_ADMIN** : bypass (filtre vide `{}`)

### 3.4 Mécanismes de sécurité

- Rate limiting : 5 login / 15min, 3 forgot-password / 15min, 100 API / 1min
- Account lockout : 30 min après 5 échecs
- 2FA : TOTP + backup codes (AES-256-GCM)
- JWT invalidation : cache 30s, vérifie password/role/deactivation changes
- Audit logging : toutes les mutations

---

## 4. SERVICES ET LOGIQUE MÉTIER

### 4.1 Calcul des moyennes (`src/lib/utils/grades.ts` + `src/lib/benin/grade-service.ts`)
- Moyenne pondérée par coefficient de matière
- Normalisation sur 20 points
- Mentions : Échec (0-9.99), Passable (10-11.99), Assez Bien (12-13.99), Bien (14-15.99), Très Bien (16-17.99), Excellent (18-20)

### 4.2 Risque et prédiction (`src/lib/services/ai-predictive/`)
- **predict-failure.ts** : Score de risque composite — Academic (35%), Attendance (25%), Behavior (20%), Homework (15%), Weak Subjects (5%)
- **predict-grade.ts** : Ensemble learning (régression linéaire, polynomiale, EMA, baseline)
- **predict-behavior.ts** : Fréquence + sévérité des incidents
- **predict-student.ts** : Orchestrateur combinant tous les prédicteurs + recommandations d'orientation

### 4.3 Analytics (`src/lib/services/student-analytics.ts` + `analytics-sync.ts`)
- Génération de snapshots per-étudiant per-période
- Synchronisation automatique après changement de note/présence/incident
- Persistance dans StudentAnalytics + SubjectPerformance + GradeHistory

### 4.4 Notifications (`src/lib/services/notification.service.ts`)
- Redis pub/sub pour temps réel
- SSE stream à `/api/notifications/stream`
- Types spécialisés : notifyNewGrade, notifyPayment, notifyBulletin, notifyEnrollment
- Nettoyage auto : notifications lues > 30 jours

### 4.5 Orientation (`src/lib/services/orientation.ts`)
- Classification des matières en 7 groupes (Littéraire, Scientifique, Économique, etc.)
- Scoring des séries : général (20%) + groupe primaire (40%) + secondaires (15%) + bonus (10%)
- Top 3 recommandations avec justifications

### 4.6 Finance (`src/lib/finance/helpers.ts`)
- Plans de paiement avec échéancier
- Réconciliation atomique via ledger
- Détection des impayés en retard

---

## 5. FRONTEND EXISTANT

### 5.1 Pages existantes (~100 page.tsx)

**Publiques** : `/`, `/privacy`, `/terms`, `/explorer`, `/disabled`
**Auth** : `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/setup`, `/mfa-setup`, `/first-login`

**Dashboard — implémentées avec API réelle :**
- `/dashboard` (vue d'ensemble role-based)
- `/dashboard/students`, `/students/[id]`, `/students/new`
- `/dashboard/teachers`, `/teachers/[id]`
- `/dashboard/parents`
- `/dashboard/classes`, `/classes/[id]`, `/classes/new`
- `/dashboard/courses`, `/courses/[id]`, `/courses/[id]/lessons/[lessonId]`
- `/dashboard/attendance`
- `/dashboard/grades`, `/grades/bulletins`, `/grades/entry`, `/grades/cahier`
- `/dashboard/exams`, `/exams/[id]`, `/exams/new`, `/exams/[id]/take`
- `/dashboard/schedule`, `/schedule/new`
- `/dashboard/finance`, `/finance/fees`, `/finance/payments/new`, `/finance/bulk-invoice`, `/finance/reports`, `/finance/reconciliation`, `/finance/export`
- `/dashboard/messages`
- `/dashboard/announcements`, `/dashboard/appointments`
- `/dashboard/incidents`, `/dashboard/medical`, `/dashboard/canteen`
- `/dashboard/orientation`, `/dashboard/gamification`
- `/dashboard/calendar`, `/dashboard/events`
- `/dashboard/homework`, `/dashboard/library`, `/dashboard/scholarships`
- `/dashboard/performances`, `/dashboard/documents`
- `/dashboard/notifications`, `/dashboard/resources`
- `/dashboard/analytics`
- `/dashboard/alerts/risks`
- `/dashboard/audit-logs`
- `/dashboard/admin`
- `/dashboard/import`
- `/dashboard/organization`
- `/dashboard/settings/*` (14 sous-pages)
- `/dashboard/root-control/*` (10 sous-pages SUPER_ADMIN)
- `/dashboard/system/*` (info, monitoring, retention)

### 5.2 Sidebar actuelle (4 sections)

```
PILOTAGE
├── Root Console (SUPER_ADMIN): Schools, Plans, Platform Finance, Users, Monitoring
├── Organization (Multi-site managers)
├── Alertes & Risques: Risk Detection, Audit Logs
└── Finances: Fees/Payments, Scholarships

OPÉRATIONS
├── Configuration: Academic Years, Subjects, Rooms, Year Promotion, Import
├── Utilisateurs: Students, Parents, Teachers, Admin Staff
├── Pédagogie: Classes, Schedules, Attendance, Courses, Grades
└── Vie Scolaire: Incidents, Medical, Canteen, Orientation, Gamification

COMMUNICATION
├── Messages, Announcements, Appointments, AI Assistant (Beta)

ADMINISTRATION
└── Security & Access, GDPR, General Settings
```

### 5.3 Composants clés
- **Charts** : 12 composants Recharts (PerformanceBar, SubjectRadar, RiskPie, AttendancePie, TrendLine, ClassRanking, AttendanceGradesScatter, RiskMatrix, CategoryPie, etc.)
- **Analytics** : MultiClassComparison, PeriodComparison, RiskInterventionTab
- **Guards** : PageGuard, RoleActionGuard
- **Layout** : PageHeader, PageCallout, DashboardUI
- **Providers** : SWR, Session, School context

---

## 6. INVENTAIRE DES INCOHÉRENCES

### CATÉGORIE A — Routes API existantes sans page/composant frontend adéquat

| # | Entité | Backend (API) | Frontend manquant/incomplet | Priorité |
|---|--------|---------------|-----------------------------|----------|
| A1 | Bulk grade entry | `POST /api/grades/batch` | Page `/grades/entry` existe mais à vérifier si elle utilise bien batch | Important |
| A2 | Student bulk import | `POST /api/students/bulk-import` | Page `/import` existe — à vérifier la couverture | Mineur |
| A3 | Teacher availability | `GET/POST /api/teachers/[id]/availability` | Pas de UI visible pour gérer les disponibilités | Important |
| A4 | Finance reconciliation | `POST /api/payments/reconcile` | Page `/finance/reconciliation` existe — à vérifier | Mineur |
| A5 | Finance bulk invoice | `POST /api/payments/bulk-invoice` | Page `/finance/bulk-invoice` existe — à vérifier | Mineur |
| A6 | Compliance dashboard | `GET /api/compliance/dashboard` | Page `/settings/compliance` existe — couverture à vérifier | Important |
| A7 | Compliance data requests fulfill | `POST /api/compliance/data-requests/[id]/fulfill` | Admin UI pour traiter les demandes peut manquer | Important |
| A8 | Exam prep | `GET /api/exams/prep` | Pas de page dédiée « préparation examen » | Mineur |
| A9 | Incident statistics | `GET /api/incidents/statistics` | Page incidents existe — stats peut-être pas affichées | Important |
| A10 | AI risk analysis | `POST /api/ai/analyze-risk` | Page alerts/risks existe — intégration IA à vérifier | Important |
| A11 | Class-subject analytics | `GET /api/analytics/class/[classId]/subject/[subjectId]` | Drill-down subject analytics probablement manquant | Important |
| A12 | Organization overview | `GET /api/analytics/organization/overview` | Page organization existe — analytics à vérifier | Mineur |
| A13 | Payments cash | `POST /api/payments/cash` | UI pour enregistrement paiement cash à vérifier | Important |
| A14 | SMS notifications | `POST /api/notifications/sms` | Page `/notifications/sms` existe — à vérifier | Mineur |
| A15 | Orientation batch-analyze | `POST /api/orientation/batch-analyze` | Pas de UI batch visible | Mineur |
| A16 | Education reforms config | `GET/POST /api/admin/config/reforms` | Page root-control/reforms existe — à vérifier | Mineur |
| A17 | Curriculum config | `GET/POST /api/admin/curriculum-config` | Pas de page dédiée visible | Important |

### CATÉGORIE B — Pages frontend qui pourraient appeler des routes incorrectes

| # | Page | Problème potentiel | Priorité |
|---|------|--------------------|----------|
| B1 | `/dashboard/finance` | Appelle `/api/finance/summary`, `/api/students/overdue`, `/api/payments/trends` — ces endpoints existent-ils exactement ? | Critique |
| B2 | Various settings pages | Certaines pages de l'audit précédent stockaient en preferences JSON au lieu de vrais modèles — vérifier la cohérence | Important |
| B3 | `/dashboard/library` | Note MEMORY.md : Book/BorrowingRecord utilisent `(prisma as any)` — les modèles existent maintenant dans le schéma, mais le service peut encore utiliser le cast | Important |
| B4 | `/dashboard/settings/rooms` | Note MEMORY.md : pas de modèle Room Prisma — stocké en user preferences | Mineur (fonctionnel) |

### CATÉGORIE C — Modèles Prisma sans route API directe

| # | Modèle | Exposé via | Manque |
|---|--------|-----------|-------|
| C1 | TeacherAvailability | `/api/teachers/[id]/availability` | ✅ Exposé |
| C2 | SubjectCategory | Pas de route dédiée | Route CRUD manquante (Important) |
| C3 | ConfigOption | `/api/reference/config-options` (GET only) | POST/PATCH/DELETE manquants pour admin |
| C4 | DataConsent | Via `/api/user/data` partiellement | Pas de CRUD dédié |
| C5 | DataRetentionPolicy | `/api/system/retention` | ✅ Exposé |
| C6 | SubjectGroupAnalysis | Via orientation service | ✅ Exposé indirectement |
| C7 | SubjectPerformance | Via analytics service | ✅ Exposé indirectement |
| C8 | GradeHistory | Via analytics service | ✅ Exposé indirectement |

### Résumé des priorités

| Priorité | Catégorie A | Catégorie B | Catégorie C | Total |
|----------|-------------|-------------|-------------|-------|
| Critique | 0 | 1 | 0 | **1** |
| Important | 8 | 2 | 1 | **11** |
| Mineur | 9 | 1 | 1 | **11** |
| **Total** | **17** | **4** | **2** | **23** |

---

## SYNTHÈSE PHASE 1

### Statistiques globales

| Métrique | Valeur |
|----------|--------|
| Modèles Prisma | 63 |
| Enums | 37+ |
| Routes API (fichiers route.ts) | ~191 |
| Rôles utilisateur | 8 |
| Permissions | 100+ |
| Pages frontend | ~100 |
| Composants | ~89 fichiers dans 19 répertoires |

### Architecture confirmée
- **Multi-tenant strict** : isolation par schoolId, SUPER_ADMIN bypass
- **RBAC hybride** : rôles + permissions granulaires + hiérarchie
- **Multi-école** : TeacherSchoolAssignment pour enseignants multi-sites
- **Multi-organisation** : OrganizationMembership pour groupes scolaires
- **Analytics pre-calculés** : StudentAnalytics + GradeHistory synchronisés après mutations
- **Temps réel** : SSE + Redis pub/sub pour notifications
- **AI intégrée** : Prédiction d'échec, grades, comportement, orientation
- **Benin-specific** : Curriculum, mentions, séries d'orientation, examens CEP/BEPC/BAC

### Points forts du backend
1. Schéma Prisma très complet et bien structuré
2. RBAC mature avec 100+ permissions
3. Analytics avec sync automatique
4. Pipeline AI prédictif complet
5. Système financier avec plans de paiement et réconciliation

### Points d'attention
1. **B1 (Critique)** : Vérifier que les endpoints appelés par la page finance existent réellement
2. **B3** : Library service devrait être mis à jour pour ne plus utiliser `(prisma as any)`
3. **C2** : SubjectCategory n'a pas de routes CRUD
4. Certaines pages analytics pourraient ne pas exploiter tous les endpoints disponibles
5. La sidebar actuelle est fonctionnelle mais ne suit pas exactement la structure demandée dans le prompt Phase 2
