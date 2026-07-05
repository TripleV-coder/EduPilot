# Design — Combler les manques de parité EduNet (features réellement utiles)

Date : 2026-07-04
Branche : chore/p1-p3-completion (ou branche dédiée par chantier)
Source du gap : recheck du site live `edunet.star-kin.com` (about.php, setup_school.php),
croisé avec l'inventaire EduPilot (pages, routes, `prisma/schema.prisma`).
Voir mémoire `project_edunet_parite`.

## Contexte

EduPilot couvre déjà **tout le core EduNet** et a **déjà livré la roadmap annoncée d'EduNet**
(Mobile Money, bibliothèque, LMS, transport, cantine, QR, réseau national) + un large value-add
(cagnotte, bien-être, gamification, orientation, OHADA, RGPD, benchmark…). Restent 6 manques
factuels. Après filtrage par valeur réelle pour une école béninoise, **4 sont retenus**, 2 écartés.

### Écartés (hors périmètre, avec raison)
- **Multi-pays / multi-devise / province** — expansion stratégique, pas une feature manquante.
  Déjà cadrée et différée dans `2026-07-02-establishment-profile-gating-design.md` §5. Le Bénin
  est XOF-only et mono-pays : aucune valeur immédiate. On conserve seulement la règle « registre
  modules et gating agnostiques du pays ». **Ne rien construire ici.**
- **Job board / recrutement public** — portail marketing d'EduNet (offres CDI/CDD/Stage +
  candidatures). Valeur quasi nulle pour une école individuelle ; relève d'un site vitrine réseau,
  pas du produit de gestion. **Différé indéfiniment.**
- **App mobile native Android/iOS** — la PWA (`/offline`, responsive, `EduMobileNav`) couvre déjà
  l'usage mobile. ROI d'un binaire natif faible vs coût. **Différé** ; améliorer la PWA au besoin.

### Convention transverse (toutes les routes de cette spec)
- Nouvelles vérifications de rôle : **`roleSatisfies`**, jamais `.includes(callerRole)** (héritage
  NETWORK_ADMIN, cf `project_rbac_network_admin_gates_2026-07-04`).
- Scoping tenant systématique (`schoolId`), jamais de vue globale par défaut.
- Migrations Prisma via `prisma migrate diff` hors-ligne (convention repo, migrations hors-git).
- PDF via `jspdf` (^4.2) + `jspdf-autotable`, import dynamique (déjà le pattern d'export analytics).
- Chaque page gère loading / empty / error / success. Tests unitaires `src/lib/**` + composants.

---

## Chantier P1 — Gestion du personnel (RH light) 🟥 forte valeur

**Constat** : la page `dashboard/staff` n'est qu'un **alias de `users/page`** — aucune gestion RH
réelle. `Attendance` est élève-only. EduNet gère présences/congés/salaires du personnel.

**Périmètre (léger, PAS un moteur de paie fiscal)**
1. **Présence du personnel** — pointage quotidien présent / absent / retard / en congé.
2. **Congés** — demande → validation, soldes indicatifs par type.
3. **Fiche de paie** — enregistrement mensuel (base, primes, retenues, net) + bulletin PDF.
   **Exclu** : calcul automatique CNSS/IRPP/impôts (país-specific, réforme fréquente → YAGNI).
   La saisie est manuelle/assistée ; on produit un document, pas un calcul légal.

**Modèles Prisma**
- `StaffAttendance` : `id, schoolId, userId, date, status(StaffAttendanceStatus), checkIn?, checkOut?, note?, recordedById`. Unique `(userId, date)`.
- `LeaveRequest` : `id, schoolId, userId, type(LeaveType), startDate, endDate, reason?, status(LeaveStatus: PENDING|APPROVED|REJECTED|CANCELLED), decidedById?, decidedAt?, decisionNote?`.
- `PayrollEntry` : `id, schoolId, userId, period(YYYY-MM), baseSalary, allowances(Json[]), deductions(Json[]), netAmount, status(DRAFT|VALIDATED|PAID), paidAt?, pdfUrl?, createdById`. Unique `(userId, period)`.
- Enums : `StaffAttendanceStatus(PRESENT|ABSENT|LATE|ON_LEAVE)`, `LeaveType(SICK|ANNUAL|MATERNITY|EXCEPTIONAL|UNPAID)`, `LeaveStatus`.

**API** (`allowedRoles` + `roleSatisfies`)
- `GET/POST /api/staff/attendance` (+ `/bulk` pour pointer une équipe en un appel).
- `GET/POST /api/staff/leaves`, `PATCH /api/staff/leaves/[id]` (décision).
- `GET/POST /api/staff/payroll`, `GET /api/staff/payroll/[id]/payslip` (PDF).
- Écriture réservée SCHOOL_ADMIN / DIRECTOR (+ héritage NETWORK_ADMIN) ; l'employé lit **ses
  propres** enregistrements (filtre `userId === session.user.id`).

**Pages**
- `dashboard/staff` → vraie page (remplace l'alias) : liste du personnel + onglets Présence / Congés / Paie.
- `dashboard/staff/leaves` : file d'attente des demandes à valider (direction) + mes demandes (employé).
- Pont finance (optionnel) : total paie du mois → écriture OHADA (charge de personnel) via
  `JournalEntry`. **Optionnel**, gated derrière un flag ; ne pas bloquer P1 dessus.

**Sécurité / correctness**
- Un employé ne voit jamais la paie d'un autre (scoping strict `userId`).
- Validation Zod : dates de congé cohérentes (start ≤ end), période paie `YYYY-MM`, montants ≥ 0.
- Anti-doublon paie via unique `(userId, period)` ; pointage via unique `(userId, date)`.

---

## Chantier P2 — Carte scolaire imprimable 🟩 quick win

**Constat** : EduNet propose « photos et cartes scolaires ». EduPilot a photo élève + `Badge`
(QR `code`, per-school) + identité école (logo, couleur, devise) — **tout le nécessaire existe déjà**,
il manque le rendu imprimable. **Aucun nouveau modèle.**

**Périmètre**
- Vue carte élève `dashboard/students/[id]/card` (ou action « Imprimer la carte ») : recto = photo,
  nom, matricule, classe, année scolaire, logo + couleur école, **QR du `Badge` existant** ; verso =
  contacts établissement + mentions.
- Génération **PDF** (jspdf) au format carte (CR80 85.6×54 mm) ; QR encodé depuis `Badge.code`
  (réutilise la lib `qrcode` déjà présente pour l'access-control).
- **Batch classe** : imprimer toutes les cartes d'une classe en un PDF (jspdf-autotable / pages multiples).
- Si l'élève n'a pas de `Badge`, le générer à la volée (réutilise l'API regenerate d'access-control).

**Sécurité / correctness**
- Réservé aux rôles gérant les élèves (SCHOOL_ADMIN, DIRECTOR, SECRETARY/STAFF selon RBAC), scoping école.
- Ne jamais exposer le QR d'un `Badge` révoqué (`revokedAt`) ni expiré (`validUntil`).

**Effort** : S (petit) — pas de schéma, réutilise Badge + qrcode + jspdf.

---

## Chantier P3 — Vitrine publique établissement + annuaire 🟨 valeur moyenne (acquisition)

**Constat** : EduNet expose une page établissement publique (photo de couverture) + un annuaire
d'écoles filtrable par région. EduPilot n'a qu'`Organization` interne. Utile pour l'**acquisition**
et l'**onboarding self-service** déjà évoqué dans la spec gating.

**Périmètre**
- Champs `School` : `+ isPublic Boolean @default(false)`, `+ coverImage String?`,
  `+ publicDescription String?`, `+ publicPhone/publicEmail String?`, `+ city/region String?`.
- Page publique **SSR sans auth** `/(public)/ecole/[code]` : logo, devise, couverture, cycles
  offerts (`offeredLevels`), description, contacts, CTA « Contacter / Pré-inscription ».
- Annuaire public `/(public)/ecoles` : liste des écoles `isPublic=true`, filtres région / cycle /
  type (`SchoolType`), recherche. Pagination + cache (public, `revalidate`).
- Toggle dans `dashboard/settings/school` : « Publier la fiche publique » + upload couverture
  (réutilise `/api/upload`). L'auto-save school (déjà en place) couvre ces champs.

**Sécurité / correctness**
- Pages publiques : n'exposer **que** les champs publics (jamais d'élèves/finances/effectifs sensibles).
- `robots`/SEO propres ; rate-limit sur le formulaire de contact (anti-spam) + honeypot/Turnstile.
- Une école `isPublic=false` renvoie 404 sur `/ecole/[code]` (pas 403 qui révélerait l'existence).

**Effort** : M (moyen).

---

## Chantier P4 — Signature électronique (scope étroit) 🟨 valeur moyenne (traçabilité)

**Constat** : EduNet annonce la signature électronique. Réellement utile en contexte scolaire pour
**autorisations parentales** (sorties, droit à l'image — le consentement image existe déjà en
`user.preferences.consents`) et **validation de documents** (bulletins, certificats). On vise une
signature **simple à valeur probante légère**, PAS une PKI qualifiée eIDAS (hors scope Bénin).

**Périmètre**
- Modèle `DocumentSignature` : `id, schoolId, docType(SignableDocType), docId, signerId?, signerRole,
  method(DRAWN|TYPED|OTP), signedAt, ipHash?, contentHash, meta(Json)`.
  Enum `SignableDocType(REPORT_CARD|CERTIFICATE|PARENT_AUTHORIZATION|STAFF_CONTRACT)`.
- Capture signature : canvas (dessin) **ou** OTP SMS/email (réutilise l'infra notifications/email).
- `contentHash` = hash du document signé (intégrité) ; `ipHash` = trace (RGPD : haché, pas d'IP brute).
- Intégrations initiales : (a) signature direction sur bulletin PDF (`grades/report-cards`),
  (b) autorisation parentale via lien OTP (nouveau flux `parents`).
- `GET/POST /api/signatures`, vérification d'intégrité `GET /api/signatures/[id]/verify`.

**Sécurité / correctness**
- Un signataire ne signe que ce qui lui est destiné (scoping rôle + tenant).
- OTP à usage unique, TTL court, anti-rejeu (réutiliser le pattern account-lockout / rate-limit).
- Le hash rend toute altération post-signature détectable ; horodatage serveur (jamais client).

**Effort** : M (moyen).

---

## Priorisation & séquencement recommandé

Ordre conseillé (valeur/effort + momentum) :

1. **P2 — Carte scolaire** (quick win, ~1–2 j) : livrable tangible immédiat, zéro schéma, rôde le
   pipeline PDF/QR.
2. **P1 — RH personnel** (le plus gros, ~1–1.5 sem) : comble le vrai trou de gestion + parité EduNet.
   Sous-découpe : P1a présence → P1b congés → P1c paie (chacun lint/typecheck/tests verts avant le suivant).
3. **P3 — Vitrine publique** (~3–4 j) : active l'acquisition/self-service.
4. **P4 — Signature électronique** (~3–4 j) : traçabilité, s'appuie sur l'infra consentement/OTP.

Chaque chantier = branche + PR indépendante, `lint` + `typecheck` + `test` + `build` verts, ADR si
décision structurante (ex. modèle paie, format signature).

## Hors périmètre (YAGNI, rappel)
- Multi-pays / multi-devise / job board / app native (voir §Écartés).
- Moteur de paie fiscal automatique (CNSS/IRPP).
- Signature qualifiée eIDAS / PKI / horodatage certifié tiers.
- Annuaire national fédéré multi-tenant public (au-delà des écoles de l'instance).
