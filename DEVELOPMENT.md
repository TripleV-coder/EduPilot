# EduPilot - Guide de Développement

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 20+ (idéalement 22+)
- PostgreSQL 15+
- Yarn (pas npm)

### Installation

```bash
# 1. Cloner et installer les dépendances
yarn install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 3. Initialiser la base de données
npx prisma db push
npx prisma generate

# 4. (Optionnel) Créer des données de test
npx tsx scripts/create-test-data.ts

# 5. Démarrer le serveur de développement
yarn dev
```

L'application sera accessible sur http://localhost:3000

### Credentials de Test
- Super Admin: `admin@edupilot.com` / `admin123`
- School Admin: `schooladmin@edupilot.com` / `school123`

---

## 📁 Structure du Projet

```
/app
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # Pages dashboard (layout groupé)
│   │   ├── api/                # API Routes ⚠️ Toutes préfixées /api
│   │   │   ├── import/         # Système d'import (students, teachers, parents)
│   │   │   ├── finance/        # Module financier
│   │   │   ├── auth/           # NextAuth endpoints
│   │   │   └── ...
│   │   └── page.tsx            # Page d'accueil
│   ├── components/             # Composants React
│   │   └── ui/                 # Composants shadcn/ui
│   ├── lib/                    # Logique métier & utilitaires
│   │   ├── auth.ts             # Configuration NextAuth
│   │   ├── prisma.ts           # Client Prisma
│   │   ├── cache/              # Système de cache Redis
│   │   ├── rbac/               # Permissions & RBAC
│   │   └── import/             # Logique d'import
│   └── proxy.ts                # Middleware Next.js (auth + rate limiting)
├── prisma/
│   └── schema.prisma           # Schéma DB (60+ modèles)
├── docs/                       # Documentation technique
├── scripts/                    # Scripts utilitaires
│   ├── backup/                 # Scripts de sauvegarde DB
│   └── create-test-data.ts     # Création de données de test
└── test_reports/               # Rapports de tests automatisés
```

---

## 🛠️ Scripts Disponibles

```bash
# Développement
yarn dev              # Démarre Next.js en mode dev (port 3000)
yarn build            # Build de production
yarn start            # Démarre le serveur de production

# Base de données
npx prisma studio     # Interface graphique pour la DB
npx prisma db push    # Synchronise le schéma sans migration
npx prisma migrate dev # Crée une nouvelle migration
npx prisma generate   # Regénère le client Prisma

# Tests
yarn test             # Lance les tests Jest
yarn test:e2e         # Tests E2E avec Playwright
yarn lint             # Lint TypeScript/ESLint
yarn type-check       # Vérification TypeScript

# Utilitaires
npx tsx scripts/create-test-data.ts  # Crée les données de test
```

---

## 🔧 Configuration

### Variables d'Environnement Requises

```env
# Base de données
DATABASE_URL="postgresql://user:pass@localhost:5432/edupilot"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[générer avec: openssl rand -base64 32]"

# Application
NEXT_PUBLIC_APP_NAME="EduPilot"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Variables d'Environnement Optionnelles

```env
# 2FA (Optionnel)
TOTP_ENCRYPTION_KEY="[générer avec: openssl rand -hex 32]"

# Email (Pour reset password, notifications)
EMAIL_PROVIDER="resend"  # ou "sendgrid"
EMAIL_API_KEY="re_xxx"
EMAIL_FROM="noreply@edupilot.com"

# Redis/Rate Limiting Distribué (Optionnel, fallback in-memory par défaut)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

---

## 🧪 Tests

### Tests Automatisés
Le projet utilise un agent de test automatisé pour les tests E2E. Les rapports sont dans `/app/test_reports/`.

### Tests Manuels
```bash
# Test d'un endpoint API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edupilot.com","password":"admin123"}'

# Test import CSV
# 1. Se connecter sur http://localhost:3000/login
# 2. Aller sur /dashboard/import
# 3. Uploader un fichier CSV de test
```

---

## 📊 Architecture Technique

### Stack
- **Framework**: Next.js 16 (App Router + Turbopack)
- **Langage**: TypeScript 5
- **Base de données**: PostgreSQL 15 + Prisma ORM
- **Authentification**: NextAuth.js v5
- **UI**: React 18 + Tailwind CSS + shadcn/ui
- **Cache**: Redis (Upstash) avec fallback in-memory
- **Rate Limiting**: Upstash avec fallback in-memory

### Concepts Clés

#### 1. Multi-Tenancy
Chaque école (`School`) est isolée. Les utilisateurs ont un `schoolId` et ne peuvent accéder qu'aux données de leur école.

#### 2. RBAC (8 Rôles)
- `SUPER_ADMIN` : Accès total plateforme
- `SCHOOL_ADMIN` : Administration école
- `DIRECTOR` : Directeur établissement
- `TEACHER` : Enseignant
- `STUDENT` : Élève
- `PARENT` : Parent/Tuteur
- `ACCOUNTANT` : Comptable
- `LIBRARIAN` : Bibliothécaire

#### 3. Système d'Import
API routes dans `/app/src/app/api/import/` :
- `/api/import/students` : Import élèves (CSV/Excel)
- `/api/import/teachers` : Import professeurs
- `/api/import/parents` : Import parents

Interface wizard complète avec :
- Sélection type de données
- Upload fichier
- Mapping colonnes automatique
- Validation avant import
- Gestion d'erreurs par ligne

#### 4. Cache
Système de cache distribué avec Redis Upstash et fallback in-memory pour développement.

Utilisé dans :
- `/api/finance/stats` : Statistiques financières
- `/api/students` : Listes élèves
- Etc.

#### 5. Rate Limiting
Configuration adaptive selon environnement :
- **Production** : Strict (100 req/min API, 20 req/min opérations sensibles)
- **Développement** : Assoupli (500 req/min API, 100 req/min opérations sensibles)

---

## 🐛 Debugging

### Logs
```bash
# Frontend (Next.js)
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log

# Base de données
psql edupilot -c "SELECT * FROM users LIMIT 5;"
```

### Problèmes Courants

#### 1. "Prisma Client did not initialize yet"
```bash
npx prisma generate
```

#### 2. "DATABASE_URL not found"
Vérifier que `.env` existe et contient `DATABASE_URL`.

#### 3. Rate limiting trop strict en dev
Le rate limiting est maintenant automatiquement assoupli en développement (x5).

#### 4. Import échoue avec erreur gender
✅ **CORRIGÉ** : Le mapping M/F → MALE/FEMALE est maintenant géré automatiquement.

---

## 🚀 Déploiement

### 1. Avec Emergent (Natif)
L'application est déjà configurée pour Emergent. Utilisez la fonctionnalité de déploiement natif.

### 2. Avec Docker
```bash
docker build -t edupilot .
docker run -p 3000:3000 edupilot
```

### 3. Avec Vercel
```bash
vercel deploy
```

### Variables d'Environnement Production
Assurez-vous de configurer :
- `DATABASE_URL` (PostgreSQL)
- `NEXTAUTH_SECRET` (secret fort)
- `NEXTAUTH_URL` (URL publique)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (pour cache distribué)

---

## 📚 Documentation Additionnelle

- `/docs/API.md` : Documentation API complète
- `/docs/ARCHITECTURE.md` : Architecture système détaillée
- `/docs/DEPLOYMENT.md` : Guide de déploiement
- `/docs/CONTRIBUTING.md` : Guide de contribution

---

## 🤝 Contribution

1. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
2. Commit : `git commit -m "feat: ajoute fonctionnalité X"`
3. Push : `git push origin feature/ma-fonctionnalite`
4. Créer une Pull Request

### Conventions
- **Commits** : Convention Conventional Commits (feat, fix, docs, etc.)
- **Code** : Linter ESLint configuré
- **Tests** : Tester avant de commit

---

## 📞 Support

En cas de problème :
1. Vérifier les logs (`/var/log/supervisor/`)
2. Consulter la documentation (`/docs/`)
3. Tester avec les credentials de test

---

## ✅ Checklist Développement

Avant de déployer en production :

- [ ] Variables d'environnement configurées
- [ ] `DATABASE_URL` pointe vers PostgreSQL de production
- [ ] `NEXTAUTH_SECRET` est un secret fort unique
- [ ] Rate limiting Redis configuré (`UPSTASH_*`)
- [ ] Tests passent (`yarn test`)
- [ ] Build de production réussi (`yarn build`)
- [ ] Migrations DB appliquées (`npx prisma migrate deploy`)
- [ ] Données de test supprimées

---

**Version**: 1.0.0  
**Dernière mise à jour**: Mars 2025
