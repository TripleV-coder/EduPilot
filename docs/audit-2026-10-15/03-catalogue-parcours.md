# Livrable 3 — Catalogue des parcours

> Lot 1 (2026-10-15). Les **parcours critiques** sont décrits au format complet (13 sections), en condensé : une rubrique vide signifie « non applicable » ; une mention *à confirmer* signale ce qui n'a pas été vérifié dans le code.
> Les autres parcours sont **inventoriés** au §B avec leur statut. Leur description complète est planifiée au lot 2 (voir `00-INDEX.md`).
> Légende des statuts :
> - **Implémenté** : vérifié dans le code.
> - **Documenté** : décrit dans `docs/guide-utilisateur`, sans relecture du code dans ce lot.
> - **Incomplet** : une étape manque.
> - **Non référencé** : page sans lien entrant (annexe A2).
> - **Non confirmé** : non examiné.

---

## A. Parcours critiques (format complet)

### PARCOURS-PLATEFORME-001 — Installation initiale de la plateforme
1. **Identité** : domaine A ; acteur : installateur ; objectif : créer le premier SUPER_ADMIN et le premier établissement ; importance : critique, une seule fois.
2. **Préconditions** : base vide (`user.count() == 0`).
3. **Entrée** : page d'installation, `GET/POST /api/auth/initial-setup` (public, limité en débit).
4. **Déroulement** :
   - GET indique si l'installation est possible (`:186`) ;
   - POST valide le formulaire (Zod) ;
   - une transaction recompte les utilisateurs (`:85`), refuse si > 0 (409 `INITIAL_SETUP_ALREADY_DONE`, `:152`), puis crée l'établissement et le SUPER_ADMIN (`:109`), avec journal d'audit.
5. **Règles** : jamais deux installations.
6. **Sécurité** : route publique ; la seule barrière est « base vide ».
7. **Données** : `School`, `User`, `AuditLog`.
8. **Erreurs** : deux POST simultanés sur base vide peuvent tous deux lire 0 (READ COMMITTED, sans verrou) : **risque plausible** de deux SUPER_ADMIN (fenêtre minime, à l'installation seulement).
9. **États** : non installé → installé.
10. **Résultat** : compte racine et première école.
11. **Tests** : `e2e/recette/00-installation.spec.ts`, `e2e/fresh-install/`.
12. **Évaluation** : faible complexité.
13. **Références** : `src/app/api/auth/initial-setup/route.ts:78-152,186`.

### PARCOURS-AUTH-001 — Connexion (tous rôles)
1. **Identité** : domaine E ; tous les rôles ; critique.
2. **Préconditions** : compte actif, école non suspendue.
3. **Entrée** : `/login` → `POST /api/auth/callback/credentials` (NextAuth).
4. **Déroulement** :
   - email et mot de passe validés (Zod) ;
   - lecture de l'utilisateur ; verrou de compte ;
   - bcrypt ; en cas d'échec, compteur et `AuditLog LOGIN_FAILED` ;
   - école suspendue → erreur dédiée, seulement après un mot de passe correct ;
   - 2FA : avec code, vérification TOTP puis codes de secours (consommés) ; sans code, session « pré-2FA » confinée par le middleware ;
   - calcul des écoles accessibles et de l'école active ;
   - jeton JWT de 24 h.
5. **Règles** : verrouillage après échecs (`account-lockout.ts`) ; code 2FA erroné = échec compté.
6. **Sécurité** :
   - débit limité au proxy, avec un verrou par compte (mémoire du 2026-10-01) ;
   - **R-MS-05** : temps de réponse différent selon que l'email existe (pas de bcrypt factice) ;
   - jetons invalidés si le mot de passe change ou le compte est désactivé (contrôle par requête, cache de 30 s).
7. **Données** : `User`, `AuditLog`, `Session`.
8. **Erreurs** : base indisponible → `service_unavailable` (pas un faux « identifiants invalides », `login-failure.ts`).
9. **États** : anonyme → pré-2FA → authentifié → invalidé.
10. **Résultat** : session avec `role`, `schoolId`, `accessibleSchoolIds`.
11. **Tests** : `tests/integration-db/login-db-outage.test.ts`, `first-login-*.test.ts`, `tests/lib/auth/*`, `e2e/auth-flow.spec.ts`.
12. **Évaluation** : complexe (4 sorties d'erreur) ; bcrypt coûteux en CPU (mesuré au 2026-10-01).
13. **Références** : `src/lib/auth/config.ts:150-320,321-480`.

### PARCOURS-AUTH-002 — Première connexion avec mot de passe provisoire
1. **Identité** : tout compte créé par l'école ; critique.
2. **Préconditions** : `mustChangePassword = true`.
3. **Entrée** : lien de première connexion → `GET /api/auth/first-login?token=` puis `POST`.
4. **Déroulement** : jeton vérifié ; mot de passe provisoire exigé (401 s'il est faux) ; nouveau mot de passe haché ; `mustChangePassword = false`, `passwordChangedAt` mis à jour (les anciens jetons sont invalidés) ; cache d'état vidé (`invalidateUserStatusCache`, `:71`).
5. **Règles** : le mot de passe provisoire **n'expire pas** (constat A10 de l'audit précédent, non corrigé).
11. **Tests** : `tests/integration-db/first-login-{token,session,rate-limit}.test.ts`, `provisional-passwords*.test.ts`.
13. **Références** : `src/app/api/auth/first-login/route.ts:35-71`, `src/lib/auth/provisional-password.ts`.

### PARCOURS-AUTH-003 — Mot de passe oublié
- **Déroulement** :
  - `POST /api/auth/forgot-password` (débit limité), réponse identique que le compte existe ou non (`:38-45`) ;
  - suppression des anciens jetons ; jeton aléatoire de 32 octets **stocké en clair**, valable 1 h ;
  - email envoyé **de façon synchrone** ; puis `POST /api/auth/reset-password`.
- **Risques** :
  - R-MS-07 (jeton en clair en base) ;
  - écart de temps : 0,5 à 1 s de délai artificiel pour un compte inexistant, contre le temps d'envoi SMTP pour un compte existant (oracle de temps plausible, non mesuré) ;
  - l'email est écrit dans le journal en cas d'échec d'envoi (`:80`).
- **Références** : `src/app/api/auth/forgot-password/route.ts:30-90`, `reset-password/route.ts`.

### PARCOURS-MULTI-001 — Changement d'école active
Décrit en détail et testé : livrable 7, §2-3. Anomalies MS-01, MS-03 et MS-04.

### PARCOURS-MULTI-002 — Rejoindre une autre école par code d'invitation (enseignant)
- **Statut** : **incomplet**. Le service existe (`src/lib/teachers/school-membership.ts:21-77` : code à usage unique, consommé de façon atomique ; `invitation-code.ts` : HMAC, 7 jours). Il n'existe **aucune route ni aucun écran** (le modèle `TeacherInvitation` n'est utilisé par aucune route, annexe A3). Le retrait (`detachTeacherFromSchool`) est testé (livrable 7).
- **Restant (lot C prévu)** : routes d'émission et de saisie, écran « Mes écoles », message neutre si l'email existe déjà.

### PARCOURS-DIRECTION-001 — Création d'un compte (personnel, enseignant, parent)
1. **Acteur** : SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR (`POST /api/users`, `POST /api/teachers`, `POST /api/users/invite`).
4. **Déroulement** :
   - école cible = école **active** (SUPER_ADMIN : `body.schoolId`) ;
   - email unique (400 sinon) ;
   - quota d'enseignants pour un enseignant ;
   - transaction : `User` (+ `TeacherProfile` / `ParentProfile`, rattachement enseignant actif) ;
   - mot de passe provisoire ou fourni.
5. **Règles** : un enseignant **multi-écoles** ne peut être créé que par le SUPER_ADMIN (`teachers/route.ts:166-173`) ; un SUPER_ADMIN ne peut pas être créé ici (`users/route.ts:151`).
6. **Sécurité** : contrôlée par rôle ; pas de journal d'audit sur `POST /api/users` ni `POST /api/teachers` (drapeau A absent, annexe A1).
8. **Doublons** : email unique en base (pas de doublon possible), mais le message « existe déjà » révèle l'existence du compte (décision validée : à remplacer par un message neutre, lot C).
11. **Tests** : `tests/api/users-route.test.ts`, `users-invite.test.ts`, `teachers*.test.ts` (simulés), recette `03-personnel`.
13. **Références** : `src/app/api/users/route.ts:151-330`, `src/app/api/teachers/route.ts:140-297`, `src/app/api/users/invite/route.ts:40-160`.

### PARCOURS-INSCRIPTION-001 — Inscription d'un élève
1. **Acteur** : direction ou administration ; écran `/dashboard/students/inscription`, assistant en étapes.
4. **Déroulement** :
   - saisie (brouillon local possible, **MS-04**) ;
   - `POST /api/students` : quota d'élèves de l'école (`:45`) ;
   - unicité de l'email (`:59-64`) ;
   - matricule unique **parmi les élèves non supprimés de l'école** (`:69-76`, l'index n'est pas unique) ;
   - mot de passe provisoire si aucun n'est fourni ;
   - transaction : `User` (`mustChangePassword`), `StudentProfile`, `Enrollment`, `StudentGuardian` (responsable sans compte).
5. **Règles** : un responsable saisi ici devient un `StudentGuardian`, **pas** un compte parent. Il reçoit les SMS d'absence (voir PARCOURS-VIESCO-001).
8. **Concurrence** : deux inscriptions simultanées avec le même matricule peuvent passer la vérification applicative ensemble, faute de contrainte unique (index non unique pour libérer le matricule des élèves supprimés). **Risque plausible** : doublon de matricule. Test nécessaire : deux POST simultanés.
11. **Tests** : `tests/api/students*.test.ts`, recette `06-inscriptions`, `tests/integration-db/bulk-import-students.test.ts`.
13. **Références** : `src/app/api/students/route.ts:225-420`.

### PARCOURS-PARENT-001 — Lier son enfant avec un code de liaison
- **Déroulement** :
  - l'école émet un code (`POST /api/students/[id]/link-code`, SUPER_ADMIN/SCHOOL_ADMIN/DIRECTOR/STAFF) : 8 caractères, haché bcrypt, 14 jours, usage unique ;
  - le parent saisit matricule et code (`POST /api/parents/link-child`) ;
  - l'élève est recherché **dans l'école active du parent** (`:38`) ;
  - code actif et non expiré vérifié, puis consommé ; `ParentStudent` créé ; journal d'audit.
- **Limite constatée** : un parent dont l'enfant est dans une **autre** école ne peut pas le lier lui-même. Le message l'oriente vers l'autre école (`:51`). Comment cette école rattache un compte parent existant n'a pas été trouvé (Q-PARENT-01).
- **Sécurité** : pas de compteur d'essais propre à la route ; seul le débit global du proxy s'applique (espace de 31⁸ codes).
- **Références** : `src/app/api/parents/link-child/route.ts:10-138`, `src/lib/parents/link-code.ts`.

### PARCOURS-ENSEIGNANT-001 — Saisie des notes d'une évaluation
1. **Acteur** : TEACHER **seul** (`grades/batch` POST : `allowedRoles: ["TEACHER"]`).
4. **Déroulement** :
   - `POST /api/evaluations` (TEACHER) ;
   - `POST /api/grades/batch` : période modifiable (`guardPeriodWritable`, année non clôturée) ;
   - enseignant **de la matière** (`assertSubjectTeacher`) ;
   - période non verrouillée par le conseil (`assertNotCouncilLocked`) ;
   - valeurs conformes au barème de l'école (`checkGradeValues`) ;
   - `upsert` par `(evaluationId, studentId)`, unique en base ;
   - historique (`logGradeChanges`) ; invalidation des caches `/api/grades*` et `/api/analytics`.
5. **Règles** : moyenne (MI + D1 + D2) / 3 et formules par école ou par enseignant (livrable 11, `docs/ANALYSE_PRECISION_CALCULS.md`) ; absence non justifiée = 0 ; note manquante = « à justifier ».
8. **Répétition** : idempotente (upsert sur clé unique). Brouillon local par classe et matière.
10. **Effets** : moyennes recalculées à la lecture (mémoïsation 15 s invalidée par les écritures) ; instantanés d'analyse synchronisés (`analytics-sync`). **Aucune notification aux familles** (constat A6).
11. **Tests** : `tests/precision/*` (banc de précision), `tests/api/grades*`, `grades-flow.spec.ts`, recette `08`.
13. **Références** : `src/app/api/grades/batch/route.ts:39-88`, `src/lib/academic/grade-write-guard.ts`, `src/lib/academic/class-averages.ts`.

### PARCOURS-ENSEIGNANT-002 — Correction d'une note après verrouillage
- **Déroulement** :
  - l'enseignant demande une correction (`POST /api/grades/corrections`, TEACHER, journal) ;
  - la direction approuve ou refuse (`PATCH /api/grades/corrections/[id]`, SUPER_ADMIN/SCHOOL_ADMIN/DIRECTOR) ;
  - en transaction : note modifiée, demande close, journal ; invalidation des caches.
- La famille peut demander un rendez-vous (`POST /api/grades/corrections/appointment`, STUDENT/PARENT).
- **Constat** : aucune notification à la famille après correction (A6).
- **Références** : `src/app/api/grades/corrections/*`.

### PARCOURS-DIRECTION-002 — Conseil de classe et bulletin
- **Conseil** : `POST /api/grades/councils` (rôles `VALIDATE_ROLES`, journal) crée un `ClassCouncil` qui **verrouille** la période pour la classe ; toute écriture de note est alors refusée (`assertNotCouncilLocked`).
- **Bulletin** : `GET/POST /api/grades/report-cards`.
  - Le POST rend **des données JSON**, pas un PDF : le PDF est produit dans le navigateur (`:322-375`).
  - Il n'existe **pas d'état « publié »** pour les bulletins : aucun champ `isPublished` sur un modèle de bulletin (annexe A3).
  - Aucune notification aux familles.
- **Sécurité** : TEACHER autorisé pour **tout élève de l'école** (`ensureSchoolAccess` seul), voir MS-02.
- **Questions** : Q-BULL-01 (publication), Q-ROLE-03 (enseignant).

### PARCOURS-VIESCO-001 — Faire l'appel et prévenir les familles
- **Acteur** : SUPER_ADMIN/SCHOOL_ADMIN/DIRECTOR/TEACHER (`POST /api/attendance/bulk`).
- **Déroulement** :
  - date modifiable (année non clôturée) ;
  - tous les élèves sont inscrits dans la classe ;
  - transaction : pour chaque élève, `findFirst` puis `update` ou `create` avec `timeSlot = null` ;
  - les élèves qui **deviennent** absents ou en retard sont notifiés après coup (`notifyParentsOfAbsences`) : notification interne et email au compte parent, SMS aux responsables sans compte, via la file `background_jobs`.
- **Anomalie structurelle confirmée (CC-01)** :
  - la contrainte unique `(studentId, classId, date, timeSlot)` ne protège pas une ligne où `timeSlot` est NULL (sémantique PostgreSQL, index sans `NULLS NOT DISTINCT`, migration `20260412090843_sync_final:479`) ;
  - deux enregistrements simultanés du même appel (double clic, deux appareils) peuvent donc créer **deux présences** pour le même élève et le même jour ;
  - doublon effectif **non reproduit** ; test à écrire : deux POST simultanés, puis compter les lignes.
- **Re-notification** : un ré-enregistrement identique ne re-notifie pas (`:114`). En cas de doublon concurrent, la notification peut partir deux fois.
- **Références** : `src/app/api/attendance/bulk/route.ts:66-159`, `src/lib/attendance/notify-parents.ts`.

### PARCOURS-FINANCE-001 — Paiement en ligne (Mobile Money / FedaPay / Flutterwave / Paystack)
Refondu et testé le 2026-10-15 (commit `0d57d9c`) :
- reste à payer : échéancier, sinon montant du frais, moins le validé et le rapproché, moins les essais de moins de 24 h ;
- verrou par élève et par frais ;
- validation seulement au montant exact et en XOF ;
- état `EXPIRED` et réconciliation quotidienne ;
- confirmation tardive acceptée ; trop-perçu noté.

Détail : `src/lib/finance/online-payments.ts` ; tests `tests/integration-db/online-payments.test.ts` (18 cas) ; guide `docs/guide-utilisateur/09-finance.md` §9.3.
**Restant** : remboursement des trop-perçus (Q-FIN-01).

### PARCOURS-FINANCE-002 — Encaissement au guichet
- `POST /api/payments/cash` (SUPER_ADMIN/SCHOOL_ADMIN/DIRECTOR/ACCOUNTANT) : transaction ; plafond `totalAmount − paidAmount` de l'échéancier (`:67-74`) ; invalidation des caches.
- Dans la transaction, l'encaissement est suivi de `syncPaymentPlanLedger` (`:91`) : échéances et `paidAmount` sont recalculés. Deux encaissements **successifs** sont donc refusés d'après le code (non reproduit par un test).
- **DA-10 (livrable 5)** : le plafond ignore un paiement **en ligne** déjà confirmé, car les confirmations en ligne ne resynchronisent pas l'échéancier. *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)*
- **Concurrence (SC-B-11)** : le plafond est lu **avant** la transaction (`:67-74`, transaction à `:76`), sans le verrou `lockStudentFee` (vérifié le 2026-10-16). Deux encaissements au guichet simultanés peuvent donc passer : risque plausible, à reproduire. Un encaissement au guichet pendant une confirmation en ligne est traité comme un trop-perçu à la confirmation (`confirmOnlinePayment`).
- **Références** : `src/app/api/payments/cash/route.ts`.

### PARCOURS-FINANCE-003 — Relances d'échéances
- **Déclenchement** : `POST /api/finance/reminders` (manuel) et maintenance quotidienne (`automation.service.ts` → `runInstallmentReminders`).
- **Mécanisme** : relances étagées (UPCOMING / DUE / OVERDUE / CRITICAL), marquage **avant** l'envoi avec retour arrière en cas d'échec (mémoire du 2026-07-21), envoi via la file de tâches.
- **DA-10** : la relance se fonde sur le statut des échéances. Toutes les voies manuelles le resynchronisent, mais pas les confirmations en ligne. Une famille qui vient de payer **en ligne** peut donc être relancée jusqu'au prochain encaissement manuel sur ce frais. Défaut observé dans le code, conséquence non reproduite. *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)*
- **Références** : `src/lib/finance/reminders.ts`, `src/app/api/finance/reminders/route.ts:119`.

### PARCOURS-ANNEE-001 — Clôture de l'année et promotion
- **Clôture** : `PATCH /api/academic-years/[id]/status` (`ACADEMIC_YEAR_CLOSE`), CLOSED ou réouverture ACTIVE ; journal ; invalidation.
- **Après clôture** : les écritures sont refusées par `guardPeriodWritable` / `guardAttendanceDateWritable` (7 routes l'appellent).
- **Promotion** : `POST /api/classes/[id]/promote` (SUPER_ADMIN/SCHOOL_ADMIN/DIRECTOR) → `promoteClass` (`src/lib/students/promotion.ts`) :
  - l'année cible doit être postérieure ;
  - l'inscription source est close par une mise à jour conditionnelle (idempotente, `EnrollmentStatus.COMPLETED`) ;
  - boucle de requêtes par élève (`:246-288`, livrable 8).
- **Tests** : `tests/integration-db/year-closure-and-notices.test.ts`, recette `15-fin-d-annee`.

### PARCOURS-RGPD-001 — Droits sur les données et conservation
- **Personne concernée** : `GET/DELETE /api/user/data` (export, demande de suppression), `POST /api/compliance/data-requests` (journal, notification).
- **Conservation** : `POST /api/system/retention`, protégé par `CRON_SECRET`, purge selon `DataRetentionPolicy` (`src/lib/security/retention.ts`), aperçu possible (`run-task.sh retention --dry`). **Absent** de la planification livrée (`scripts/cron/edupilot.cron` ne lance que `backup` et `automation`) : *à confirmer côté exploitation*.
- **Suppression définitive d'un compte** (`POST /api/users/[id]/delete`, HARD = SUPER_ADMIN) : efface aussi les **paiements et notes** de l'élève (liste des écritures, annexe A1). Point ouvert déjà signalé dans le guide (9.12).
- **Tests** : `tests/integration-db/data-rights.test.ts`, `retention*.test.ts`, `compliance-retention.test.ts`.

---

## B. Inventaire des autres parcours

Le statut par domaine est déduit des routes et pages existantes (annexes A1 et A2). Une page **non référencée** n'a aucun lien entrant dans le code : elle n'est atteignable que par URL.

| ID | Domaine | Parcours | Points d'entrée | Statut |
|---|---|---|---|---|
| PARCOURS-PLATEFORME-002 | A | Console racine (écoles, abonnements, utilisateurs, journaux) | `/dashboard/root-control*`, `/api/root/*` | Implémenté ; 4 sous-pages non référencées |
| PARCOURS-RESEAU-001 | B | Vue réseau, membres d'organisation | `/api/organizations*`, nav NETWORK_ADMIN (4 liens) | Implémenté partiellement ; `SCHOOL_CREATE` accordé au NETWORK_ADMIN mais aucune route ne le lui permet (création réservée au SUPER_ADMIN, `schools/route.ts:176`) |
| PARCOURS-ECOLE-001 | C | Configuration de l'école (cycles, modules, barème, paramètres, salles…) | `/dashboard/settings/*` (26 pages) | Implémenté ; 5 sous-pages non référencées |
| PARCOURS-DIRECTION-003 | D | Gestion des utilisateurs, comptages par rôle | `/dashboard/users`, `/api/users*` | Implémenté |
| PARCOURS-AUTH-004 | E | Activation de la 2FA | `/api/auth/mfa/setup`, `/dashboard/settings/security` | Implémenté |
| PARCOURS-INSCRIPTION-002 | F, AF | Import CSV (élèves, parents, enseignants, classes, emplois du temps) | `/dashboard/import`, `/api/import/*` | Implémenté, tout-ou-rien, plafonné (mémoire 2026-06-13) |
| PARCOURS-ELEVE-001 | G | Fiche élève, vue 360°, carte scolaire QR | `/dashboard/students/[id]`, `/api/students/[id]/*` | Implémenté |
| PARCOURS-ENSEIGNANT-003 | I | Disponibilités | `/api/teachers/[id]/availability` | Implémenté côté API ; écran « Mes disponibilités » prévu au lot C |
| PARCOURS-RH-001 | J | Personnel : présence, congés, paie (OHADA) | `/dashboard/staff/*` | Implémenté ; `/dashboard/staff` est un alias redirigé, `/dashboard/teachers/hr` non référencée |
| PARCOURS-CLASSE-001 | K, L | Classes, matières, affectations (`class-subjects`, lot) | `/dashboard/classes`, `/api/class-subjects*` | Implémenté ; `/dashboard/settings/class-subjects` non référencée |
| PARCOURS-CALENDRIER-001 | M | Années, périodes, vacances, jours fériés, événements | `/dashboard/calendar*`, `/api/calendar/*` | Implémenté |
| PARCOURS-EDT-001 | N | Emploi du temps | `/dashboard/schedule`, `/api/schedules` | Implémenté |
| PARCOURS-ENSEIGNANT-004 | O, P | Formule de calcul par matière (enseignant) | `/api/class-subjects/[id]/formula` (PUT TEACHER) | Implémenté (mémoire du 2026-10-03) |
| PARCOURS-DIRECTION-004 | R | Classements, résultats, statistiques de notes | `/api/grades/statistics`, `/api/analytics*` | Implémenté |
| PARCOURS-VIESCO-002 | S | Justifier une absence (parent) | `/api/attendance/justifications` | Implémenté |
| PARCOURS-VIESCO-003 | S | Incidents, sanctions, discipline | `/api/incidents*`, `/dashboard/discipline` | Implémenté ; `/dashboard/discipline` non référencée |
| PARCOURS-PEDA-001 | T | Devoirs, ressources, LMS (cours, leçons) | `/api/homework`, `/api/courses*`, `/dashboard/lms` | Implémenté ; LMS non référencé |
| PARCOURS-ORIENT-001 | U | Orientation CEP / post-BEPC / préparation BEPC | `/dashboard/orientation/*`, `/dashboard/bepc-prep` | Implémenté ; 3 pages non référencées |
| PARCOURS-COMM-001 | V | Messagerie, diffusion, annonces, modèles | `/api/messages*`, `/api/announcements`, `/api/communication/*` | Implémenté |
| PARCOURS-COMM-002 | V | Notifications vocales, WhatsApp | `/dashboard/voice-notifs`, `/dashboard/whatsapp` | Pages non référencées ; état fonctionnel non confirmé |
| PARCOURS-ECOUTE-001 | W | Signalement à la cellule d'écoute (anonymat possible) | `/dashboard/wellbeing/new`, `/api/wellbeing/reports` | Implémenté ; code de suivi d'un signalement anonyme : décision en attente |
| PARCOURS-FINANCE-004 | X, Y | Frais, échéanciers, bourses | `/api/fees`, `/api/payment-plans`, `/api/scholarships` | Implémenté ; `/dashboard/finance/scholarships` non référencée |
| PARCOURS-FINANCE-005 | AB | Rapprochement en masse | `/dashboard/finance/reconciliation`, `/api/payments/reconcile` | Implémenté |
| PARCOURS-FINANCE-006 | AC | Remboursement d'un trop-perçu | — | **Absent** (Q-FIN-01) |
| PARCOURS-FINANCE-007 | AD | Reçus, avis de paiement | `/api/payments/[id]/invoice`, `payment-notices` | Implémenté |
| PARCOURS-COMPTA-001 | — | Comptabilité OHADA (écritures, export) | `/dashboard/accounting*`, `/api/accounting/*` | Implémenté |
| PARCOURS-RAPPORT-001 | AE, AF | Tableaux de bord par rôle, rapports, exports CSV/PDF | `/dashboard`, `/api/analytics*`, `/api/finance/export` | Implémenté ; `/dashboard/finance/export` et `/reports` non référencées |
| PARCOURS-PREF-001 | AH | Profil, apparence, langue, notifications, mes données | `/dashboard/settings/*` | Implémenté |
| PARCOURS-SUPPORT-001 | AI | Support / assistance | — | **Non trouvé** (aucune route ni page « support ») |
| PARCOURS-AUDIT-001 | AJ | Journaux d'audit | `/dashboard/audit-logs`, `/api/audit-logs` | Implémenté ; `/dashboard/admin/logs` non référencée (doublon probable) |
| PARCOURS-EXPLOIT-001 | AK | Sauvegardes | `scripts/backup/postgres-backup.sh` (cron 02:00), `/dashboard/system/backup` | Script planifié ; page non référencée ; restauration : voir `docs/RUNBOOK.md` (non relu) |
| PARCOURS-EXPLOIT-002 | AL | Maintenance quotidienne (analyses, absentéisme, relances, paiements 24 h) | `/api/system/automation`, cron 06:00 | Implémenté ; bail exclusif contre les doubles exécutions |
| PARCOURS-SERVICES-001 | AM | Cantine, transport, bibliothèque, clubs, contrôle d'accès, alumni, cagnottes, portefeuille, signatures, IA, gamification, examens en ligne | `/dashboard/<module>` | Implémentés côté API ; **pages non référencées** pour cantine, transport, bibliothèque, clubs, contrôle d'accès, alumni, gamification (annexe A2). Accès réel par la navigation à confirmer en recette |
| PARCOURS-PUBLIC-001 | AM | Vitrine publique et annuaire des écoles | `/api/public/*`, `/api/explorer/*` | Implémenté (public par conception) |
