# Sécurité — EduPilot

Document de référence pour l'équipe de sécurité, les auditeurs externes et les contributeurs. Mis à jour à chaque évolution sécuritaire majeure.

> Signaler une vulnérabilité : utiliser **GitHub Security Advisories** (canal privé). Ne **jamais** ouvrir d'issue publique pour un défaut de sécurité.

---

## 1. Modèle de menace (STRIDE)

| Catégorie | Menace concrète sur EduPilot | Contre-mesure principale |
|-----------|------------------------------|--------------------------|
| **S**poofing | Usurpation d'identité d'un parent / enseignant via mot de passe faible ou phishing | bcrypt(cost=12) + MFA TOTP optionnel + verrouillage 5 tentatives + cookies `httpOnly` / `SameSite=Strict` |
| **T**ampering | Modification d'une note par un élève via l'API | Validation Zod stricte + RBAC `GRADE_*` + audit log avant/après + `tenant_id` injecté côté serveur |
| **R**epudiation | Un admin nie avoir supprimé un élève | `AuditLog` avec `userId`, `action`, `entity`, `entityId`, `before/after`, `ipAddress`, `userAgent`, `createdAt` immuable |
| **I**nformation Disclosure | Fuite des notes d'une classe à un parent d'une autre école | Isolation multi-tenant : middleware `getActiveSchoolId(session)` + filtre Prisma sur `schoolId` à chaque requête |
| **D**enial of Service | Attaque par envoi massif de requêtes login / reset password | Rate-limiter Upstash Redis : `LOGIN=5/15min`, `FORGOT_PASSWORD=3/15min`, `API=100/min` par IP |
| **E**levation of Privilege | Un `TEACHER` essaie d'agir comme `SCHOOL_ADMIN` | Hiérarchie `roleHierarchy` + `canManageRole()` qui interdit explicitement de gérer un rôle égal ou supérieur |

---

## 2. Authentification et session

### 2.1 Hachage des mots de passe
- **Algorithme** : `bcryptjs` avec coût **12** rounds (`src/lib/auth/config.ts`)
- **Pepper** : non utilisé (à évaluer en V2)
- **Politique de complexité** : `strongPasswordSchema` exige 8+ caractères, 1 majuscule, 1 minuscule, 1 chiffre
- **Politique renforcée** : `veryStrongPasswordSchema` exige en plus 1 caractère spécial (utilisée pour les comptes admin via `schoolDeploymentSchema`)
- **Rotation** : Forcée à la première connexion via `firstLoginRequired = true`

### 2.2 Sessions et JWT
- **Provider** : NextAuth v5 (beta) avec adaptateur Prisma
- **Stockage** : Sessions DB (table `Session`) avec rotation à chaque connexion
- **Cookies** : `httpOnly` + `secure` (prod) + `sameSite=lax` (NextAuth par défaut, durci à `strict` en sécurité critique)
- **Expiration** : 30 jours glissants, invalidation au logout et au changement de mot de passe

### 2.3 Multi-facteur (MFA / 2FA)
- **Standard** : TOTP (RFC 6238) via `otplib`, 6 chiffres, période 30s, fenêtre ±1
- **Secret chiffré** : AES-256-GCM en base via `TOTP_ENCRYPTION_KEY` (64 chars hex). Format DB : `iv:authTag:ciphertext`
- **QR code** : généré à la volée via `qrcode`, jamais persisté
- **Activation** : optionnelle pour STUDENT/PARENT, recommandée pour TEACHER, à imposer pour DIRECTOR+ en V2
- **Récupération** : 10 codes de secours générés à l'activation, hachés en base
  (`twoFactorBackupCodes`), affichés **une seule fois**, consommés à l'usage.
  En dernier recours, un admin peut désactiver le MFA après vérification d'identité.

#### Flux de connexion en deux temps

`authorize()` délivre volontairement une session **pré-2FA** quand un compte
protégé se connecte sans code : mot de passe vérifié,
`isTwoFactorAuthenticated: false`. L'étape 2 passe par
`update({ twoFactorCode })`, vérifiée dans le callback JWT.

**L'enforcement est au middleware** (`src/proxy.ts`) et nulle part ailleurs :
c'est le seul point d'étranglement couvrant à la fois les 283 routes d'API et
les 174 pages, y compris les routes qui n'utilisent pas `createApiHandler`.

| État | API | Page |
|---|---|---|
| 2FA activé, non validé | `403 { code: "MFA_REQUIRED" }` | redirection `/mfa-verify?callbackUrl=…` |
| 2FA validé, ou désactivé | passe | passe |

> ⚠️ Toute route ajoutée hérite automatiquement de ce garde. Ne jamais
> reproduire la vérification route par route — un oubli y serait invisible.
> Régression couverte par `tests/lib/auth/mfa-gate.test.ts`.

#### Protection contre la force brute

Un TOTP vaut 6 chiffres (10⁶ combinaisons) pour ~30 s de validité :

- **Vérification (étape 2)** : `MFA_VERIFY_RATE_LIMIT` — 5 tentatives / 10 min
  par utilisateur, remis à zéro au succès. Dépassement audité en
  `MFA_VERIFY_RATE_LIMITED`.
- **Code erroné dans `authorize()`** : incrémente le verrouillage de compte
  (`recordFailedLoginAttempt`) au même titre qu'un mot de passe erroné, audité
  en `LOGIN_FAILED_2FA`.
- **Succès** : audité en `MFA_VERIFIED` / `MFA_VERIFIED_BACKUP_CODE`.

### 2.4 Verrouillage de compte
- **Seuil** : 5 tentatives échouées
- **Durée** : 30 minutes
- **Reset** : automatique après connexion réussie ou via action admin (`unlockAccount`, audit-logué)
- **Source** : `src/lib/auth/account-lockout.ts`

### 2.5 Récupération de mot de passe
- Token signé HMAC avec expiration **15 minutes**, lié à `userId` + `email` au moment de la demande
- 1 seul token actif à la fois (les anciens sont invalidés à la nouvelle demande)
- Rate-limit dédié : 3 demandes / 15 minutes / IP

---

## 3. Autorisation (RBAC)

### 3.1 Hiérarchie des rôles
```
SUPER_ADMIN  100   accès tous tenants, gestion plateforme
SCHOOL_ADMIN  80   gestion établissement complète
DIRECTOR      70   pédagogie + administratif
ACCOUNTANT    50   finance uniquement
TEACHER       40   classes + notes assignées
STAFF         30   surveillance + lecture
PARENT        20   ses enfants uniquement
STUDENT       10   ses propres données
```

### 3.2 Règles de gestion (`canManageRole`)
- `SUPER_ADMIN` gère **tout le monde** (y compris d'autres SUPER_ADMIN)
- `SCHOOL_ADMIN` et `DIRECTOR` ne peuvent gérer que les rôles **strictement** inférieurs dans la hiérarchie (pas leur propre rôle, jamais SUPER_ADMIN)
- Tout autre rôle ne peut gérer personne

### 3.3 Permissions granulaires
- Énumération `Permission` (`src/lib/rbac/permissions.ts`) : ~80 permissions du type `entity:action[:scope]`
- Matrice complète : `rolePermissions: Record<UserRole, Permission[]>`
- Helpers : `hasPermission`, `hasAnyPermission`, `hasAllPermissions`
- Scopes spéciaux : `:own` (utilisateur sur ses propres données), `:children` (parent sur les données de ses enfants)

### 3.4 Application
- **Backend** : `createApiHandler({ requiredPermissions, allowedRoles })` dans `src/lib/api/api-helpers.ts`
- **Frontend** : composant `Guard` (`src/components/guard/`) qui masque les éléments d'UI non autorisés
- **Navigation** : `navConfig` filtre les entrées du sidebar selon `permission` + `roles`

---

## 4. Isolation multi-tenant

Modèle retenu : **Row-Level scoping côté application** (pas de RLS Postgres en V1).

### 4.1 Mécanisme
- Toute entité scoped contient un champ `schoolId` (ou équivalent `tenantId` selon le modèle)
- À chaque requête, le middleware `createApiHandler` :
  1. Récupère `activeSchoolId` depuis la session via `getActiveSchoolId(session)`
  2. Bloque toute requête sans tenant pour les rôles non-`SUPER_ADMIN` (code 403, `Compte orphelin`)
  3. Compare `schoolId` du query string au tenant actif → bloque si mismatch (code 403, `Violation d'isolation`)
- Les services (`src/lib/services/`) injectent systématiquement `schoolId` dans les filtres Prisma

### 4.2 Cas particuliers
- Les enseignants multi-établissements ont une table `teacher_school_assignments` qui leur autorise plusieurs `schoolId` (`canAccessSchool` valide cette liste)
- Les `Organization` (réseau d'écoles) sont une couche au-dessus, gérées par `organizationMembership`

### 4.3 Migration V2 envisagée
Activer **Postgres RLS** (Row-Level Security) avec politique `tenant_isolation` basée sur la variable de session `app.current_tenant_id`. Cela rendrait l'isolation appliquée même en cas de bug applicatif. Voir [ADR-0008](./adr/0008-multi-tenancy.md).

---

## 5. Validation des entrées

| Source | Mécanisme | Référence |
|--------|-----------|-----------|
| Body JSON | Zod schemas dans `src/lib/validations/*` | `auth.ts`, `finance.ts`, `school.ts`, etc. |
| Query params | Zod schemas dédiés (`paymentFilterSchema`, etc.) | idem |
| URL params (cuid) | `validateCuid()` / `validateCuids()` | `api-helpers.ts` |
| Fichiers uploadés | Limite taille Next.js + type-check côté serveur | `next.config.js` `bodySizeLimit` |
| SQL | Prisma ORM exclusivement, **aucun** `$queryRaw` user-input | — |

---

## 6. Headers de sécurité (CSP, HSTS, etc.)

Source : `next.config.js`, appliqué sur toutes les routes (`source: "/(.*)"`).

| Header | Valeur (prod) | Rôle |
|--------|---------------|------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://...` | Bloque XSS et chargement de scripts tiers non autorisés |
| `X-Frame-Options` | `SAMEORIGIN` | Anti-clickjacking |
| `X-Content-Type-Options` | `nosniff` | Empêche le sniffing MIME |
| `X-XSS-Protection` | `1; mode=block` | Filtre XSS legacy (IE/anciens Chrome) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limite la fuite de référence URL |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS pendant 2 ans |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Désactive les API navigateur sensibles |

**Connect-src** autorise explicitement : `*.upstash.io` (cache), `*.ingest.sentry.io` (monitoring), `generativelanguage.googleapis.com` (Gemini), `api.openai.com`, `api.anthropic.com`.

---

## 7. Chiffrement

| Donnée | Algorithme | Clé | Localisation |
|--------|-----------|-----|--------------|
| Mots de passe | bcrypt (cost=12) | — | DB, colonne `password` |
| Secrets TOTP | AES-256-GCM | `TOTP_ENCRYPTION_KEY` (env, 64 chars hex) | DB, colonne `twoFactorSecret` |
| Connexion DB | TLS 1.2+ | gérée par fournisseur | `DATABASE_URL` |
| Connexion Redis | TLS Upstash | gérée par Upstash | `UPSTASH_REDIS_REST_URL` |
| Cookies session | HMAC | `NEXTAUTH_SECRET` (min 32 chars) | env |
| Backups DB | AES-256 (côté fournisseur) | gérée par fournisseur | hors application |

**Rotation des clés** : `TOTP_ENCRYPTION_KEY` ne doit pas être tournée sans procédure de re-chiffrement. Si compromission suspectée, désactiver MFA sur tous les comptes (script à écrire) et faire ré-enrôler.

---

## 8. Rate limiting

| Endpoint / action | Limite | Fenêtre | Identifiant |
|-------------------|--------|---------|-------------|
| `/api/auth/login` | 5 | 15 min | email |
| `/api/auth/forgot-password` | 3 | 15 min | email |
| `/api/*` (par défaut) | 100 | 1 min | IP + path |
| Webhooks paiement | 20 | 1 min | IP source |

Source : `src/lib/auth/rate-limiter.ts`. Stockage : **Upstash Redis** en prod (multi-instance), fallback in-memory en dev.

---

## 9. Audit logs

Table `AuditLog` :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | cuid | Identifiant unique |
| `userId` | string (FK) | Acteur de l'action |
| `action` | string libre | ex: `USER_CREATED`, `GRADE_UPDATED`, `LOGIN_SUCCESS` |
| `entity` | string | ex: `user`, `grade`, `payment` |
| `entityId` | string | ID de l'entité touchée |
| `oldValues` | JSON | État avant modification |
| `newValues` | JSON | État après modification |
| `ipAddress` | string | IP source (depuis X-Forwarded-For) |
| `userAgent` | string | UA navigateur |
| `createdAt` | timestamp | Immuable (pas de update) |

Index sur `(userId)`, `(entity, entityId)`, `(createdAt)`. Consultable via `/dashboard/audit-logs` pour les rôles `SUPER_ADMIN` et `SCHOOL_ADMIN`.

**Rétention** : 365 jours pour `auditLog` (voir [RGPD](#11-rgpd)). Au-delà : archive cold storage.

> **Convention** : `action` est un **String libre** (pas un enum). Toujours requêter avec `{ contains: x, mode: "insensitive" }` pour la recherche.

---

## 10. Couverture OWASP Top 10 (2021)

| ID | Catégorie | État | Détail |
|----|-----------|------|--------|
| A01 | Broken Access Control | OK | RBAC + isolation tenant + IDOR check à chaque endpoint via `ownership-check` helpers |
| A02 | Cryptographic Failures | OK | TLS forcé, bcrypt 12, AES-256-GCM pour TOTP, pas de stockage en clair |
| A03 | Injection | OK | Prisma ORM only, Zod sur toutes entrées, DOMPurify pour les rares cas de HTML utilisateur |
| A04 | Insecure Design | OK | Threat model documenté (ce document), ADRs pour décisions critiques |
| A05 | Security Misconfiguration | OK | Headers CSP/HSTS, secrets en env, CORS contrôlé, `.env*` dans `.gitignore` |
| A06 | Vulnerable Components | OK | `npm audit` en CI (fail on high), Dependabot hebdo, Trivy filesystem + image scan |
| A07 | Auth Failures | OK | bcrypt + MFA + lockout + rate limit + session rotation |
| A08 | Software/Data Integrity | OK | SBOM CycloneDX généré en CI, build provenance (`attest-build-provenance`), image GHCR signée |
| A09 | Logging/Monitoring | OK | Pino logger structuré, Sentry (frontend + backend), audit log immuable |
| A10 | SSRF | OK | Pas d'URL utilisateur appelée côté serveur sans whitelist (uniquement webhooks signés) |

---

## 11. RGPD

EduPilot stocke des données personnelles de **mineurs** (élèves) — vigilance maximale exigée par le RGPD.

| Obligation | Mise en œuvre |
|------------|---------------|
| Consentement explicite | `DataConsent` table, opt-in pour analytics/marketing au premier login |
| Droit d'accès (Art.15) | `/api/gdpr/export` retourne un ZIP avec toutes les données de l'utilisateur (JSON + PDF) |
| Droit à l'effacement (Art.17) | `/api/gdpr/delete-account` purge ou anonymise (selon rôle). Audit logs conservés sous pseudonyme (`userId` haché) |
| Droit à la portabilité (Art.20) | Export JSON structuré identique au droit d'accès |
| Limitation du traitement | Toggle `dataProcessingPaused` sur le compte parent |
| Registre des traitements | `docs/data-registry.md` (à compléter pour l'auditeur DPO) |
| Sous-traitants (DPA) | Vercel (hébergement), Upstash (cache), Sentry (monitoring), Resend (email), Stripe/Flutterwave (paiement). Tous DPA signés avant prod |
| Notification de breach | 72h vers CNIL via `bosco29962355977@gmail.com` (DPO interne) + email aux utilisateurs impactés. Procédure dans [`RUNBOOK.md`](./RUNBOOK.md#data-breach) |
| Rétention | Voir tableau ci-dessous |

### Politique de rétention

| Donnée | Durée | Justification |
|--------|-------|---------------|
| Comptes utilisateurs actifs | Indéterminée tant qu'actifs | Service rendu |
| Comptes inactifs > 24 mois | Notification puis suppression | RGPD minimisation |
| Données scolaires (notes, présences) | 10 ans après fin de scolarité | Obligation légale Bénin |
| Paiements / factures | 10 ans | Obligation comptable |
| Audit logs | 12 mois en chaud, 5 ans en archive | Investigation + conformité |
| Sessions | 30 jours glissants | Sécurité |
| Logs applicatifs (Sentry) | 90 jours | Debug |

---

## 12. Procédure de signalement de vulnérabilité

1. **Ne pas** ouvrir d'issue publique
2. Aller sur `https://github.com/<owner>/edupilot/security/advisories/new`
3. Décrire la vulnérabilité, sa reproduction, l'impact, et idéalement une suggestion de correction
4. L'équipe sécurité accuse réception sous **48h**
5. Évaluation et CVE assignée si applicable sous **7 jours**
6. Correction publiée sous **30 jours** pour les severité High/Critical, **90 jours** pour Medium

Bug bounty : **non actif** en V1 mais la mention des chercheurs identifiés est faite dans `SECURITY.md` après accord.

---

## 13. Mise à jour de ce document

Ce fichier est versionné. Toute évolution sécuritaire (nouvelle dépendance critique, refonte auth, ajout de provider…) doit s'accompagner d'un PR mettant à jour ce document.

Dernière revue : **2026-05-16** (audit interne)
Prochaine revue planifiée : **2026-11-16**
