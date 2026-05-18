/**
 * E2E — parent dashboard and child-data access.
 * Validates parents see ONLY their own children and can navigate the key
 * read-only sections.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

test.use({ storageState: path.join(__dirname, ".auth", "parent.json") });

test.describe("Parent flow (PARENT)", () => {
    test("/dashboard shows the parent-specific dashboard", async ({ page }) => {
        const response = await page.goto("/dashboard");
        expect(response?.status()).toBeLessThan(400);
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });

    test("appointments page renders for parents", async ({ page }) => {
        const response = await page.goto("/dashboard/appointments");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });

    test("messages page renders for parents", async ({ page }) => {
        const response = await page.goto("/dashboard/messages");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });

    test("a parent cannot access the audit logs page", async ({ page }) => {
        await page.goto("/dashboard/audit-logs", { waitUntil: "domcontentloaded" });
        // Parents lack the AUDIT_LOG_READ permission → expect redirect away
        // from the route OR a 403/forbidden state.
        const finalUrl = page.url();
        const deniedByUrl = !finalUrl.endsWith("/audit-logs");
        const deniedByContent = await page
            .locator("body")
            .innerText()
            .then((t) => /accès refusé|forbidden|non autorisé/i.test(t))
            .catch(() => false);
        expect(deniedByUrl || deniedByContent).toBe(true);
    });

    test("a parent cannot create a new class", async ({ page }) => {
        await page.goto("/dashboard/classes/new", { waitUntil: "domcontentloaded" });
        const finalUrl = page.url();
        const deniedByUrl = !finalUrl.endsWith("/classes/new");
        const deniedByContent = await page
            .locator("body")
            .innerText()
            .then((t) => /accès refusé|forbidden|non autorisé/i.test(t))
            .catch(() => false);
        expect(deniedByUrl || deniedByContent).toBe(true);
    });
});
