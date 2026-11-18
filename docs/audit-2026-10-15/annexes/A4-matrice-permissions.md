# Annexe A4 — Matrice rôles × permissions (RBAC codé)

> Généré le 2026-10-15 par extraction automatique du code (AST TypeScript / analyse du schéma Prisma), branche `feat/enseignant-multi-ecoles`, commit `0d57d9c`. Source : `getRolePermissions()` de `src/lib/rbac/permissions.ts`. Côté serveur, `createApiHandler` contrôle `session.user.role` (un seul rôle) via `roleSatisfies` (`allowedRoles`) et `hasPermission` (`requiredPermissions`). Le champ `User.roles[]` n'est lu que par le client (`use-rbac.ts`). `roleSatisfies` : seul NETWORK_ADMIN hérite de SCHOOL_ADMIN ; SUPER_ADMIN n'hérite de rien (il doit être listé explicitement).

| Permission | SUPER_ADMIN | NETWORK_ADMIN | SCHOOL_ADMIN | DIRECTOR | TEACHER | STAFF | ACCOUNTANT | PARENT | STUDENT |
|---|---|---|---|---|---|---|---|---|---|
| `school:create` | ✔ | ✔ |  |  |  |  |  |  |  |
| `school:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `school:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `school:delete` | ✔ |  |  |  |  |  |  |  |  |
| `user:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `user:read` | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |  |
| `user:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `user:delete` | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `student:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `student:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |
| `student:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `student:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `student:read:own` |  |  |  |  |  |  |  |  | ✔ |
| `teacher:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `teacher:read` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `teacher:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `teacher:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `class:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `class:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `class:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `class:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `subject:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `subject:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `subject:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `subject:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `grade:create` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `grade:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  | ✔ | ✔ |
| `grade:update` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `grade:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `grade:read:own` |  |  |  |  |  |  |  |  | ✔ |
| `grade:read:children` |  |  |  |  |  |  |  | ✔ |  |
| `evaluation:create` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `evaluation:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  | ✔ | ✔ |
| `evaluation:update` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `evaluation:delete` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `schedule:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `schedule:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  | ✔ | ✔ |
| `schedule:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `schedule:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `fee:create` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `fee:read` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `fee:update` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `fee:delete` | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `finance:create` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `finance:read` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `finance:update` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `finance:delete` | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |
| `payment:create` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `payment:read` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `payment:update` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `payment:delete` | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `payment:read:own` |  |  |  |  |  |  |  | ✔ |  |
| `report:view` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |  |  |
| `statistics:view` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `notification:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `notification:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `notification:delete` | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `academic_year:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `academic_year:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |
| `academic_year:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `academic_year:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `academic_year:close` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `student:promotion` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `calendar_event:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `calendar_event:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  | ✔ | ✔ |
| `calendar_event:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `calendar_event:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `holiday:create` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `holiday:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  | ✔ | ✔ |
| `holiday:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `holiday:delete` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `orientation:create` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `orientation:read` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `orientation:update` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `orientation:delete` | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `orientation:read:own` |  |  |  |  |  |  |  |  | ✔ |
| `orientation:read:children` |  |  |  |  |  |  |  | ✔ |  |
| `orientation:validate` | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| `analytics:view` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `analytics:view:own` |  |  |  |  |  |  |  |  | ✔ |
| `analytics:view:children` |  |  |  |  |  |  |  | ✔ |  |
| `analytics:generate` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `ai:predict:student` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `ai:predict:class` | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `ai:predict:view:own` |  |  |  |  |  |  |  |  | ✔ |
| `ai:predict:view:children` |  |  |  |  |  |  |  | ✔ |  |
| `attendance:read` |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `attendance:create` |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `attendance:update` |  | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| `attendance:delete` |  |  |  |  |  |  |  |  |  |
| `incident:read` |  |  |  |  | ✔ | ✔ |  |  |  |
| `incident:create` |  |  |  |  | ✔ | ✔ |  |  |  |
| `incident:update` |  |  |  |  |  |  |  |  |  |
| `incident:delete` |  |  |  |  |  |  |  |  |  |
| `medical:read` | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |  |
| `canteen:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  | ✔ | ✔ |
| `library:read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |
| `system:backup:create` | ✔ |  |  |  |  |  |  |  |  |
| `system:backup:view` | ✔ |  |  |  |  |  |  |  |  |
| `system:backup:restore` | ✔ |  |  |  |  |  |  |  |  |
| `system:read` | ✔ |  |  |  |  |  |  |  |  |
| `system:write` | ✔ |  |  |  |  |  |  |  |  |

**Totaux :** SUPER_ADMIN 84, NETWORK_ADMIN 81, SCHOOL_ADMIN 80, DIRECTOR 74, TEACHER 29, STAFF 13, ACCOUNTANT 15, PARENT 14, STUDENT 14.
