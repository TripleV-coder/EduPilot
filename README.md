# EduPilot - Plateforme de Gestion Scolaire

> Plateforme complète de gestion scolaire multi-tenant avec authentification sécurisée, gestion des utilisateurs, notes, emploi du temps, et analytiques IA.

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Tests-62%20passing-FCC72B)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Demarrage Rapide

### Linux / macOS
```bash
./run.sh dev
```

### Windows
```powershell
.\run.ps1 dev
```

L'application demarre sur [http://localhost:3000](http://localhost:3000)

---

## Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (optionnel, pour rate limiting)

### Installation Complete

```bash
# Cloner le projet
git clone <url-du-repo>
cd edupilot

# Installer les dependances
npm install

# Configurer l'environnement
cp .env.example .env
# Editer .env avec vos configurations

# Initialiser la base de donnees
npm run setup

# (Optionnel) Semer les donnees de reference
npm run db:seed:reference

# Demarrer en developpement
npm run dev
```

### Premier Utilisateur (Super Admin)

Au premier lancement, accedez a `/initial-setup` pour creer le compte Super Administrateur.

---

## Fonctionnalites Principales

### Securite Avancee
- **Rate Limiting** : Limitation par route (5 login/15min, 100 API/min, 20 sensibles/min)
- **Sanitisation XSS** : Protection DOMPurify sur toutes les entrees API
- **Logging Structure** : Logs JSON en prod, pretty en dev
- **Validation Zod** : Schemas de validation sur toutes les entrees
- **Multi-tenant** : Isolation stricte par etablissement

### Authentification & Autorisation
- **NextAuth v5** avec JWT
- **7 roles hierarchiques** : SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT, ACCOUNTANT
- **133 permissions granulaires** avec systeme RBAC
- **Hash bcrypt** (12 rounds)
- **Verrouillage de compte** apres 5 echecs

### Gestion Academique
- **Classes & Niveaux** - Organisation hierarchique
- **Matieres & Enseignants** - Affectation flexible
- **Emploi du temps** - Detection automatique de conflits
- **Evaluations & Notes** - Notation ponderee, moyennes automatiques
- **Presences/Absences** - Suivi en temps reel
- **Bulletins PDF** - Generation automatique

### Interface Moderne
- **Design responsive** - Mobile, tablet, desktop, 4K
- **Dark mode** natif
- **Charts interactifs** avec Recharts
- **Pagination avancee** avec filtres multiples
- **Optimistic UI** pour une experience fluide

### Fonctionnalites Enterprise
- **IA Predictive** - Detection eleves a risque
- **Analytics Avancees** - Tableaux de bord personnalises
- **Gestion Financiere** - Frais, paiements, echeanciers
- **LMS Integre** - Plateforme d'apprentissage
- **Orientation** - Recommandations IA
- **Messagerie** - Communication securisee
- **Certificats PDF** - Generation automatique

### Temps Reel
- **Socket.IO** integre pour notifications instantanees
- **Synchronisation** multi-device

---

## Stack Technique

### Frontend
- **Framework** : Next.js 14 (App Router)
- **UI** : React 18, TypeScript 5, Tailwind CSS 3
- **Components** : shadcn/ui (Radix UI)
- **Forms** : React Hook Form + Zod
- **Charts** : Recharts

### Backend
- **API** : Next.js API Routes (104+ endpoints)
- **Database** : PostgreSQL avec Prisma ORM
- **Auth** : NextAuth v5 (JWT)
- **Real-time** : Socket.IO 4
- **Validation** : Zod schemas

### Securite & Performance
- **RBAC** : 7 roles, 133 permissions
- **Rate Limiting** : Upstash Redis
- **Caching** : Redis (optionnel)
- **Sanitization** : DOMPurify
- **Email** : SendGrid avec templates HTML

---

## Commandes NPM

```bash
# Developpement
npm run dev              # Serveur Next.js + Socket.IO

# Production
npm run build            # Build pour production
npm run start            # Serveur production
npm run start:pm2        # Demarrage avec PM2

# Base de donnees
npm run db:generate      # Generer Prisma Client
npm run db:push          # Pousser schema vers DB
npm run db:migrate       # Creer une migration
npm run db:seed          # Peupler avec donnees de reference
npm run db:studio        # Ouvrir Prisma Studio

# Qualite
npm run lint             # ESLint
npm run lint:fix         # Fix automatique
npm run type-check       # Verification TypeScript
npm run test             # Tests (Vitest)
npm run test:watch       # Tests en mode watch
npm run test:coverage    # Couverture de tests

# Setup complet
npm run setup:full       # Install + Generate + Push + Seed
```

---

## Systeme de Roles

### Hierarchie

```
SUPER_ADMIN (Acces global)
  └─ SCHOOL_ADMIN (Etablissement)
      ├─ DIRECTOR (Pedagogie)
      │   └─ TEACHER (Classe/Matiere)
      │       └─ STUDENT (Eleve)
      └─ ACCOUNTANT (Finances)
      └─ PARENT (Enfants)
```

### Attribution des Roles

| Role | Cree par | Methode |
|------|----------|---------|
| **SUPER_ADMIN** | Premier utilisateur | Page `/initial-setup` |
| **SCHOOL_ADMIN** | SUPER_ADMIN | Interface admin |
| **DIRECTOR** | SCHOOL_ADMIN | Interface ecole |
| **TEACHER** | SCHOOL_ADMIN/DIRECTOR | Interface ecole |
| **STUDENT** | SCHOOL_ADMIN/DIRECTOR | Interface ecole |
| **PARENT** | Auto-cree avec eleve | Ou invitation |
| **ACCOUNTANT** | SCHOOL_ADMIN | Interface ecole |

---

## Structure du Projet

```
edupilot/
├── prisma/
│   ├── schema.prisma           # Schema de base de donnees (29 models)
│   ├── migrations/             # Migrations versionnees
│   └── seed-reference-data.ts  # Donnees de reference
│
├── src/
│   ├── app/
│   │   ├── (auth)/             # Pages auth (login, register)
│   │   ├── (dashboard)/        # Pages dashboard par role
│   │   └── api/                # 104+ API routes
│   │
│   ├── components/
│   │   ├── ui/                 # Composants shadcn/ui
│   │   ├── dashboard/          # Composants dashboard
│   │   ├── charts/             # Charts Recharts
│   │   └── ...                 # 80+ composants
│   │
│   ├── hooks/                  # Hooks React
│   │   ├── use-optimistic.ts   # Optimistic updates
│   │   └── use-socket.ts       # WebSocket
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── api-helpers.ts      # Helpers API (validation, pagination)
│   │   │   ├── middleware-rate-limit.ts  # Rate limiting
│   │   │   └── error-responses.ts  # Reponses d'erreur standard
│   │   ├── auth/               # Authentification & RBAC
│   │   ├── rbac/               # Permissions & guards
│   │   ├── sanitize/           # Sanitisation XSS
│   │   ├── services/           # Services metier
│   │   └── utils/
│   │       ├── logger.ts       # Logging structure
│   │       ├── format.ts       # Utilitaires format
│   │       └── grades.ts       # Calcul notes
│   │
│   └── types/                  # Types TypeScript
│
├── tests/                      # Tests unitaires
├── server.js                   # Serveur Socket.IO + Next.js
└── ecosystem.config.js         # Configuration PM2
```

---

## API REST

### Authentification

```typescript
POST /api/auth/login        // Connexion
POST /api/auth/register     // Inscription
POST /api/auth/logout       // Deconnexion
GET  /api/auth/session      // Session actuelle
POST /api/auth/reset-password
POST /api/auth/forgot-password
```

### Ressources Principales

```typescript
// Utilisateurs
GET    /api/users           // Liste pageable
POST   /api/users           // Creer utilisateur
GET    /api/users/:id       // Details utilisateur
PATCH  /api/users/:id       // Modifier utilisateur
DELETE /api/users/:id       // Supprimer utilisateur

// Etudiants
GET    /api/students
POST   /api/students
GET    /api/students/:id
PATCH  /api/students/:id

// Enseignants
GET    /api/teachers
POST   /api/teachers
GET    /api/teachers/:id
PATCH  /api/teachers/:id

// Cours
GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
PATCH  /api/courses/:id
DELETE /api/courses/:id

// Notes
GET    /api/grades
POST   /api/grades
GET    /api/grades/:id
PATCH  /api/grades/:id
DELETE /api/grades/:id

// Evaluations
GET    /api/evaluations
POST   /api/evaluations
GET    /api/evaluations/:id
PATCH  /api/evaluations/:id
DELETE /api/evaluations/:id

// Calendrier
GET    /api/schedule
POST   /api/schedule
GET    /api/schedule/:id
PATCH  /api/schedule/:id
DELETE /api/schedule/:id

// Presences
GET    /api/attendance
POST   /api/attendance
PATCH  /api/attendance/:id

// Paiements
GET    /api/payments
POST   /api/payments
GET    /api/payments/:id
PATCH  /api/payments/:id

// Notifications
GET    /api/notifications
POST   /api/notifications
PATCH  /api/notifications/:id
DELETE /api/notifications/:id
```

### Format de Reponse

```typescript
// Succes
{
  "success": true,
  "data": { ... }
}

// Page
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 100,
  "totalPages": 5
}

// Erreur
{
  "error": "Message d'erreur",
  "code": "ERROR_CODE"
}
```

### En-Tetes Standard

```http
Authorization: Bearer <token>
Content-Type: application/json
```

---

## Securite

### Mesures Implementees

1. **Rate Limiting**
   - 5 tentatives/login par 15 min
   - 100 requetes API/min
   - 20 requetes sensibles/min

2. **Validation des Entrees**
   - Zod pour la validation des schemas
   - DOMPurify pour la sanitisation XSS
   - SQL injection prevenue par Prisma

3. **Authentification**
   - JWT avec rotation de tokens
   - Hash bcrypt (12 rounds)
   - Verrouillage apres 5 echecs

4. **Protection API**
   - CORS configure
   - Headers de securite (CSP, XSS)
   - Multi-tenant isolation

5. **Logging**
   - Logs structures JSON en prod
   - Niveau DEBUG en dev
   - Audit trail pour actions sensibles

---

## Tests

```bash
# Executer tous les tests
npm run test

# Tests avec couverture
npm run test:coverage

# Tests en mode watch
npm run test:watch
```

### Structure des Tests

```
tests/
├── lib/
│   ├── utils/
│   │   └── api-helpers.test.ts      // 17 tests
│   └── validations/
│       └── auth.test.ts             // 15 tests
src/
├── lib/
│   └── __tests__/
│       └── sanitize.test.ts         // 21 tests
└── hooks/
    └── __tests__/
        └── use-optimistic.test.ts   // 9 tests
```

### Couverture Actuelle

- **62 tests** passent
- Sanitisation, validations, hooks, API helpers

---

## Variables d'Environnement

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/edupilot"

# Auth
AUTH_SECRET="votre-secret-min-32-caracteres"
AUTH_URL="http://localhost:3000"

# Email (SendGrid)
SENDGRID_API_KEY="votre-cle-sendgrid"
EMAIL_FROM="noreply@edupilot.fr"

# Redis (Upstash pour rate limiting)
UPSTASH_REDIS_REST_URL="https://votre-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="votre-token"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## Deploiement

### Production avec PM2

```bash
# Build
npm run build

# Demarrer avec PM2
npm run start:pm2

# Voir les logs
npm run logs:pm2

# Monitor
npm run monitor:pm2
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Metriques du Projet

| Metrique | Valeur |
|----------|--------|
| **API Routes** | 104+ |
| **Permissions RBAC** | 133 |
| **Modules Fonctionnels** | 29 |
| **Composants React** | 80+ |
| **Tests Unitaires** | 62 |
| **Roles Utilisateurs** | 7 |
| **Models Prisma** | 29 |

---

## Licence

MIT © 2025 EduPilot

---

**Fait avec passion pour l'education**
