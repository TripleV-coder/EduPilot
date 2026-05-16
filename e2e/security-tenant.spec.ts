import { test, expect } from "@playwright/test";
import { E2E_SCHOOLS } from "./global-setup";

/**
 * Tenant isolation: a SCHOOL_ADMIN of school B must NEVER receive school A's data.
 * - Admin2 (Lycée Béhanzin) tries to fetch a class that belongs to school 1 (Saint-Michel).
 * - Admin2 also tries to filter requests with `schoolId=school1` — should be ignored or rejected.
 */
test.describe("Tenant isolation — cross-school access is denied", () => {
    test.use({ storageState: "e2e/.auth/admin2.json" });

    test("admin@behanzin cannot fetch a Saint-Michel class by ID", async ({ request }) => {
        const url = `/api/classes/${E2E_SCHOOLS.SCHOOL_1_CLASS_ID}`;
        const res = await request.get(url);
        expect(
            [403, 404].includes(res.status()),
            `Cross-school class fetch should be denied, got ${res.status()}`
        ).toBe(true);
    });

    test("admin@behanzin querying ?schoolId=school1 does not leak Saint-Michel data", async ({ request }) => {
        const res = await request.get(`/api/students?schoolId=${E2E_SCHOOLS.SCHOOL_1_ID}`);
        if (res.status() === 200) {
            const body = await res.json().catch(() => null);
            const list = Array.isArray(body)
                ? body
                : Array.isArray(body?.data)
                ? body.data
                : Array.isArray(body?.students)
                ? body.students
                : [];
            // If the server honored the foreign schoolId filter, ALL returned students would belong to school 1.
            // We assert the inverse: NO student should belong to school 1.
            const leaked = list.filter(
                (s: any) => s?.schoolId === E2E_SCHOOLS.SCHOOL_1_ID
            );
            expect(
                leaked.length,
                `Tenant leak: ${leaked.length} students from foreign school returned`
            ).toBe(0);
        } else {
            // 403/404 is also acceptable.
            expect([401, 403, 404]).toContain(res.status());
        }
    });

    test("admin@behanzin cannot fetch Saint-Michel user list with filter", async ({ request }) => {
        const res = await request.get(`/api/users?schoolId=${E2E_SCHOOLS.SCHOOL_1_ID}`);
        if (res.status() === 200) {
            const body = await res.json().catch(() => null);
            const list = Array.isArray(body)
                ? body
                : Array.isArray(body?.data)
                ? body.data
                : Array.isArray(body?.users)
                ? body.users
                : [];
            const leaked = list.filter(
                (u: any) => u?.schoolId === E2E_SCHOOLS.SCHOOL_1_ID
            );
            expect(leaked.length).toBe(0);
        } else {
            expect([401, 403, 404]).toContain(res.status());
        }
    });
});
