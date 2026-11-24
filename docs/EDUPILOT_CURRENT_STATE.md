# EduPilot — État réel du produit (phase 0)

> Établi le 2026-11-24 sur la branche `feat/parcours-ux-mobile` (base `e397776`, `main` du 2026-11-18,
> plus 11 fichiers modifiés non commités du chantier mobile). Lecture seule : aucun fichier de code
> n'a été modifié pour ce document.
>
> Légende des preuves : **[M]** mesuré aujourd'hui · **[C]** lu dans le code aujourd'hui ·
> **[D]** repris d'un audit antérieur du dépôt, non re-vérifié · **[H]** hypothèse.

## 1. En une phrase

EduPilot n'est pas un prototype. C'est une application Next.js monolithique de grande taille, déjà
auditée plusieurs fois. Ses points forts sont le calcul des moyennes béninoises, l'isolation des
écoles et un encaissement en ligne verrouillé. Ses vrais trous sont ailleurs :

- aucun fonctionnement hors ligne ;
- aucune passerelle EducMaster ;
- les encaissements de scolarité ne sont pas reliés à la comptabilité ;
- aucun pilote en école réelle, donc aucune métrique d'usage.

## 2. Chiffres de référence

| Mesure | Valeur | Preuve |
|---|---|---|
| Code TypeScript sous `src/` | 195 954 lignes | [M] |
| Pages (`page.tsx`) | 185 | [M] |
| Routes API (`route.ts`) | 336, dont 333 via `createApiHandler` | [M] |
| Modèles Prisma / énumérations | 138 / 74 (`prisma/schema.prisma`, 3 649 lignes) | [M] |
| Rôles | 9 (SUPER_ADMIN, NETWORK_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STAFF, ACCOUNTANT, PARENT, STUDENT) | [C] |
| Tables en RLS forcée | 18 instructions `FORCE ROW LEVEL SECURITY` | [M] |
| Fichiers de tests | 520 (162 api, 184 lib, 103 intégration sur base réelle, 26 composants…) + 15 scénarios E2E | [M] |
| Tests unitaires | **4 553 verts**, 5 ignorés (417 fichiers, 110 s) | [M] |
| Vérification de types / lint | 0 erreur / propre | [M] |
| Tests d'intégration (base réelle) | 857 au 2026-11-05 | [D] — **non relancés** |
| Routes API citées par au moins un test | ≈ 290 / 336 (heuristique par chemin, surestime la couverture réelle) | [M] |
| E2E en CI | 89/89 au 2026-09-19 | [D] |
| Commits | 527 ; branche à jour avec `origin/main` | [M] |

**Pas encore mesuré dans cette phase** :

- tests d'intégration et E2E ;
- build de production ;
- `npm audit` ;
- charge (dernière mesure : `audit-reports/webapp-2026-11-18/`) ;
- restauration de sauvegarde.

## 3. Pile technique (constatée)

- **Application** : Next.js 16 (App Router), React, TypeScript strict, Tailwind et primitives
  Radix/shadcn, SWR, Recharts. Middleware `src/proxy.ts` (débit, 2FA, routes publiques).
- **Données** : PostgreSQL et Prisma. Le contexte RLS est fixé par requête (AsyncLocalStorage).
  L'application tourne avec le rôle `edupilot_app`. L'état partagé (cache, débit, file de tâches)
  est stocké dans PostgreSQL ; Redis a été retiré (ADR-0013).
- **Identité** : NextAuth (JWT), TOTP natif, option « rester connecté 30 j », révocation de session.
- **Asynchrone** : file de tâches PostgreSQL, maintenance quotidienne sous bail, cron (`cron:automation`,
  `cron:retention`).
- **Paiement** : FedaPay sur le compte marchand de chaque école (ADR-0011, secrets chiffrés
  AES-256-GCM). MoMo direct, Flutterwave et Paystack ne sont autorisés qu'en configuration globale,
  et refusés pour les frais des écoles.
- **Communication** : WhatsApp par l'API Meta Cloud, avec modèles approuvés par type (ADR-0014). Le
  SMS sert de secours. S'y ajoutent l'e-mail SMTP, les notifications web (VAPID dérivées) et le temps
  réel.
- **IA** : 100 % locale, sans aucun LLM externe ni n8n (ADR-0012). Petit modèle mesuré le 2026-11-13 :
  routage 10/10, rédaction correcte, raisonnement mathématique faux, environ 16 s par rédaction sur
  le processeur d'un portable [D].
- **PWA** : Serwist. Seules les ressources statiques sont mises en cache ; API et pages passent
  toujours par le réseau (`src/lib/pwa/cache-policy.ts`).
- **Exploitation** : Docker, dossier `deploy/contabo`, 4 workflows GitHub (ci, ci-cd, lighthouse,
  pr-validation), `.env` réduit à 3 variables. Selon l'étude du 2026-11-23, la livraison continue
  n'a jamais déployé [D].

## 4. Carte des modules (`src/lib`, par taille)

| Module | Lignes | Rôle |
|---|---|---|
| `services/` | 6 259 | Logique transverse (notifications, etc.) |
| `ai/` | 4 865 | Assistant, gouvernance, accès élève, modèles |
| `finance/` | 3 108 | Soldes, encaissements, paiements en ligne, remboursements, relances, avis, portefeuille |
| `academic/` | 2 547 | Moteur de moyennes unique (`average-engine`), formules, moyennes de classe |
| `auth/`, `security/`, `rbac/` | 4 831 | Sessions, 2FA, révocation, permissions, garde-fous |
| `api/` | 1 899 | `createApiHandler` (auth, école, maintenance, garde `?schoolId`) |
| `import/` | 1 574 | Imports CSV/XLSX (plafond 500 lignes) |
| `benin/` | 716 | Niveaux CEP/BEPC/BAC, séries (EA/MIA…) |
| `payments/` | 664 | Comptes marchands par école, client FedaPay |
| `notifications/` | 931 | WhatsApp, SMS, voix, e-mail, canal famille |
| autres | — | cantine, transport, bibliothèque, examens, RH, signatures, alumni, contrôle d'accès, bien-être… |

La taille du domaine API (environ 95 dossiers) est plus élevée qu'un concurrent béninois typique.
C'est un atout fonctionnel, mais aussi une **surface à maintenir et à tester** pour une équipe réduite.

## 5. Les capacités de la mission confrontées au code

### 5.1 Académique

| Capacité | État | Preuve |
|---|---|---|
| Établissements, années, cycles, niveaux, classes, matières | ✅ présent ; cycles offerts réglables par école | [C] `src/lib/benin/levels.ts`, `/dashboard/settings/cycles` |
| Notes MI / devoirs / compositions, coefficients | ✅ moteur unique `(MI + D1 + D2) / 3`, formules libres par école et par enseignant | [C] `src/lib/academic/` ; banc de précision à 0 écart [D] |
| Moyennes annuelles, absences non justifiées = 0, note manquante = « à justifier » | ✅ | [D] `docs/ANALYSE_PRECISION_CALCULS.md` |
| Bulletins, clôture d'année, promotion | ✅ (clôture verrouillée sur 5 routes) | [D] |
| Présences, emploi du temps, cahier de textes | ✅ ; appel retravaillé pour mobile (non commité) | [M] navigateur 390 px |
| Défauts de calcul encore ouverts | DEF-014, 015, 018 (version de formule non tracée sur les moyennes stockées), 020 (taux de présence d'un seul relevé) | [D] `audit-reports/defects-register.md` |

### 5.2 Finance — vérification des risques cités par la mission

| Risque supposé par la mission | État constaté | Preuve |
|---|---|---|
| Paiements en cours ignorés dans le reste à payer | **Traité** : un essai en attente réserve son montant, quel que soit son âge (`available = dû − encaissé − réservé`) | [C] `src/lib/finance/online-payments.ts` règle 2 |
| Paiement en double pendant une attente | **Traité** : verrou transactionnel par élève et par frais (`pg_advisory_xact_lock`) à la création comme à la confirmation | [C] `lockStudentFee` |
| Montant ou devise de la notification non vérifiés | **Traité** : montant exact en FCFA entiers et devise XOF ; sinon le paiement est mis « à rapprocher » | [C] règle 4 |
| Confirmation par le frontend | **Non** : la validation vient du webhook signé ou d'une interrogation du fournisseur | [C] routes `payments/*/webhook`, `verify-provider`, `reconcile` |
| Délai d'expiration de 24 h imposé à l'aveugle | **Non** : 24 h ne déclenche qu'une interrogation du fournisseur ; le paiement reste réservé si la réponse est incertaine ; alerte après 48 h | [C] règle 6 |
| Confirmation tardive après expiration ou annulation | **Traitée** : le paiement est validé, l'état antérieur noté, le trop-perçu signalé | [C] règle 5 |
| Échéancier non resynchronisé après un paiement en ligne | **Corrigé** (C-01, 2026-10-16) : recalcul dans la même transaction | [C] règle 7 |
| Souveraineté : compte marchand central | **Traité** : FedaPay sur le compte de chaque école ; compte global refusé pour les frais | [C] `initiate/route.ts`, ADR-0011 |
| Mode A, montant libre | **Présent** : `mode: "AMOUNT"`, plafonné au disponible | [C] `initiate/route.ts` |
| Mode B, tranches | **Partiel** : `NEXT_INSTALLMENT` et `FULL_BALANCE`, montants recalculés par le serveur. Le parent ne peut pas **choisir** une tranche précise : l'imputation est toujours chronologique (choix volontaire, Q-FIN-02 en attente de validation métier) | [C] |
| Remboursements | **Présents** comme écritures d'extourne (montant négatif lié par `refundOfId`), cumul plafonné sous verrou. Pas d'appel de remboursement automatique au fournisseur | [C] `src/lib/finance/refunds.ts` |

**Lacunes réelles** :

1. **Pas de table d'événements fournisseur**. Un même webhook reçu deux fois est absorbé par l'état
   du paiement et par le verrou, mais il ne laisse pas de trace propre et rejouable. La mission
   demande cette trace pour la réconciliation [C].
2. **Machine à états implicite**. `PaymentStatus` vaut PENDING, VERIFIED, RECONCILED, CANCELLED ou
   EXPIRED. Les transitions autorisées sont codées dans les fonctions, pas déclarées ni contrôlées en
   un seul endroit. REFUNDED et DISPUTED n'existent pas comme états (le remboursement est une
   extourne) [C].
3. **Encaissements de scolarité non reliés à la comptabilité**. Les écritures `JournalEntry` (OHADA)
   ne sont alimentées que par la paie et les cagnottes. Le rapprochement entre la comptabilité et
   l'encaissé repose donc sur des saisies manuelles [C].
4. **Pas de paiement groupé pour plusieurs enfants**. Un paiement correspond toujours à un élève et
   à un frais ; un parent de trois enfants fait trois transactions [C].
5. **Pas de reçu hors ligne à numérotation contrôlée** [C].
6. **TD-025** : réserves restantes sur les paiements sans issue définitive [D] `TECH_DEBT.md`.

### 5.3 Multi-écoles et sécurité

- **Isolation** : garde central `?schoolId` dans `createApiHandler`, RLS forcée, clés de cache par
  utilisateur et par école, enseignant limité à l'école active [C/D].
- **Corrigés depuis l'audit d'octobre** [D] :
  - service worker qui servait des pages privées (MS-03) ;
  - révocation des sessions (MS-01) ;
  - enseignant qui voyait toute l'école (MS-02) ;
  - 2FA décoratif ;
  - affectation en masse santé (PARENT → SUPER_ADMIN) ;
  - injection CSV.
- **Latent** : escalade STAFF + TEACHER en cumul de rôles, sans écriture multi-rôles aujourd'hui [D].
- **Conformité** : dossier APDP présent (`docs/conformite/APDP_DOSSIER.md`), non relu dans cette phase.

### 5.4 Interopérabilité et hors ligne

| Sujet | État | Preuve |
|---|---|---|
| EducMaster | **Absent** : aucune occurrence dans `src/` ni `docs/` | [M] |
| Hors ligne | **Absent** pour les données : aucune file d'attente ni IndexedDB ; le service worker n'exclut que les ressources statiques ; seul un brouillon de notes en `localStorage` existe (`use-autosave`) | [C] |
| Page « Hors ligne » | **Défaut d'honnêteté** : elle affiche « Consultation dossier élève » et « Cahier de liaison · lecture » comme disponibles, alors qu'aucune donnée scolaire n'est mise en cache. Seules les données déjà affichées dans un onglet ouvert restent visibles | [C] `dashboard/offline/page.tsx:26-33` vs `src/lib/pwa/cache-policy.ts` |

C'est le principal écart face aux concurrents qui vendent le hors-ligne (GestionEcole, Ecolax), et
face à la réalité du réseau mobile béninois.

### 5.5 Communication et IA

- **WhatsApp Business (Meta Cloud)** : modèles par type, statuts reçus signés, SMS de secours. La
  dépendance à un seul fournisseur WhatsApp est assumée (ADR-0014) [C].
- **IA locale** : il faut un serveur d'inférence. La qualité mesurée suffit pour la rédaction
  (appréciations) et le routage, pas pour du raisonnement chiffré. La latence sur processeur
  (environ 16 s) est un frein d'adoption [D]. Les règles « l'IA ne confirme pas de paiement, ne
  modifie pas une note définitive » sont à vérifier en phase 1 [H].

## 6. Ce qui manque pour être une référence (diagnostic de phase 0)

Ordre provisoire, à confirmer par l'audit de phase 1 :

1. **Aucune preuve terrain** : aucun pilote, aucune métrique d'adoption ni de recouvrement. Aucun
   avantage concurrentiel ne peut aujourd'hui être *démontré* au sens de la mission.
2. **Hors ligne absent** : l'appel et la saisie de notes échouent dès que le réseau tombe.
3. **EducMaster absent** : la double saisie reste entière pour les écoles.
4. **Comptabilité déconnectée des encaissements**, et pas de journal d'événements fournisseur.
5. **Surface fonctionnelle très large** pour une équipe réduite. Un audit antérieur avait relevé
   67 écrans hors menus [D], à re-mesurer.
6. **Livraison continue jamais déployée**, `main` rouge sur axe au 2026-11-23 [D], mobile lent [D].

## 7. Suite proposée

- **Phase 1 (audit technique)**, en commençant par la finance :
  - relancer les tests d'intégration et le build ;
  - écrire les scénarios de concurrence demandés en §7.F de la mission et constater lesquels
    existent déjà ;
  - mesurer `npm audit`.
- **Phase 2 (veille concurrentielle)** : recherche web avec date et source pour chaque concurrent.
  Un premier balayage du 2026-11-24 a trouvé Geschoul, Scolaria, Logesco, GestEcole, Novacole,
  LYDIA Edu, Eduvate et EducMaster. **Ecolia n'a été retrouvé par aucune recherche.**
- **Correctif immédiat possible** (petit, sûr) : rendre la page « Hors ligne » conforme à la
  politique de cache réelle.
