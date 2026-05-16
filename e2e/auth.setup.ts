import { test as setup, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { E2E_PASSWORD, E2E_USERS } from "./global-setup";

const AUTH_DIR = "e2e/.auth";

type Account = { role: keyof typeof E2E_USERS; file: string };

const accounts: Account[] = [
    { role: "SCHOOL_ADMIN_1", file: `${AUTH_DIR}/admin.json` },
    { role: "SCHOOL_ADMIN_2", file: `${AUTH_DIR}/admin2.json` },
    { role: "TEACHER_1", file: `${AUTH_DIR}/teacher.json` },
    { role: "STUDENT_1", file: `${AUTH_DIR}/student.json` },
    { role: "PARENT_1", file: `${AUTH_DIR}/parent.json` },
    { role: "ACCOUNTANT_1", file: `${AUTH_DIR}/accountant.json` },
];

async function loginAs(page: Page, email: string) {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /bon retour/i })).toBeVisible();
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/\/dashboard($|\/)/, { timeout: 30_000 });
}

for (const { role, file } of accounts) {
    setup(`authenticate as ${role}`, async ({ page }) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await loginAs(page, E2E_USERS[role]);
        await page.context().storageState({ path: file });
    });
}
