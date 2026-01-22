# Guide de Sécurité EduPilot

## Table des Matières
1. [Authentification & Autorisation](#authentification--autorisation)
2. [Protection Contre les Attaques](#protection-contre-les-attaques)
3. [Multi-Tenant & Isolation](#multi-tenant--isolation)
4. [Headers de Sécurité HTTP](#headers-de-sécurité-http)
5. [Audit & Logging](#audit--logging)
6. [Mots de Passe & Tokens](#mots-de-passe--tokens)
7. [Audit de Sécurité](#audit-de-sécurité)

---

## Authentification & Autorisation

### NextAuth Configuration
EduPilot utilise NextAuth.js (v5) pour l'authentification avec stratégie JWT.

**Fichier**: `src/lib/auth/config.ts`

#### Features Implémentées
- ✅ **JWT Session Strategy**: Sessions stockées côté client via JWT (max 30 jours)
- ✅ **Password Hashing**: bcrypt avec salt rounds = 12
- ✅ **Role-Based Access Control**: 7 rôles (SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT, ACCOUNTANT)
- ✅ **Session Invalidation**: Invalidation automatique après changement de mot de passe ou de rôle
- ✅ **Account Lockout**: Verrouillage du compte après 5 tentatives échouées (30 min)

#### Vérification de Token
```typescript
// Dans callbacks JWT
if (userFromDb.passwordChangedAt && userFromDb.passwordChangedAt > tokenIssuedAt) {
  return {}; // Token invalide
}
```

---

## Protection Contre les Attaques

### Rate Limiting

**Fichier**: `src/lib/auth/rate-limiter.ts`

#### Limites Configurées
| Endpoint | Max Tentatives | Fenêtre | Description |
|----------|----------------|---------|-------------|
| Login    | 5              | 15 min  | Protection contre brute-force |
| First Login | 3           | 15 min  | Changement de mot de passe |
| Forgot Password | 3      | 15 min  | Reset de mot de passe |
| API Générale | 100        | 1 min   | Limite globale API |

#### Implémentation
- Stockage en mémoire (Map) avec TTL auto-nettoyage
- Headers standards: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- Extraction IP avec support proxy: `x-forwarded-for`, `x-real-ip`

**Note Production**: Remplacer le stockage en mémoire par Redis pour scalabilité multi-instance.

### Account Lockout

**Fichier**: `src/lib/auth/account-lockout.ts`

#### Fonctionnement
1. **Tentative Échouée**: `failedLoginAttempts++`
2. **5 Échecs**: Compte verrouillé pendant 30 minutes
3. **Succès**: Compteur réinitialisé à 0
4. **Déverrouillage Manuel**: Fonction `unlockAccount()` pour admins

#### Audit Logs
Tous les événements sont enregistrés:
- `LOGIN_FAILED`: Tentative échouée
- `LOGIN_FAILED_LOCKED`: Tentative sur compte verrouillé
- `ACCOUNT_LOCKED`: Verrouillage automatique
- `ACCOUNT_UNLOCKED`: Déverrouillage manuel

### CSRF Protection
- **NextAuth Built-in**: Tokens CSRF automatiques
- **SameSite Cookies**: Protection contre CSRF cross-site
- **Origin Validation**: Vérification de l'origine des requêtes

---

## Multi-Tenant & Isolation

### Principe
Chaque établissement scolaire (`School`) est isolé. Les utilisateurs (sauf `SUPER_ADMIN`) ne peuvent accéder qu'aux données de leur établissement.

### Helpers d'Authentification

**Fichier**: `src/lib/api/auth-helpers.ts`

#### `authenticateRequest()`
```typescript
const result = await authenticateRequest(request, {
  requiredRoles: ['TEACHER', 'SCHOOL_ADMIN'],
  requireSchoolAccess: true,
  allowSuperAdmin: true,
});

if ('error' in result) {
  return result.error; // 401 ou 403
}

const user = result.user; // AuthenticatedUser
```

#### `getSchoolFilter()`
```typescript
const where = {
  ...getSchoolFilter(user), // { schoolId: user.schoolId } ou {}
  // ... autres filtres
};

const students = await prisma.studentProfile.findMany({ where });
```

#### `canAccessSchool()`
```typescript
if (!canAccessSchool(user, targetSchoolId)) {
  return forbidden('Accès refusé à cet établissement');
}
```

### Audit de Sécurité API

**Script**: `scripts/audit-api-security.sh`

**Résultats Actuels**:
- ✅ **112 routes API** au total
- ✅ **106 routes sécurisées** (avec auth)
- ✅ **6 routes publiques** (auth endpoints - correct)
- ⚠️ **49 routes sans filtre schoolId** (à vérifier manuellement)

**Commande**:
```bash
./scripts/audit-api-security.sh
```

---

## Headers de Sécurité HTTP

**Fichier**: `next.config.mjs`

### Headers Configurés

| Header | Valeur | Description |
|--------|--------|-------------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS (2 ans) |
| `X-Frame-Options` | `DENY` | Bloque iframes (anti-clickjacking) |
| `X-Content-Type-Options` | `nosniff` | Désactive le MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Active la protection XSS navigateur |
| `Referrer-Policy` | `origin-when-cross-origin` | Contrôle le header Referer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Désactive fonctionnalités sensibles |
| `Content-Security-Policy` | *(voir ci-dessous)* | Politique de sécurité du contenu |

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline'; // Next.js nécessite unsafe-eval
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
```

**Note**: `unsafe-eval` et `unsafe-inline` sont requis par Next.js. En production, utiliser des nonces pour une CSP plus stricte.

---

## Audit & Logging

### AuditLog Model

**Schéma**: `prisma/schema.prisma` (ligne 1987)

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String?
  oldValues Json?
  newValues Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

### Actions Auditées

| Action | Description |
|--------|-------------|
| `LOGIN_SUCCESS` | Connexion réussie |
| `LOGIN_FAILED` | Tentative échouée |
| `LOGIN_FAILED_LOCKED` | Tentative sur compte verrouillé |
| `ACCOUNT_LOCKED` | Verrouillage automatique |
| `ACCOUNT_UNLOCKED` | Déverrouillage manuel |
| `PASSWORD_CHANGED` | Changement de mot de passe |
| `PASSWORD_CHANGED_FIRST_LOGIN` | Premier changement après création |
| `USER_CREATED` | Création d'utilisateur |
| `SYSTEM_INITIALIZED` | Initialisation système |

### Création d'Audit Log

```typescript
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entity: 'user',
    entityId: user.id,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  },
});
```

---

## Mots de Passe & Tokens

### Politique de Mots de Passe

**Validation**: `src/app/api/auth/first-login/route.ts` (ligne 78-84)

**Critères**:
- ✅ Minimum 8 caractères
- ✅ Au moins 1 majuscule (`[A-Z]`)
- ✅ Au moins 1 minuscule (`[a-z]`)
- ✅ Au moins 1 chiffre (`[0-9]`)
- ✅ Au moins 1 caractère spécial (`[^A-Za-z0-9]`)

### Mots de Passe Temporaires

**Génération**: `src/lib/auth/password-generator.ts`

**Format**: `XXXX-9999` (4 lettres majuscules + tiret + 4 chiffres)

**Stockage**: 
- ✅ **HASH bcrypt** dans `FirstLoginToken.tempPassword`
- ❌ **JAMAIS en clair** dans la base de données
- ✅ **Expiration 7 jours**
- ✅ **Usage unique** (champ `usedAt`)

**Fichiers Modifiés**:
- `src/lib/auth/user-creation.ts` (ligne 115-120)
- `src/app/api/setup/route.ts` (ligne 157-162)
- `src/app/api/auth/first-login/route.ts` (ligne 147-153)

### FirstLoginToken Model

```prisma
model FirstLoginToken {
  id           String    @id @default(cuid())
  userId       String
  token        String    @unique // UUID
  tempPassword String?   // bcrypt hash
  expiresAt    DateTime
  usedAt       DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

### Password Reset Flow

1. **Request Reset**: `POST /api/auth/forgot-password`
   - Rate limit: 3 requêtes / 15 min
   - Crée `PasswordResetToken` avec expiration 1h

2. **Verify Token**: `GET /api/auth/reset-password?token=xxx`
   - Vérifie validité et expiration

3. **Reset Password**: `POST /api/auth/reset-password`
   - Valide nouveau mot de passe
   - Met à jour `user.password` et `user.passwordChangedAt`
   - Invalide tous les JWT existants

---

## Gestion des Erreurs

### Réponses Standardisées

**Fichier**: `src/lib/api/error-responses.ts`

#### Format Standard

```typescript
interface ErrorResponse {
  error: string;
  code: string;
  details?: any; // Seulement en développement
  timestamp: string;
}
```

#### Fonctions Helper

| Fonction | Status | Code | Usage |
|----------|--------|------|-------|
| `unauthorized()` | 401 | `UNAUTHORIZED` | Non authentifié |
| `forbidden()` | 403 | `FORBIDDEN` | Non autorisé |
| `notFound()` | 404 | `NOT_FOUND` | Ressource introuvable |
| `validationError()` | 400 | `VALIDATION_ERROR` | Données invalides |
| `zodValidationError()` | 400 | `VALIDATION_ERROR` | Erreur Zod |
| `conflict()` | 409 | `CONFLICT` | Conflit (ex: email existe déjà) |
| `tooManyRequests()` | 429 | `RATE_LIMIT_EXCEEDED` | Rate limit |
| `serverError()` | 500 | `INTERNAL_SERVER_ERROR` | Erreur serveur |

#### Gestion Automatique

```typescript
export async function withErrorHandling<T>(
  handler: () => Promise<T>
): Promise<T | NextResponse<ErrorResponse>> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return zodValidationError(error);
    }
    // ... Prisma, autres erreurs
  }
}
```

### Erreurs Prisma

**Codes Gérés**:
- `P2002`: Contrainte unique violée → `409 CONFLICT`
- `P2025`: Enregistrement non trouvé → `404 NOT_FOUND`
- `P2003`: Contrainte clé étrangère → `400 VALIDATION_ERROR`

---

## Bonnes Pratiques de Sécurité

### Pour les Développeurs

#### ✅ À FAIRE

1. **Toujours authentifier les routes API**
   ```typescript
   const result = await authenticateRequest(request, {
     requiredRoles: ['TEACHER'],
   });
   if ('error' in result) return result.error;
   ```

2. **Appliquer l'isolation multi-tenant**
   ```typescript
   const where = {
     ...getSchoolFilter(user),
     // ...
   };
   ```

3. **Valider toutes les entrées avec Zod**
   ```typescript
   const schema = z.object({
     name: z.string().min(1),
     email: z.string().email(),
   });
   const validated = schema.parse(body);
   ```

4. **Utiliser les helpers d'erreur standardisés**
   ```typescript
   if (!resource) {
     return notFound('Étudiant');
   }
   ```

5. **Logger les actions sensibles**
   ```typescript
   await prisma.auditLog.create({
     data: {
       userId: user.id,
       action: 'GRADE_MODIFIED',
       entity: 'grade',
       entityId: grade.id,
       oldValues: { value: oldValue },
       newValues: { value: newValue },
     },
   });
   ```

#### ❌ À NE PAS FAIRE

1. ❌ Retourner des données sans vérifier le schoolId
2. ❌ Hasher les mots de passe avec salt rounds < 10
3. ❌ Stocker des mots de passe temporaires en clair
4. ❌ Exposer des stack traces en production
5. ❌ Ignorer les erreurs de validation
6. ❌ Créer des routes API sans authentification (sauf publiques)

---

## Checklist de Sécurité

### Authentification & Autorisation
- [x] NextAuth JWT configuré
- [x] Rate limiting sur login (5/15min)
- [x] Account lockout (5 tentatives → 30min)
- [x] Session invalidation (password/role change)
- [x] Audit logs complets
- [x] Role-based access control (7 rôles)

### Protection Données
- [x] Mots de passe hashés (bcrypt, 12 rounds)
- [x] Mots de passe temporaires hashés
- [x] Multi-tenant isolation (schoolId)
- [x] Validation Zod sur toutes les entrées
- [x] Gestion erreurs Prisma

### Headers & Configuration
- [x] HSTS (2 ans)
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] CSP configurée
- [x] Permissions-Policy

### Routes API
- [x] 106/112 routes authentifiées
- [x] 6 routes publiques (auth) - correct
- [ ] Vérifier manuellement les 49 routes sans filtre schoolId

### Monitoring & Audit
- [x] AuditLog model avec ipAddress/userAgent
- [x] Logs pour tous les événements d'auth
- [x] Script d'audit sécurité (`audit-api-security.sh`)

---

## Incident Response

### En Cas de Brèche

1. **Isolation Immédiate**
   - Déconnecter l'application
   - Verrouiller tous les comptes affectés
   - Préserver les logs

2. **Investigation**
   - Analyser `AuditLog` pour identifier l'origine
   - Vérifier les accès non autorisés
   - Documenter la chronologie

3. **Remediation**
   - Patcher la vulnérabilité
   - Réinitialiser tous les mots de passe affectés
   - Invalider tous les JWT (changer `NEXTAUTH_SECRET`)
   - Notification des utilisateurs concernés

4. **Post-Mortem**
   - Documenter la cause racine
   - Mettre à jour les procédures
   - Former l'équipe

---

## Ressources & Contacts

### Documentation
- [NextAuth.js](https://next-auth.js.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Prisma Security](https://www.prisma.io/docs/guides/security)

### Outils
- `scripts/audit-api-security.sh`: Audit automatique des routes
- `vitest`: Tests de sécurité (à venir)

### Support
- Pour signaler une vulnérabilité: [security@edupilot.com](mailto:security@edupilot.com)
- Issues GitHub: [github.com/edupilot/issues](https://github.com/edupilot/issues)

---

**Dernière mise à jour**: 2025-12-24  
**Version**: 1.0  
**Mainteneur**: Équipe Sécurité EduPilot
