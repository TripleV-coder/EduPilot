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
              // CI uses a prod build (`next start`) instead of `next dev` so
              // routes are pre-compiled. On slower runners, `next dev`'s JIT
              // compilation of /login on first request was taking >30s, the
              // browser RSC fetch timed out with "TypeError: Failed to fetch"
              // → NextAuth's client polled /api/auth/session, also failed
              // → ClientFetchError → login never redirected → setup timeout.
              // Local devs keep `next dev` for HMR.
              command: process.env.CI
                  ? `npm run build && PORT=${PORT} npm run start -- -p ${PORT}`
                  : `PORT=${PORT} npm run dev`,
              url: BASE_URL,
              reuseExistingServer: true,
              timeout: process.env.CI ? 300_000 : 120_000,
              stdout: "ignore",
              stderr: "pipe",
          },
});
