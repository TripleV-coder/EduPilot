import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Anonymous (no cookie) callers must NEVER receive data from protected endpoints.
 * Accept either 401 (unauthenticated), 403 (forbidden), or 307 (redirect to /login).
 * Anything 2xx with real data is a security defect.
 */
const PROTECTED_GETS = [
    "/api/students",
    "/api/teachers",
    "/api/classes",
    "/api/users",
    "/api/fees",
    "/api/grades",
    "/api/admin/users",
    "/api/attendance",
    "/api/incidents",
    "/api/audit-logs",
];

test.describe("Anonymous access — protected APIs must reject", () => {
    for (const url of PROTECTED_GETS) {
        test(`GET ${url} blocks anonymous`, async ({ request }) => {
            const res = await request.get(url, { maxRedirects: 0 });
            expect([401, 403, 307, 302, 404]).toContain(res.status());
            if (res.status() === 200) {
                // Should never reach here, but assert empty / non-sensitive if it does
                const body = await res.text();
                expect(body.length).toBeLessThan(200);
            }
        });
    }

    test("dashboard pages redirect to /login when anonymous", async ({ page }) => {
        await page.goto("/dashboard/users");
        await expect(page).toHaveURL(/\/login/);
    });
});
