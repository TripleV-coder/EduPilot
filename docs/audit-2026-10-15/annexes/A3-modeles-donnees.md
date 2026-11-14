# Annexe A3 — Modèles de données (Prisma)

> Généré le 2026-10-15 par extraction automatique du code (AST TypeScript / analyse du schéma Prisma), branche `feat/enseignant-multi-ecoles`, commit `0d57d9c`. « École » = type du champ `schoolId` s'il existe ; sinon le rattachement passe par une relation (voir colonne Relations). « RLS » = table soumise à `FORCE ROW LEVEL SECURITY` par une migration. Champs « sensibles » = repérage par nom (heuristique, à valider). Relations en **gras** = suppression en cascade.

Total : **130 modèles**, 70 énumérations, 16 tables sous RLS forcée, 54 modèles avec `schoolId` direct.

| Modèle (table) | École | RLS | Suppr. logique | Relations (→ cible, onDelete) | Unicités | Champs sensibles | Routes lect./écr. |
|---|---|---|---|---|---|---|---|
| SubscriptionPlan (`subscription_plans`) | — |  |  |  | name; code | description | 3/1 |
| Organization (`organizations`) | — |  |  |  | code | description | 4/0 |
| OrganizationMembership (`organization_memberships`) | — |  |  | **organization→Organization**, **user→User** | ([organizationId, userId]) |  | 1/1 |
| School (`schools`) | — |  |  | parentSchool→School (SetNull), organization→Organization (SetNull), plan→SubscriptionPlan | code | address, phone, email, emailDomain, publicDescription, publicPhone, subscriptionStatus | 32/4 |
| AcademicConfig (`academic_configs`) | String |  |  | **school→School** | schoolId |  | 3/1 |
| AcademicYear (`academic_years`) | String |  |  | **school→School** | ([schoolId, name]) |  | 21/2 |
| Period (`periods`) | — |  |  | **academicYear→AcademicYear** | ([academicYearId, sequence]) |  | 18/3 |
| User (`users`) | String? |  |  | **school→School** | email | email, emailVerified, password, phone, passwordChangedAt, mustChangePassword, twoFactorSecret, twoFactorBackupCodes | 52/15 |
| Account (`accounts`) | — |  |  | **user→User** | ([provider, providerAccountId]) | providerAccountId, refresh_token, access_token, token_type, id_token | 1/1 |
| Session (`sessions`) | — |  |  | **user→User** | sessionToken | sessionToken | 2/1 |
| VerificationToken (`verification_tokens`) | — |  |  |  | token; ([identifier, token]) | token | 1/1 |
| PasswordResetToken (`password_reset_tokens`) | — |  |  |  | token | email, token | 2/2 |
| FirstLoginToken (`first_login_tokens`) | — |  |  | **user→User** | token | token, tempPassword | 1/1 |
| SystemSetting (`system_settings`) | — |  |  |  | key | isSecret | 2/1 |
| BackgroundJob (`background_jobs`) | String? | ✔ |  | **school→School** |  |  | 0/0 |
| TeacherProfile (`teacher_profiles`) | String |  | ✔ | **school→School**, **user→User** | userId; ([schoolId, matricule]) |  | 32/5 |
| TeacherSchoolAssignment (`teacher_school_assignments`) | String |  |  | **school→School**, **teacher→TeacherProfile**, **user→User** | ([teacherId, schoolId]); ([userId, schoolId]) |  | 5/4 |
| StudentProfile (`student_profiles`) | String | ✔ | ✔ | **school→School**, **user→User** | userId | dateOfBirth, gender, birthPlace, nationality, address | 58/4 |
| ParentProfile (`parent_profiles`) | — |  |  | **user→User** | userId |  | 36/3 |
| ParentStudent (`parent_students`) | — |  |  | **parent→ParentProfile**, **student→StudentProfile** | ([parentId, studentId]) | relationship | 8/2 |
| ScanPoint (`scan_points`) | String |  |  | **school→School** |  |  | 2/1 |
| ScanLog (`scan_logs`) | String |  |  | **school→School**, scanPoint→ScanPoint (SetNull), student→StudentProfile (SetNull) |  | reason | 2/1 |
| Badge (`badges`) | String |  |  | **school→School**, **student→StudentProfile** | studentId; code |  | 2/1 |
| Alumni (`alumni`) | String |  |  | **school→School**, student→StudentProfile (SetNull) |  | email, phone | 2/2 |
| StudentLinkCode (`student_link_codes`) | String |  |  | **student→StudentProfile** |  | codeHash | 2/2 |
| ClassLevel (`class_levels`) | String |  |  | **school→School** | ([schoolId, code]) |  | 4/1 |
| Class (`classes`) | String |  | ✔ | **classLevel→ClassLevel**, mainTeacher→TeacherProfile, **school→School** | ([schoolId, classLevelId, name]) |  | 30/3 |
| Subject (`subjects`) | String |  | ✔ | **school→School** | ([schoolId, code]) |  | 6/4 |
| ClassSubject (`class_subjects`) | — |  |  | **class→Class**, **subject→Subject**, teacher→TeacherProfile | ([classId, subjectId]) |  | 24/6 |
| Enrollment (`enrollments`) | — |  | ✔ | **academicYear→AcademicYear**, **class→Class**, **student→StudentProfile** |  |  | 33/3 |
| EvaluationType (`evaluation_types`) | String |  |  | **school→School** | ([schoolId, code]) |  | 4/3 |
| Evaluation (`evaluations`) | — | ✔ |  | **classSubject→ClassSubject**, **period→Period**, **type→EvaluationType** |  |  | 9/2 |
| Grade (`grades`) | — | ✔ | ✔ | **evaluation→Evaluation**, **student→StudentProfile** | ([evaluationId, studentId]) | excuseReason, excludedReason | 15/4 |
| Schedule (`schedules`) | — |  |  | **class→Class**, classSubject→ClassSubject |  |  | 3/2 |
| Fee (`fees`) | String |  | ✔ | academicYear→AcademicYear, **school→School** |  | description, amount | 10/3 |
| Payment (`payments`) | — | ✔ | ✔ | **fee→Fee**, receivedByUser→User, reconciledByUser→User, **student→StudentProfile** | reference | amount, notes | 22/10 |
| PaymentPlan (`payment_plans`) | — |  |  | **fee→Fee**, **student→StudentProfile** |  | totalAmount, paidAmount | 10/3 |
| InstallmentPayment (`installment_payments`) | — |  |  | **paymentPlan→PaymentPlan** |  | amount | 1/1 |
| Scholarship (`scholarships`) | — |  |  | **student→StudentProfile** |  | amount, notes | 3/2 |
| Attendance (`attendances`) | — | ✔ |  | **class→Class**, recordedBy→User, justificationSubmittedBy→User (SetNull), **student→StudentProfile** | ([studentId, classId, date, timeSlot]) | reason | 14/3 |
| Homework (`homeworks`) | — |  | ✔ | **classSubject→ClassSubject**, createdBy→User |  | description | 4/2 |
| HomeworkSubmission (`homework_submissions`) | — |  |  | gradedBy→User, **homework→Homework**, **student→StudentProfile** | ([homeworkId, studentId]) | content | 4/3 |
| Message (`messages`) | — |  | ✔ | parent→Message, **recipient→User**, **sender→User** |  | recipientId, content, deletedByRecipient | 6/5 |
| Notification (`notifications`) | — |  |  | **user→User** |  | message | 27/24 |
| AuditLog (`audit_logs`) | String? |  |  | school→School, **user→User** |  | ipAddress, userAgent | 61/54 |
| Resource (`resources`) | String |  | ✔ | classLevel→ClassLevel, **school→School**, subject→Subject, uploadedBy→User |  | description | 3/3 |
| Announcement (`announcements`) | String |  | ✔ | author→User, **school→School** |  | content | 3/2 |
| Certificate (`certificates`) | — |  |  | academicYear→AcademicYear, issuedBy→User, **student→StudentProfile** | certificateNumber | reason | 2/1 |
| Appointment (`appointments`) | — |  |  | createdBy→User, **parent→ParentProfile**, **student→StudentProfile**, **teacher→TeacherProfile** |  | notes, cancelReason | 5/3 |
| TeacherAvailability (`teacher_availabilities`) | — |  |  | **teacher→TeacherProfile** |  |  | 2/2 |
| DataConsent (`data_consents`) | — |  |  | **user→User** | ([userId, consentType, subjectUserId]) | ipAddress, userAgent | 1/0 |
| DataRetentionPolicy (`data_retention_policies`) | String |  |  | **school→School** | ([schoolId, dataType]) | description | 2/1 |
| DataAccessRequest (`data_access_requests`) | — |  |  | processor→User, **user→User** |  | notes | 9/5 |
| BehaviorIncident (`behavior_incidents`) | — | ✔ |  | reportedBy→User, **student→StudentProfile** |  | description, followUpNotes | 7/2 |
| Sanction (`sanctions`) | — | ✔ |  | assignedBy→User, **incident→BehaviorIncident** |  | description | 1/1 |
| MedicalRecord (`medical_records`) | — | ✔ |  | **student→StudentProfile** | studentId | bloodType, medicalHistory, notes | 3/2 |
| Allergy (`allergies`) | — | ✔ |  | **medicalRecord→MedicalRecord** |  | medicalRecordId, allergen | 1/1 |
| Vaccination (`vaccinations`) | — | ✔ |  | **medicalRecord→MedicalRecord** |  | medicalRecordId, vaccineName | 2/2 |
| EmergencyContact (`emergency_contacts`) | — | ✔ |  | **medicalRecord→MedicalRecord** |  | medicalRecordId, relationship, phone, alternatePhone, address | 2/2 |
| SchoolEvent (`school_events`) | String |  |  | createdBy→User, **school→School** |  | description, maxParticipants | 4/2 |
| EventParticipation (`event_participations`) | — |  |  | **event→SchoolEvent**, **student→StudentProfile** | ([eventId, studentId]) | notes | 1/1 |
| ExamTemplate (`exam_templates`) | — |  |  | **classSubject→ClassSubject**, createdBy→User |  | description | 6/4 |
| Question (`questions`) | — |  |  | **examTemplate→ExamTemplate** |  |  | 2/2 |
| ExamSession (`exam_sessions`) | — |  |  | **examTemplate→ExamTemplate**, **student→StudentProfile** | ([examTemplateId, studentId, attempt]) |  | 3/3 |
| ExamAnswer (`exam_answers`) | — |  |  | **examSession→ExamSession**, **question→Question** | ([examSessionId, questionId]) |  | 2/2 |
| Course (`courses`) | — |  |  | **classSubject→ClassSubject**, createdBy→User |  | description | 4/2 |
| CourseModule (`course_modules`) | — |  |  | **course→Course** |  | description | 3/2 |
| Lesson (`lessons`) | — |  |  | **module→CourseModule** |  | content | 4/1 |
| CourseEnrollment (`course_enrollments`) | — |  |  | **course→Course**, **student→StudentProfile** | ([courseId, studentId]) |  | 5/3 |
| LessonCompletion (`lesson_completions`) | — |  |  | **lesson→Lesson**, **student→StudentProfile** | ([lessonId, studentId]) |  | 4/2 |
| SchoolHoliday (`school_holidays`) | String |  |  | **academicYear→AcademicYear**, **school→School** |  | description | 2/2 |
| PublicHoliday (`public_holidays`) | String? |  |  | **school→School** |  | description | 1/1 |
| SchoolCalendarEvent (`school_calendar_events`) | String |  |  | **academicYear→AcademicYear**, **school→School** |  | description | 2/1 |
| StudentOrientation (`student_orientations`) | — |  |  | **academicYear→AcademicYear**, **classLevel→ClassLevel**, **student→StudentProfile** | ([studentId, academicYearId]) |  | 5/4 |
| OrientationRecommendation (`orientation_recommendations`) | — |  |  | **orientation→StudentOrientation**, validatedBy→User |  |  | 2/2 |
| SubjectGroupAnalysis (`subject_group_analyses`) | — |  |  | **orientation→StudentOrientation** | ([orientationId, subjectGroup]) |  | 0/0 |
| StudentAnalytics (`student_analytics`) | — |  |  | **academicYear→AcademicYear**, **period→Period**, **student→StudentProfile** | ([studentId, periodId]) |  | 7/1 |
| SubjectPerformance (`subject_performances`) | — |  |  | **analytics→StudentAnalytics**, **subject→Subject** | ([analyticsId, subjectId]) |  | 1/0 |
| GradeHistory (`grade_history`) | — |  |  | **academicYear→AcademicYear**, **period→Period**, **student→StudentProfile**, **subject→Subject** | ([studentId, subjectId, periodId]) |  | 0/0 |
| City (`cities`) | — |  |  |  | ([name, countryCode]) |  | 1/1 |
| Profession (`professions`) | — |  |  |  | name | description | 1/1 |
| Nationality (`nationalities`) | — |  |  |  | name; code |  | 1/1 |
| SubjectCategory (`subject_categories`) | String? |  |  | **school→School** | ([schoolId, code]) | description | 4/4 |
| ConfigOption (`config_options`) | String? |  |  | **school→School** | ([schoolId, category, code]) | description | 6/5 |
| ImportTemplate (`import_templates`) | String |  |  | **createdBy→User**, **school→School** | ([schoolId, name, type]) |  | 2/2 |
| CanteenMenu (`canteen_menus`) | String |  |  | **school→School** | ([schoolId, date]) | allergens | 0/0 |
| MealTicket (`meal_tickets`) | String |  | ✔ | payment→Payment, **school→School**, **user→User** | qrCode |  | 1/1 |
| Achievement (`achievements`) | — |  |  |  | code | description | 1/0 |
| UserAchievement (`user_achievements`) | — |  |  | **achievement→Achievement**, **user→User** | ([userId, achievementId]) |  | 0/0 |
| Leaderboard (`leaderboard`) | String |  |  | **school→School**, **user→User** | ([schoolId, userId, period]) |  | 0/0 |
| Book (`books`) | String |  |  | **school→School** |  | description | 2/1 |
| BorrowingRecord (`borrowing_records`) | — |  |  | **book→Book**, **student→StudentProfile** |  |  | 1/0 |
| TeacherInvitation (`teacher_invitations`) | String |  |  | **school→School** | codeHash | codeHash | 0/0 |
| CommunicationLog (`communication_logs`) | String |  |  | **school→School**, user→User (SetNull) |  | recipient | 0/0 |
| CommunicationPreference (`communication_preferences`) | — |  |  | **user→User** | userId |  | 0/0 |
| CommunicationTemplate (`communication_templates`) | String? |  |  | **school→School** |  | content | 2/2 |
| WalletAccount (`wallet_accounts`) | String |  |  | **school→School** | ([schoolId, name]) | accountRef | 1/0 |
| WalletTransaction (`wallet_transactions`) | String |  |  | **school→School**, **account→WalletAccount** |  | accountId, amountFcfa | 1/0 |
| ScheduledDisbursement (`scheduled_disbursements`) | String |  |  | **school→School**, account→WalletAccount (SetNull) |  | accountId, amountFcfa | 1/0 |
| Cagnotte (`cagnottes`) | String |  |  | **school→School**, class→Class (SetNull), host→User (SetNull) |  | description, expectedParticipants | 3/1 |
| CagnotteContribution (`cagnotte_contributions`) | — |  |  | **cagnotte→Cagnotte**, **parent→User** |  | amountFcfa | 1/1 |
| CagnotteJournalEntry (`cagnotte_journal_entries`) | — |  |  | **cagnotte→Cagnotte**, actor→User (SetNull) |  | amountFcfa, message | 2/2 |
| WellbeingReport (`wellbeing_reports`) | String |  |  | **school→School**, reporter→User (SetNull), reportedAbout→User (SetNull) |  |  | 3/2 |
| PsyAppointment (`psy_appointments`) | String |  |  | **school→School**, psy→User (SetNull), student→User (SetNull) |  |  | 2/0 |
| ClimatePulseWeek (`climate_pulse_weeks`) | String |  |  | **school→School** | ([schoolId, weekLabel]) |  | 1/0 |
| FiscalYear (`fiscal_years`) | String |  |  | **school→School** | ([schoolId, label]) |  | 5/0 |
| OhadaAccount (`ohada_accounts`) | String |  |  | **school→School** | ([schoolId, syscohadaCode]) |  | 3/2 |
| JournalEntry (`journal_entries`) | String |  |  | **school→School**, **fiscalYear→FiscalYear** | ([schoolId, pieceRef]) |  | 5/2 |
| JournalEntryLine (`journal_entry_lines`) | — |  |  | **journalEntry→JournalEntry**, debitAccount→OhadaAccount (SetNull), creditAccount→OhadaAccount (SetNull) |  | debitAccountId, creditAccountId, amountFcfa | 0/0 |
| VoiceCampaign (`voice_campaigns`) | String |  |  | **school→School**, author→User (SetNull) |  |  | 1/0 |
| VoiceCampaignTranslation (`voice_campaign_translations`) | — |  |  | **campaign→VoiceCampaign** | ([campaignId, lang]) |  | 0/0 |
| BenchmarkSnapshot (`benchmark_snapshots`) | String |  |  | **school→School** |  |  | 1/0 |
| BenchmarkSnapshotIndicator (`benchmark_snapshot_indicators`) | — |  |  | **snapshot→BenchmarkSnapshot** |  |  | 0/0 |
| TransportLine (`transport_lines`) | String |  |  | **school→School** | ([schoolId, number]) | note | 1/1 |
| Bus (`buses`) | String |  |  | **school→School**, line→TransportLine (SetNull) | ([schoolId, plateNumber]) | driverPhone | 1/0 |
| BusRoute (`bus_routes`) | — |  |  | **line→TransportLine** | ([lineId, order]) |  | 0/0 |
| StudentTransport (`student_transports`) | — |  |  | **student→StudentProfile**, **line→TransportLine**, stop→BusRoute (SetNull) | ([studentId, lineId]) |  | 1/0 |
| PerformanceMetric (`performance_metrics`) | — |  |  |  |  |  | 2/1 |
| TelemetryEvent (`telemetry_events`) | — |  |  |  |  |  | 1/1 |
| StaffAttendance (`staff_attendances`) | String |  |  | **school→School**, **user→User**, recordedBy→User (SetNull) | ([userId, date]) | note | 2/2 |
| LeaveRequest (`leave_requests`) | String |  |  | **school→School**, **user→User**, decidedBy→User (SetNull) |  | reason, decisionNote | 2/2 |
| PayrollEntry (`payroll_entries`) | String |  |  | **school→School**, **user→User**, createdBy→User (SetNull) | ([userId, period]) | baseSalary, netAmount | 2/2 |
| DocumentSignature (`document_signatures`) | String |  |  | **school→School**, signer→User (SetNull) |  | signatureData, contentHash, ipHash | 2/1 |
| StudentGuardian (`student_guardians`) | — | ✔ |  | **student→StudentProfile** |  | relationship, phone | 1/1 |
| Club (`clubs`) | String |  |  | **school→School**, supervisor→TeacherProfile (SetNull) | ([schoolId, name]) | description | 3/2 |
| ClubMembership (`club_memberships`) | — |  |  | **club→Club**, **student→StudentProfile** | ([clubId, studentId]) |  | 1/1 |
| ClassCouncil (`class_councils`) | — |  |  | **class→Class**, **period→Period** | ([classId, periodId]) |  | 2/1 |
| GradeCorrectionRequest (`grade_correction_requests`) | — | ✔ |  | **evaluation→Evaluation**, **student→StudentProfile** |  | excuseReason, reason, reviewNote | 2/2 |
| ExternalPeriodAverage (`external_period_averages`) | — | ✔ |  | **student→StudentProfile**, **period→Period** | ([studentId, periodId]) |  | 0/0 |
| StudentFormula (`student_formulas`) | — | ✔ |  | **classSubject→ClassSubject**, **period→Period**, **student→StudentProfile** | ([classSubjectId, periodId, studentId]) | reason | 3/1 |
