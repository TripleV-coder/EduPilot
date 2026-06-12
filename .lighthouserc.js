/**
 * Lighthouse CI configuration.
 *
 * Budgets actés (2026-06-12) : accessibility / best-practices / seo bloquent
 * le workflow en dessous des minScore. Performance reste en "warn" car les
 * runners GitHub partagés varient de ±15 pts d'un run à l'autre — le p75 réel
 * est suivi en production via /api/performance/dashboard (PerformanceMetric).
 *
 * docs: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
module.exports = {
  ci: {
    collect: {
      // The action passes urls + numberOfRuns via the workflow inputs.
      // We keep collect{} minimal to defer to those.
      // The server is started + healthchecked by the workflow itself
      // (see .github/workflows/lighthouse-ci.yml). startServerCommand
      // here would race on port 3000 and would also swallow stdout so a
      // runtime crash would be invisible.
      settings: {
        // Avoid storage-quota errors on slim CI runners.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.6 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.85 }],
        "categories:seo": ["error", { minScore: 0.85 }],
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
