import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'prisma'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/components/edu/**/*.tsx',
        'src/components/messaging/**/*.tsx',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        'src/lib/types/**',
        '**/*.d.ts',
        'src/lib/swagger.ts',
      ],
      // Seuils par périmètre (glob), à monter au fil des nouveaux tests :
      //  - src/lib/**        : cœur métier testé (baseline 2026-06-11 : 41/33/40)
      //  - src/components/** : primitives edu + messaging (baseline 2026-06-13 :
      //    edu 55/46/37.5 — Button/Card/Input/Badge/MetricCard/Spinner/Progress/
      //    Toast/ComposeDialog couverts ; charts/icônes encore à couvrir).
      //  - src/app/api/**    : seuil TD-005 (18/14/18 au 2026-08-16, +99 tests :
      //    announcements, events, library, attendance stats/justifications/bulk,
      //    audit-logs/export, alumni, benchmark, cagnottes, admin/subjects) —
      //    remonter lot par lot.
      // Cibles long terme : lib 60/50/60, components 70/60/60, api 40/30/40.
      thresholds: {
        'src/lib/**': { statements: 40, branches: 32, functions: 38 },
        'src/components/**': { statements: 50, branches: 40, functions: 35 },
        'src/app/api/**': { statements: 18, branches: 14, functions: 18 },
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
