/**
 * E2E — teacher grade entry workflow.
 * Verifies the core gradebook entry path used daily by every teacher.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

test.use({ storageState: path.join(__dirname, ".auth", "teacher.json") });

test.describe("Grades flow (TEACHER)", () => {
    test("the grades page lists evaluations and offers an entry CTA", async ({ page }) => {
        const response = await page.goto("/dashboard/grades");
        expect(response?.status()).toBeLessThan(400);

        // Page must show a meaningful heading or section title.
        await expect(
            page.getByRole("heading", { name: /(notes|grades|évaluation)/i }).first(),
        ).toBeVisible({ timeout: 15_000 });

        // The teacher must be able to either pick a class or start an evaluation.
        const ctaLink = page
            .getByRole("link", { name: /nouveau|saisir|noter/i })
            .or(page.getByRole("button", { name: /nouveau|saisir|noter/i }));
        await expect(ctaLink.first()).toBeVisible({ timeout: 15_000 });
    });

    test("homework subpage renders without fatal error", async ({ page }) => {
        const response = await page.goto("/dashboard/homework");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error|Server Error/i);
    });

    test("exams subpage renders without fatal error", async ({ page }) => {
        const response = await page.goto("/dashboard/exams");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error|Server Error/i);
    });

    test("a teacher cannot reach the finance admin pages", async ({ page }) => {
        const response = await page.goto("/dashboard/finance/fees", { waitUntil: "domcontentloaded" });
        // Either RBAC redirects (302/3xx → final 200 on a guard page) or 403.
        const finalUrl = page.url();
        const denied =
            finalUrl.includes("/dashboard") && !finalUrl.includes("/finance/fees")
                ? true
                : response?.status() === 403 || response?.status() === 404;
        expect(denied).toBe(true);
    });
});
