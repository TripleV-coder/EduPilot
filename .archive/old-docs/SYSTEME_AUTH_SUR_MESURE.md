# 🔐 Système d'Authentification Sur Mesure - EduPilot

> **Architecture d'authentification enterprise adaptée aux besoins spécifiques de la gestion scolaire multi-tenant**

---

## 📋 Table des Matières

1. [Analyse des Besoins Spécifiques](#analyse-des-besoins)
2. [Architecture Proposée](#architecture-proposée)
3. [Système de Rôles Hiérarchique](#système-de-rôles)
4. [Permissions Contextuelles](#permissions-contextuelles)
5. [Multi-Tenant Avancé](#multi-tenant)
6. [Implémentation Complète](#implémentation)
7. [Flux d'Authentification](#flux-authentification)
8. [Cas d'Usage Réels](#cas-usage)

---

## 🎯 Analyse des Besoins Spécifiques

### Spécificités EduPilot

Votre application a des besoins **très spécifiques** à l'éducation:

#### 1. **Hiérarchie Complexe Multi-Niveaux**
```
SUPER_ADMIN (système)
  └─ SCHOOL_ADMIN (établissement)
      ├─ DIRECTOR (pédagogie)
      │   └─ TEACHER (classe/matière)
      │       └─ STUDENT (classe)
      │           └─ PARENT (enfant)
      └─ ACCOUNTANT (finances)
```

#### 2. **Contextes Multiples**
- **School Context**: Quel établissement ?
- **Class Context**: Quelle classe ?
- **Subject Context**: Quelle matière ?
- **Time Context**: Quelle année/période ?
- **Relation Context**: Quel élève (pour parent/teacher) ?

#### 3. **Permissions Dynamiques**
- Un TEACHER peut noter **ses élèves** dans **ses matières**
- Un PARENT peut voir **ses enfants** uniquement
- Un DIRECTOR peut gérer **son établissement** uniquement
- Permissions qui changent selon le **contexte** et le **temps**

#### 4. **Données Sensibles**
- Notes des élèves
- Données médicales
- Informations financières
- Dossiers disciplinaires
- Communications privées

---

## 🏗️ Architecture Proposée

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser/Mobile)                   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├─ JWT Access Token (15 min)
                ├─ Refresh Token (7 days)
                └─ Device Fingerprint
                │
┌───────────────▼─────────────────────────────────────────────┐
│                      MIDDLEWARE LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Authentication (JWT Verify)                       │   │
│  │ 2. Multi-Tenant Isolation (schoolId)                 │   │
│  │ 3. Context Resolution (class, subject, period)       │   │
│  │ 4. Permission Evaluation (RBAC + ABAC)               │   │
│  │ 5. Rate Limiting (by role + IP)                      │   │
│  │ 6. Audit Logging (all actions)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ API Routes     │  │ Business     │  │ Data Access     │ │
│  │ (Protected)    │─▶│ Logic        │─▶│ (Row-Level      │ │
│  │                │  │              │  │  Security)      │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                       DATABASE LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PostgreSQL + Prisma                                  │   │
│  │ - Multi-tenant isolation (schoolId)                  │   │
│  │ - Row-level security (RLS)                           │   │
│  │ - Audit tables (who, what, when)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 👥 Système de Rôles Hiérarchique

### Modèle Amélioré

Au lieu de rôles simples, utilisons **Rôle + Contexte + Portée**:

```typescript
interface UserRole {
  // Rôle de base
  role: RoleType;

  // Contexte (portée)
  scope: {
    schoolId?: string;        // Pour tous sauf SUPER_ADMIN
    classIds?: string[];      // Pour TEACHER, STUDENT
    subjectIds?: string[];    // Pour TEACHER
    studentIds?: string[];    // Pour PARENT
    departmentId?: string;    // Pour DIRECTOR
  };

  // Permissions dynamiques
  permissions: Permission[];

  // Contraintes temporelles
  validFrom?: Date;
  validUntil?: Date;

  // Restrictions
  restrictions?: {
    ipWhitelist?: string[];
    maxSessions?: number;
    mustUseMFA?: boolean;
    canExportData?: boolean;
  };
}
```

### 7 Rôles avec Contextes

#### 1. **SUPER_ADMIN** (Système)
```typescript
{
  role: "SUPER_ADMIN",
  scope: { global: true },
  permissions: ALL_PERMISSIONS,
  restrictions: {
    ipWhitelist: ["admin-office-ip"],
    mustUseMFA: true,
  }
}
```

**Peut:**
- Tout faire sur tous les établissements
- Créer/supprimer des établissements
- Gérer tous les utilisateurs
- Accéder aux analytics globales

**Ne peut pas:**
- Être créé via l'interface (CLI uniquement)

---

#### 2. **SCHOOL_ADMIN** (Établissement)
```typescript
{
  role: "SCHOOL_ADMIN",
  scope: {
    schoolId: "school-123"
  },
  permissions: [
    Permission.SCHOOL_MANAGE,
    Permission.USER_CREATE,
    Permission.USER_MANAGE,
    Permission.CLASS_MANAGE,
    // ... toutes permissions de l'école
  ],
  restrictions: {
    mustUseMFA: true,
    canExportData: true,
  }
}
```

**Peut:**
- Gérer son établissement
- Créer utilisateurs (DIRECTOR, TEACHER, ACCOUNTANT, STUDENT, PARENT)
- Gérer classes, matières, emplois du temps
- Configurer année scolaire
- Voir tous les rapports de l'école

**Ne peut pas:**
- Accéder à d'autres établissements
- Créer d'autres SCHOOL_ADMIN
- Modifier configuration système

---

#### 3. **DIRECTOR** (Direction Pédagogique)
```typescript
{
  role: "DIRECTOR",
  scope: {
    schoolId: "school-123",
    departmentId?: "dept-456",  // Optionnel (directeur de cycle)
  },
  permissions: [
    Permission.STUDENT_MANAGE,
    Permission.TEACHER_MANAGE,
    Permission.CLASS_MANAGE,
    Permission.GRADE_VIEW_ALL,
    Permission.REPORT_GENERATE,
    // ... permissions pédagogiques
  ]
}
```

**Peut:**
- Gérer enseignants et élèves
- Voir toutes les notes de l'école/département
- Valider inscriptions
- Gérer emplois du temps
- Générer rapports pédagogiques

**Ne peut pas:**
- Gérer finances
- Créer/supprimer l'école
- Modifier salaires enseignants

---

#### 4. **TEACHER** (Enseignant)
```typescript
{
  role: "TEACHER",
  scope: {
    schoolId: "school-123",
    classIds: ["class-1", "class-2"],
    subjectIds: ["math", "physics"],
  },
  permissions: [
    Permission.GRADE_CREATE,      // Mais seulement pour ses matières
    Permission.GRADE_UPDATE,      // Mais seulement pour ses élèves
    Permission.ATTENDANCE_MARK,   // Mais seulement pour ses cours
    Permission.HOMEWORK_CREATE,
    Permission.STUDENT_VIEW,      // Mais seulement ses élèves
  ]
}
```

**Peut:**
- Noter ses élèves dans ses matières
- Créer devoirs pour ses classes
- Marquer présences dans ses cours
- Voir infos de ses élèves
- Communiquer avec parents de ses élèves

**Ne peut pas:**
- Noter dans matières d'autres enseignants
- Voir notes d'autres matières
- Modifier notes validées par direction
- Accéder dossiers médicaux

---

#### 5. **STUDENT** (Élève)
```typescript
{
  role: "STUDENT",
  scope: {
    schoolId: "school-123",
    classIds: ["class-1"],
    studentId: "student-789",  // Lui-même
  },
  permissions: [
    Permission.GRADE_VIEW_OWN,
    Permission.SCHEDULE_VIEW_OWN,
    Permission.HOMEWORK_SUBMIT,
    Permission.RESOURCE_VIEW,
    Permission.NOTIFICATION_VIEW_OWN,
  ]
}
```

**Peut:**
- Voir ses notes uniquement
- Voir son emploi du temps
- Soumettre devoirs
- Consulter ressources pédagogiques
- Voir ses notifications

**Ne peut pas:**
- Voir notes d'autres élèves
- Modifier quoi que ce soit
- Accéder à ses données médicales (sauf si activé)

---

#### 6. **PARENT** (Parent)
```typescript
{
  role: "PARENT",
  scope: {
    schoolId: "school-123",
    studentIds: ["student-789", "student-790"],  // Ses enfants
  },
  permissions: [
    Permission.GRADE_VIEW_CHILDREN,
    Permission.ATTENDANCE_VIEW_CHILDREN,
    Permission.PAYMENT_MANAGE,
    Permission.APPOINTMENT_REQUEST,
    Permission.MESSAGE_SEND_TEACHER,
  ]
}
```

**Peut:**
- Voir notes de ses enfants
- Voir présences de ses enfants
- Payer frais scolaires
- Demander RDV avec enseignants
- Communiquer avec l'école

**Ne peut pas:**
- Voir notes d'autres élèves
- Modifier notes
- Accéder à la gestion de l'école

---

#### 7. **ACCOUNTANT** (Comptable)
```typescript
{
  role: "ACCOUNTANT",
  scope: {
    schoolId: "school-123",
  },
  permissions: [
    Permission.FEE_MANAGE,
    Permission.PAYMENT_MANAGE,
    Permission.INVOICE_GENERATE,
    Permission.REPORT_FINANCIAL,
    Permission.STUDENT_VIEW_FINANCIAL,
  ]
}
```

**Peut:**
- Gérer frais et paiements
- Générer factures
- Voir rapports financiers
- Gérer bourses

**Ne peut pas:**
- Voir notes des élèves
- Gérer aspects pédagogiques
- Modifier configuration école

---

## 🎯 Permissions Contextuelles (ABAC)

### Permission = Rôle + Contexte + Attributs

Au lieu de vérifier juste le rôle, vérifiez **la permission DANS son contexte**:

```typescript
interface PermissionCheck {
  // Permission demandée
  permission: Permission;

  // Ressource cible
  resource: {
    type: ResourceType;     // "grade", "student", "class", etc.
    id: string;
    schoolId: string;

    // Attributs de la ressource
    attributes?: {
      classId?: string;
      subjectId?: string;
      teacherId?: string;
      studentId?: string;
      period?: string;
      isFinalized?: boolean;
    };
  };

  // Contexte utilisateur
  user: {
    id: string;
    role: RoleType;
    scope: UserScope;
  };

  // Contexte temporel
  time?: {
    academicYear: string;
    period: string;
    isLocked?: boolean;
  };
}
```

### Exemples de Vérifications Contextuelles

#### Exemple 1: Enseignant peut-il noter cet élève ?

```typescript
async function canTeacherGradeStudent(
  teacherId: string,
  studentId: string,
  subjectId: string,
  evaluationId: string
): Promise<boolean> {
  // 1. Vérifier que l'enseignant enseigne cette matière
  const teaches = await prisma.classSubject.findFirst({
    where: {
      teacherProfileId: teacherId,
      subjectId: subjectId,
      classAssignment: {
        enrollments: {
          some: { studentId }
        }
      }
    }
  });

  if (!teaches) return false;

  // 2. Vérifier que l'évaluation n'est pas finalisée
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: { isFinalized: true }
  });

  if (evaluation?.isFinalized) return false;

  // 3. Vérifier que la période n'est pas clôturée
  const period = await getCurrentAcademicPeriod();
  if (period?.isClosed) return false;

  return true;
}
```

#### Exemple 2: Parent peut-il voir ces notes ?

```typescript
async function canParentViewGrades(
  parentId: string,
  studentId: string
): Promise<boolean> {
  // 1. Vérifier relation parent-enfant
  const isParent = await prisma.parentProfile.findFirst({
    where: {
      userId: parentId,
      children: {
        some: { studentId }
      }
    }
  });

  if (!isParent) return false;

  // 2. Vérifier que l'élève est actif
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { user: { select: { isActive: true } } }
  });

  if (!student?.user.isActive) return false;

  // 3. Vérifier restrictions de confidentialité (si élève majeur)
  const age = calculateAge(student.dateOfBirth);
  if (age >= 18) {
    // Vérifier si l'élève a autorisé l'accès
    const consent = await prisma.parentConsent.findFirst({
      where: {
        studentId,
        parentId,
        type: "GRADE_ACCESS",
        isActive: true
      }
    });

    if (!consent) return false;
  }

  return true;
}
```

---

## 🏢 Multi-Tenant Avancé

### Isolation à 3 Niveaux

#### Niveau 1: Base de Données (Row-Level Security)

```sql
-- Activer RLS sur toutes les tables sensibles
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Policy pour SCHOOL_ADMIN
CREATE POLICY school_admin_access ON users
  FOR ALL
  USING (
    school_id = current_setting('app.current_school_id')::uuid
    OR
    current_setting('app.user_role') = 'SUPER_ADMIN'
  );

-- Policy pour TEACHER
CREATE POLICY teacher_access ON grades
  FOR SELECT
  USING (
    evaluation_id IN (
      SELECT id FROM evaluations
      WHERE class_subject_id IN (
        SELECT id FROM class_subjects
        WHERE teacher_profile_id = current_setting('app.current_user_id')::uuid
      )
    )
  );
```

#### Niveau 2: Application (Prisma Extensions)

```typescript
// prisma-client-extension.ts
import { Prisma } from '@prisma/client';

export function createTenantExtension(schoolId: string, userId: string, role: string) {
  return Prisma.defineExtension({
    name: 'tenant-isolation',

    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          // Auto-inject schoolId filter
          if (role !== 'SUPER_ADMIN') {
            if (operation === 'findMany' || operation === 'findFirst') {
              args.where = {
                ...args.where,
                schoolId: schoolId,
              };
            }

            if (operation === 'create' || operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data = args.data.map(d => ({ ...d, schoolId }));
              } else {
                args.data = { ...args.data, schoolId };
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}

// Usage
const prismaWithTenant = prisma.$extends(
  createTenantExtension(session.user.schoolId, session.user.id, session.user.role)
);
```

#### Niveau 3: Middleware (Request Level)

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const session = await getSession(request);

  if (!session) return redirectToLogin(request);

  // Vérifier isolation multi-tenant
  const targetSchoolId = extractSchoolIdFromRequest(request);

  if (targetSchoolId && session.user.role !== 'SUPER_ADMIN') {
    if (session.user.schoolId !== targetSchoolId) {
      return NextResponse.json(
        { error: 'Accès refusé: établissement non autorisé' },
        { status: 403 }
      );
    }
  }

  // Injecter contexte dans headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-School-Id', session.user.schoolId || '');
  requestHeaders.set('X-User-Id', session.user.id);
  requestHeaders.set('X-User-Role', session.user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
```

---

## 💻 Implémentation Complète

### 1. Schéma Prisma Amélioré

```prisma
// prisma/schema.prisma

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String
  firstName     String
  lastName      String
  role          UserRole
  schoolId      String?
  isActive      Boolean  @default(true)

  // Multi-factor authentication
  mfaEnabled    Boolean  @default(false)
  mfaSecret     String?
  backupCodes   String[]

  // Session management
  sessions      Session[]
  devices       UserDevice[]

  // Audit
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?
  lastLoginIp   String?

  school        School?  @relation(fields: [schoolId], references: [id])

  // Role-specific profiles
  teacherProfile   TeacherProfile?
  studentProfile   StudentProfile?
  parentProfile    ParentProfile?

  @@index([email])
  @@index([schoolId])
  @@index([role])
  @@map("users")
}

model Session {
  id            String   @id @default(cuid())
  userId        String
  token         String   @unique
  refreshToken  String   @unique
  deviceId      String
  ipAddress     String
  userAgent     String
  expiresAt     DateTime
  refreshExpiresAt DateTime
  createdAt     DateTime @default(now())
  lastActivityAt DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  device        UserDevice @relation(fields: [deviceId], references: [id])

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("sessions")
}

model UserDevice {
  id            String   @id @default(cuid())
  userId        String
  fingerprint   String   // Browser fingerprint
  name          String?  // "iPhone 14", "Chrome on Windows", etc.
  isTrusted     Boolean  @default(false)
  lastUsedAt    DateTime @default(now())
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions      Session[]

  @@unique([userId, fingerprint])
  @@map("user_devices")
}

model RolePermission {
  id            String   @id @default(cuid())
  userId        String
  permission    String   // "grade:create", "student:view", etc.
  resourceType  String?  // "grade", "student", "class"
  resourceId    String?  // Specific resource ID

  // Scope restrictions
  schoolId      String?
  classId       String?
  subjectId     String?

  // Time restrictions
  validFrom     DateTime?
  validUntil    DateTime?

  // Custom conditions (JSON)
  conditions    Json?

  createdAt     DateTime @default(now())
  createdBy     String

  @@index([userId])
  @@index([permission])
  @@index([schoolId])
  @@map("role_permissions")
}

model PermissionCache {
  id            String   @id @default(cuid())
  userId        String
  cacheKey      String   @unique
  permissions   Json     // Cached permission list
  context       Json     // Context used for caching
  expiresAt     DateTime
  createdAt     DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
  @@map("permission_cache")
}
```

### 2. Service d'Authentification Avancé

```typescript
// src/lib/auth/advanced-auth-service.ts

import { hash, compare } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { generateMFASecret, verifyMFAToken } from './mfa';
import { generateDeviceFingerprint } from './device-fingerprint';

export class AdvancedAuthService {
  /**
   * Authenticate user with email/password + optional MFA
   */
  async authenticate(
    email: string,
    password: string,
    mfaToken?: string,
    deviceFingerprint?: string
  ): Promise<AuthResult> {
    // 1. Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        school: true,
        teacherProfile: { include: { teacherSubjects: true } },
        studentProfile: { include: { enrollments: true } },
        parentProfile: { include: { children: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new AuthError('Identifiants invalides');
    }

    // 2. Verify password
    const passwordValid = await compare(password, user.password);
    if (!passwordValid) {
      await this.logFailedLogin(user.id, 'invalid_password');
      throw new AuthError('Identifiants invalides');
    }

    // 3. Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaToken) {
        return {
          requiresMFA: true,
          userId: user.id,
        };
      }

      const mfaValid = verifyMFAToken(user.mfaSecret!, mfaToken);
      if (!mfaValid) {
        await this.logFailedLogin(user.id, 'invalid_mfa');
        throw new AuthError('Code MFA invalide');
      }
    }

    // 4. Get or create device
    const device = await this.getOrCreateDevice(
      user.id,
      deviceFingerprint!
    );

    // 5. Create session
    const session = await this.createSession(user, device);

    // 6. Load permissions
    const permissions = await this.loadUserPermissions(user);

    // 7. Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: this.getClientIp(),
      },
    });

    // 8. Log successful login
    await this.logSuccessfulLogin(user.id, device.id);

    return {
      user: this.serializeUser(user),
      accessToken: session.token,
      refreshToken: session.refreshToken,
      permissions,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Create session with access + refresh tokens
   */
  private async createSession(
    user: User,
    device: UserDevice
  ): Promise<Session> {
    const now = new Date();
    const accessTokenExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
    const refreshTokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create JWT access token
    const accessToken = sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        sessionId: crypto.randomUUID(),
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    // Create refresh token
    const refreshToken = crypto.randomUUID();

    // Store in database
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        token: accessToken,
        refreshToken,
        ipAddress: this.getClientIp(),
        userAgent: this.getUserAgent(),
        expiresAt: accessTokenExpiry,
        refreshExpiresAt: refreshTokenExpiry,
      },
    });

    return session;
  }

  /**
   * Refresh access token
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    // 1. Find session
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: {
            school: true,
            teacherProfile: true,
            studentProfile: true,
            parentProfile: true,
          },
        },
      },
    });

    if (!session) {
      throw new AuthError('Session invalide');
    }

    // 2. Check expiry
    if (new Date() > session.refreshExpiresAt) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new AuthError('Session expirée');
    }

    // 3. Check user still active
    if (!session.user.isActive) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new AuthError('Utilisateur inactif');
    }

    // 4. Create new tokens
    const newAccessToken = sign(
      {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
        schoolId: session.user.schoolId,
        sessionId: session.id,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const newRefreshToken = crypto.randomUUID();
    const now = new Date();
    const accessTokenExpiry = new Date(now.getTime() + 15 * 60 * 1000);
    const refreshTokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 5. Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: accessTokenExpiry,
        refreshExpiresAt: refreshTokenExpiry,
        lastActivityAt: new Date(),
      },
    });

    // 6. Reload permissions (might have changed)
    const permissions = await this.loadUserPermissions(session.user);

    return {
      user: this.serializeUser(session.user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      permissions,
      expiresAt: accessTokenExpiry,
    };
  }

  /**
   * Load user permissions with caching
   */
  private async loadUserPermissions(user: User): Promise<Permission[]> {
    const cacheKey = `permissions:${user.id}:${user.role}:${user.schoolId}`;

    // Try cache first
    const cached = await this.getPermissionCache(cacheKey);
    if (cached) return cached;

    // Load from database
    const permissions = await this.computeUserPermissions(user);

    // Cache for 15 minutes
    await this.setPermissionCache(cacheKey, permissions, 15 * 60);

    return permissions;
  }

  /**
   * Compute permissions based on role + context
   */
  private async computeUserPermissions(user: User): Promise<Permission[]> {
    const basePermissions = getRolePermissions(user.role);

    // Add custom permissions
    const customPerms = await prisma.rolePermission.findMany({
      where: {
        userId: user.id,
        OR: [
          { validFrom: null },
          { validFrom: { lte: new Date() } },
        ],
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
    });

    return [
      ...basePermissions,
      ...customPerms.map(p => p.permission as Permission),
    ];
  }

  /**
   * Verify JWT and load session
   */
  async verifyToken(token: string): Promise<SessionData> {
    try {
      // 1. Verify JWT
      const payload = verify(token, process.env.JWT_SECRET!) as JWTPayload;

      // 2. Find session in DB
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              school: true,
              teacherProfile: {
                include: {
                  teacherSubjects: {
                    include: { subject: true }
                  },
                  classSubjects: {
                    include: {
                      classAssignment: {
                        include: { class: true }
                      }
                    }
                  }
                }
              },
              studentProfile: {
                include: {
                  enrollments: {
                    include: { class: true }
                  }
                }
              },
              parentProfile: {
                include: {
                  children: {
                    include: { student: true }
                  }
                }
              }
            }
          },
        },
      });

      if (!session) {
        throw new AuthError('Session invalide');
      }

      // 3. Check expiry
      if (new Date() > session.expiresAt) {
        await prisma.session.delete({ where: { id: session.id } });
        throw new AuthError('Session expirée');
      }

      // 4. Check user active
      if (!session.user.isActive) {
        throw new AuthError('Utilisateur inactif');
      }

      // 5. Update last activity
      await prisma.session.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      });

      // 6. Load permissions
      const permissions = await this.loadUserPermissions(session.user);

      // 7. Build context
      const context = this.buildUserContext(session.user);

      return {
        user: this.serializeUser(session.user),
        permissions,
        context,
        sessionId: session.id,
      };
    } catch (error) {
      throw new AuthError('Token invalide');
    }
  }

  /**
   * Build user context (scope)
   */
  private buildUserContext(user: User): UserContext {
    const context: UserContext = {
      schoolId: user.schoolId,
    };

    // Teacher context
    if (user.role === 'TEACHER' && user.teacherProfile) {
      context.subjectIds = user.teacherProfile.teacherSubjects.map(
        ts => ts.subjectId
      );
      context.classIds = [
        ...new Set(
          user.teacherProfile.classSubjects.map(
            cs => cs.classAssignment.classId
          )
        ),
      ];
    }

    // Student context
    if (user.role === 'STUDENT' && user.studentProfile) {
      context.classIds = user.studentProfile.enrollments.map(
        e => e.classId
      );
      context.studentId = user.studentProfile.id;
    }

    // Parent context
    if (user.role === 'PARENT' && user.parentProfile) {
      context.studentIds = user.parentProfile.children.map(
        c => c.studentId
      );
    }

    return context;
  }

  /**
   * Logout (revoke session)
   */
  async logout(sessionId: string): Promise<void> {
    await prisma.session.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Logout all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }
}
```

### 3. Gestionnaire de Permissions Contextuel

```typescript
// src/lib/auth/permission-manager.ts

export class PermissionManager {
  /**
   * Check if user can perform action on resource
   */
  async can(
    session: SessionData,
    permission: Permission,
    resource?: ResourceContext
  ): Promise<boolean> {
    // 1. Check base permission
    if (!session.permissions.includes(permission)) {
      return false;
    }

    // 2. If no resource context, permission granted
    if (!resource) return true;

    // 3. Check multi-tenant isolation
    if (session.user.role !== 'SUPER_ADMIN') {
      if (resource.schoolId && resource.schoolId !== session.context.schoolId) {
        return false;
      }
    }

    // 4. Context-specific checks
    switch (permission) {
      case Permission.GRADE_CREATE:
      case Permission.GRADE_UPDATE:
        return this.canManageGrade(session, resource);

      case Permission.STUDENT_VIEW:
        return this.canViewStudent(session, resource);

      case Permission.ATTENDANCE_MARK:
        return this.canMarkAttendance(session, resource);

      default:
        return true;
    }
  }

  /**
   * Can teacher grade this student?
   */
  private async canManageGrade(
    session: SessionData,
    resource: ResourceContext
  ): Promise<boolean> {
    if (session.user.role === 'SUPER_ADMIN') return true;
    if (session.user.role === 'SCHOOL_ADMIN') return true;
    if (session.user.role === 'DIRECTOR') return true;

    if (session.user.role === 'TEACHER') {
      // Check if teacher teaches this subject to this student
      const evaluation = await prisma.evaluation.findUnique({
        where: { id: resource.evaluationId },
        include: {
          classSubject: {
            include: {
              teacherProfile: true,
              classAssignment: {
                include: {
                  enrollments: true
                }
              }
            }
          }
        }
      });

      if (!evaluation) return false;

      // Teacher must be assigned to this subject
      if (evaluation.classSubject.teacherProfileId !== session.user.teacherProfile?.id) {
        return false;
      }

      // Student must be in the class
      const studentInClass = evaluation.classSubject.classAssignment.enrollments.some(
        e => e.studentId === resource.studentId
      );

      if (!studentInClass) return false;

      // Evaluation must not be finalized
      if (evaluation.isFinalized) return false;

      return true;
    }

    return false;
  }

  /**
   * Can view student info?
   */
  private async canViewStudent(
    session: SessionData,
    resource: ResourceContext
  ): Promise<boolean> {
    // Admins can view all
    if (['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(session.user.role)) {
      return true;
    }

    // Teacher can view their students
    if (session.user.role === 'TEACHER') {
      if (!session.context.classIds) return false;

      const studentInMyClasses = await prisma.enrollment.findFirst({
        where: {
          studentId: resource.studentId,
          classId: { in: session.context.classIds },
        },
      });

      return !!studentInMyClasses;
    }

    // Student can view themselves
    if (session.user.role === 'STUDENT') {
      return resource.studentId === session.context.studentId;
    }

    // Parent can view their children
    if (session.user.role === 'PARENT') {
      return session.context.studentIds?.includes(resource.studentId!) || false;
    }

    return false;
  }

  /**
   * Can mark attendance?
   */
  private async canMarkAttendance(
    session: SessionData,
    resource: ResourceContext
  ): Promise<boolean> {
    // Only teachers and admins can mark attendance
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(session.user.role)) {
      return false;
    }

    if (session.user.role === 'TEACHER') {
      // Check if this is their session
      const sessionRecord = await prisma.session.findUnique({
        where: { id: resource.sessionId },
        include: {
          classSubject: {
            include: {
              teacherProfile: true
            }
          }
        }
      });

      if (!sessionRecord) return false;

      return sessionRecord.classSubject.teacherProfileId === session.user.teacherProfile?.id;
    }

    return true;
  }

  /**
   * Batch permission check (optimized)
   */
  async canBatch(
    session: SessionData,
    checks: Array<{ permission: Permission; resource?: ResourceContext }>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const check of checks) {
      const key = `${check.permission}:${JSON.stringify(check.resource || {})}`;
      results[key] = await this.can(session, check.permission, check.resource);
    }

    return results;
  }
}
```

### 4. Middleware d'Authentification

```typescript
// src/lib/auth/auth-middleware.ts

export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredPermissions?: Permission[]
): Promise<SessionData> {
  // 1. Extract token
  const token = extractTokenFromRequest(req);
  if (!token) {
    throw new AuthError('Token manquant', 401);
  }

  // 2. Verify token and load session
  const authService = new AdvancedAuthService();
  const session = await authService.verifyToken(token);

  // 3. Check required permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const permManager = new PermissionManager();

    for (const permission of requiredPermissions) {
      const hasPermission = await permManager.can(session, permission);
      if (!hasPermission) {
        throw new AuthError(
          `Permission requise: ${permission}`,
          403
        );
      }
    }
  }

  // 4. Attach session to request
  (req as any).session = session;

  return session;
}

/**
 * HOF to protect API routes
 */
export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options?: {
    permissions?: Permission[];
    requireMFA?: boolean;
  }
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const session = await authMiddleware(req, res, options?.permissions);

      // Check MFA if required
      if (options?.requireMFA && !session.user.mfaEnabled) {
        return res.status(403).json({
          error: 'MFA requis pour cette opération',
        });
      }

      // Call original handler
      return await handler(req, res);
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          error: error.message,
        });
      }

      console.error('[Auth Error]', error);
      return res.status(500).json({
        error: 'Erreur interne',
      });
    }
  };
}
```

---

## 🔄 Flux d'Authentification Complets

### Flux 1: Login Standard

```
┌──────────┐     1. POST /api/auth/login          ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     { email, password, deviceId }    │          │
└──────────┘                                       └──────────┘
                                                        │
                                                        │ 2. Verify password
                                                        │ 3. Check MFA
                                                        │ 4. Create session
                                                        │ 5. Generate tokens
                                                        │
┌──────────┐     6. Return tokens                 ┌──────────┐
│  Client  │◀────────────────────────────────────│  Server  │
│          │     { accessToken, refreshToken }    │          │
└──────────┘                                       └──────────┘
     │
     │ 7. Store tokens in httpOnly cookies
     │ 8. Store user data in localStorage
     │
┌──────────┐     9. GET /api/grades               ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     Authorization: Bearer <token>    │          │
└──────────┘                                       └──────────┘
                                                        │
                                                        │ 10. Verify token
                                                        │ 11. Load permissions
                                                        │ 12. Check access
                                                        │ 13. Return data
                                                        │
┌──────────┐     14. Return grades                ┌──────────┐
│  Client  │◀────────────────────────────────────│  Server  │
│          │     { grades: [...] }                │          │
└──────────┘                                       └──────────┘
```

### Flux 2: Token Refresh

```
┌──────────┐     1. Access token expired         ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     (401 Unauthorized)               │          │
└──────────┘                                       └──────────┘
     │
     │ 2. Detect 401 error
     │ 3. GET /api/auth/refresh
     │    with refreshToken
     │
┌──────────┐     4. POST /api/auth/refresh       ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     { refreshToken }                 │          │
└──────────┘                                       └──────────┘
                                                        │
                                                        │ 5. Verify refresh token
                                                        │ 6. Check session validity
                                                        │ 7. Generate new tokens
                                                        │
┌──────────┐     8. Return new tokens             ┌──────────┐
│  Client  │◀────────────────────────────────────│  Server  │
│          │     { accessToken, refreshToken }    │          │
└──────────┘                                       └──────────┘
     │
     │ 9. Update tokens
     │ 10. Retry original request
     │
┌──────────┐     11. Retry GET /api/grades       ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     Authorization: Bearer <new>      │          │
└──────────┘                                       └──────────┘
```

### Flux 3: MFA Login

```
┌──────────┐     1. POST /api/auth/login          ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     { email, password }              │          │
└──────────┘                                       └──────────┘
                                                        │
                                                        │ 2. Verify password ✓
                                                        │ 3. Detect MFA enabled
                                                        │
┌──────────┐     4. Return { requiresMFA: true } ┌──────────┐
│  Client  │◀────────────────────────────────────│  Server  │
│          │     { requiresMFA, userId }          │          │
└──────────┘                                       └──────────┘
     │
     │ 5. Show MFA input UI
     │ 6. User enters 6-digit code
     │
┌──────────┐     7. POST /api/auth/verify-mfa     ┌──────────┐
│  Client  │────────────────────────────────────▶│  Server  │
│          │     { userId, mfaToken }             │          │
└──────────┘                                       └──────────┘
                                                        │
                                                        │ 8. Verify MFA token
                                                        │ 9. Create session
                                                        │ 10. Generate tokens
                                                        │
┌──────────┐     11. Return tokens                ┌──────────┐
│  Client  │◀────────────────────────────────────│  Server  │
│          │     { accessToken, refreshToken }    │          │
└──────────┘                                       └──────────┘
```

---

## 🎬 Cas d'Usage Réels

### Cas 1: Enseignant Note un Élève

```typescript
// API Route: POST /api/grades
export const POST = withAuth(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const session = req.session as SessionData;
    const { studentId, evaluationId, value } = req.body;

    // 1. Permission check
    const permManager = new PermissionManager();
    const canGrade = await permManager.can(
      session,
      Permission.GRADE_CREATE,
      { studentId, evaluationId }
    );

    if (!canGrade) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas noter cet élève pour cette évaluation',
      });
    }

    // 2. Business validation
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { classSubject: true },
    });

    if (!evaluation) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    if (value < 0 || value > Number(evaluation.maxGrade)) {
      return res.status(400).json({
        error: `Note invalide (0-${evaluation.maxGrade})`,
      });
    }

    // 3. Create grade
    const grade = await prisma.grade.create({
      data: {
        studentId,
        evaluationId,
        value,
        gradedBy: session.user.id,
      },
    });

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GRADE_CREATE',
        targetType: 'grade',
        targetId: grade.id,
        metadata: { studentId, evaluationId, value },
      },
    });

    // 5. Notify student/parent
    await notificationService.send({
      recipientIds: [studentId],
      type: 'GRADE_ADDED',
      message: `Nouvelle note en ${evaluation.classSubject.subject.name}`,
      metadata: { gradeId: grade.id },
    });

    return res.status(201).json({ grade });
  },
  { permissions: [Permission.GRADE_CREATE] }
);
```

### Cas 2: Parent Consulte Notes de son Enfant

```typescript
// API Route: GET /api/students/[id]/grades
export const GET = withAuth(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const session = req.session as SessionData;
    const studentId = req.query.id as string;

    // 1. Permission check
    const permManager = new PermissionManager();
    const canView = await permManager.can(
      session,
      Permission.GRADE_VIEW_CHILDREN,
      { studentId }
    );

    if (!canView) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas consulter les notes de cet élève',
      });
    }

    // 2. Check consent for adult students (18+)
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { dateOfBirth: true },
    });

    if (student) {
      const age = calculateAge(student.dateOfBirth);
      if (age >= 18) {
        const consent = await prisma.parentConsent.findFirst({
          where: {
            studentId,
            parentId: session.user.parentProfile!.id,
            type: 'GRADE_ACCESS',
            isActive: true,
          },
        });

        if (!consent) {
          return res.status(403).json({
            error: 'Cet élève est majeur et n\'a pas autorisé l\'accès',
          });
        }
      }
    }

    // 3. Fetch grades
    const grades = await prisma.grade.findMany({
      where: {
        studentId,
        evaluation: {
          classSubject: {
            classAssignment: {
              academicYear: getCurrentAcademicYear(),
            },
          },
        },
      },
      include: {
        evaluation: {
          include: {
            classSubject: {
              include: {
                subject: true,
                teacherProfile: {
                  include: { user: true },
                },
              },
            },
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GRADE_VIEW',
        targetType: 'student',
        targetId: studentId,
        metadata: { gradesCount: grades.length },
      },
    });

    return res.json({ grades });
  },
  { permissions: [Permission.GRADE_VIEW_CHILDREN] }
);
```

### Cas 3: Directeur Génère Rapport Établissement

```typescript
// API Route: POST /api/reports/school
export const POST = withAuth(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const session = req.session as SessionData;
    const { reportType, period, format } = req.body;

    // 1. Permission check
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(session.user.role)) {
      return res.status(403).json({
        error: 'Rôle insuffisant pour générer des rapports',
      });
    }

    // 2. Multi-tenant check
    const schoolId = session.context.schoolId;
    if (!schoolId && session.user.role !== 'SUPER_ADMIN') {
      return res.status(400).json({
        error: 'Établissement non défini',
      });
    }

    // 3. Generate report based on type
    let reportData;
    switch (reportType) {
      case 'PERFORMANCE':
        reportData = await generatePerformanceReport(schoolId!, period);
        break;
      case 'ATTENDANCE':
        reportData = await generateAttendanceReport(schoolId!, period);
        break;
      case 'FINANCIAL':
        // Extra permission check for financial reports
        if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(session.user.role)) {
          return res.status(403).json({
            error: 'Permission insuffisante pour les rapports financiers',
          });
        }
        reportData = await generateFinancialReport(schoolId!, period);
        break;
      default:
        return res.status(400).json({ error: 'Type de rapport invalide' });
    }

    // 4. Format output
    let output;
    if (format === 'pdf') {
      output = await generatePDF(reportData);
    } else {
      output = reportData;
    }

    // 5. Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REPORT_GENERATE',
        targetType: 'report',
        targetId: `${reportType}_${Date.now()}`,
        metadata: { reportType, period, format },
      },
    });

    return res.json({ report: output });
  },
  { permissions: [Permission.REPORT_VIEW] }
);
```

---

## 📦 Package Résumé

Votre nouveau système d'authentification inclurait:

### NPM Packages Requis

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "speakeasy": "^2.0.0",      // MFA
    "qrcode": "^1.5.3",          // MFA QR codes
    "ua-parser-js": "^1.0.37",   // Device detection
    "ioredis": "^5.3.2",         // Permission caching
    "@prisma/client": "^5.8.0",
    "zod": "^3.22.4"
  }
}
```

### Fichiers à Créer

```
src/lib/auth/
├── advanced-auth-service.ts        # Service principal
├── permission-manager.ts           # Gestionnaire permissions
├── auth-middleware.ts              # Middleware protection
├── mfa.ts                          # Multi-factor auth
├── device-fingerprint.ts           # Device tracking
├── session-manager.ts              # Session CRUD
├── permission-cache.ts             # Cache Redis
└── types.ts                        # TypeScript types
```

---

## ✅ Avantages de ce Système

### 1. **Sécurité Renforcée**
- ✅ Tokens courts (15 min) + refresh (7j)
- ✅ MFA optionnel par rôle
- ✅ Device tracking
- ✅ Session invalidation immédiate
- ✅ IP whitelisting pour admins

### 2. **Permissions Contextuelles**
- ✅ Vérifications selon le contexte (classe, matière, élève)
- ✅ Permissions dynamiques (changent avec les affectations)
- ✅ Permissions temporelles (validFrom/validUntil)
- ✅ Row-level security en base

### 3. **Performance**
- ✅ Cache Redis des permissions (15 min)
- ✅ Batch permission checks
- ✅ Prisma extensions pour auto-filter
- ✅ Moins de requêtes DB

### 4. **Auditabilité**
- ✅ Toutes les actions loggées
- ✅ Traçabilité complète
- ✅ Export conformité RGPD
- ✅ Détection anomalies

### 5. **Expérience Utilisateur**
- ✅ Login rapide (<500ms)
- ✅ Token refresh transparent
- ✅ Multi-device support
- ✅ Gestion devices de confiance
- ✅ Logout sélectif

---

## 🚀 Migration depuis Système Actuel

### Étape 1: Ajouter Tables (1h)
```bash
# Créer migration Prisma
npx prisma migrate dev --name add-advanced-auth
```

### Étape 2: Implémenter Services (4-6h)
- AdvancedAuthService
- PermissionManager
- SessionManager

### Étape 3: Migrer Middleware (2h)
- Remplacer NextAuth par custom middleware
- Garder compatibilité pendant transition

### Étape 4: Tester (3-4h)
- Tests unitaires
- Tests d'intégration
- Tests E2E

### Étape 5: Déployer (1h)
- Feature flag pour rollback
- Migration progressive

**Total: 11-14 heures** pour migration complète

---

## 💡 Conclusion

Ce système d'authentification sur mesure est **parfaitement adapté** à EduPilot car:

1. ✅ **Hiérarchie complexe** gérée (7 rôles avec contextes)
2. ✅ **Permissions contextuelles** (enseignant → classe → matière)
3. ✅ **Multi-tenant strict** (isolation école)
4. ✅ **Données sensibles** protégées (notes, médical, finances)
5. ✅ **Performance** optimale (cache, batch checks)
6. ✅ **Audit complet** (conformité RGPD)
7. ✅ **Extensible** (nouvelles permissions faciles)

**Le système actuel (NextAuth + RBAC) est bon, mais ce système sur mesure est OPTIMAL pour une application de gestion scolaire enterprise.** 🎓🔐

---

**Prêt à implémenter ?** Je peux vous aider étape par étape ! 🚀
