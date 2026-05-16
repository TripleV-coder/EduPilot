# Tests — EduPilot

Guide complet de la stratégie de tests, des outils, et des bonnes pratiques.

> **État actuel** (2026-05-16) : 46 fichiers de tests, **539 tests** unit/integration verts + 6 specs E2E Playwright.

---

## 1. Pyramide de tests

```
              ╱╲          E2E (Playwright)  — 6 specs
             ╱──╲         Parcours critiques, multi-pages
            ╱────╲
           ╱──────╲       Integration (Vitest + Prisma mock)
          ╱────────╲      ~15 fichiers — API helpers, services
         ╱──────────╲
        ╱────────────╲    Unit (Vitest)
       ╱──────────────╲   ~30 fichiers — validations, utils, calculs
      ╱────────────────╲
```

| Niveau | Outil | Volume | Vitesse | Coverage cible |
|--------|-------|--------|---------|----------------|
| Unit | Vitest | 80 % des tests | < 2 ms / test | ≥ 80 % du code lib/ |
| Integration | Vitest + mocks | 15 % | 10–50 ms / test | endpoints critiques |
| E2E | Playwright | 5 % | 5–30 s / scénario | 5 parcours métier majeurs |

---

## 2. Commandes essentielles

```bash
# Tests unitaires + intégration
npm run test                # un run unique
npm run test:watch          # mode TDD
npm run test:coverage       # avec rapport coverage (HTML + lcov)

# Tests E2E
npm run test:e2e            # tous les tests Playwright
npx playwright test e2e/auth-flow.spec.ts        # un seul fichier
npx playwright test --debug                       # mode debug interactif
npx playwright show-report                        # voir le dernier rapport

# Lint + type-check
npm run lint
npm run type-check
```

---

## 3. Conventions de tests

### 3.1 Structure du dossier
```
tests/
├── setup.ts                       # mocks globaux (Prisma, NextAuth, next/server)
├── unit/                          # tests purs sans DB
│   ├── core-features.test.ts
│   └── lib/
│       ├── analytics/helpers.test.ts
│       └── finance/helpers.test.ts
├── integration/
│   └── api.test.ts                # tests d'intégration API
├── lib/                           # tests unitaires lib/
│   ├── api-helpers.test.ts
│   ├── auth-crypto.test.ts
│   ├── validations-*.test.ts
│   ├── utils-*.test.ts
│   └── rbac-*.test.ts
└── api/                           # tests d'endpoint API
    ├── auth.test.ts
    └── homework.test.ts
```

### 3.2 Nommage des fichiers
- `<module>-<feature>.test.ts` (ex: `validations-finance.test.ts`)
- 1 fichier = 1 module testé. Pas de "tests fourre-tout".
- Un test E2E par scénario utilisateur dans `e2e/<feature>.spec.ts`

### 3.3 Structure d'un test
```ts
import { describe, it, expect } from "vitest";
import { feeSchema } from "@/lib/validations/finance";

describe("validations/finance", () => {
  describe("feeSchema", () => {
    it("accepts a valid fee", () => {
      const r = feeSchema.safeParse({ name: "Inscription", amount: 50000 });
      expect(r.success).toBe(true);
    });

    it("rejects negative amount", () => {
      expect(feeSchema.safeParse({ name: "X", amount: -1 }).success).toBe(false);
    });
  });
});
```

### 3.4 Règles d'or
- **AAA** : Arrange / Act / Assert. Pas de logique métier dans les tests.
- **1 test = 1 comportement**. Si un test contient 5 `expect()` indépendants, le découper.
- **Pas de tests pour les setters/getters triviaux** (vide ratio signal/bruit).
- **Tests déterministes** : pas de `Date.now()`, pas de `Math.random()` sans mock. Utiliser `vi.useFakeTimers()` si besoin.
- **Pas de logique conditionnelle dans le test** (`if`, `for` étranges). Utiliser `it.each` à la place.

---

## 4. Mocking

### 4.1 Mocks globaux (`tests/setup.ts`)
- **Prisma** : `vi.mock("@prisma/client", ...)` retourne un client avec toutes les méthodes mockées (`vi.fn()`)
- **NextAuth** : `auth()` retourne `null` par défaut, à override par test
- **next/server** : `NextResponse.json/redirect/next` mockés en objets simples

### 4.2 Mocker la session dans un test
```ts
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({
    user: {
      id: "u1",
      role: "TEACHER",
      schoolId: "school-1",
      isTwoFactorEnabled: false,
      isTwoFactorAuthenticated: true,
    },
  } as any);
});
```

### 4.3 Mocker Prisma localement
```ts
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mocked(prisma.user.findUnique).mockResolvedValue({
  id: "u1",
  email: "a@b.com",
  // ... reste des champs requis
} as any);
```

---

## 5. Coverage

### 5.1 Configuration (`vitest.config.ts`)
- Provider : **V8** (rapide, natif Node 20+)
- Inclus : `src/lib/**/*.ts`
- Exclus : `src/lib/types/**`, `*.d.ts`, `swagger.ts`
- Seuils :
  - Statements : 60 % (cible : 80 %)
  - Branches : 50 % (cible : 70 %)
  - Functions : 60 % (cible : 80 %)

### 5.2 Lire le rapport
Après `npm run test:coverage` :
- HTML : `coverage/index.html` (ouvrir dans un navigateur)
- LCOV : `coverage/lcov.info` (uploadé vers Codecov en CI)
- Texte : affiché dans la console

### 5.3 Quels modules cibler en priorité ?
1. `src/lib/auth/**` — sécurité critique
2. `src/lib/rbac/**` — sécurité critique
3. `src/lib/validations/**` — défense en profondeur sur l'entrée
4. `src/lib/finance/**` — argent
5. `src/lib/api/api-helpers.ts` — utilisé par toutes les routes

---

## 6. E2E (Playwright)

### 6.1 Specs en place (`e2e/`)
| Fichier | Couverture |
|---------|-----------|
| `auth-flow.spec.ts` | Login → dashboard → logout |
| `auth.setup.ts` | Bootstrap session pour réutilisation |
| `dashboard.spec.ts` | Navigation, RBAC visuel |
| `public-routes.spec.ts` | Pages publiques (/, /privacy, /terms) |
| `security-anonymous.spec.ts` | Anonyme ne peut pas accéder aux pages protégées |
| `security-rbac.spec.ts` | Un STUDENT ne voit pas la route Finance |
| `security-tenant.spec.ts` | École A ne peut pas lire l'école B |

### 6.2 Configuration
- `playwright.config.ts` : Chromium uniquement en CI (rapide), tous browsers en local
- Base URL : `http://localhost:3000` (lancée par `webServer` du config)
- Storage state : `e2e/.auth/<role>.json` pour réutiliser les sessions

### 6.3 Ajouter un test E2E
```ts
// e2e/grades.spec.ts
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/teacher.json" });

test("a teacher can add a grade", async ({ page }) => {
  await page.goto("/dashboard/grades");
  await page.getByRole("button", { name: "Nouvelle note" }).click();
  await page.getByLabel("Valeur").fill("15");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Note enregistrée")).toBeVisible();
});
```

### 6.4 A11y dans Playwright
Pour ajouter axe-core à un test :
```ts
import AxeBuilder from "@axe-core/playwright";

test("dashboard a11y", async ({ page }) => {
  await page.goto("/dashboard");
  const a = await new AxeBuilder({ page }).analyze();
  expect(a.violations).toEqual([]);
});
```
Lib à installer : `@axe-core/playwright` (cf. ADR à venir).

---

## 7. Tests de sécurité

### 7.1 Tenant isolation
`e2e/security-tenant.spec.ts` doit valider :
- Un user de l'école A se voit en 403 sur `/api/students?schoolId=B`
- Un user de l'école A ne voit aucune donnée de l'école B dans aucune page

### 7.2 RBAC
`tests/lib/rbac.permissions.test.ts` valide la matrice :
- `STUDENT` n'a aucune permission `grade:create`
- `TEACHER` ne peut pas créer un autre `TEACHER`

### 7.3 Brute force
`tests/lib/brute-force.test.ts` (existant) + `tests/lib/auth-rate-limiter.test.ts` (nouveau) :
- Après 5 logins KO, le compte est lock 30 min
- Le rate-limiter empêche > 5 tentatives / 15 min / IP

### 7.4 RGPD
`tests/lib/rgpd.test.ts` (existant) :
- Export inclut toutes les données du user
- Suppression purge ou anonymise correctement

---

## 8. Performance

À implémenter en V2 :
- Tests **k6** pour charger les endpoints critiques (target : p95 < 500 ms à 50 RPS)
- **Lighthouse CI** sur les 5 pages publiques + dashboard (déjà en place via `lighthouse-ci.yml`)

---

## 9. CI

Voir `.github/workflows/ci.yml`. Le pipeline exécute :
- `lint` (matrix Node 20 + 22)
- `unit-tests` (avec coverage upload vers Codecov)
- `build` (Next.js production build)
- `e2e` (Playwright Chromium)
- `codeql`, `dependency-audit`, `trivy`, `sbom`
- `quality-gate` : fail si l'un des précédents échoue

PR sont **bloquées** tant que `Quality Gate` n'est pas vert.

---

## 10. Diagnostic des tests qui échouent

### 10.1 Un test cassé en CI mais passe en local
- Vérifier que les variables d'env de CI matchent : `DATABASE_URL`, `NEXTAUTH_SECRET`, `TOTP_ENCRYPTION_KEY`
- Vérifier que `prisma generate` a tourné (CI le fait automatiquement, dev local non)
- Vérifier le timezone (CI = UTC, local = Africa/Porto-Novo) : utiliser des dates ISO partout

### 10.2 Un test flaky
- Identifier la cause : timing, ordre des tests, mocks partagés
- Ajouter `vi.restoreAllMocks()` en `afterEach` si pas déjà
- Pour les tests qui dépendent du temps, utiliser `vi.useFakeTimers()` + `vi.setSystemTime(...)`

### 10.3 Snapshot tests obsolètes
- Mettre à jour : `npm run test -- -u`
- **Toujours** vérifier le diff avant de merger
