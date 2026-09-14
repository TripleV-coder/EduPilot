import { defineConfig, devices } from "@playwright/test";

/**
 * E2E du démarrage à vide (Lot 5) : installation complète depuis l'interface,
 * sur une base NEUVE (migrations appliquées, aucun seed, aucun utilisateur).
 *
 * Distinct de playwright.config.ts : pas de global-setup (aucun compte de
 * démonstration à préparer), pas d'état d'authentification partagé — chaque
 * compte est créé par le parcours lui-même. Les étapes s'enchaînent dans un
 * seul fichier, en série.
 *
 * Serveur : de production, sur une base vide, avec le rôle applicatif
 * (voir docs/EXPLOITATION.md / scripts/quality/README.md). E2E_BASE_URL le désigne.
 */
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3100";

export default defineConfig({
    testDir: "./e2e/fresh-install",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? "html" : [["list"]],
    use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
});
