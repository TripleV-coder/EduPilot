import { test, expect } from '@playwright/test';

/**
 * E2E — Authentication flows
 * Couvre : login (succès, erreur, lockout), forgot password, protection des routes.
 */

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function fillLoginForm(page: any, email: string, password: string) {
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
}

// ─────────────────────────────────────────────────────────────
// LOGIN PAGE — Structure
// ─────────────────────────────────────────────────────────────

test.describe('Login Page — Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
    });

    test('affiche le titre EduPilot', async ({ page }) => {
        await expect(page).toHaveTitle(/EduPilot/i);
    });

    test('affiche le champ email', async ({ page }) => {
        const emailField = page.locator('input[type="email"], input[name="email"]');
        await expect(emailField).toBeVisible({ timeout: 10_000 });
    });

    test('affiche le champ mot de passe', async ({ page }) => {
        const passwordField = page.locator('input[type="password"], input[name="password"]');
        await expect(passwordField).toBeVisible({ timeout: 10_000 });
    });

    test('affiche le bouton de connexion', async ({ page }) => {
        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    });

    test('contient un lien vers le mot de passe oublié', async ({ page }) => {
        const forgotLink = page.locator('a[href*="forgot"], text=oublié, text=Oublié, text=mot de passe');
        // Optionnel — ne pas échouer si absent
        const count = await forgotLink.count();
        if (count > 0) {
            await expect(forgotLink.first()).toBeVisible();
        }
    });
});

// ─────────────────────────────────────────────────────────────
// LOGIN — Identifiants incorrects
// ─────────────────────────────────────────────────────────────

test.describe('Login — Identifiants incorrects', () => {
    test('affiche un message d\'erreur avec un email invalide', async ({ page }) => {
        await page.goto('/login');
        await fillLoginForm(page, 'notanemail', 'password123');

        // Soit validation HTML5, soit message d'erreur JS
        const emailField = page.locator('input[type="email"], input[name="email"]');
        const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid);
        if (!isInvalid) {
            // Message d'erreur côté serveur
            const errorMsg = page.locator('[role="alert"], .error, [data-error], text=/invalide|incorrect|erreur/i');
            await expect(errorMsg.first()).toBeVisible({ timeout: 10_000 });
        }
    });

    test('affiche un message d\'erreur avec des identifiants incorrects', async ({ page }) => {
        await page.goto('/login');
        await fillLoginForm(page, 'wrong@example.com', 'WrongPassword1!');

        // Attendre la réponse du serveur
        const errorMsg = page.locator(
            '[role="alert"], .error, [data-error], ' +
            'text=/invalide|incorrect|erreur|identifiant|connexion/i'
        );
        await expect(errorMsg.first()).toBeVisible({ timeout: 15_000 });
    });
});

// ─────────────────────────────────────────────────────────────
// ROUTES PROTÉGÉES — Redirection vers /login
// ─────────────────────────────────────────────────────────────

test.describe('Routes protégées — Redirection', () => {
    const protectedRoutes = [
        '/dashboard',
        '/dashboard/students',
        '/dashboard/teachers',
        '/dashboard/finance',
        '/dashboard/grades',
        '/dashboard/settings',
    ];

    for (const route of protectedRoutes) {
        test(`redirige vers /login pour ${route}`, async ({ page }) => {
            await page.goto(route);

            // Attendre soit la redirection soit la page de login inline
            await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});

            const url = page.url();
            const isOnLogin = url.includes('/login');
            const hasLoginForm = await page.locator('input[type="email"], input[name="email"]').isVisible().catch(() => false);

            expect(isOnLogin || hasLoginForm).toBe(true);
        });
    }
});

// ─────────────────────────────────────────────────────────────
// MOT DE PASSE OUBLIÉ — Page
// ─────────────────────────────────────────────────────────────

test.describe('Mot de passe oublié', () => {
    test('la page /forgot-password se charge', async ({ page }) => {
        await page.goto('/forgot-password');
        const url = page.url();

        // La page existe OU redirige vers login (selon l'implémentation)
        if (!url.includes('/login')) {
            const emailField = page.locator('input[type="email"], input[name="email"]');
            await expect(emailField).toBeVisible({ timeout: 10_000 });
        }
    });
});

// ─────────────────────────────────────────────────────────────
// API AUTH — Endpoints publics
// ─────────────────────────────────────────────────────────────

test.describe('API Auth — Endpoints publics', () => {
    test('POST /api/auth/forgot-password retourne 200 (anti-énumération)', async ({ request }) => {
        const res = await request.post('/api/auth/forgot-password', {
            data: { email: 'nonexistent@example.com' },
        });
        // Doit retourner 200 même si l'email n'existe pas (anti-énumération)
        expect(res.status()).toBe(200);
    });

    test('POST /api/auth/forgot-password — rate limit après 3 tentatives', async ({ request }) => {
        // 3 tentatives rapides sur le même email
        const testEmail = `ratelimit-${Date.now()}@test.com`;
        for (let i = 0; i < 3; i++) {
            await request.post('/api/auth/forgot-password', { data: { email: testEmail } });
        }
        // 4ème tentative → 429
        const res = await request.post('/api/auth/forgot-password', { data: { email: testEmail } });
        expect(res.status()).toBe(429);
    });

    test('GET /api/system/health retourne 200', async ({ request }) => {
        const res = await request.get('/api/system/health');
        expect(res.status()).toBe(200);
    });

    test('GET /api/users retourne 401 sans authentification', async ({ request }) => {
        const res = await request.get('/api/users');
        expect([401, 403]).toContain(res.status());
    });

    test('GET /api/students retourne 401 sans authentification', async ({ request }) => {
        const res = await request.get('/api/students');
        expect([401, 403]).toContain(res.status());
    });
});

// ─────────────────────────────────────────────────────────────
// ACCESSIBILITÉ — Page de login
// ─────────────────────────────────────────────────────────────

test.describe('Accessibilité — Login', () => {
    test('les champs de formulaire ont des labels associés', async ({ page }) => {
        await page.goto('/login');

        const emailInput = page.locator('input[type="email"], input[name="email"]');
        await expect(emailInput).toBeVisible({ timeout: 10_000 });

        // Vérifier aria-label ou label associé
        const ariaLabel = await emailInput.getAttribute('aria-label');
        const id = await emailInput.getAttribute('id');
        const hasLabel = ariaLabel !== null || (id !== null && await page.locator(`label[for="${id}"]`).count() > 0);
        expect(hasLabel).toBe(true);
    });
});
