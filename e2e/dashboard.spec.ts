import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// EduPilot E2E Smoke Tests — Dashboard Pages
// Vérifie que chaque page se charge et affiche les éléments clés.
// ═══════════════════════════════════════════════════════════════

test.describe('Login Page', () => {
    test('affiche le formulaire de connexion', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveTitle(/EduPilot/i);
        // Chercher un champ email ou mot de passe
        const emailField = page.locator('input[type="email"], input[name="email"]');
        await expect(emailField).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Dashboard — Finance', () => {
    test('charge la page /dashboard/finance', async ({ page }) => {
        await page.goto('/dashboard/finance');
        // La page devrait soit afficher le contenu, soit rediriger vers login
        const url = page.url();
        if (url.includes('/login')) {
            // Non authentifié : redirigé vers login → page protégée fonctionne
            await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        } else {
            // Authentifié ou rendu côté client : vérifier le titre "Finances"
            await expect(page.locator('text=Finances').or(page.locator('text=Accès refusé')).or(page.locator('[class*="animate-spin"]'))).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Dashboard — Emploi du Temps', () => {
    test('charge la page /dashboard/schedule', async ({ page }) => {
        await page.goto('/dashboard/schedule');
        const url = page.url();
        if (url.includes('/login')) {
            await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        } else {
            await expect(page.locator('text=Emploi du Temps').or(page.locator('text=Accès refusé')).or(page.locator('[class*="animate-spin"]'))).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Dashboard — Notes', () => {
    test('charge la page /dashboard/grades', async ({ page }) => {
        await page.goto('/dashboard/grades');
        const url = page.url();
        if (url.includes('/login')) {
            await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        } else {
            await expect(page.locator('text=Notes').or(page.locator('text=Évaluations')).or(page.locator('text=Accès refusé')).or(page.locator('[class*="animate-spin"]'))).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Dashboard — Assistant IA', () => {
    test('charge la page /dashboard/ai', async ({ page }) => {
        await page.goto('/dashboard/ai');
        const url = page.url();
        if (url.includes('/login')) {
            await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        } else {
            await expect(page.locator('text=Assistant IA').or(page.locator('text=Accès refusé')).or(page.locator('[class*="animate-spin"]'))).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Dashboard — Performance', () => {
    test('charge la page /dashboard/performance', async ({ page }) => {
        await page.goto('/dashboard/performance');
        const url = page.url();
        if (url.includes('/login')) {
            await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
        } else {
            await expect(page.locator('text=Performance').or(page.locator('text=Accès refusé')).or(page.locator('[class*="animate-spin"]'))).toBeVisible({ timeout: 10000 });
        }
    });
});

test.describe('Redirections de sécurité', () => {
    test('les pages dashboard redirigent vers login si non authentifié', async ({ page }) => {
        // Tester une page dashboard sans session — devrait être redirigé ou afficher un guard
        await page.goto('/dashboard/finance');
        // Attendre un court instant pour les redirections côté client
        await page.waitForTimeout(2000);
        const url = page.url();
        // Soit redirigé vers login, soit le PageGuard affiche un loader/accès refusé
        const isOnLogin = url.includes('/login');
        const hasGuard = await page.locator('text=Accès refusé').or(page.locator('[class*="animate-spin"]')).isVisible().catch(() => false);
        expect(isOnLogin || hasGuard).toBeTruthy();
    });
});
