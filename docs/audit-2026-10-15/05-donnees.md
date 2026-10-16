# Livrable 5 — Cartographie des données

> Inventaire exhaustif : **annexe A3** (130 modèles, 70 énumérations). Pour chaque modèle elle donne le rattachement à l'école, la RLS, la suppression logique, les relations avec leur comportement de suppression, les unicités, les champs sensibles (heuristique) et le nombre de routes qui le lisent et l'écrivent.
> Aucun changement de schéma n'est proposé ici. Les conséquences de chaque changement envisagé sont décrites au livrable 10.

## 1. Chiffres clés (extraction du 2026-10-15)

| Indicateur | Valeur |
|---|---|
| Modèles | 130 |
| Modèles avec `schoolId` direct | 54 ; les 76 autres sont rattachés à l'école par une relation (élève, classe, frais…) ou sont globaux |
| Tables sous RLS forcée | 16 : `student_profiles`, `grades`, `evaluations`, `attendances`, `payments`, `medical_records`, `allergies`, `vaccinations`, `emergency_contacts`, `behavior_incidents`, `sanctions`, `grade_correction_requests`, `student_formulas`, `external_period_averages`, `student_guardians`, `background_jobs` |
| Modèles **hors RLS** reliés à une personne | 60, dont `Enrollment`, `Class`, `PaymentPlan`, `Scholarship`, `ParentStudent`, `Message`, `Notification`, `StudentAnalytics`, `GradeHistory`, `WellbeingReport`, `PsyAppointment`, `PayrollEntry`, `LeaveRequest`, `DataAccessRequest`, `AuditLog` (liste complète dans l'annexe A3) |
| Relations avec suppression en cascade | 172 ; 52 depuis `School`, 28 depuis `StudentProfile`, 23 depuis `User` |
| Modèles utilisés par aucune route | 14 ; 7 sont utilisés par des services (`BackgroundJob`, `GradeHistory`, `CanteenMenu`, `UserAchievement`, `Leaderboard`, `TeacherInvitation`, `ExternalPeriodAverage`). `SubjectGroupAnalysis`, `CommunicationLog` et `CommunicationPreference` ne sont référencés **nulle part**, hors types. `JournalEntryLine`, `VoiceCampaignTranslation`, `BenchmarkSnapshotIndicator` et `BusRoute` sont accédés par relations imbriquées |

## 2. Données maîtres et données dérivées

| Donnée maîtresse | Données dérivées | Mode de recalcul | Référence |
|---|---|---|---|
| `Grade`, `Evaluation`, `EvaluationType`, `ClassSubject` (coefficients, formules), `StudentFormula`, `ExternalPeriodAverage`, `ClassCouncil`, `Enrollment`, `Period`, `ConfigOption` | Moyennes de période et annuelles, rangs | **À la lecture** (moteur unique `average-engine`), mémoïsé 15 s, invalidé à chaque écriture de ces 10 modèles | `src/lib/academic/class-averages.ts`, `src/lib/db/write-events.ts` |
| idem | `StudentAnalytics`, `SubjectPerformance` (instantanés) | Synchronisation après écriture de notes et maintenance quotidienne (`syncAllSchoolsAnalytics`) ; recalcul complet d'une école mesuré à 236 s pour 2 985 instantanés | `src/lib/services/analytics-sync.ts`, `automation.service.ts` |
| idem | `GradeHistory` | Écrit par `logGradeChanges` | `grade-write-guard.ts` |
| `Fee`, `PaymentPlan`, `Scholarship`, `Payment` | Reste à payer, taux de recouvrement, avis de paiement, tableaux de bord finance | À la lecture (`computeStudentBalances`, `getFeeBalance`) ; tableau de bord mémoïsé 60 s | `src/lib/finance/expected-fees.ts`, `online-payments.ts` |
| `PaymentPlan.paidAmount`, `InstallmentPayment.status` | Solde de l'échéancier, statut des échéances (PENDING / OVERDUE / PAID), état de l'échéancier | Recalculés **en totalité** par `syncPaymentPlanLedger` à partir des paiements validés ou rapprochés, en affectant les paiements dans l'ordre chronologique à l'échéance impayée la plus ancienne. Appelée par toutes les voies d'encaissement manuel (8 appels), **pas** par les confirmations de paiement en ligne. Voir DA-10 *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | `src/lib/finance/helpers.ts:269-400` |
| `Attendance` | Taux de présence, alertes d'absentéisme | À la lecture ; cache de 60 s | `/api/attendance/stats` |

**Ce qui impose un recalcul** : une note, un coefficient, une formule, un barème, une affectation de matière, une inscription ou un changement de période recalculent les moyennes à la lecture suivante. Les **instantanés d'analyse** (taux de réussite, risques, tableaux de bord) attendent la synchronisation. Une modification de paramètres d'école déclenche un recalcul long : plus de 20 minutes observées (mémoire du 2026-10-14).

## 3. Contraintes et risques d'incohérence (constatés)

| ID | Constat | Preuve | Classe |
|---|---|---|---|
| DA-01 | Présences : la contrainte unique `(studentId, classId, date, timeSlot)` **ne protège pas** les lignes où `timeSlot` est NULL. L'appel en masse écrit toujours NULL | `schema.prisma` (`Attendance`), migration `20260412090843_sync_final:479`, `attendance/bulk/route.ts:96-130` | Anomalie structurelle confirmée ; doublon non reproduit |
| DA-02 | Matricule élève : index **non unique** (pour libérer le matricule d'un élève supprimé). L'unicité n'est contrôlée que dans le code, sans verrou | `StudentProfile @@index([schoolId, matricule])`, `students/route.ts:69-76` | Risque plausible sous concurrence |
| DA-03 | **Suppression définitive d'une école** (`DELETE /api/schools/[id]`, SUPER_ADMIN) : `prisma.school.delete` sans confirmation, sans journal, sans suppression logique. Les 52 cascades emportent comptes, élèves, notes, paiements, comptabilité et journaux | `src/app/api/schools/[id]/route.ts:118-135` | Anomalie confirmée (irréversible, non tracée) |
| DA-04 | **Le journal d'audit est supprimé avec l'utilisateur** (`AuditLog.user onDelete: Cascade`). Une suppression définitive de compte ou d'école efface la trace de ses actions | `schema.prisma` modèle `AuditLog` | Anomalie confirmée (traçabilité) |
| DA-05 | Suppression définitive d'un élève : ses **paiements et notes** sont effacés (pièces comptables) | annexe A1 `/api/users/[id]/delete`, `Payment.student onDelete: Cascade` | Déjà signalé (guide 9.12) |
| DA-06 | `Payment.fee onDelete: Cascade` : supprimer un frais supprimerait ses paiements. L'API l'empêche (suppression logique, 409 si des paiements existent, `fees/[id]/route.ts:74-81`), mais la base ne le garantit pas | schéma + route | Protection applicative seulement |
| DA-07 | `School.isActive` sert à la fois à la **suspension par la plateforme** (connexion bloquée) et à un champ modifiable par la direction (`PATCH /api/schools/[id]` avec `SCHOOL_UPDATE`). Un DIRECTOR ou SCHOOL_ADMIN peut donc suspendre sa propre école ou une annexe accessible | `schools/[id]/route.ts:10-30,79-110`, `school-suspension.ts` | Anomalie confirmée de conception (Q-ECOLE-01) |
| DA-10 | **Échéancier non resynchronisé après un paiement en ligne.**<br>La fonction `syncPaymentPlanLedger` (`src/lib/finance/helpers.ts:269-400`) recalcule `paidAmount`, le statut des échéances et l'état de l'échéancier à partir des paiements validés ou rapprochés. Elle est appelée par toutes les voies d'encaissement manuel recensées :<br>• guichet `payments/cash/route.ts:91` ;<br>• saisie `payments/route.ts:284` et `finance/payments/route.ts:121` ;<br>• modification ou annulation `payments/[id]/route.ts:128,192` et `finance/payments/[id]/route.ts:89,161` ;<br>• paiement d'échéance `payment-plans/[id]/installments/[installmentId]/pay/route.ts:126`.<br>Elle n'est **pas** appelée par les confirmations en ligne (`confirmOnlinePayment` : webhooks FedaPay, MoMo, Flutterwave, Paystack) ni par la réconciliation à 24 h (`reconcileStalePayments`), toutes dans `src/lib/finance/online-payments.ts`.<br>**Conséquence** : incohérence **temporaire** après un paiement en ligne, jusqu'au prochain encaissement manuel sur le même frais (la resynchronisation recalcule tout). Elle touche :<br>1. les échéances (statut PENDING / OVERDUE) ;<br>2. les relances étagées (`reminders.ts:130-153`) ;<br>3. les SMS (`notifications/sms/route.ts:136-139`) ;<br>4. l'espace parent (`finance/my-payments/route.ts:80`) ;<br>5. le plafond du guichet (`payments/cash/route.ts:67-74`), qui peut accepter un montant déjà payé en ligne.<br>Les tableaux de bord, rapports et avis de paiement lisent la somme des paiements : ils ne sont **pas** affectés.<br>**Risque distinct (SC-B-11)** : le plafond du guichet est lu **avant** la transaction (`cash/route.ts:67-74`, transaction à `:76`), sans le verrou `lockStudentFee` utilisé par le paiement en ligne. Deux encaissements **simultanés** peuvent passer. Deux encaissements **successifs** sont refusés d'après le code, puisque le premier resynchronise `paidAmount` (non reproduit par un test). *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | Appels recensés par `grep -rn "syncPaymentPlanLedger(" src` ; absence d'appel dans `online-payments.ts` et dans les webhooks | **Défaut observé dans le code** (non reproduit par un test) ; conséquences plausibles non reproduites ; SC-B-11 : risque plausible |
| DA-08 | Un rôle par utilisateur (`User.role`) et `User.roles[]` sans effet serveur | livrable 7 §8 | Limite connue |
| DA-09 | `TeacherProfile.schoolId` (école principale) en plus de `TeacherSchoolAssignment.isPrimary` : deux sources pour l'école principale | schéma ; `school-membership.ts:46,97` les combine | Redondance |

## 4. Données sensibles

Par catégorie, vérification par nom de champ (colonne « Champs sensibles » de l'annexe A3) :
- **santé** : `MedicalRecord`, `Allergy`, `Vaccination`, `EmergencyContact` (sous RLS) ;
- **bien-être et écoute** : `WellbeingReport`, `PsyAppointment` (hors RLS) ;
- **identité de mineurs** : `StudentProfile` (RLS), `User` (hors RLS) ;
- **finance** : `Payment` (RLS), `PaymentPlan`, `Scholarship`, `PayrollEntry` (hors RLS) ;
- **secrets** : `User.password`, `twoFactorSecret`, `twoFactorBackupCodes` (hachés), `PasswordResetToken.token` (**en clair**), `FirstLoginToken`, `StudentLinkCode.codeHash`, `TeacherInvitation.codeHash` (HMAC).

**Priorité d'extension de la RLS suggérée par l'exposition** (livrable 10) : `wellbeing_reports`, `psy_appointments`, `enrollments`, `payment_plans`, `scholarships`, `student_analytics`, `messages`, `payroll_entries`.

## 5. Conservation

`DataRetentionPolicy` par école et par type de données, purge par `/api/system/retention` (livrable 3, PARCOURS-RGPD-001). Les tâches terminées de la file sont purgées (`purgeFinishedJobs`). Les obligations légales de conservation (pièces comptables, bulletins) ne sont **pas** documentées dans le dépôt : Q-RGPD-01.
