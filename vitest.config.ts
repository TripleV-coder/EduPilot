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
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
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
