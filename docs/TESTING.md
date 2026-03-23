# 🧪 Guide de Tests - EduPilot

## Vue d'Ensemble

EduPilot dispose d'une suite complète de tests automatisés avec **240 tests** couvrant :
- ✅ Fonctionnalités critiques (import, auth, RBAC)
- ✅ Sécurité (rate limiting, permissions, RGPD)
- ✅ Performance (cache, optimisation)
- ✅ API et intégration

---

## 🚀 Lancer les Tests

### Tests Complets
```bash
# Tous les tests (240 tests)
yarn test

# Avec coverage
yarn test:coverage

# Mode watch (pendant développement)
yarn test:watch
```

### Tests Spécifiques
```bash
# Un seul fichier
yarn test tests/unit/core-features.test.ts

# Pattern
yarn test tests/lib/

# Tests d'import uniquement
yarn test import
```

---

## 📊 Résultats Attendus

```bash
Test Files  15 passed (15)
Tests       240 passed (240)
Duration    ~1.5s
```

### Répartition des Tests

| Catégorie | Nombre | Fichiers |
|-----------|--------|----------|
| **Import System** | 14 | `core-features.test.ts` |
| **API Integration** | 12 | `api.test.ts` |
| **RBAC & Permissions** | 22 | `rbac.permissions.test.ts` |
| **Security** | 34 | `api-guard.test.ts` |
| **Brute Force Protection** | 12 | `brute-force.test.ts` |
| **Account Lockout** | 13 | `account-lockout.test.ts` |
| **RGPD Compliance** | 14 | `rgpd.test.ts` |
| **Performance** | 16 | `performance.test.ts` |
| **AI Predictions** | 35 | `ai-predictive.test.ts` |
| **Curriculum** | 36 | `benin-curriculum-system.test.ts` |
| **Error Handling** | 7 | `api-error-response.test.ts` |
| **API Helpers** | 10 | `api-helpers.test.ts` |
| **Gamification** | 10 | `gamification.test.ts` |
| **Homework** | 4 | `homework.test.ts` |
| **Auth** | 1 | `auth.test.ts` |

---

## 🎯 Tests E2E (Testing Agent v3)

### Système d'Import Testé
Le testing agent automatisé a validé le système d'import complet :

✅ **Backend (100% succès)**
- Import étudiants : CSV parsing, validation, mapping gender, insertion DB
- Import professeurs : CSV parsing, validation, insertion DB
- Import parents : CSV parsing, validation, liaison enfants

✅ **Frontend (80% succès)**
- Wizard UI : Sélection type, upload, mapping colonnes, validation
- Performance : ~4.3s par requête (rate limiting intentionnel)

### Données de Test Créées
```bash
# Vérifier les données créées par les tests
psql $DATABASE_URL -c "
  SELECT role, COUNT(*) 
  FROM users 
  WHERE email LIKE '%test%' 
  GROUP BY role;
"

# Résultat attendu :
# STUDENT  | 2
# TEACHER  | 2
# PARENT   | 2
```

### Rapport de Test
```bash
# Consulter le dernier rapport
cat /app/test_reports/iteration_1.json | jq '.'
```

---

## 🐛 Tests de Régression

Avant chaque release majeure, exécuter :

### 1. Tests Unitaires
```bash
yarn test
```

### 2. Tests E2E Manuels
```bash
# Se connecter
open http://localhost:3000/login
# Credentials : admin@edupilot.com / admin123

# Tester flows critiques :
1. Login/Logout
2. Import CSV (students, teachers, parents)
3. Navigation dashboard
4. CRUD opérations (ajouter/modifier/supprimer élève)
```

### 3. Tests API
```bash
# Tester endpoints critiques
API_URL="http://localhost:3000"

# Health check
curl $API_URL/api/health

# Import students (requiert auth, tester via UI)
# Finance stats
# etc.
```

---

## 📝 Écrire Nouveaux Tests

### Structure de Test Vitest

```typescript
// tests/mon-feature.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('Ma Fonctionnalité', () => {
  beforeEach(() => {
    // Setup avant chaque test
  })

  it('should faire quelque chose', () => {
    const result = maFonction('input')
    expect(result).toBe('expected')
  })

  it('should gérer les erreurs', () => {
    expect(() => maFonction(null)).toThrow()
  })
})
```

### Tests API Routes

```typescript
// tests/api/mon-endpoint.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('GET /api/mon-endpoint', () => {
  it('should return data', async () => {
    // Mock prisma
    const mockData = [{ id: '1', name: 'Test' }]
    vi.spyOn(prisma.myModel, 'findMany').mockResolvedValue(mockData)

    // Test
    const response = await fetch('/api/mon-endpoint')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toEqual(mockData)
  })
})
```

---

## 🎨 Coverage

### Générer Rapport de Coverage
```bash
yarn test:coverage
```

### Visualiser Coverage
```bash
# Ouvrir dans navigateur
open coverage/index.html
```

### Objectifs Coverage
- **Statements** : > 70%
- **Branches** : > 60%
- **Functions** : > 70%
- **Lines** : > 70%

---

## 🔧 Configuration Tests

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## 🚨 Tests Critiques (Ne Doivent JAMAIS Échouer)

### 1. Import System
```bash
yarn test core-features
# 14 tests doivent passer
```

### 2. RBAC & Permissions
```bash
yarn test rbac
# 22 tests doivent passer
```

### 3. Security
```bash
yarn test api-guard brute-force account-lockout
# 59 tests doivent passer
```

---

## 📊 Monitoring Tests en CI/CD

### GitHub Actions
Les tests s'exécutent automatiquement sur :
- ✅ Chaque push sur `main`
- ✅ Chaque pull request
- ✅ Before deploy

### Voir résultats
```bash
# Localement
yarn test

# CI/CD
# Voir .github/workflows/ci-cd.yml
# Les tests doivent passer avant merge/deploy
```

---

## 🐞 Debugging Tests qui Échouent

### 1. Mode Verbose
```bash
yarn test --reporter=verbose
```

### 2. Isoler Test Qui Échoue
```bash
# Utiliser .only
it.only('test qui échoue', () => {
  // ...
})
```

### 3. Console Logs
```bash
# Ajouter console.log dans le test
it('test', () => {
  console.log('Debug:', variable)
  expect(variable).toBe(expected)
})
```

### 4. Vérifier Mocks
```bash
# S'assurer que les mocks sont corrects
vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser)
```

---

## ✅ Checklist Tests Avant Deploy

- [ ] `yarn test` : 240 tests passent
- [ ] `yarn test:coverage` : > 70% coverage
- [ ] Tests E2E manuels passent
- [ ] Pas de console errors dans tests
- [ ] Pas de warnings TypeScript
- [ ] Tests API endpoints critiques OK

---

## 📚 Ressources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright E2E](https://playwright.dev/)

---

**Dernière mise à jour** : 23 Mars 2025  
**Tests Version** : 1.1.0 (240 tests)
