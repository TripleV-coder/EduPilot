import { test, expect, type Page } from "@playwright/test";

async function expectNoFatalError(page: Page) {
    const body = page.locator("body");
    await expect(body).not.toContainText(/Application error|Server Error|Internal Server Error/i);
    await expect(body).not.toContainText(/^Error:/i);
}

test.describe("Dashboard (authenticated as SCHOOL_ADMIN)", () => {
    test("/dashboard loads with school context", async ({ page }) => {
        const response = await page.goto("/dashboard");
        expect(response?.status()).toBeLessThan(400);
        await expect(page).toHaveURL(/\/dashboard/);
        await expectNoFatalError(page);
        // Sidebar must be present (EduSidebar root element from edu-shell)
        await expect(page.locator("nav, aside").first()).toBeVisible({ timeout: 15_000 });
    });

    test("/dashboard/students renders a list (or empty state)", async ({ page }) => {
        await page.goto("/dashboard/students");
        await expect(page).toHaveURL(/\/dashboard\/students/);
        await expectNoFatalError(page);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
        // Either we see at least one student row OR a French empty-state message
        const hasContent = await page
            .locator("body")
            .filter({ hasText: /élève|étudiant|Aucun|matricule/i })
            .first()
            .isVisible()
            .catch(() => false);
        expect(hasContent).toBe(true);
    });

    test("/dashboard/classes loads", async ({ page }) => {
        await page.goto("/dashboard/classes");
        await expect(page).toHaveURL(/\/dashboard\/classes/);
        await expectNoFatalError(page);
        await expect(page.locator("body")).toContainText(/classe|Classes/i);
    });

    test("/dashboard/teachers loads", async ({ page }) => {
        await page.goto("/dashboard/teachers");
        await expect(page).toHaveURL(/\/dashboard\/teachers/);
        await expectNoFatalError(page);
        await expect(page.locator("body")).toContainText(/enseignant|professeur|Aucun/i);
    });

    test("/dashboard/settings renders the settings hub", async ({ page }) => {
        await page.goto("/dashboard/settings");
        await expect(page).toHaveURL(/\/dashboard\/settings/);
        await expectNoFatalError(page);
        await expect(page.locator("body")).toContainText(/paramètres|profil|sécurité|langue|apparence/i);
    });

    test("/dashboard/analytics renders without crashing", async ({ page }) => {
        const response = await page.goto("/dashboard/analytics");
        expect(response?.status()).toBeLessThan(500);
        await expectNoFatalError(page);
    });
});
