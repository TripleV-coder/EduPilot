import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Public routes (no auth)", () => {
    test("/login renders the login form", async ({ page }) => {
        const response = await page.goto("/login");
        expect(response?.status()).toBe(200);
        await expect(page.locator("#email")).toBeVisible();
        await expect(page.locator("#password")).toBeVisible();
        await expect(page.getByRole("button", { name: /se connecter/i })).toBeVisible();
    });

    test("/forgot-password renders", async ({ page }) => {
        const response = await page.goto("/forgot-password");
        expect(response?.status()).toBe(200);
        await expect(page.locator("body")).toContainText(/mot de passe|email|adresse/i);
    });

    test("/register renders", async ({ page }) => {
        const response = await page.goto("/register");
        expect(response?.status()).toBe(200);
        await expect(page.locator("body")).not.toBeEmpty();
    });

    test("/privacy renders RGPD content", async ({ page }) => {
        const response = await page.goto("/privacy");
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: /politique de confidentialité/i })).toBeVisible();
        await expect(page.locator("body")).toContainText("RGPD");
    });

    test("/terms renders CGU content", async ({ page }) => {
        const response = await page.goto("/terms");
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: /conditions d'utilisation/i })).toBeVisible();
    });

    test("/dashboard redirects unauthenticated users to /login", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/\/login/);
    });
});
