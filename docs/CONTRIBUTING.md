# 👥 Guide de Contribution - EduPilot

Merci de votre intérêt pour contribuer à EduPilot ! Ce guide vous aidera à démarrer.

---

## Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Configuration de développement](#configuration-de-développement)
- [Standards de code](#standards-de-code)
- [Process de Pull Request](#process-de-pull-request)
- [Conventions de commit](#conventions-de-commit)
- [Tests](#tests)
- [Documentation](#documentation)

---

## Code de conduite

En contribuant à EduPilot, vous acceptez de respecter notre code de conduite :

- ✅ Être respectueux et inclusif
- ✅ Accepter les critiques constructives
- ✅ Se concentrer sur ce qui est meilleur pour la communauté
- ❌ Utiliser un langage ou des images sexualisés
- ❌ Trolling, commentaires insultants ou attaques personnelles
- ❌ Harcèlement public ou privé

---

## Comment contribuer

### Rapporter un bug 🐛

1. **Vérifier** si le bug n'a pas déjà été rapporté dans les [Issues](https://github.com/votre-org/edupilot/issues)
2. **Créer une issue** avec le template "Bug Report"
3. **Inclure** :
   - Description claire du problème
   - Steps pour reproduire
   - Comportement attendu vs actuel
   - Screenshots si applicable
   - Environnement (OS, navigateur, version)

### Proposer une fonctionnalité 💡

1. **Créer une issue** avec le template "Feature Request"
2. **Décrire** :
   - Le problème que ça résout
   - La solution proposée
   - Les alternatives considérées
   - Impact sur les utilisateurs

### Contribuer du code 💻

1. **Fork** le repository
2. **Créer une branche** : `git checkout -b feature/ma-fonctionnalite`
3. **Coder** en suivant nos standards
4. **Tester** votre code
5. **Commit** avec des messages descriptifs
6. **Push** vers votre fork
7. **Créer une Pull Request**

---

## Configuration de développement

### Prérequis

- Node.js 20.x
- PostgreSQL 15+
- Git
- Un éditeur de code (VS Code recommandé)

### Installation

```bash
# 1. Fork et clone le repository
git clone https://github.com/votre-username/edupilot.git
cd edupilot

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Configurer la base de données
npx prisma generate
npx prisma db push
npm run db:seed

# 5. Démarrer le serveur de développement
npm run dev
```

### VS Code Extensions recommandées

- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense
- TypeScript Error Translator

### Configuration VS Code

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Standards de code

### TypeScript

- ✅ Utiliser TypeScript strict mode
- ✅ Typer explicitement les paramètres de fonction
- ✅ Éviter `any`, utiliser `unknown` si nécessaire
- ✅ Utiliser les types Prisma générés

```typescript
// ✅ Bon
async function getStudent(id: string): Promise<StudentProfile | null> {
  return await prisma.studentProfile.findUnique({
    where: { id }
  });
}

// ❌ Mauvais
async function getStudent(id: any) {
  return await prisma.studentProfile.findUnique({
    where: { id }
  });
}
```

### React Components

- ✅ Utiliser des composants fonctionnels
- ✅ Props typées avec TypeScript
- ✅ Extraire la logique complexe dans des hooks
- ✅ Composants réutilisables dans `/components`

```tsx
// ✅ Bon
interface StudentCardProps {
  student: StudentProfile;
  onSelect?: (id: string) => void;
}

export function StudentCard({ student, onSelect }: StudentCardProps) {
  return (
    <div data-testid="student-card">
      <h3>{student.user.firstName} {student.user.lastName}</h3>
      {onSelect && (
        <button onClick={() => onSelect(student.id)}>
          Sélectionner
        </button>
      )}
    </div>
  );
}
```

### Naming Conventions

```typescript
// Variables et fonctions : camelCase
const studentCount = 150;
function calculateAverage() { }

// Composants React : PascalCase
function StudentCard() { }

// Constantes : UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5242880;

// Types/Interfaces : PascalCase
interface UserProfile { }
type StudentGrade = number;

// Fichiers composants : PascalCase.tsx
// StudentCard.tsx

// Fichiers utilitaires : kebab-case.ts
// date-utils.ts, api-helpers.ts
```

### Imports

```typescript
// Ordre des imports
import { useState } from 'react';           // 1. Externe
import { Button } from '@/components/ui';   // 2. Components
import { prisma } from '@/lib/prisma';      // 3. Lib
import { StudentProfile } from '@/types';   // 4. Types
import './styles.css';                       // 5. Styles
```

### API Routes

```typescript
// Structure standard d'une route API
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/api/guards';

// Schema de validation
const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Vérifier authentification et permissions
    const session = await requireRole(req, ['SCHOOL_ADMIN', 'DIRECTOR']);
    
    // 2. Valider le body
    const body = await req.json();
    const data = createStudentSchema.parse(body);
    
    // 3. Business logic
    const student = await createStudent(data, session.user.schoolId);
    
    // 4. Retourner la réponse
    return NextResponse.json(student, { status: 201 });
    
  } catch (error) {
    // Gestion d'erreur standardisée
    return handleApiError(error);
  }
}
```

### Base de données (Prisma)

```typescript
// ✅ Utiliser select pour optimiser
const students = await prisma.studentProfile.findMany({
  select: {
    id: true,
    matricule: true,
    user: {
      select: {
        firstName: true,
        lastName: true,
      }
    }
  }
});

// ✅ Utiliser des transactions pour les opérations multiples
await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.studentProfile.create({ data: profileData }),
]);

// ✅ Gérer les erreurs Prisma
try {
  await prisma.user.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictError('Email already exists');
    }
  }
  throw error;
}
```

---

## Process de Pull Request

### Avant de soumettre

- [ ] Le code suit les standards de ce guide
- [ ] Les tests passent : `npm run test`
- [ ] Pas d'erreurs ESLint : `npm run lint`
- [ ] Type check OK : `npm run type-check`
- [ ] Les changements sont documentés
- [ ] Le code est testé manuellement

### Description de PR

Utiliser le template fourni et inclure :

```markdown
## Description
Brève description des changements

## Type de changement
- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Breaking change
- [ ] Documentation

## Tests effectués
Description des tests manuels et automatiques

## Screenshots (si applicable)
Ajouter des screenshots pour les changements UI

## Checklist
- [ ] Code suit les standards du projet
- [ ] Tests ajoutés/mis à jour
- [ ] Documentation mise à jour
- [ ] Aucun warning de build
```

### Review Process

1. **Automated checks** : CI/CD vérifie le code automatiquement
2. **Code review** : Au moins 1 review requis
3. **Changes requested** : Implémenter les modifications demandées
4. **Approval** : Merge par un maintainer

---

## Conventions de commit

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation uniquement
- `style`: Formatage, point-virgule manquant, etc.
- `refactor`: Refactoring de code
- `perf`: Amélioration de performance
- `test`: Ajout ou correction de tests
- `chore`: Maintenance, dépendances, config

### Exemples

```bash
# Feature
git commit -m "feat(students): add student import from CSV"

# Bug fix
git commit -m "fix(auth): resolve session expiration issue"

# Documentation
git commit -m "docs(api): update authentication endpoints"

# Refactoring
git commit -m "refactor(grades): simplify grade calculation logic"
```

---

## Tests

### Tests unitaires (Vitest)

```typescript
// tests/lib/grade-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateAverage } from '@/lib/services/grades';

describe('Grade Calculator', () => {
  it('should calculate simple average', () => {
    const grades = [
      { value: 15, coefficient: 1 },
      { value: 18, coefficient: 1 },
    ];
    
    const avg = calculateAverage(grades);
    expect(avg).toBe(16.5);
  });
  
  it('should handle weighted average', () => {
    const grades = [
      { value: 15, coefficient: 1 },
      { value: 18, coefficient: 2 },
    ];
    
    const avg = calculateAverage(grades);
    expect(avg).toBe(17); // (15*1 + 18*2) / 3
  });
});
```

### Tests E2E (Playwright)

```typescript
// e2e/student-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Student Management', () => {
  test('should create new student', async ({ page }) => {
    await page.goto('/dashboard/students');
    await page.click('[data-testid="create-student-btn"]');
    
    await page.fill('[data-testid="first-name-input"]', 'Jean');
    await page.fill('[data-testid="last-name-input"]', 'Dupont');
    await page.fill('[data-testid="email-input"]', 'jean@test.com');
    
    await page.click('[data-testid="submit-btn"]');
    
    await expect(page.locator('text=Élève créé avec succès')).toBeVisible();
  });
});
```

### Lancer les tests

```bash
# Tests unitaires
npm run test

# Tests unitaires en watch mode
npm run test:watch

# Tests avec coverage
npm run test:coverage

# Tests E2E
npm run test:e2e

# Tests E2E en UI mode
npm run test:e2e -- --ui
```

---

## Documentation

### Code Documentation

```typescript
/**
 * Calcule la moyenne pondérée des notes d'un élève
 * 
 * @param grades - Tableau des notes avec leurs coefficients
 * @param precision - Nombre de décimales (par défaut: 2)
 * @returns La moyenne pondérée arrondie
 * 
 * @example
 * const grades = [
 *   { value: 15, coefficient: 1 },
 *   { value: 18, coefficient: 2 }
 * ];
 * const avg = calculateAverage(grades); // 17.00
 */
export function calculateAverage(
  grades: Grade[],
  precision: number = 2
): number {
  // Implementation
}
```

### Mise à jour de la documentation

Lorsque vous ajoutez une fonctionnalité :

1. **README.md** : Si changement majeur
2. **docs/API.md** : Si nouveau endpoint
3. **docs/ARCHITECTURE.md** : Si changement architectural
4. **Code comments** : Pour la logique complexe

---

## Questions ?

- 💬 **Discord** : https://discord.gg/edupilot
- 📧 **Email** : dev@edupilot.bj
- 📖 **Docs** : https://docs.edupilot.bj

Merci de contribuer à EduPilot ! 🚀
