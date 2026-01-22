# 🔐 Système d'Authentification et RBAC - Analyse et Améliorations

## 📊 État Actuel (Très Bon ✅)

Votre application dispose déjà d'un **système RBAC robuste et complet**:

### ✅ Points Forts

1. **NextAuth v5** avec stratégie JWT
2. **7 rôles définis**: SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT, ACCOUNTANT
3. **133 permissions granulaires** dans `Permission` enum
4. **Matrice de permissions complète** par rôle
5. **Isolation multi-tenant** (schoolId)
6. **Guards API** centralisés dans `api-guard.ts`
7. **Middleware de protection** des routes
8. **Hiérarchie des rôles** avec niveaux de privilèges
9. **Fonctions utilitaires** pour vérifications (hasPermission, canPerformAction, etc.)

### 📁 Structure Actuelle

```
src/lib/auth/
├── config.ts          # Configuration NextAuth
├── index.ts           # Export des handlers
└── session.ts         # Helpers de session (requireAuth, requireRole, etc.)

src/lib/rbac/
├── permissions.ts     # Permissions enum + matrice complète
└── api-guard.ts       # Guards pour routes API

src/middleware.ts      # Protection des routes publiques/privées
```

---

## 🚀 Améliorations Proposées

### 1. **Permission-Based Guards** (au lieu de Role-Based uniquement)

**Problème:** Actuellement, vous utilisez principalement des rôles pour vérifier l'accès.
**Solution:** Ajouter des guards basés sur les permissions individuelles.

#### Créer: `src/lib/rbac/permission-guard.ts`

```typescript
import { Session } from "next-auth";
import { UserRole } from "@prisma/client";
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from "./permissions";
import { NextResponse } from "next/server";

/**
 * Require specific permission
 */
export function requirePermission(
  session: Session | null,
  permission: Permission
): { authorized: boolean; response?: NextResponse } {
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const userRole = session.user.role as UserRole;

  if (!hasPermission(userRole, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Permission requise: ${permission}`,
          code: "MISSING_PERMISSION",
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Require ANY of the specified permissions
 */
export function requireAnyPermission(
  session: Session | null,
  permissions: Permission[]
): { authorized: boolean; response?: NextResponse } {
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const userRole = session.user.role as UserRole;

  if (!hasAnyPermission(userRole, permissions)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Vous n'avez pas les permissions nécessaires",
          required: permissions,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Require ALL of the specified permissions
 */
export function requireAllPermissions(
  session: Session | null,
  permissions: Permission[]
): { authorized: boolean; response?: NextResponse } {
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const userRole = session.user.role as UserRole;

  if (!hasAllPermissions(userRole, permissions)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Vous n'avez pas toutes les permissions nécessaires",
          required: permissions,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true };
}
```

**Usage dans API Routes:**
```typescript
import { requirePermission } from "@/lib/rbac/permission-guard";
import { Permission } from "@/lib/rbac/permissions";

export async function POST(req: Request) {
  const session = await auth();

  // Au lieu de requireRoles([...])
  const check = requirePermission(session, Permission.STUDENT_CREATE);
  if (!check.authorized) return check.response;

  // ... logique
}
```

---

### 2. **Hook React pour Permissions (Client-Side)**

#### Créer: `src/hooks/use-permissions.ts`

```typescript
"use client";

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
} from "@/lib/rbac/permissions";

export function usePermissions() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  return {
    /**
     * Check if user has specific permission
     */
    can: (permission: Permission): boolean => {
      if (!userRole) return false;
      return hasPermission(userRole, permission);
    },

    /**
     * Check if user has ANY of the permissions
     */
    canAny: (permissions: Permission[]): boolean => {
      if (!userRole) return false;
      return hasAnyPermission(userRole, permissions);
    },

    /**
     * Check if user has ALL of the permissions
     */
    canAll: (permissions: Permission[]): boolean => {
      if (!userRole) return false;
      return hasAllPermissions(userRole, permissions);
    },

    /**
     * Get all user's permissions
     */
    permissions: userRole ? getRolePermissions(userRole) : [],

    /**
     * Get user role
     */
    role: userRole,

    /**
     * Check if user is authenticated
     */
    isAuthenticated: !!session?.user,
  };
}
```

**Usage dans Composants:**
```tsx
import { usePermissions } from "@/hooks/use-permissions";
import { Permission } from "@/lib/rbac/permissions";

export function StudentActions() {
  const { can } = usePermissions();

  return (
    <div>
      {can(Permission.STUDENT_CREATE) && (
        <Button>Ajouter un élève</Button>
      )}

      {can(Permission.GRADE_UPDATE) && (
        <Button>Modifier la note</Button>
      )}
    </div>
  );
}
```

---

### 3. **Composant de Protection par Permission**

#### Créer: `src/components/auth/permission-gate.tsx`

```typescript
"use client";

import { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { Permission } from "@/lib/rbac/permissions";

interface PermissionGateProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // true = ALL permissions, false = ANY permission
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermissions();

  // Single permission check
  if (permission) {
    return can(permission) ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions check
  if (permissions) {
    const hasAccess = requireAll
      ? canAll(permissions)
      : canAny(permissions);

    return hasAccess ? <>{children}</> : <>{fallback}</>;
  }

  // No permission specified, deny by default
  return <>{fallback}</>;
}
```

**Usage:**
```tsx
import { PermissionGate } from "@/components/auth/permission-gate";
import { Permission } from "@/lib/rbac/permissions";

<PermissionGate permission={Permission.STUDENT_CREATE}>
  <Button>Créer un élève</Button>
</PermissionGate>

<PermissionGate
  permissions={[Permission.GRADE_CREATE, Permission.GRADE_UPDATE]}
  requireAll={false} // ANY permission
  fallback={<div>Accès refusé</div>}
>
  <GradeEditor />
</PermissionGate>
```

---

### 4. **Composant Role Gate**

#### Créer: `src/components/auth/role-gate.tsx`

```typescript
"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

interface RoleGateProps {
  allowedRoles: UserRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ allowedRoles, fallback = null, children }: RoleGateProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Usage:**
```tsx
import { RoleGate } from "@/components/auth/role-gate";

<RoleGate allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
  <AdminPanel />
</RoleGate>
```

---

### 5. **Audit Log System** (Traçabilité RBAC)

#### Créer: `src/lib/rbac/audit-logger.ts`

```typescript
import prisma from "@/lib/prisma";
import { Session } from "next-auth";
import { Permission } from "./permissions";

export async function logPermissionCheck(
  session: Session | null,
  permission: Permission,
  resource: string,
  authorized: boolean,
  metadata?: Record<string, any>
) {
  if (!session?.user) return;

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: authorized ? "PERMISSION_GRANTED" : "PERMISSION_DENIED",
        targetType: "PERMISSION_CHECK",
        targetId: permission,
        metadata: {
          permission,
          resource,
          authorized,
          userRole: session.user.role,
          ...metadata,
        },
        ipAddress: null, // À ajouter depuis request
      },
    });
  } catch (error) {
    console.error("[Audit Log] Failed to log permission check:", error);
  }
}

export async function logResourceAccess(
  session: Session,
  action: string,
  resourceType: string,
  resourceId: string,
  success: boolean,
  metadata?: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: success ? `${action.toUpperCase()}_SUCCESS` : `${action.toUpperCase()}_FAILED`,
        targetType: resourceType,
        targetId: resourceId,
        metadata: {
          action,
          success,
          userRole: session.user.role,
          ...metadata,
        },
        ipAddress: null,
      },
    });
  } catch (error) {
    console.error("[Audit Log] Failed to log resource access:", error);
  }
}
```

---

### 6. **Rate Limiting par Rôle**

#### Créer: `src/lib/rbac/rate-limiter.ts`

```typescript
import { UserRole } from "@prisma/client";

// Rate limits par rôle (requêtes par minute)
const RATE_LIMITS: Record<UserRole, number> = {
  SUPER_ADMIN: 1000,
  SCHOOL_ADMIN: 500,
  DIRECTOR: 500,
  TEACHER: 200,
  ACCOUNTANT: 200,
  STUDENT: 100,
  PARENT: 100,
};

// Simple in-memory store (utiliser Redis en production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, role: UserRole): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
} {
  const limit = RATE_LIMITS[role];
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  const record = requestCounts.get(userId);

  // Si pas d'enregistrement ou fenêtre expirée
  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    requestCounts.set(userId, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  // Incrémenter le compteur
  record.count++;

  // Vérifier la limite
  if (record.count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  return {
    allowed: true,
    limit,
    remaining: limit - record.count,
    resetAt: record.resetAt,
  };
}

// Middleware pour API routes
export function withRateLimit(handler: Function) {
  return async (req: Request, session: Session) => {
    const check = checkRateLimit(session.user.id, session.user.role as UserRole);

    if (!check.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes",
          limit: check.limit,
          resetAt: check.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": check.limit.toString(),
            "X-RateLimit-Remaining": check.remaining.toString(),
            "X-RateLimit-Reset": check.resetAt.toString(),
          },
        }
      );
    }

    return handler(req, session);
  };
}
```

---

### 7. **Session Refresh & Token Rotation**

#### Améliorer: `src/lib/auth/config.ts`

```typescript
// Ajouter dans callbacks
callbacks: {
  async jwt({ token, user, trigger, session }) {
    // Initial sign in
    if (user) {
      token.id = user.id;
      token.role = user.role;
      token.schoolId = user.schoolId;
      // ...
    }

    // Token refresh - revalidate user data
    if (trigger === "update" && session) {
      const freshUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: {
          id: true,
          role: true,
          schoolId: true,
          isActive: true,
        },
      });

      if (!freshUser || !freshUser.isActive) {
        // Force logout si utilisateur désactivé
        return null;
      }

      token.role = freshUser.role;
      token.schoolId = freshUser.schoolId;
    }

    return token;
  },
  // ...
},
```

---

## 📋 Checklist d'Implémentation

### Phase 1: Guards & Hooks (1-2h)
- [ ] Créer `permission-guard.ts`
- [ ] Créer `use-permissions.ts` hook
- [ ] Créer composant `PermissionGate`
- [ ] Créer composant `RoleGate`

### Phase 2: Audit & Monitoring (2-3h)
- [ ] Implémenter `audit-logger.ts`
- [ ] Ajouter logging aux guards API
- [ ] Créer dashboard d'audit (admin)

### Phase 3: Rate Limiting (1-2h)
- [ ] Implémenter `rate-limiter.ts`
- [ ] Intégrer dans middleware
- [ ] Configurer Redis (production)

### Phase 4: Token Refresh (1h)
- [ ] Améliorer callback JWT
- [ ] Tester invalidation de session
- [ ] Ajouter refresh automatique côté client

### Phase 5: Testing (2-3h)
- [ ] Tests unitaires pour permissions
- [ ] Tests d'intégration pour guards
- [ ] Tests E2E pour flows d'authentification

---

## 🎯 Exemples d'Usage Complets

### API Route avec Permissions

```typescript
// src/app/api/students/route.ts
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/permission-guard";
import { Permission } from "@/lib/rbac/permissions";
import { logResourceAccess } from "@/lib/rbac/audit-logger";

export async function POST(req: Request) {
  const session = await auth();

  // Check permission
  const check = requirePermission(session, Permission.STUDENT_CREATE);
  if (!check.authorized) return check.response;

  try {
    const data = await req.json();

    const student = await prisma.studentProfile.create({
      data: {
        // ...
      },
    });

    // Log success
    await logResourceAccess(
      session!,
      "create",
      "student",
      student.id,
      true,
      { studentData: data }
    );

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    // Log failure
    await logResourceAccess(
      session!,
      "create",
      "student",
      "unknown",
      false,
      { error: error.message }
    );

    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
```

### Composant avec Multiple Checks

```tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGate } from "@/components/auth/permission-gate";
import { Permission } from "@/lib/rbac/permissions";

export function StudentDashboard() {
  const { can, role, permissions } = usePermissions();

  return (
    <div>
      <h1>Tableau de Bord Élève</h1>

      {/* Afficher selon permission */}
      <PermissionGate permission={Permission.GRADE_READ_OWN}>
        <GradesSection />
      </PermissionGate>

      {/* Multiple permissions (ANY) */}
      <PermissionGate
        permissions={[
          Permission.SCHEDULE_READ,
          Permission.CALENDAR_EVENT_READ,
        ]}
      >
        <ScheduleSection />
      </PermissionGate>

      {/* Vérification dans logique */}
      {can(Permission.ANALYTICS_VIEW_OWN) && (
        <AnalyticsWidget />
      )}

      {/* Debug info (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <details>
          <summary>Debug: Mes Permissions ({permissions.length})</summary>
          <ul>
            {permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

---

## 🔒 Sécurité Supplémentaire

### 1. IP Whitelisting pour SUPER_ADMIN

```typescript
// src/lib/auth/config.ts
async authorize(credentials, req) {
  // ... validation

  // Check IP for SUPER_ADMIN
  if (user.role === "SUPER_ADMIN") {
    const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(",") || [];
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`[Security] SUPER_ADMIN login blocked from IP: ${clientIP}`);
      return null;
    }
  }

  return user;
}
```

### 2. Multi-Factor Authentication (MFA)

```typescript
// Ajouter dans User model
model User {
  // ...
  mfaEnabled   Boolean @default(false)
  mfaSecret    String?
  backupCodes  String[] // Codes de secours
}
```

### 3. Session Device Tracking

```typescript
// Ajouter dans JWT callback
token.deviceId = generateDeviceFingerprint(req);
token.loginIP = req.headers.get("x-forwarded-for");
token.loginAt = Date.now();
```

---

## 📊 Conclusion

### ✅ Votre système actuel est déjà **excellent**

Vous avez:
- RBAC complet avec 7 rôles
- 133 permissions granulaires
- Guards API centralisés
- Multi-tenant isolation
- Hiérarchie des rôles

### 🚀 Les améliorations proposées ajoutent:

1. **Permission-based guards** (plus granulaire que role-based)
2. **Hooks React** pour permissions côté client
3. **Composants de protection** réutilisables
4. **Audit logging** pour conformité
5. **Rate limiting** par rôle
6. **Token refresh** automatique

### 💡 Recommandations:

1. **Implémenter d'abord**: Permission guards + Hooks React (impact immédiat)
2. **Ensuite**: Audit logging (important pour conformité RGPD)
3. **Optionnel**: Rate limiting + MFA (selon besoins sécurité)

Votre architecture auth/RBAC est **prête pour la production** ! 🎉
