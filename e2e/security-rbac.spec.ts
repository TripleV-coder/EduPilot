import { test, expect, type APIRequestContext } from "@playwright/test";

async function expectForbiddenOrUnauth(request: APIRequestContext, url: string) {
    const res = await request.get(url, { maxRedirects: 0 });
    const status = res.status();
    expect(
        [401, 403, 307, 302, 404].includes(status),
        `Expected ${url} to be denied for this role, got ${status}`
    ).toBe(true);

    if (status === 200) {
        const body = await res.text();
        // Defensive: a 200 with empty body is acceptable (some endpoints return [] for filtered roles).
        // But large structured payloads are not.
        expect(body.length).toBeLessThan(500);
    }
}

test.describe("RBAC — STUDENT cannot reach admin/management endpoints", () => {
    test.use({ storageState: "e2e/.auth/student.json" });

    const FORBIDDEN_FOR_STUDENT = [
        "/api/admin/users",
        "/api/users",
        "/api/teachers",
        "/api/audit-logs",
        "/api/fees",
        "/api/admin/maintenance",
    ];

    for (const url of FORBIDDEN_FOR_STUDENT) {
        test(`STUDENT cannot GET ${url}`, async ({ request }) => {
            await expectForbiddenOrUnauth(request, url);
        });
    }
});

test.describe("RBAC — PARENT cannot reach admin/management endpoints", () => {
    test.use({ storageState: "e2e/.auth/parent.json" });

    const FORBIDDEN_FOR_PARENT = [
        "/api/admin/users",
        "/api/audit-logs",
        "/api/fees",
        "/api/teachers",
    ];

    for (const url of FORBIDDEN_FOR_PARENT) {
        test(`PARENT cannot GET ${url}`, async ({ request }) => {
            await expectForbiddenOrUnauth(request, url);
        });
    }
});

test.describe("RBAC — TEACHER cannot reach admin endpoints", () => {
    test.use({ storageState: "e2e/.auth/teacher.json" });

    const FORBIDDEN_FOR_TEACHER = [
        "/api/admin/users",
        "/api/audit-logs",
        "/api/admin/maintenance",
    ];

    for (const url of FORBIDDEN_FOR_TEACHER) {
        test(`TEACHER cannot GET ${url}`, async ({ request }) => {
            await expectForbiddenOrUnauth(request, url);
        });
    }
});

test.describe("RBAC — SCHOOL_ADMIN can reach school-management endpoints", () => {
    test.use({ storageState: "e2e/.auth/admin.json" });

    const ALLOWED_FOR_ADMIN = [
        "/api/students",
        "/api/teachers",
        "/api/classes",
        "/api/users",
        "/api/audit-logs",
    ];

    for (const url of ALLOWED_FOR_ADMIN) {
        test(`SCHOOL_ADMIN can GET ${url}`, async ({ request }) => {
            const res = await request.get(url);
            expect(
                [200, 304].includes(res.status()),
                `${url} should be readable by SCHOOL_ADMIN, got ${res.status()}`
            ).toBe(true);
        });
    }
});
