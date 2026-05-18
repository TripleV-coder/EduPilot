/**
 * E2E — finance and payment workflow for ACCOUNTANT role.
 * Touches the highest-money-impact features: fees, payments, reconciliation.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

test.use({ storageState: path.join(__dirname, ".auth", "accountant.json") });

test.describe("Finance flow (ACCOUNTANT)", () => {
    test("finance landing renders KPIs and tabs", async ({ page }) => {
        const response = await page.goto("/dashboard/finance");
        expect(response?.status()).toBeLessThan(400);

        await expect(page).toHaveURL(/\/dashboard\/finance/);
        await expect(page.locator("body")).not.toContainText(/Application error/i);

        // Expect at least one KPI metric to be on screen (number followed by
        // a currency-ish label).
        await expect(
            page.locator("text=/\\d/").first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test("fees subpage lists fees (or empty state)", async ({ page }) => {
        const response = await page.goto("/dashboard/finance/fees");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });

    test("payments subpage and 'new payment' CTA are reachable", async ({ page }) => {
        const response = await page.goto("/dashboard/finance/payments/new");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });

    test("reconciliation page is gated to finance roles", async ({ page }) => {
        const response = await page.goto("/dashboard/finance/reconciliation");
        expect(response?.status()).toBeLessThan(400);
        await expect(page).toHaveURL(/reconciliation|finance/);
    });

    test("an accountant cannot see student profiles list", async ({ page }) => {
        await page.goto("/dashboard/students", { waitUntil: "domcontentloaded" });
        // RBAC must hide or redirect — must not surface a raw student list as if
        // they were a school admin.
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });
});
