# ANALYSE APPROFONDIE DU BACKEND & VISION FRONTEND ULTRA-ÉLABORÉ

## EduPilot - Plateforme de Gestion Scolaire Complète

---

# PARTIE 1: ANALYSE APPROFONDIE DU BACKEND

## 1.1 Synthèse du Schéma de Données (Prisma)

### Modèles Principaux (54 modèles)

| Module | Modèles | Relations Clés |
|--------|---------|----------------|
| **Multi-Tenant** | School (établissements) | 1→N (users, classes, fees...) |
| **Auth & Users** | User, Account, Session, TeacherProfile, StudentProfile, ParentProfile | 1→1 (profiles), 1→N (relations) |
| **Academic** | AcademicYear, Period, ClassLevel, Class, Enrollment | Hiérarchique (Year→Period, School→ClassLevel→Class) |
| **Matières** | Subject, ClassSubject, EvaluationType | N→M (class↔subject via ClassSubject) |
| **Évaluations** | Evaluation, Grade | N→1 (Evaluation→ClassSubject, Period, Type) |
| **Emploi du temps** | Schedule | N→1 (Class, ClassSubject optionnel) |
| **Présences** | Attendance | N→1 (Student, Class), 1→1 (RecordedBy) |
| **Finances** | Fee, Payment, PaymentPlan, InstallmentPayment, Scholarship | N→1 (Student, Fee), 1→N (Installments) |
| **LMS** | Course, CourseModule, Lesson, CourseEnrollment, LessonCompletion | Hiérarchique (Course→Module→Lesson) |
| **Examens** | ExamTemplate, Question, ExamSession, ExamAnswer | Hiérarchique (Template→Question), N→1 (Session→Student) |
| **Santé** | MedicalRecord, Allergy, Vaccination, EmergencyContact | 1→1 (MedicalRecord→Student), 1→N (enfants) |
| **Événements** | SchoolEvent, EventParticipation | N→1 (Student), 1→N (Participations) |
| **Comportement** | BehaviorIncident, Sanction | N→1 (Student, ReportedBy), 1→N (Sanctions) |
| **Rendez-vous** | Appointment, TeacherAvailability | N→1 (Teacher, Parent, Student) |
| **Orientation** | StudentOrientation, OrientationRecommendation, SubjectGroupAnalysis | 1→N (Recommandations), 1→N (Analyses) |
| **Analytics** | StudentAnalytics, SubjectPerformance, GradeHistory | 1→N (SubjectPerformances), N→1 (Student, Period) |
| **Conformité RGPD** | DataConsent, DataRetentionPolicy, DataAccessRequest | N→1 (User, School) |
| **Calendrier** | SchoolHoliday, PublicHoliday, SchoolCalendarEvent | N→1 (School, AcademicYear) |
| **Messagerie** | Message | N→1 (Sender, Recipient), 1→N (Replies) |
| **Notifications** | Notification | N→1 (User) |
| **Ressources** | Resource | N→1 (School, Subject, ClassLevel, UploadedBy) |
| **Annonces** | Announcement | N→1 (School, Author) |
| **Certificats** | Certificate | N→1 (Student, AcademicYear, IssuedBy) |
| **Audit** | AuditLog | N→1 (User) |
| **Données Référence** | City, Profession, Nationality, SubjectCategory, ConfigOption | Tables de référence |

### Énumérations Clés (30+ enums)

```
SchoolType: PUBLIC, PRIVATE, RELIGIOUS, INTERNATIONAL
SchoolLevel: PRIMARY, SECONDARY_COLLEGE, SECONDARY_LYCEE, MIXED
PeriodType: TRIMESTER, SEMESTER, HYBRID
UserRole: SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT, ACCOUNTANT
EnrollmentStatus: ACTIVE, TRANSFERRED, GRADUATED, DROPPED, SUSPENDED
PaymentMethod: CASH, MOBILE_MONEY_MTN, MOBILE_MONEY_MOOV, BANK_TRANSFER, CHECK, OTHER
PaymentStatus: PENDING, VERIFIED, RECONCILED, CANCELLED
AttendanceStatus: PRESENT, ABSENT, LATE, EXCUSED
RiskLevel: NONE, LOW, MEDIUM, HIGH, CRITICAL
PerformanceLevel: EXCELLENT, VERY_GOOD, GOOD, AVERAGE, INSUFFICIENT, WEAK
RecommendedSeries: SERIE_A, SERIE_B, SERIE_C, SERIE_D, SERIE_E, SERIE_F1-F4, SERIE_G1-G3...
OrientationStatus: PENDING, ANALYZED, RECOMMENDED, VALIDATED, ACCEPTED, REJECTED
```

---

## 1.2 Infrastructure API (128+ Routes)

### Répartition par Module

| Module | Routes | Exemples |
|--------|--------|----------|
| **Auth** | 5+ | `/api/auth/login`, `/register`, `/reset-password`, `/initial-setup` |
| **Users** | 3+ | `/api/users`, `/users/[id]`, `/users/[id]/delete` |
| **Students** | 3+ | `/api/students`, `/students/[id]` |
| **Teachers** | 2+ | `/api/teachers` |
| **Classes** | 3+ | `/api/classes`, `/classes/[id]`, `/class-levels` |
| **Subjects** | 3+ | `/api/subjects`, `/subjects/[id]`, `/class-subjects` |
| **Grades** | 4+ | `/api/grades`, `/grades/[id]`, `/bulletins/*` |
| **Evaluations** | 2+ | `/api/evaluation-types` |
| **Schedule** | 3+ | `/api/schedules`, `/schedules/[id]` |
| **Attendance** | 4+ | `/api/attendance`, `/attendance/[id]`, `/attendance/stats` |
| **Finance** | 15+ | `/api/fees`, `/payments`, `/payment-plans`, `/scholarships` |
| **LMS** | 12+ | `/api/courses`, `/modules`, `/lessons`, `/courses/[id]/enroll` |
| **Exams** | 5+ | `/api/exams`, `/exams/[id]/start`, `/exams/sessions/*` |
| **Homework** | 6+ | `/api/homework`, `/homework/[id]/submissions` |
| **Resources** | 4+ | `/api/resources`, `/resources/[id]/download` |
| **Events** | 3+ | `/api/events`, `/events/[id]/participate` |
| **Incidents** | 4+ | `/api/incidents`, `/incidents/[id]/sanctions` |
| **Appointments** | 3+ | `/api/appointments`, `/appointments/[id]` |
| **Orientation** | 3+ | `/api/orientation`, `/orientation/[id]/validate` |
| **Analytics** | 5+ | `/api/analytics/students`, `/analytics/attendance*` |
| **AI** | 4+ | `/api/ai/predictions/*`, `/api/ai/chat` |
| **Calendar** | 6+ | `/api/calendar/holidays`, `/calendar/events`, `/calendar/public-holidays` |
| **Academic** | 4+ | `/api/academic-years`, `/academic-years/[id]` |
| **Announcements** | 3+ | `/api/announcements`, `/announcements/[id]` |
| **Certificates** | 2+ | `/api/certificates`, `/certificates/[id]` |
| **Messages** | 3+ | `/api/messages`, `/messages/[id]` |
| **Compliance** | 3+ | `/api/compliance/data-requests` |
| **Medical** | 5+ | `/api/medical-records`, `/medical-records/[id]/allergies` |
| **Audit** | 2+ | `/api/audit-logs` |
| **System** | 3+ | `/api/system/backup` |
| **Reference** | 5+ | `/api/reference/cities`, `/professions`, `/nationalities` |
| **Parents** | 2+ | `/api/parents/dashboard` |
| **Reference** | 2+ | `/reference/config-options` |

---

## 1.3 Système RBAC (133 Permissions)

### Hiérarchie des Rôles

```
                    SUPER_ADMIN (100)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   SCHOOL_ADMIN      DIRECTOR          ACCOUNTANT
      (80)             (80)               (60)
        │                 │
        │    ┌────────────┴────────────┐
        │    │                         │
    TEACHER (50)                   PARENT (20)
                                         │
                                         │
                                     STUDENT (10)
```

### Matrice des Permissions par Rôle

| Permission | SUPER_ADMIN | SCHOOL_ADMIN | DIRECTOR | TEACHER | ACCOUNTANT | PARENT | STUDENT |
|------------|:-----------:|:------------:|:--------:|:-------:|:----------:|:------:|:-------:|
| **School Management** |
| school:create | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| school:read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| school:update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| school:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **User Management** |
| user:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| user:read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| user:update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| user:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Student Management** |
| student:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| student:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒own |
| student:update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| student:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Teacher Management** |
| teacher:create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| teacher:read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| teacher:update | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| teacher:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Grade Management** |
| grade:create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| grade:read | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒children | 🔒own |
| grade:update | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| grade:delete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Finance Management** |
| fee:create | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| fee:read | ✅ | ✅ | ✅ | ❌ | ✅ | 🔒own | 🔒own |
| fee:update | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| fee:delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payment:create | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| payment:read | ✅ | ✅ | ✅ | ❌ | ✅ | 🔒own | 🔒own |
| payment:update | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Analytics & AI** |
| analytics:view | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒children | 🔒own |
| analytics:view:own | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| analytics:view:children | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| ai:predict:student | ✅ | ❌ | ✅ | ✅ | ❌ | 🔒children | 🔒own |
| ai:predict:view:own | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ai:predict:view:children | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Orientation** |
| orientation:create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| orientation:read | ✅ | ✅ | ✅ | ✅ | ❌ | 🔒children | 🔒own |
| orientation:validate | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reports** |
| report:view | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| statistics:view | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Légende:** 🔒own = accès aux données propres | 🔒children = accès aux données des enfants

---

# PARTIE 2: VISION FRONTEND ULTRA-ÉLABORÉ

## 2.1 Architecture Frontend Idéale

### Structure de Routes par Rôle

```
src/app/(dashboard)/
├── layout.tsx                          # Layout principal avec sidebar adaptatif
├── error.tsx                           # Error boundary global
│
├── (auth)/                             # Routes publiques
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/[token]/page.tsx
│   └── initial-setup/page.tsx          # Création Super Admin
│
├── dashboard/                          # Route commune (fallback)
│   └── page.tsx
│
├── SUPER_ADMIN/                        # Espace Super Admin
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Super Admin Dashboard
│   ├── schools/
│   │   ├── page.tsx                    # Liste des écoles
│   │   ├── [id]/page.tsx               # Détails école
│   │   ├── [id]/edit/page.tsx          # Édition école
│   │   └── create/page.tsx             # Créer école
│   ├── users/
│   │   ├── page.tsx                    # Tous les utilisateurs
│   │   └── [id]/page.tsx               # Détails utilisateur
│   ├── system/
│   │   ├── backup/page.tsx             # Gestion backups
│   │   ├── settings/page.tsx           # Settings globaux
│   │   └── logs/page.tsx               # Logs système
│   └── audit-logs/
│       └── page.tsx                    # Journalisation
│
├── admin/                              # Espace Admin Établissement
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Admin Dashboard
│   ├── settings/
│   │   ├── general/page.tsx
│   │   ├── academic/page.tsx
│   │   ├── fees/page.tsx
│   │   └── data-privacy/page.tsx       # RGPD
│   ├── users/
│   │   ├── page.tsx                    # Utilisateurs école
│   │   ├── create/page.tsx
│   │   └── [id]/page.tsx
│   ├── classes/
│   │   ├── page.tsx                    # Liste classes
│   │   ├── create/page.tsx
│   │   └── [id]/page.tsx
│   ├── subjects/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── academic-years/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── periods/page.tsx            # Gestion périodes
│   ├── calendar/
│   │   ├── holidays/page.tsx           # Vacances scolaires
│   │   └── events/page.tsx             # Événements calendrier
│   └── reports/
│       ├── page.tsx                    # Rapports globaux
│       └── analytics/page.tsx          # Analytics établissement
│
├── director/                           # Espace Directeur
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Dashboard pédagogique
│   ├── classes/
│   │   └── [id]/page.tsx               # Vue classe détaillée
│   ├── teachers/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── students/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx               # Fiche élève complète
│   ├── orientation/
│   │   ├── page.tsx                    # Tableau orientation
│   │   └── [id]/page.tsx
│   ├── reports/
│   │   ├── class/page.tsx              # Rapports par classe
│   │   └── statistics/page.tsx
│   └── analytics/
│       └── page.tsx                    # Analytics avancés
│
├── teacher/                            # Espace Enseignant
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Teacher Dashboard
│   ├── classes/
│   │   ├── page.tsx                    # Mes classes
│   │   └── [id]/page.tsx               # Détails classe
│   │       ├── students/page.tsx       # Liste élèves
│   │       ├── grades/page.tsx         # Saisie notes
│   │       ├── attendance/page.tsx     # Présences
│   │       ├── schedule/page.tsx       # EMPLOI DU TEMPS
│   │       └── exams/page.tsx          # Examens
│   ├── homework/
│   │   ├── page.tsx                    # Mes devoirs
│   │   ├── create/page.tsx
│   │   └── [id]/page.tsx               # Détails + corrections
│   ├── grades/
│   │   ├── page.tsx                    # Toutes les notes
│   │   └── [classId]/page.tsx          # Notes par classe
│   ├── attendance/
│   │   ├── page.tsx                    # Historique présences
│   │   └── [date]/page.tsx             # Saisie quotidienne
│   ├── resources/
│   │   ├── page.tsx                    # Mes ressources
│   │   └── upload/page.tsx
│   ├── availability/
│   │   └── page.tsx                    # Disponibilités RDV
│   ├── analytics/
│   │   └── page.tsx                    # Analytics classes
│   └── messages/
│       └── page.tsx                    # Messagerie
│
├── student/                            # Espace Élève
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Student Dashboard
│   ├── grades/
│   │   ├── page.tsx                    # Mes notes
│   │   └── bulletins/page.tsx          # Bulletins PDF
│   ├── schedule/
│   │   └── page.tsx                    # Mon emploi du temps
│   ├── attendance/
│   │   └── page.tsx                    # Mes présences
│   ├── homework/
│   │   ├── page.tsx                    # Devoirs à faire
│   │   └── [id]/page.tsx               # Soumission
│   ├── courses/
│   │   ├── page.tsx                    # Mes cours LMS
│   │   └── [id]/page.tsx               # Leçon en cours
│   ├── exams/
│   │   ├── page.tsx                    # Examens à passer
│   │   └── [id]/page.tsx               # Passage examen
│   ├── analytics/
│   │   └── page.tsx                    # Mes performances
│   ├── orientation/
│   │   └── page.tsx                    # Mon orientation
│   ├── resources/
│   │   └── page.tsx                    # Ressources profs
│   ├── events/
│   │   └── page.tsx                    # Événements scolaires
│   ├── certificates/
│   │   └── page.tsx                    # Mes certificats
│   ├── messages/
│   │   └── page.tsx                    # Messages
│   └── profile/
│       └── page.tsx                    # Mon profil
│
├── parent/                             # Espace Parent
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Parent Dashboard
│   ├── children/
│   │   ├── page.tsx                    # Liste enfants
│   │   └── [id]/page.tsx               # Fiche enfant
│   │       ├── grades/page.tsx         # Notes enfant
│   │       ├── attendance/page.tsx     # Présences enfant
│   │       ├── homework/page.tsx       # Devoirs enfant
│   │       ├── analytics/page.tsx      # Performances enfant
│   │       └── orientation/page.tsx    # Orientation enfant
│   ├── payments/
│   │   ├── page.tsx                    # Paiements
│   │   ├── [id]/page.tsx               # Détails paiement
│   │   └── history/page.tsx            # Historique
│   ├── appointments/
│   │   ├── page.tsx                    # Mes RDV
│   │   └── create/page.tsx             # Prendre RDV
│   ├── messages/
│   │   └── page.tsx                    # Messages
│   └── profile/
│       └── page.tsx                    # Mon profil
│
├── accountant/                         # Espace Comptable
│   ├── layout.tsx
│   ├── dashboard/page.tsx              # Finance Dashboard
│   ├── fees/
│   │   ├── page.tsx                    # Frais scolaires
│   │   ├── create/page.tsx
│   │   └── [id]/page.tsx
│   ├── payments/
│   │   ├── page.tsx                    # Tous paiements
│   │   ├── [id]/page.tsx
│   │   └── verify/page.tsx             # Vérification
│   ├── plans/
│   │   ├── page.tsx                    # Plans de paiement
│   │   └── [id]/page.tsx
│   ├── scholarships/
│   │   ├── page.tsx                    # Bourses
│   │   └── create/page.tsx
│   ├── reports/
│   │   ├── page.tsx                    # Rapports financiers
│   │   ├── daily/page.tsx              # Journalier
│   │   ├── monthly/page.tsx            # Mensuel
│   │   └── outstanding/page.tsx        # Impayés
│   └── invoices/
│       └── page.tsx                    # Génération factures
│
├── messages/                           # Messagerie (commun)
│   ├── page.tsx                        # Liste conversations
│   └── [id]/page.tsx                   # Conversation
│
├── notifications/                      # Notifications (commun)
│   └── page.tsx
│
└── profile/                            # Profil (commun)
    └── page.tsx
```

---

## 2.2 Composants par Module

### Module UI de Base (src/components/ui/)

| Composant | Props | Usage |
|-----------|-------|-------|
| Button | variant, size, loading, disabled | Boutons CTA |
| Input | type, placeholder, error, label | Champs texte |
| Select | options, value, onChange, searchable | Sélecteurs |
| Checkbox | checked, onChange, label | Cases à cocher |
| RadioGroup | options, value, onChange | Boutons radio |
| Textarea | rows, placeholder, maxLength | Zones de texte |
| Card | title, content, footer | Conteneurs |
| Badge | variant, children | Badges/étiquettes |
| Avatar | src, alt, size, fallback | Avatars utilisateurs |
| Alert | variant, title, description | Alertes |
| Dialog | open, onOpenChange, title, children | Modales |
| Drawer | open, onOpenChange, position | Panneaux latéraux |
| DropdownMenu | items, trigger | Menus déroulants |
| Table | columns, data, pagination | Tableaux |
| DataTable | columns, data, filters, sorting | Tableaux avancés |
| Form | methods, children | Formulaires |
| FormField | name, control, render | Champs formulaire |
| Tabs | items, defaultValue, children | Onglets |
| Pagination | page, pageSize, total, onChange | Pagination |
| Toast | title, description, variant | Notifications toast |
| Skeleton | variant, width, height | Chargement |
| Progress | value, max | Barres de progression |
| Calendar | selected, onSelect, disabled | Calendrier |
| DatePicker | mode, value, onChange | Sélecteur de date |
| TimePicker | value, onChange, format | Sélecteur d'heure |
| Modal | open, onClose, children | Modales génériques |
| Tooltip | content, children | Infobulles |
| Popover | content, children | Popovers |
| Sheet | open, onClose, children | Panneaux |
| Accordion | items, defaultValue | Accordéons |
| Timeline | items | Chronologie |
| StatCard | title, value, change, icon | Cartes stats |
| EmptyState | title, description, action | État vide |
| LoadingSpinner | size | Spinners |
| ErrorBoundary | fallback, children | Limites erreurs |

### Module Layout (src/components/layout/)

| Composant | Usage |
|-----------|-------|
| Sidebar | Navigation latérale (responsive) |
| Header | En-tête avec notifications, profile |
| Breadcrumb | Fil d'Ariane |
| Footer | Pied de page |
| MainLayout | Layout global |
| DashboardLayout | Layout dashboard |
| PageHeader | En-tête de page |
| PageContent | Contenu de page |
| SidebarItem | Élément de menu |
| SidebarGroup | Groupe de menu |
| UserMenu | Menu utilisateur |
| SchoolSelector | Sélecteur établissement |
| ThemeToggle | Thème clair/sombre |
| LanguageSelector | Sélecteur langue |

### Module Dashboard (src/components/dashboard/)

| Composant | Props | Rôles |
|-----------|-------|-------|
| SuperAdminDashboard | user | SUPER_ADMIN |
| SchoolAdminDashboard | school, stats | SCHOOL_ADMIN |
| DirectorDashboard | school, classes | DIRECTOR |
| TeacherDashboard | teacher, classes | TEACHER |
| StudentDashboard | student | STUDENT |
| ParentDashboard | parent, children | PARENT |
| AccountantDashboard | stats | ACCOUNTANT |

**Sous-composants Dashboard:**
- StatsCard (title, value, trend, icon)
- RecentActivity (items)
- QuickActions (actions)
- ChartsWidget (type, data)
- AlertsWidget (alerts)
- TasksWidget (tasks)
- CalendarWidget (events)
- NotificationsWidget (notifications)

### Module Analytics (src/components/analytics/)

| Composant | Usage | Inputs |
|-----------|-------|--------|
| PerformanceChart | Graphique performance | studentId, period |
| GradeTrendsChart | Évolution notes | studentId, subjectId |
| AttendanceChart | Graphique présences | studentId, classId |
| RiskLevelBadge | Badge niveau risque | riskLevel |
| PerformanceLevelBadge | Badge niveau performance | level |
| SubjectPerformanceCard | Performance par matière | subjectData |
| ClassAnalytics | Analytics classe | classId |
| StudentAnalytics | Analytics élève | studentId |
| ComparisonChart | Comparaison | data1, data2 |
| ProgressBar | Barre progression | value, label |
| RadarChart | Profil matières | studentData |
| Heatmap | Activité annuelle | data |
| DistributionChart | Distribution notes | classData |

### Module AI (src/components/ai/)

| Composant | Usage | Permissions |
|-----------|-------|-------------|
| BehaviorRiskCard | Risque comportement | ADMIN, TEACHER |
| FailureRiskCard | Risque échec | ADMIN, TEACHER |
| NextGradePrediction | Prédiction note | TEACHER, STUDENT, PARENT |
| OrientationFitCard | Fit orientation | STUDENT, PARENT, TEACHER |
| RiskLevelBadge | Badge risque | Tous |
| AIInsightsPanel | Insights IA | ADMIN, DIRECTOR |
| ChatWidget | Assistant IA | Tous |
| RecommendationsList | Recommandations | Tous |

### Module Finance (src/components/finance/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| FeeCard | Frais scolaires | ADMIN, ACCOUNTANT |
| FeeList | Liste frais | ADMIN, ACCOUNTANT, PARENT |
| PaymentForm | Formulaire paiement | ACCOUNTANT, PARENT |
| PaymentHistory | Historique paiements | Tous |
| PaymentStatusBadge | Statut paiement | Tous |
| InvoiceGenerator | Génération facture | ACCOUNTANT |
| PaymentPlanCard | Plan de paiement | PARENT, ACCOUNTANT |
| InstallmentRow | Échéance | PARENT |
| ScholarshipBadge | Bourse | ADMIN, ACCOUNTANT |
| FeeAnalytics | Analytics frais | ADMIN, ACCOUNTANT |
| OutstandingPayments | Impayés | ACCOUNTANT |
| ReconciliationTool | Rapprochement | ACCOUNTANT |
| BulkInvoiceGenerator | Factures groupées | ACCOUNTANT |
| PaymentMethodSelector | Méthode paiement | PARENT, ACCOUNTANT |

### Module LMS (src/components/lms/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| CourseCard | Carte cours | Tous |
| CourseList | Liste cours | Tous |
| CourseDetail | Détails cours | Tous |
| ModuleCard | Carte module | Tous |
| LessonView | Visualisation leçon | Tous |
| LessonProgress | Progression leçon | STUDENT |
| CourseEnrollment | Inscription cours | STUDENT |
| ProgressBar | Barre progression | STUDENT |
| QuizComponent | Questionnaire | STUDENT |
| VideoPlayer | Lecteur vidéo | Tous |
| DocumentViewer | Visionneuse docs | Tous |
| CompletionTracker | Suivi complétion | STUDENT |

### Module Examens (src/components/exams/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| ExamCard | Carte examen | Tous |
| ExamList | Liste examens | Tous |
| ExamInterface | Interface passage | STUDENT |
| QuestionComponent | Question QCM | STUDENT |
| TimerDisplay | Minuteur | STUDENT |
| QuestionNavigation | Navigation questions | STUDENT |
| ResultsView | Résultats examen | Tous |
| GradeDisplay | Affichage note | Tous |
| ExamAnalytics | Analytics examens | TEACHER, ADMIN |

### Module Devoirs (src/components/homework/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| HomeworkCard | Carte devoir | Tous |
| HomeworkList | Liste devoirs | Tous |
| CreateHomeworkForm | Création | TEACHER |
| SubmissionForm | Soumission | STUDENT |
| SubmissionList | Liste soumissions | TEACHER |
| GradeForm | Notation | TEACHER |
| FeedbackDisplay | Affichage feedback | Tous |
| AttachmentsList | Fichiers joints | Tous |

### Module Présence (src/components/attendance/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| AttendanceSheet | Feuille présence | TEACHER |
| AttendanceCard | Carte présence | Tous |
| AttendanceStats | Statistiques | ADMIN, TEACHER |
| AttendanceChart | Graphique | ADMIN, TEACHER |
| AbsenceAlert | Alerte absence | ADMIN, PARENT |
| JustificationForm | Justification | PARENT |
| DailyAttendance | Présence quotidienne | TEACHER |
| BulkAttendance | Saisie groupée | TEACHER |
| AttendanceReport | Rapport | ADMIN, TEACHER |

### Module Messagerie (src/components/messages/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| ConversationList | Liste conversations | Tous |
| ConversationItem | Élément conversation | Tous |
| MessageBubble | Bulle message | Tous |
| MessageInput | Saisie message | Tous |
| ThreadView | Fil discussion | Tous |
| NewMessageForm | Nouveau message | Tous |
| AttachmentPicker | Pièces jointes | Tous |
| EmojiPicker | Sélecteur emoji | Tous |
| SearchMessages | Recherche | Tous |
| StarredMessages | Messages favorisés | Tous |
| ArchivedMessages | Archives | Tous |

### Module Calendrier (src/components/calendar/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| FullCalendar | Calendrier complet | Tous |
| MonthView | Vue mois | Tous |
| WeekView | Vue semaine | Tous |
| DayView | Vue jour | Tous |
| AgendaView | Liste événements | Tous |
| EventCard | Carte événement | Tous |
| EventForm | Création événement | ADMIN, TEACHER |
| HolidayDisplay | Vacances | Tous |
| ScheduleView | Emploi du temps | Tous |
| RecurrenceConfig | Récurrence | ADMIN, TEACHER |
| DragDropScheduler | Drag & drop | ADMIN, TEACHER |

### Module Santé (src/components/medical/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| MedicalRecordForm | Dossier médical | ADMIN, PARENT |
| AllergyList | Liste allergies | ADMIN, PARENT |
| VaccinationCard | Vaccination | ADMIN, PARENT |
| EmergencyContactList | Contacts urgence | ADMIN, PARENT |
| HealthAlert | Alerte santé | ADMIN, PARENT |
| BloodTypeBadge | Groupe sanguin | ADMIN |
| MedicalHistory | Historique | ADMIN, PARENT |
| MedicalNote | Notes médicales | ADMIN |

### Module Événements (src/components/events/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| EventCard | Carte événement | Tous |
| EventList | Liste événements | Tous |
| EventDetail | Détails événement | Tous |
| CreateEventForm | Création | ADMIN, TEACHER |
| ParticipationForm | Inscription | STUDENT, PARENT |
| ParticipationList | Participants | ADMIN, TEACHER |
| PermissionForm | Autorisation | PARENT |
| EventAnalytics | Analytics | ADMIN |

### Module Comportement (src/components/incidents/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| IncidentCard | Carte incident | ADMIN, TEACHER |
| IncidentList | Liste incidents | ADMIN, TEACHER |
| CreateIncidentForm | Création incident | ADMIN, TEACHER |
| IncidentDetail | Détails incident | ADMIN, TEACHER |
| SanctionCard | Sanction | ADMIN, TEACHER |
| BehaviorHistory | Historique | ADMIN, TEACHER, PARENT |
| SeverityBadge | Badge sévérité | ADMIN, TEACHER |
| ResolutionForm | Résolution | ADMIN, TEACHER |

### Module Orientation (src/components/orientation/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| OrientationCard | Carte orientation | STUDENT, PARENT |
| SeriesRecommendation | Recommandation série | ADMIN, TEACHER |
| ScoreGauge | Jauge score | Tous |
| StrengthWeakness | Points forts/faibles | Tous |
| SubjectGroupAnalysis | Analyse groupes | ADMIN, TEACHER |
| TrendIndicator | Indicateur tendance | Tous |
| AcceptanceForm | Formulaire acceptation | PARENT, STUDENT |
| OrientationReport | Rapport orientation | ADMIN |
| SeriesComparison | Comparaison séries | Tous |

### Module Certificats (src/components/certificates/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| CertificateCard | Carte certificat | Tous |
| CertificatePreview | Aperçu PDF | Tous |
| DownloadButton | Téléchargement | Tous |
| RequestForm | Demande certificat | PARENT, STUDENT |
| VerificationCode | Code vérification | Tous |
| CertificateGenerator | Génération | ADMIN |

### Module Ressources (src/components/resources/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| ResourceCard | Carte ressource | Tous |
| ResourceList | Liste ressources | Tous |
| ResourceGrid | Grille ressources | Tous |
| UploadForm | Upload | ADMIN, TEACHER |
| CategoryFilter | Filtre catégorie | Tous |
| SearchBar | Recherche | Tous |
| DownloadCounter | Compteur dl | ADMIN |
| PreviewModal | Aperçu | Tous |

### Module Annonces (src/components/announcements/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| AnnouncementCard | Carte annonce | Tous |
| AnnouncementList | Liste annonces | Tous |
| CreateForm | Création annonce | ADMIN, TEACHER |
| PriorityBadge | Badge priorité | Tous |
| TargetSelector | Cible (rôles) | ADMIN, TEACHER |
| ExpiryConfig | Expiration | ADMIN, TEACHER |

### Module Rendez-vous (src/components/appointments/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| AppointmentCard | Carte RDV | Tous |
| AppointmentList | Liste RDV | Tous |
| CalendarView | Vue calendrier | Tous |
| BookingForm | Réservation | PARENT |
| AvailabilityGrid | Disponibilités | PARENT, TEACHER |
| StatusBadge | Badge statut | Tous |
| RescheduleForm | Reprogrammation | Tous |
| CancellationForm | Annulation | Tous |

### Module Conformité (src/components/compliance/)

| Composant | Usage | Rôles |
|-----------|-------|-------|
| DataRequestForm | Demande RGPD | Tous |
| ConsentManager | Gestion consentements | Tous |
| RetentionPolicyView | Politiques rétention | ADMIN |
| RequestStatusTracker | Suivi demandes | ADMIN, User |
| DataExportPanel | Export données | ADMIN, User |
| AuditLogViewer | Logs audit | ADMIN |

---

## 2.3 Hooks Personnalisés (src/hooks/)

| Hook | Params | Returns | Usage |
|------|--------|---------|-------|
| useAuth | - | session, loading, updateSession | Gestion auth |
| useUser | userId | user, loading, update | Données utilisateur |
| useStudents | filters | students, loading, pagination | Élèves |
| useTeachers | filters | teachers, loading, pagination | Enseignants |
| useClasses | schoolId | classes, loading | Classes |
| useGrades | filters | grades, loading, stats | Notes |
| useEvaluations | filters | evaluations, loading | Évaluations |
| useSchedule | filters | schedule, loading | EMPLOI DU TEMPS |
| useAttendance | filters | attendance, loading | Présences |
| usePayments | filters | payments, loading | Paiements |
| useFees | filters | fees, loading | Frais |
| useCourses | filters | courses, loading | Cours LMS |
| useHomework | filters | homework, loading | Devoirs |
| useExams | filters | exams, loading | Examens |
| useMessages | conversationId | messages, loading | Messagerie |
| useNotifications | - | notifications, unread | Notifications |
| useAnalytics | studentId | analytics, loading | Analytics |
| useOrientation | studentId | orientation, loading | Orientation |
| useEvents | filters | events, loading | Événements |
| useResources | filters | resources, loading | Ressources |
| useMedicalRecords | studentId | record, loading | Dossier médical |
| useIncidents | filters | incidents, loading | Incidents |
| useAppointments | filters | appointments, loading | RDV |
| useAnnouncements | filters | announcements, loading | Annonces |
| useCertificates | filters | certificates, loading | Certificats |
| useSchool | schoolId | school, loading | Établissement |
| useAcademicYear | filters | years, loading | Années scolaires |
| useSubjects | schoolId | subjects, loading | Matières |
| useClassSubjects | classId | classSubjects, loading | Matières/classe |
| useEnrollments | filters | enrollments, loading | Inscriptions |
| useScholarships | filters | scholarships, loading | Bourses |
| usePaymentPlans | studentId | plans, loading | Plans paiement |

### Hooks Spécialisés

| Hook | Usage |
|------|-------|
| useOptimistic | UI optimiste (avant API) |
| useSocket | WebSocket temps réel |
| useDebounce | Debounce recherche |
| usePagination | Pagination générique |
| useFilters | Gestion filtres |
| useSorting | Tri tableaux |
| useLocalStorage | Stockage local |
| useMediaQuery | Responsive |
| useDarkMode | Thème sombre |
| usePermissions | Vérif permissions |
| useRole | Rôle actuel |
| usePermissionsCheck | Vérif perm détaillée |
| useExport | Export données |
| useImport | Import données |
| useDownload | Téléchargement |
| useForm | Formulaires |
| useWizard | Formulaires multi-étapes |

---

## 2.4 Types TypeScript (src/lib/types/)

```
types/
├── index.ts                    # Exports principaux
├── user.ts                     # Types User, Profile
├── auth.ts                     # Types Auth, Session
├── school.ts                   # Types School, Academic
├── academic.ts                 # Year, Period, Class
├── subject.ts                  # Subject, ClassSubject
├── grade.ts                    # Grade, Evaluation
├── schedule.ts                 # Schedule, TimeSlot
├── attendance.ts               # Attendance
├── finance.ts                  # Fee, Payment, Plan
├── lms.ts                      # Course, Module, Lesson
├── exam.ts                     # Exam, Question, Session
├── homework.ts                 # Homework, Submission
├── health.ts                   # Medical, Allergy
├── event.ts                    # SchoolEvent, Participation
├── orientation.ts              # Orientation, Recommendation
├── analytics.ts                # Analytics, Performance
├── ai.ts                       # Predictions, Insights
├── message.ts                  # Message, Conversation
├── notification.ts             # Notification
├── resource.ts                 # Resource, Category
├── certificate.ts              # Certificate
├── incident.ts                 # BehaviorIncident, Sanction
├── appointment.ts              # Appointment, Availability
├── announcement.ts             # Announcement
├── compliance.ts               # DataConsent, Request
└── api.ts                      # API Response types
```

---

## 2.5 Permissions Frontend

### Helper Functions (src/lib/rbac/)

```typescript
// src/lib/rbac/permissions.ts (existant)
import { Permission, rolePermissions } from './permissions';

// Nouvelles fonctions à ajouter
export function canAccessRoute(role: UserRole, route: string): boolean;
export function getAllowedRoutes(role: UserRole): string[];
export function filterMenuItems(role: UserRole, items: MenuItem[]): MenuItem[];
export function hasResourceAccess(user, resource, action): boolean;
export function getScopeFilter(role: UserRole, resource: string): PrismaFilter;
```

### Composants de Protection

```tsx
// src/components/auth/PermissionGate.tsx
interface PermissionGateProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  user?: User;
}

// src/components/auth/RoleGate.tsx
interface RoleGateProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// src/components/auth/ResourceGate.tsx
interface ResourceGateProps {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

---

# PARTIE 3: ANALYSE DE L'EXISTANT VS IDÉAL

## 3.1 État Actuel du Frontend

### Routes Existantes

| Dossier | Pages | Status |
|---------|-------|--------|
| **admin/** | schools, users, classes, subjects | ✅ Complet |
| **school/** | students, teachers, attendance, finance, analytics, calendar, resources | ⚠️ Partiel |
| **teacher/** | classes, grades, homework, attendance | ⚠️ Partiel |
| **student/** | dashboard, courses, grades, homework, analytics, orientation | ⚠️ Partiel |
| **parent/** | dashboard, appointments, payments | ⚠️ Partiel |
| **accountant/** | fees, payments, plans, scholarships | ⚠️ Partiel |
| **dashboard/** | page principale | ✅ |
| **messages/** | liste messages | ⚠️ Partiel |
| **profile/** | profil utilisateur | ✅ |
| **settings/** | paramètres | ⚠️ Partiel |
| **ai-assistant/** | assistant IA | ⚠️ Partiel |

### Composants Existants

| Dossier | Composants | % Complet |
|---------|------------|-----------|
| **ui/** | ~30 composants shadcn | 90% |
| **layout/** | sidebar, header | 80% |
| **dashboard/** | 7 dashboards modernes | 70% |
| **analytics/** | 6 composants | 60% |
| **ai/** | 4 composants IA | 50% |
| **finance/** | 6 composants | 40% |
| **lms/** | 4 composants | 50% |
| **exams/** | 3 composants | 40% |
| **homework/** | 4 composants | 50% |
| **attendance/** | 4 composants | 40% |
| **messages/** | 6 composants | 40% |
| **calendar/** | 3 composants | 30% |
| **medical/** | 4 composants | 30% |
| **events/** | 4 composants | 30% |
| **incidents/** | 4 composants | 30% |
| **orientation/** | 5 composants | 40% |
| **certificates/** | 3 composants | 30% |
| **resources/** | 4 composants | 40% |
| **appointments/** | 4 composants | 30% |
| **announcements/** | 4 composants | 30% |
| **compliance/** | 4 composants | 30% |

### Hooks Existants

| Hook | Status |
|------|--------|
| useAuth | ✅ Fonctionnel |
| useStudents | ✅ Fonctionnel |
| useTeachers | ✅ Fonctionnel |
| useClasses | ✅ Fonctionnel |
| useGrades | ✅ Fonctionnel |
| useSchedule | ⚠️ Partiel |
| useAttendance | ⚠️ Partiel |
| usePayments | ✅ Fonctionnel |
| useCourses | ✅ Fonctionnel |
| useHomework | ✅ Fonctionnel |
| useExams | ⚠️ Partiel |
| useMessages | ⚠️ Partiel |
| useNotifications | ✅ Fonctionnel |
| useAnalytics | ✅ Fonctionnel |
| useOrientation | ⚠️ Partiel |
| useEvents | ⚠️ Partiel |
| useResources | ✅ Fonctionnel |
| useOptimistic | ✅ Fonctionnel |
| useSocket | ✅ Fonctionnel |

---

## 3.2 Écart entre Existant et Idéal

### Priorité CRITIQUE (À faire immédiatement)

| Module | Composant | Status | Action |
|--------|-----------|--------|--------|
| **Medical** | Dossier médical complet | 0% | Créer |
| **Medical** | Vaccinations | 0% | Créer |
| **Medical** | Contacts urgence | 0% | Créer |
| **Medical** | Allergies | 0% | Créer |
| **Events** | Inscription événements | 0% | Créer |
| **Events** | Autorisations parents | 0% | Créer |
| **Incidents** | Sanctions | 0% | Créer |
| **Incidents** | Historique comportement | 0% | Créer |
| **Orientation** | Comparaison séries | 0% | Créer |
| **Orientation** | Acceptance form | 0% | Créer |
| **Compliance** | Gestion consentements | 0% | Créer |
| **Compliance** | Demandes RGPD | 0% | Créer |
| **Compliance** | Export données | 0% | Créer |
| **Finance** | Rapprochement | 0% | Créer |
| **Finance** | Factures groupées | 0% | Créer |
| **Exams** | Interface passage QCM | 0% | Créer |
| **Exams** | Timer en temps réel | 0% | Créer |
| **Exams** | Résultats détaillés | 0% | Créer |
| **LMS** | Quiz interactif | 0% | Créer |
| **LMS** | Lecteur vidéo | 0% | Créer |

### Priorité HAUTE (À faire bientôt)

| Module | Composant | Status | Action |
|--------|-----------|--------|--------|
| **Attendance** | Saisie groupée | 20% | Améliorer |
| **Attendance** | Alertes absence | 0% | Créer |
| **Messages** | Fil de discussion | 0% | Créer |
| **Messages** | Pièces jointes | 0% | Créer |
| **Messages** | Recherche | 0% | Créer |
| **Calendar** | Vue semaine/jour | 0% | Créer |
| **Calendar** | Drag & drop | 0% | Créer |
| **Finance** | Tableau de bord comptable | 50% | Améliorer |
| **Finance** | Rapports financiers | 0% | Créer |
| **Homework** | Corrections | 30% | Améliorer |
| **Announcements** | Ciblage par rôle | 0% | Créer |
| **Certificates** | Génération PDF | 0% | Créer |
| **Certificates** | Vérification | 0% | Créer |
| **Resources** | Prévisualisation | 0% | Créer |
| **Appointments** | Calendrier RDV | 0% | Créer |
| **Appointments** | Disponibilités | 0% | Créer |

### Priorité MOYENNE (À faire ultérieurement)

| Module | Composant | Status | Action |
|--------|-----------|--------|--------|
| **Dashboard** | Super Admin | 50% | Améliorer |
| **Dashboard** | Directeur | 50% | Améliorer |
| **Analytics** | Comparaisons | 0% | Créer |
| **Analytics** | Heatmap | 0% | Créer |
| **AI** | Chat complet | 30% | Améliorer |
| **AI** | Insights | 0% | Créer |
| **Reports** | Génération PDF | 0% | Créer |
| **Reports** | Tableaux croisés | 0% | Créer |

---

# PARTIE 4: RECOMMANDATIONS FINALES

## 4.1 Plan d'Action par Phase

### Phase 1: Modules Critiques (2-3 semaines)

1. **Santé Scolaire**
   - Créer MedicalRecordForm
   - Créer AllergyList
   - Créer VaccinationCard
   - Créer EmergencyContactList
   - Créer HealthAlert

2. **Événements & Participations**
   - Créer EventRegistration
   - Créer PermissionForm (parents)
   - Créer ParticipationList

3. **Conformité RGPD**
   - Créer DataRequestForm
   - Créer ConsentManager
   - Créer AuditLogViewer (admin)

4. **Examens QCM**
   - Créer ExamInterface complet
   - Créer QuestionComponent
   - Créer TimerDisplay
   - Créer ResultsView

### Phase 2: Modules Haute Priorité (2-3 semaines)

1. **Présences Avancées**
   - Créer BulkAttendance
   - Créer AbsenceAlert
   - Créer JustificationForm

2. **Messagerie Complète**
   - Créer ThreadView
   - Créer AttachmentPicker
   - Créer SearchMessages

3. **Calendrier Interactif**
   - Créer WeekView, DayView
   - Créer DragDropScheduler
   - Créer RecurrenceConfig

4. **Finance Avancée**
   - Créer ReconciliationTool
   - Créer BulkInvoiceGenerator
   - Créer FinancialReports

### Phase 3: Modules Moyenne Priorité (3-4 semaines)

1. **Dashboards Complets**
   - Améliorer SuperAdminDashboard
   - Améliorer DirectorDashboard

2. **Analytics Avancés**
   - Créer ComparisonChart
   - Créer Heatmap
   - Créer DistributionChart

3. **LMS Complet**
   - Créer QuizComponent
   - Créer VideoPlayer
   - Créer CompletionTracker

4. **Orientation Complète**
   - Créer SeriesComparison
   - Créer AcceptanceForm
   - Créer OrientationReport

### Phase 4: Optimisations (2 semaines)

1. **Performance**
   - Implémenter code splitting
   - Optimiser lazy loading
   - Améliorer caching

2. **UX**
   - Animations smooth
   - Loading states
   - Error boundaries

3. **Tests**
   - Tests unitaires composants
   - Tests d'intégration
   - Tests E2E

---

## 4.2 Structure Composants Recommandée

```
src/components/
├── ui/                          # Composants base (shadcn/ui)
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── card.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── form.tsx
│   ├── calendar.tsx
│   ├── date-picker.tsx
│   ├── toast.tsx
│   ├── tooltip.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── tabs.tsx
│   ├── pagination.tsx
│   └── ...
│
├── layout/                      # Layout composants
│   ├── sidebar/
│   │   ├── index.tsx
│   │   ├── sidebar-item.tsx
│   │   ├── sidebar-group.tsx
│   │   └── user-menu.tsx
│   ├── header/
│   │   ├── index.tsx
│   │   ├── notifications.tsx
│   │   └── search.tsx
│   ├── dashboard-layout.tsx
│   └── page-layout.tsx
│
├── auth/                        # Auth & Permissions
│   ├── permission-gate.tsx
│   ├── role-gate.tsx
│   └── resource-gate.tsx
│
├── dashboard/                   # Dashboards par rôle
│   ├── super-admin-dashboard.tsx
│   ├── school-admin-dashboard.tsx
│   ├── director-dashboard.tsx
│   ├── teacher-dashboard.tsx
│   ├── student-dashboard.tsx
│   ├── parent-dashboard.tsx
│   └── accountant-dashboard.tsx
│
├── analytics/                   # Analytics
│   ├── charts/
│   │   ├── performance-chart.tsx
│   │   ├── grade-trends.tsx
│   │   ├── radar-chart.tsx
│   │   └── heatmap.tsx
│   ├── performance-badge.tsx
│   ├── risk-badge.tsx
│   └── subject-card.tsx
│
├── ai/                          # Intelligence Artificielle
│   ├── risk-card.tsx
│   ├── prediction-card.tsx
│   ├── insights-panel.tsx
│   └── chat-widget.tsx
│
├── finance/                     # Finance
│   ├── fees/
│   │   ├── fee-card.tsx
│   │   └── fee-list.tsx
│   ├── payments/
│   │   ├── payment-form.tsx
│   │   ├── payment-history.tsx
│   │   └── status-badge.tsx
│   ├── plans/
│   │   ├── payment-plan-card.tsx
│   │   └── installment-row.tsx
│   └── reports/
│       ├── fee-analytics.tsx
│       └── reconciliation-tool.tsx
│
├── lms/                         # Learning Management System
│   ├── course-card.tsx
│   ├── course-detail.tsx
│   ├── module-card.tsx
│   ├── lesson-view.tsx
│   ├── progress-bar.tsx
│   └── quiz-component.tsx
│
├── exams/                       # Examens
│   ├── exam-card.tsx
│   ├── exam-interface.tsx
│   ├── question.tsx
│   ├── timer.tsx
│   └── results-view.tsx
│
├── homework/                    # Devoirs
│   ├── homework-card.tsx
│   ├── create-form.tsx
│   ├── submission-form.tsx
│   └── grading-form.tsx
│
├── attendance/                  # Présences
│   ├── attendance-sheet.tsx
│   ├── bulk-attendance.tsx
│   ├── stats-card.tsx
│   └── alert.tsx
│
├── messages/                    # Messagerie
│   ├── conversation-list.tsx
│   ├── message-bubble.tsx
│   ├── input.tsx
│   └── thread-view.tsx
│
├── calendar/                    # Calendrier
│   ├── full-calendar.tsx
│   ├── month-view.tsx
│   ├── week-view.tsx
│   ├── event-card.tsx
│   └── schedule-view.tsx
│
├── medical/                     # Santé
│   ├── record-form.tsx
│   ├── allergy-list.tsx
│   ├── vaccination-card.tsx
│   └── emergency-contacts.tsx
│
├── events/                      # Événements
│   ├── event-card.tsx
│   ├── registration-form.tsx
│   └── permission-form.tsx
│
├── incidents/                   # Comportement
│   ├── incident-card.tsx
│   ├── create-form.tsx
│   ├── sanction-card.tsx
│   └── history.tsx
│
├── orientation/                 # Orientation
│   ├── orientation-card.tsx
│   ├── recommendation.tsx
│   ├── score-gauge.tsx
│   └── series-comparison.tsx
│
├── certificates/                # Certificats
│   ├── certificate-card.tsx
│   ├── preview.tsx
│   └── generator.tsx
│
├── resources/                   # Ressources
│   ├── resource-card.tsx
│   ├── upload-form.tsx
│   └── category-filter.tsx
│
├── appointments/                # Rendez-vous
│   ├── appointment-card.tsx
│   ├── calendar-view.tsx
│   ├── booking-form.tsx
│   └── availability-grid.tsx
│
├── announcements/               # Annonces
│   ├── announcement-card.tsx
│   └── create-form.tsx
│
├── compliance/                  # Conformité
│   ├── data-request-form.tsx
│   ├── consent-manager.tsx
│   └── audit-log-viewer.tsx
│
└── common/                      # Composants partagés
    ├── empty-state.tsx
    ├── loading-spinner.tsx
    ├── error-boundary.tsx
    └── async-component.tsx
```

---

## 4.3 Matrice Fonctionnalités par Rôle

### SUPER_ADMIN

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Vue globale multi-écoles, Stats système |
| Schools | CRUD complet, Configuration |
| Users | CRUD tous utilisateurs, Roles |
| System | Backups, Settings, Logs |
| Audit | Logs complets, Export |
| Reports | Rapports globaux |

### SCHOOL_ADMIN

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Stats établissement, Alerts |
| Settings | Configuration école |
| Users | CRUD utilisateurs école |
| Classes | CRUD classes |
| Academic | Années, périodes |
| Calendar | Vacances, événements |
| Reports | Rapports établissement |
| Compliance | Politiques rétention |

### DIRECTOR

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Vue pédagogique, Alerts |
| Classes | Vue détaillée classes |
| Teachers | Management enseignants |
| Students | Fiches élèves |
| Orientation | Validation orientations |
| Reports | Rapports pédagogiques |
| Analytics | Analytics avancés |

### TEACHER

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Mes classes, alerts |
| Classes | Mes classes, élèves |
| Grades | Saisie, modification notes |
| Attendance | Saisie présences |
| Homework | Création, correction |
| Exams | Création, résultats |
| Schedule | Mon emploi du temps |
| Resources | Upload ressources |
| Analytics | Analytics classes |
| Orientation | Recommandations |

### STUDENT

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Vue d'ensemble |
| Grades | Mes notes, bulletins |
| Schedule | Mon emploi du temps |
| Attendance | Mes présences |
| Homework | Devoirs, soumissions |
| Courses | Cours LMS, progression |
| Exams | Passage examens |
| Analytics | Mes performances |
| Orientation | Mon orientation |
| Resources | Ressources profs |
| Events | Événements |
| Certificates | Mes certificats |

### PARENT

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Vue enfants |
| Children | Fiches enfants, grades, attendance |
| Payments | Paiements, plans |
| Appointments | Prise RDV |
| Orientation | Orientation enfants |
| Messages | Communication |
| Compliance | Mes données RGPD |

### ACCOUNTANT

| Module | Fonctionnalités |
|--------|-----------------|
| Dashboard | Stats financières |
| Fees | CRUD frais |
| Payments | Enregistrement, vérification |
| Plans | Gestion plans paiement |
| Scholarships | Bourses |
| Reports | Rapports financiers |
| Invoices | Génération factures |

---

## 4.4 Checklist de Validation

### Frontend Minimal Viable (MVP)

- [ ] 7 dashboards fonctionnels
- [ ] Système auth complet
- [ ] Navigation par rôle
- [ ] CRUD utilisateurs
- [ ] CRUD classes/élèves/enseignants
- [ ] Gestion notes (saisie/lecture)
- [ ] Gestion présences
- [ ] Gestion emplois du temps
- [ ] Module finance (frais/paiements)
- [ ] LMS basique (cours/leçons)
- [ ] Messagerie basique
- [ ] Notifications
- [ ] Profile utilisateur
- [ ] Responsive design
- [ ] Thème sombre

### Frontend Complet

- [ ] Tout le MVP +
- [ ] Examens QCM interactifs
- [ ] Devoirs avec soumissions
- [ ] Calendrier complet
- [ ] Analytics avancés
- [ ] Prédictions IA
- [ ] Orientation scolaire
- [ ] Dossiers médicaux
- [ ] Événements participations
- [ ] Incidents/sanctions
- [ ] Conformité RGPD
- [ ] Rapports PDF
- [ ] Certificates
- [ ] Rendez-vous parents
- [ ] Resources pédagogiques

---

# CONCLUSION

Ce document présente une analyse complète de ton backend EduPilot et définit la vision d'un frontend ultra-élaboré correspondant.

**Points clés:**

1. **Backend robuste**: 54 modèles, 128+ API routes, système RBAC avec 133 permissions
2. **7 rôles hiérarchiques** avec permissions granulaires
3. **Frontend existant**: ~70% des composants de base, ~40% des composants métier
4. **Écart principal**: Modules santé, conformité RGPD, Examens QCM, Calendrier avancé

**Recommandation prioritaire:** Compléter d'abord les modules critiques (Santé, RGPD, Examens) avant d'enrichir les fonctionnalités existantes.

---

*Document généré le 2025-01-02*
*Pour EduPilot v1.0+*
