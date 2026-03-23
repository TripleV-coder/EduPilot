#!/bin/bash
SCHEMA="/home/triple-v/Documents/Projets Personnels/edupilot-master/prisma/schema.prisma"

cat > "$SCHEMA" << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

enum SchoolType { PUBLIC PRIVATE RELIGIOUS INTERNATIONAL }
enum SchoolLevel { PRIMARY SECONDARY_COLLEGE SECONDARY_LYCEE MIXED }
enum PeriodType { TRIMESTER SEMESTER HYBRID }
enum UserRole { SUPER_ADMIN SCHOOL_ADMIN DIRECTOR TEACHER STUDENT PARENT ACCOUNTANT }
enum Gender { MALE FEMALE }
enum EnrollmentStatus { ACTIVE TRANSFERRED GRADUATED DROPPED SUSPENDED }
enum PaymentMethod { CASH MOBILE_MONEY_MTN MOBILE_MONEY_MOOV BANK_TRANSFER CHECK OTHER }
enum PaymentStatus { PENDING VERIFIED RECONCILED CANCELLED }
enum NotificationType { INFO SUCCESS WARNING ERROR GRADE PAYMENT BULLETIN ENROLLMENT SYSTEM MESSAGE ATTENDANCE }
enum AttendanceStatus { PRESENT ABSENT LATE EXCUSED }
enum ResourceType { LESSON EXERCISE EXAM CORRECTION DOCUMENT VIDEO AUDIO OTHER }
enum AnnouncementType { GENERAL ACADEMIC EVENT URGENT MAINTENANCE HOLIDAY }
enum AnnouncementPriority { LOW NORMAL HIGH URGENT }
enum CertificateType { ENROLLMENT ATTENDANCE CONDUCT SUCCESS CUSTOM }
enum AppointmentType { IN_PERSON VIDEO_CALL PHONE_CALL }
enum AppointmentStatus { PENDING CONFIRMED COMPLETED CANCELED NO_SHOW }
enum DataAccessType { EXPORT RECTIFICATION DELETION PORTABILITY }
enum DataAccessStatus { PENDING IN_PROGRESS COMPLETED REJECTED }
enum IncidentType { LATE ABSENCE_UNEXCUSED DISRESPECT DISRUPTION CHEATING BULLYING VIOLENCE VANDALISM THEFT SUBSTANCE INAPPROPRIATE_LANGUAGE DRESS_CODE TECHNOLOGY_MISUSE OTHER }
enum IncidentSeverity { LOW MEDIUM HIGH CRITICAL }
enum SanctionType { WARNING DETENTION SUSPENSION EXPULSION COMMUNITY_SERVICE LOSS_OF_PRIVILEGE PARENT_CONFERENCE COUNSELING OTHER }
enum EventType { GENERAL SPORTS CULTURAL ACADEMIC FIELD_TRIP ASSEMBLY PARENT_MEETING GRADUATION COMPETITION WORKSHOP }
enum EventParticipationStatus { REGISTERED CONFIRMED ATTENDED ABSENT CANCELED }
enum QuestionType { MCQ TRUE_FALSE SHORT_ANSWER ESSAY FILL_BLANK }
enum LessonType { TEXT VIDEO PDF QUIZ ASSIGNMENT }
enum HolidayType { CHRISTMAS NEW_YEAR EASTER SUMMER FEBRUARY SPRING TOUSSAINT OTHER }
enum PublicHolidayType { NATIONAL RELIGIOUS INTERNATIONAL LOCAL }
enum CalendarEventType { PRE_RENTREE RENTREE FIN_TRIMESTRE FIN_SEMESTRE CONSEIL_CLASSE REUNION_PARENTS EXAMEN COMPOSITION REMISE_BULLETINS CEREMONIE JOURNEE_PEDAGOGIQUE FORMATION FIN_ANNEE OTHER }
enum OrientationStatus { PENDING ANALYZED RECOMMENDED VALIDATED ACCEPTED REJECTED }
enum RecommendedSeries { SERIE_A SERIE_B SERIE_C SERIE_D SERIE_E SERIE_F1 SERIE_F2 SERIE_F3 SERIE_F4 SERIE_G1 SERIE_G2 SERIE_G3 FORMATION_PRO APPRENTISSAGE }
enum SubjectGroup { LITTERAIRE SCIENTIFIQUE ECONOMIQUE TECHNIQUE LANGUES ARTS SPORT }
enum PerformanceTrend { STRONG_INCREASE INCREASE STABLE DECREASE STRONG_DECREASE }
enum PerformanceLevel { EXCELLENT VERY_GOOD GOOD AVERAGE INSUFFICIENT WEAK }
enum RiskLevel { NONE LOW MEDIUM HIGH CRITICAL }
enum ProfessionCategory { AGRICULTURE ARTISANAT COMMERCE EDUCATION SANTE FONCTION_PUBLIQUE LIBERAL TECHNIQUE SERVICE SANS_EMPLOI AUTRE }
enum ImportType { STUDENTS TEACHERS CLASSES PARENTS SUBJECTS }

// ═══════════════════════════════════════════════════════════════
// CORE MODELS
// ═══════════════════════════════════════════════════════════════

model School {
  id        String      @id @default(cuid())
  name      String
  code      String      @unique
  type      SchoolType  @default(PRIVATE)
  level     SchoolLevel
  address   String?
  city      String?
  phone     String?
  email     String?
  logo      String?
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  academicConfig       AcademicConfig?
  academicYears        AcademicYear[]
  users                User[]
  classLevels          ClassLevel[]
  classes              Class[]
  subjects             Subject[]
  evaluationTypes      EvaluationType[]
  fees                 Fee[]
  resources            Resource[]
  announcements        Announcement[]
  dataRetentionPolicies DataRetentionPolicy[]
  schoolHolidays       SchoolHoliday[]
  publicHolidays       PublicHoliday[]
  schoolCalendarEvents SchoolCalendarEvent[]
  schoolEvents         SchoolEvent[]
  subjectCategories    SubjectCategory[]
  configOptions        ConfigOption[]
  importTemplates      ImportTemplate[]

  @@map("schools")
}

model AcademicConfig {
  id          String     @id @default(cuid())
  schoolId    String     @unique
  periodType  PeriodType @default(TRIMESTER)
  periodsCount Int       @default(3)
  maxGrade    Decimal    @default(20) @db.Decimal(5, 2)
  passingGrade Decimal   @default(10) @db.Decimal(5, 2)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@map("academic_configs")
}

model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  name      String
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  school      School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  periods     Period[]
  enrollments Enrollment[]
  fees        Fee[]
  certificates Certificate[]
  schoolHolidays SchoolHoliday[]
  schoolCalendarEvents SchoolCalendarEvent[]
  studentOrientations StudentOrientation[]
  studentAnalytics StudentAnalytics[]
  gradeHistory GradeHistory[]

  @@unique([schoolId, name])
  @@map("academic_years")
}

model Period {
  id             String     @id @default(cuid())
  academicYearId String
  name           String
  type           PeriodType
  startDate      DateTime
  endDate        DateTime
  sequence       Int
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  academicYear   AcademicYear    @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  evaluations    Evaluation[]
  studentAnalytics StudentAnalytics[]
  gradeHistory   GradeHistory[]

  @@unique([academicYearId, sequence])
  @@map("periods")
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  emailVerified       DateTime?
  password            String
  firstName           String
  lastName            String
  phone               String?
  avatar              String?
  role                UserRole
  isActive            Boolean   @default(true)
  schoolId            String?
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  passwordChangedAt   DateTime?
  roleChangedAt       DateTime?
  isTwoFactorEnabled  Boolean   @default(false)
  twoFactorSecret     String?
  twoFactorBackupCodes String[] @default([])
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  school           School?          @relation(fields: [schoolId], references: [id], onDelete: SetNull)
  accounts         Account[]
  sessions         Session[]
  teacherProfile   TeacherProfile?
  studentProfile   StudentProfile?
  parentProfile    ParentProfile?
  notifications    Notification[]
  auditLogs        AuditLog[]
  firstLoginTokens FirstLoginToken[]
  attendancesRecorded Attendance[] @relation("RecordedBy")
  homeworksCreated Homework[]
  homeworksGraded  HomeworkSubmission[] @relation("GradedBy")
  messagesSent     Message[]        @relation("Sender")
  messagesReceived Message[]        @relation("Recipient")
  resourcesUploaded Resource[]
  announcementsAuthored Announcement[]
  certificatesIssued Certificate[]
  appointmentsCreated Appointment[] @relation("AppointmentCreator")
  dataConsents     DataConsent[]
  dataAccessRequests DataAccessRequest[] @relation("Requester")
  dataAccessProcessed DataAccessRequest[] @relation("Processor")
  behaviorIncidentsReported BehaviorIncident[]
  sanctionsAssigned Sanction[]
  schoolEventsCreated SchoolEvent[]
  examTemplatesCreated ExamTemplate[]
  coursesCreated   Course[]
  orientationRecsValidated OrientationRecommendation[]
  importTemplatesCreated ImportTemplate[]

  @@index([firstName])
  @@index([lastName])
  @@index([schoolId])
  @@index([role])
  @@index([isActive])
  @@index([createdAt])
  @@map("users")
}

model Account {
  id                String @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expires   DateTime
  createdAt DateTime @default(now())

  @@index([email])
  @@map("password_reset_tokens")
}

model FirstLoginToken {
  id           String    @id @default(cuid())
  userId       String
  token        String    @unique
  tempPassword String?
  expiresAt    DateTime
  usedAt       DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@index([expiresAt])
  @@map("first_login_tokens")
}

model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  type      String
  isSecret  Boolean  @default(false)
  updatedBy String?
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@index([key])
  @@map("system_settings")
}

EOF

echo "Part 1 written successfully"
