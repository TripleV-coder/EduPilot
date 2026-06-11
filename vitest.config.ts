import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'prisma'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/types/**',
        '**/*.d.ts',
        'src/lib/swagger.ts',
      ],
      // Thresholds reflect the measured baseline for src/lib/** as of
      // 2026-06-11 (statements 24.09, branches 19.99, functions 24.00),
      // after the P1 financial/business integration suites. Set just under
      // measured so CI is not flaky on small dips. Ratchet up these numbers
      // as new modules get covered. Next milestone: 40 — target: 60/50/60.
      thresholds: {
        statements: 23,
        branches: 19,
        functions: 23,
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
