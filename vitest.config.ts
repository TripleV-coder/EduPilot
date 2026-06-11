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
      // 2026-06-11 (statements 41.40, branches 33.07, functions 39.66),
      // after the P1.2 coverage push (algorithms, services, validations,
      // parsers). Set just under measured so CI is not flaky on small dips.
      // Ratchet up these numbers as new modules get covered. Target: 60/50/60.
      thresholds: {
        statements: 40,
        branches: 32,
        functions: 38,
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
