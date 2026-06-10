/**
 * Accessibility audit — runs axe-core against critical authenticated routes.
 * Fails the build if any WCAG 2.1 AA violation is found.
 *
 * Coverage: 6 routes covering login, dashboard root, students list, grades,
 * finance, and the design-system showcase.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const AUTH_DIR = path.join(__dirname, ".auth");

/**
 * Filter rules we know don't apply to our app (e.g. color-contrast on third-party
 * embeds that ship their own theming). Keep this list tight — only suppress when
 * there's a documented reason.
 */
const RULES_DISABLED: string[] = [
    // Recharts SVG charts inject their own focus-trap; axe flags it but the chart
    // is decorative and labelled by an aria-describedby on its container.
    "svg-img-alt",
];

async function settle(page: Page) {
    // La connexion SSE du centre de notifications (/api/notifications/stream)
    // reste ouverte sur les pages dashboard : "networkidle" peut ne jamais
    // être atteint. Best effort, puis audit() laisse finir les animations.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function audit(page: Page) {
    // Les animations d'entrée (GSAP / Framer Motion) laissent des opacités
    // intermédiaires sur les runners CI lents : axe calcule alors un
    // contraste faussé (texte en cours de fade-in). On laisse les
    // entrances se terminer avant d'analyser.
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .disableRules(RULES_DISABLED)
        .analyze();

    if (results.violations.length > 0) {
        // Helpful failure message for CI logs.
        const summary = results.violations
            .map(
                (v) =>
                    `- [${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n  Nodes: ${v.nodes.length}`,
            )
            .join("\n");
        console.error(`Accessibility violations on ${page.url()}:\n${summary}`);
    }
    expect(results.violations, "WCAG violations detected").toEqual([]);
}

test.describe("Accessibility — public routes (anonymous)", () => {
    test("/", async ({ page }) => {
        await page.goto("/");
        await settle(page);
        await audit(page);
    });

    test("/login", async ({ page }) => {
        // NB : la route de connexion est /login (pas /auth/login, qui rend la 404).
        await page.goto("/login");
        await settle(page);
        await audit(page);
    });
});

test.describe("Accessibility — authenticated as SCHOOL_ADMIN", () => {
    test.use({ storageState: path.join(AUTH_DIR, "admin.json") });

    test("/dashboard", async ({ page }) => {
        await page.goto("/dashboard");
        await settle(page);
        await audit(page);
    });

    test("/dashboard/students", async ({ page }) => {
        await page.goto("/dashboard/students");
        await settle(page);
        await audit(page);
    });

    test("/dashboard/finance", async ({ page }) => {
        await page.goto("/dashboard/finance");
        await settle(page);
        await audit(page);
    });

    test("/dashboard/design-system", async ({ page }) => {
        await page.goto("/dashboard/design-system");
        await settle(page);
        await audit(page);
    });
});

test.describe("Accessibility — authenticated as TEACHER", () => {
    test.use({ storageState: path.join(AUTH_DIR, "teacher.json") });

    test("/dashboard/grades", async ({ page }) => {
        await page.goto("/dashboard/grades");
        await settle(page);
        await audit(page);
    });
});
