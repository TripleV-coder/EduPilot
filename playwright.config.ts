import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3093);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? "html" : [["list"]],
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: "setup",
            testMatch: /.*\.setup\.ts/,
        },
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "e2e/.auth/admin.json",
            },
            dependencies: ["setup"],
            testIgnore: /.*\.setup\.ts/,
        },
    ],
    webServer: process.env.E2E_NO_SERVER
        ? undefined
        : {
              command: `PORT=${PORT} npm run dev`,
              url: BASE_URL,
              reuseExistingServer: true,
              timeout: 120_000,
              stdout: "ignore",
              stderr: "pipe",
          },
});
