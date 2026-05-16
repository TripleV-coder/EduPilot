import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication flow", () => {
    test("invalid credentials keep the user on /login", async ({ page }) => {
        await page.goto("/login");
        await page.locator("#email").fill("nobody@invalid.test");
        await page.locator("#password").fill("WrongPassword123!");
        await page.getByRole("button", { name: /se connecter/i }).click();

        // Either a visible error alert OR we simply stay on /login (no redirect to /dashboard).
        await page.waitForTimeout(2_000);
        await expect(page).toHaveURL(/\/login/);
        await expect(page).not.toHaveURL(/\/dashboard/);
    });

    test("valid SCHOOL_ADMIN credentials reach the dashboard", async ({ page }) => {
        const { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } = await import("./global-setup");
        await page.goto("/login");
        await page.locator("#email").fill(E2E_ADMIN_EMAIL);
        await page.locator("#password").fill(E2E_ADMIN_PASSWORD);
        await page.getByRole("button", { name: /se connecter/i }).click();

        await page.waitForURL(/\/dashboard($|\/)/, { timeout: 30_000 });
        await expect(page).toHaveURL(/\/dashboard/);
    });
});
