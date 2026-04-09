# 🏗️ Architecture Technique - EduPilot

## Vue d'ensemble

EduPilot est une application SaaS (Software as a Service) de gestion scolaire construite avec une architecture moderne, scalable et sécurisée.

---

## Stack Technique

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Langage**: TypeScript 5.7
- **Styling**: Tailwind CSS 3.4 + Radix UI
- **Animations**: Framer Motion 12
- **State Management**: React Hooks + Server Components
- **Forms**: React Hook Form + Zod validation
- **Graphiques**: Recharts
- **3D**: Three.js + React Three Fiber

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Next.js API Routes + Server Actions
- **Authentification**: NextAuth.js v5
- **ORM**: Prisma 6.19
- **Validation**: Zod 4.3

### Base de données
- **SGBD**: PostgreSQL 16
- **Cache**: Redis (Upstash)
- **Migration**: Prisma Migrate

### Infrastructure
- **Conteneurisation**: Docker + Docker Compose
- **Process Manager**: PM2 (déploiement sans Docker)
- **Reverse Proxy**: Nginx (recommandé)
- **CI/CD**: GitHub Actions

### Monitoring & Observabilité
- **Tracking d'erreurs**: Sentry
- **Logs**: Winston / Console structuré
- **Métriques**: Performance API intégrée

---

## Architecture Logicielle

### Architecture en couches

```
┌─────────────────────────────────────────┐
│         Couche Présentation             │
│  (Next.js Pages, Components, UI)        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Couche Business Logic           │
│  (Services, Domain Logic, Validation)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Couche Accès Données            │
│      (Prisma ORM, Redis Cache)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Base de Données              │
│           (PostgreSQL + Redis)          │
└─────────────────────────────────────────┘
```

### Modèle Multi-Tenant

EduPilot utilise un modèle multi-tenant avec **isolation par schoolId**. Récemment, le système a été étendu pour prendre en charge les enseignants multi-établissements via un modèle de rattachement flexible :

1. **École active (Contexte de travail)** :
   Chaque utilisateur a une école active dans sa session (`getActiveSchoolId(session)`). Toutes les actions et requêtes (tableaux de bord, listes d'élèves, notes) se font dans le contexte de cette école active.
   
2. **Écoles accessibles (Périmètre de droits)** :
   Un utilisateur (comme un enseignant) peut être rattaché à plusieurs écoles via la table `TeacherSchoolAssignment`. Lors de sa connexion, sa session charge la liste de ses écoles accessibles (`session.user.accessibleSchoolIds`). Il peut basculer d'une école à l'autre sans se reconnecter.
   
3. **SUPER_ADMIN** :
   Le rôle `SUPER_ADMIN` n'est rattaché à aucune école spécifique (`schoolId` null). Il a un accès global et peut consulter les données de toutes les écoles ou se "restreindre" à une école spécifique en la sélectionnant.

```typescript
// Exemple de vérification des droits
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

// 1. Quel est le contexte courant ?
const activeSchoolId = getActiveSchoolId(session);

// 2. Est-ce que l'utilisateur a le droit d'accéder à cette ressource ?
if (!canAccessSchool(session, resourceSchoolId)) {
  throw new Error("Accès refusé");
}

// 3. Filtrage des requêtes
const students = await prisma.studentProfile.findMany({
  where: {
    schoolId: activeSchoolId, // Isolation tenant
    enrollments: {
      some: { academicYearId: currentYear.id }
    }
  }
});
```

**Avantages** :
- Base de données partagée = coûts réduits
- Requêtes optimisées avec indexes sur `schoolId`
- Simplicité de maintenance

**Sécurité** :
- Middleware vérifie systématiquement `schoolId`
- Row Level Security au niveau applicatif
- Audit logs pour la traçabilité

---

## Structure du Projet

```
edupilot/
├── src/
│   ├── app/                    # Routes Next.js (App Router)
│   │   ├── (auth)/            # Routes d'authentification
│   │   ├── (dashboard)/       # Routes protégées
│   │   ├── api/               # API Routes
│   │   ├── layout.tsx         # Layout racine
│   │   └── page.tsx           # Page d'accueil
│   │
│   ├── components/            # Composants React réutilisables
│   │   ├── ui/               # Composants UI de base (Radix)
│   │   ├── dashboard/        # Composants dashboard
│   │   ├── landing/          # Page d'accueil publique
│   │   ├── charts/           # Graphiques
│   │   ├── performance/      # Composants de performance
│   │   └── ...
│   │
│   ├── lib/                   # Bibliothèques et utilitaires
│   │   ├── api/              # Helpers API
│   │   ├── auth/             # Configuration auth
│   │   ├── config/           # Configuration app
│   │   ├── security/         # Sécurité (RBAC, rate limit)
│   │   ├── services/         # Business logic
│   │   ├── utils/            # Utilitaires généraux
│   │   ├── cache.ts          # Système de cache
│   │   ├── redis-cache.ts    # Cache Redis optimisé
│   │   ├── performance.ts    # Monitoring performance
│   │   └── prisma.ts         # Client Prisma singleton
│   │
│   ├── types/                 # Types TypeScript globaux
│   ├── hooks/                 # React hooks personnalisés
│   ├── domain/                # Logique métier (Domain Driven)
│   ├── middleware.ts          # Middleware Next.js
│   └── instrumentation.ts     # Observabilité
│
├── prisma/
│   ├── schema.prisma          # Schéma de base de données
│   ├── migrations/            # Historique des migrations
│   ├── seed.ts               # Script de seed principal
│   └── seeds/                # Modules de seed
│
├── tests/
│   ├── lib/                  # Tests unitaires
│   ├── api/                  # Tests d'intégration API
│   └── setup.ts              # Configuration des tests
│
├── e2e/                      # Tests E2E Playwright
├── docs/                     # Documentation
├── scripts/                  # Scripts utilitaires
├── public/                   # Assets statiques
├── .github/workflows/        # CI/CD GitHub Actions
├── docker-compose.yml        # Configuration Docker
├── Dockerfile                # Image Docker
├── next.config.js            # Configuration Next.js
├── tailwind.config.ts        # Configuration Tailwind
└── tsconfig.json             # Configuration TypeScript
```

---

## Modèle de Données

### Entités principales

```mermaid
erDiagram
    School ||--o{ User : contains
    School ||--o{ AcademicYear : has
    User ||--o| TeacherProfile : has
    User ||--o| StudentProfile : has
    User ||--o| ParentProfile : has
    StudentProfile ||--o{ Enrollment : has
    Enrollment }o--|| Class : in
    Class }o--|| ClassLevel : has
    ClassSubject }o--|| Class : belongs
    ClassSubject }o--|| Subject : uses
    ClassSubject }o--|| TeacherProfile : taught-by
    Evaluation }o--|| ClassSubject : for
    Grade }o--|| Evaluation : in
    Grade }o--|| StudentProfile : for
```

### Hiérarchie des rôles (RBAC)

```
SUPER_ADMIN (Dieu du système)
    ↓
SCHOOL_ADMIN (Gestion école)
    ↓
DIRECTOR (Direction pédagogique)
    ↓
TEACHER (Enseignement)
    ↓
ACCOUNTANT (Finance)
    ↓
STUDENT (Élève)
    ↓
PARENT (Parent d'élève)
```

**Permissions** :
- Chaque rôle hérite des permissions des rôles inférieurs
- Permissions granulaires par endpoint (guards API)
- Vérification au niveau middleware ET au niveau handler

---

## Flux de Requêtes

### 1. Requête authentifiée typique

```
┌────────────┐
│   Client   │
└──────┬─────┘
       │ GET /api/students
       ▼
┌────────────────────┐
│   Middleware       │
│ - Auth check       │
│ - Role validation  │
│ - Rate limiting    │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│   API Handler      │
│ - Validation (Zod) │
│ - Business logic   │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│   Service Layer    │
│ - Data access      │
│ - Cache check      │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│  Prisma + Cache    │
│ - DB query         │
│ - Redis cache      │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐
│   PostgreSQL       │
└────────────────────┘
```

### 2. Optimisations appliquées

**Caching multi-niveau** :
1. **React Server Components** : Cache automatique côté serveur
2. **Redis** : Cache distribué pour les données fréquemment accédées
3. **In-memory** : Fallback pour le développement

**Lazy Loading** :
- Composants chargés à la demande
- Images avec `next/image` (optimisation automatique)
- Routes chargées dynamiquement

**Database Optimization** :
- Indexes stratégiques sur `schoolId`, `academicYearId`, etc.
- Requêtes Prisma optimisées avec `select` et `include`
- Batch operations pour les opérations massives

---

## Sécurité

### 1. Authentification
- NextAuth.js v5 avec stratégie Credentials
- Sessions sécurisées (JWT)
- Support 2FA (TOTP) avec chiffrement AES-256
- First login tokens avec expiration

### 2. Autorisation (RBAC)
```typescript
// Guard de protection d'endpoint
export async function requireRole(
  req: NextRequest,
  allowedRoles: UserRole[]
) {
  const session = await getSession(req);
  
  if (!session) {
    throw new UnauthorizedError();
  }
  
  if (!allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  
  return session;
}
```

### 3. Rate Limiting
- Upstash Redis pour le rate limiting distribué
- Limites différenciées par type d'endpoint
- Fallback in-memory pour le développement

### 4. Protection XSS/CSRF
- Content Security Policy (CSP) stricte
- Headers de sécurité (Helmet)
- Validation stricte des inputs (Zod)
- Sanitization des données utilisateur

### 5. RGPD
- Export de données utilisateur (portabilité)
- Droit à l'oubli (anonymisation avec maintien intégrité)
- Audit logs complets
- Politiques de rétention configurables

---

## Performance

### Métriques cibles

| Métrique | Objectif |
|----------|----------|
| Time to First Byte (TTFB) | < 200ms |
| First Contentful Paint (FCP) | < 1.8s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Time to Interactive (TTI) | < 3.8s |
| Cumulative Layout Shift (CLS) | < 0.1 |

### Stratégies d'optimisation

1. **Server-Side Rendering (SSR)** pour les pages critiques
2. **Static Generation** pour le contenu stable
3. **Image Optimization** avec `next/image`
4. **Code Splitting** automatique par route
5. **Bundle Analysis** régulier
6. **Compression** gzip/brotli

---

## Scalabilité

### Horizontale (Scale-out)

```
┌──────────────────┐
│  Load Balancer   │
└────────┬─────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│ App 1 │ │ App 2│ │ App 3│ │ App N│
└───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
    │        │        │        │
    └────────┴────────┴────────┘
             │
     ┌───────▼────────┐
     │   PostgreSQL   │
     │   (Primary)    │
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │   PostgreSQL   │
     │   (Replicas)   │
     └────────────────┘
```

**Capacité** :
- Chaque instance : ~500 utilisateurs simultanés
- 10 instances : ~5000 utilisateurs simultanés

### Verticale (Scale-up)

**Database** :
- CPU : 8 cores → 16 cores → 32 cores
- RAM : 16 GB → 32 GB → 64 GB
- Connexion pooling avec PgBouncer

---

## Observabilité

### Logs structurés

```typescript
logger.info('User logged in', {
  userId: user.id,
  schoolId: user.schoolId,
  ip: req.ip,
  userAgent: req.headers['user-agent']
});
```

### Métriques

```typescript
performanceMonitor.measure('database-query', async () => {
  return await prisma.student.findMany();
});

// Stats disponibles via API
const stats = performanceMonitor.getStats('database-query');
// { avg: 45ms, p50: 40ms, p95: 120ms, p99: 200ms }
```

### Alertes

Configurées pour détecter :
- Erreurs répétées (> 10/min)
- Latence élevée (p95 > 1s)
- Taux d'erreur API (> 1%)
- Connexions DB échouées

---

## Maintenance & Évolution

### Versioning
- Semantic Versioning (semver)
- Changelog maintenu
- Migrations documentées

### CI/CD
- Tests automatiques (unit + E2E)
- Linting & type checking
- Build & deployment automatisés
- Review apps pour les PR

### Documentation
- Documentation API (OpenAPI/Swagger)
- Documentation technique (ce fichier)
- Guides utilisateurs par rôle
- Changelog des versions

---

## Ressources

- **Repository**: https://github.com/votre-org/edupilot
- **Documentation**: https://docs.edupilot.bj
- **Statut**: https://status.edupilot.bj
- **Support**: support@edupilot.bj
