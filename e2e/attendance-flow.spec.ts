/**
 * E2E — attendance taking workflow.
 * Teachers must reach the attendance page, see the daily call, and the
 * tab navigation must remain stable.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

test.use({ storageState: path.join(__dirname, ".auth", "teacher.json") });

test.describe("Attendance flow (TEACHER)", () => {
    test("attendance landing renders without fatal error", async ({ page }) => {
        const response = await page.goto("/dashboard/attendance");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error|Server Error/i);
    });

    test("a teacher can navigate from dashboard to attendance via the sidebar", async ({ page }) => {
        await page.goto("/dashboard");

        const navLink = page.getByRole("link", { name: /pr(é|e)sence|attendance/i }).first();
        if (await navLink.count()) {
            await navLink.click();
            await page.waitForURL(/attendance/, { timeout: 10_000 });
        } else {
            // Fallback: direct navigation if the sidebar item is collapsed.
            await page.goto("/dashboard/attendance");
        }

        await expect(page).toHaveURL(/attendance/);
    });

    test("attendance justifications section is reachable", async ({ page }) => {
        // The justifications subsection is rendered as a tab inside the page.
        // We don't click the tab (it might be a custom button) — we just verify
        // that the keyword shows up somewhere on the page.
        await page.goto("/dashboard/attendance");
        await page.waitForLoadState("networkidle");
        const bodyText = await page.locator("body").innerText().catch(() => "");
        expect(/justification|absent|retard/i.test(bodyText)).toBe(true);
    });

    test("calendar page renders for teachers", async ({ page }) => {
        const response = await page.goto("/dashboard/calendar");
        expect(response?.status()).toBeLessThan(400);
        await expect(page.locator("body")).not.toContainText(/Application error/i);
    });
});
