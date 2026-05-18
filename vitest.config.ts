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
      // 2026-05-18 (statements 18.76, branches 13.81, functions 18.51).
      // Set just under measured so CI is not flaky on small dips. Ratchet
      // up these numbers as new modules get covered. Target: 60/50/60.
      thresholds: {
        statements: 17,
        branches: 12,
        functions: 17,
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
