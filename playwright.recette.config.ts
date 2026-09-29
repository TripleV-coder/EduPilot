import { defineConfig, devices } from "@playwright/test";

/**
 * Recette filmée : cycle de vie complet de l'application, depuis une base
 * VIDE (aucun seed, aucun compte), exclusivement par l'interface.
 *
 * Chaque étape (e2e/recette/NN-*.spec.ts) reprend l'état laissé par la
 * précédente (comptes, mots de passe, codes : recette-videos/.etat.json) et
 * filme chaque acteur dans recette-videos/<étape>/<scénario>/<acteur>.webm.
 *
 * Prérequis : serveur de production sur une base neuve (migrate deploy, rôle
 * applicatif), ROOT_USER_EMAILS vide. Voir e2e/recette/README.md.
 *   E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.recette.config.ts
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3100";

export default defineConfig({
    testDir: "./e2e/recette",
    testMatch: /\d\d-.*\.spec\.ts/,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 90 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"], ["json", { outputFile: "recette-videos/resultats-playwright.json" }]],
    outputDir: "recette-videos/.playwright",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 720 },
        locale: "fr-FR",
        timezoneId: "Africa/Porto-Novo",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        launchOptions: { slowMo: Number(process.env.RECETTE_SLOWMO ?? 90) },
    },
});
