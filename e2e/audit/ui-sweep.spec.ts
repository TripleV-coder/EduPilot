/**
 * Balayage d'audit de l'interface (hors CI : UI_SWEEP=1).
 *
 * Pour chaque rôle, ouvre chaque page accessible et relève : violations axe
 * (WCAG 2.1 AA + bonnes pratiques), erreurs console, appels d'API en échec
 * (≥ 500, ou 4xx autres que 401/403/404 attendus), débordement horizontal
 * à 375 px. Rapport : test-results/ui-sweep.json. N'échoue jamais : c'est
 * une mesure, pas une garde (e2e/a11y.spec.ts garde les pages critiques).
 */
import { test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { navForRole } from "../../src/components/edu-shell/role-nav";

const AUTH_DIR = path.join(__dirname, "..", ".auth");
const OUT = path.join(process.cwd(), "test-results", "ui-sweep.json");

function staticDashboardRoutes(): string[] {
    const root = path.join(process.cwd(), "src", "app", "(dashboard)", "dashboard");
    const routes: string[] = [];
    const walk = (dir: string, prefix: string) => {
        for (const entry of readdirSync(dir)) {
            const full = path.join(dir, entry);
            if (!statSync(full).isDirectory()) {
                if (entry === "page.tsx") routes.push(prefix || "/dashboard");
                continue;
            }
            if (entry.startsWith("[")) continue;
            const segment = entry.startsWith("(") ? "" : `/${entry}`;
            walk(full, prefix + segment);
        }
    };
    walk(root, "/dashboard");
    return [...new Set(routes)].sort();
}

const PUBLIC = ["/", "/login", "/forgot-password", "/register", "/privacy", "/terms", "/ecoles", "/explorer", "/offline"];

const ROLES: Array<{ key: string; role: string; file: string; all?: boolean }> = [
    { key: "admin", role: "SCHOOL_ADMIN", file: "admin.json", all: true },
    { key: "teacher", role: "TEACHER", file: "teacher.json" },
    { key: "student", role: "STUDENT", file: "student.json" },
    { key: "parent", role: "PARENT", file: "parent.json" },
    { key: "accountant", role: "ACCOUNTANT", file: "accountant.json" },
];

type PageReport = {
    role: string;
    url: string;
    status: number | null;
    finalUrl: string;
    loadMs: number;
    violations: Array<{ id: string; impact: string | null | undefined; nodes: number; targets: string[]; help: string }>;
    consoleErrors: string[];
    failedRequests: string[];
    mobileOverflowPx: number;
};

const reports: PageReport[] = [];

async function inspect(page: Page, role: string, url: string) {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
        if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    };
    const onResponse = (res: import("@playwright/test").Response) => {
        const u = new URL(res.url());
        if (!u.pathname.startsWith("/api/")) return;
        const s = res.status();
        if (s >= 500 || (s >= 400 && ![401, 403, 404].includes(s))) failedRequests.push(`${s} ${res.request().method()} ${u.pathname}${u.search}`);
    };
    const onPageError = (err: Error) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`);
    page.on("console", onConsole);
    page.on("response", onResponse);
    page.on("pageerror", onPageError);

    const started = Date.now();
    let status: number | null = null;
    try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        status = res?.status() ?? null;
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(1200);
    } catch (e) {
        consoleErrors.push(`navigation: ${(e as Error).message.slice(0, 200)}`);
    }
    const loadMs = Date.now() - started;

    let violations: PageReport["violations"] = [];
    try {
        const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
            .disableRules(["svg-img-alt"])
            .analyze();
        violations = axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
            targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
            help: v.help,
        }));
    } catch (e) {
        consoleErrors.push(`axe: ${(e as Error).message.slice(0, 200)}`);
    }

    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(400);
    const mobileOverflowPx = await page
        .evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        .catch(() => -1);
    await page.setViewportSize({ width: 1366, height: 900 });

    page.off("console", onConsole);
    page.off("response", onResponse);
    page.off("pageerror", onPageError);
    reports.push({ role, url, status, finalUrl: page.url().replace(/^https?:\/\/[^/]+/, ""), loadMs, violations, consoleErrors, failedRequests, mobileOverflowPx });
}

test.describe.configure({ mode: "serial" });
test.skip(!process.env.UI_SWEEP, "Balayage d'audit : UI_SWEEP=1");
test.setTimeout(3 * 60 * 60 * 1000);

test("anonyme — pages publiques", async ({ browser }) => {
    // storageState vide explicite : sinon le contexte hérite de la session admin
    // déclarée dans playwright.config.ts (les pages publiques redirigeaient).
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    for (const url of PUBLIC) await inspect(page, "anonymous", url);
    await context.close();
});

for (const r of ROLES) {
    test(`${r.key} — pages`, async ({ browser }) => {
        const context = await browser.newContext({ storageState: path.join(AUTH_DIR, r.file), viewport: { width: 1366, height: 900 } });
        const page = await context.newPage();
        const urls = r.all ? staticDashboardRoutes() : ["/dashboard", ...navForRole(r.role).map((l) => l.href)];
        for (const url of [...new Set(urls)]) await inspect(page, r.key, url);
        await context.close();
    });
}

test.afterAll(() => {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(reports, null, 2));
});
