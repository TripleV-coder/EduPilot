import { defineConfig } from 'vitest/config'
import base from './vitest.config'

/**
 * Mesure consolidée (npm run test:coverage:all) : tests unitaires sur TOUT
 * src/, sans les seuils par dossier de vitest.config.ts (réglés pour l'ancien
 * périmètre ; mergeConfig les conserverait, d'où le remplacement complet de
 * `coverage`). Le seuil global s'applique après fusion avec l'intégration
 * (scripts/quality/coverage-merge.mjs --check).
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      provider: 'v8',
      reporter: ['json'],
      reportsDirectory: 'coverage/unit',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts'],
    },
  },
})
