/**
 * Lighthouse CI configuration.
 *
 * Voluntarily permissive: every category assertion is set to "warn" so the
 * audit produces a report (and a temporary-public-storage URL we can click)
 * without failing the workflow on numeric thresholds that haven't been
 * negotiated yet. When perf/a11y budgets are agreed, swap "warn" -> "error"
 * and set explicit minScore values.
 *
 * docs: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
module.exports = {
  ci: {
    collect: {
      // The action passes urls + numberOfRuns via the workflow inputs.
      // We keep collect{} minimal to defer to those.
      // Without startServerCommand the previous run failed with
      // CHROME_INTERSTITIAL_ERROR because nothing was listening on
      // localhost:3000 — the workflow built Next but never started it.
      startServerCommand: "npm run start -- -p 3000",
      startServerReadyPattern: "Ready in|started server on|Local:.*localhost",
      startServerReadyTimeout: 60_000,
      settings: {
        // Avoid storage-quota errors on slim CI runners.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.8 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
        // Common noisy audits that don't matter in CI:
        "uses-http2": "off",
        "is-on-https": "off",
        "redirects-http": "off",
        "valid-source-maps": "off",
      },
    },
    upload: {
      // Already configured in the workflow via temporaryPublicStorage: true.
      // Repeated here for runs invoked locally with `lhci autorun`.
      target: "temporary-public-storage",
    },
  },
};
