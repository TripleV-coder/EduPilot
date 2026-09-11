import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Suite d'intégration sur un VRAI PostgreSQL (jamais de Prisma mocké).
 *
 * - Local : `global-setup.ts` démarre un PostgreSQL éphémère (embedded-postgres,
 *   port libre ≠ 5432, répertoire temporaire supprimé à la fin).
 * - CI : `TEST_DATABASE_URL` pointe vers le service postgres:16 (port ≠ 5432,
 *   base suffixée `_test`/`_it`), vérifié par `assertDisposableDatabaseUrl`.
 *
 * Les défauts de volume, d'isolation et de schéma (C1, C3, H5, M3) sont passés
 * au travers des tests mockés : c'est ici qu'ils sont prouvés.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration-db/**/*.test.ts'],
    globalSetup: ['./tests/integration-db/global-setup.ts'],
    setupFiles: ['./tests/integration-db/setup.ts'],
    // Une seule base partagée : exécution séquentielle des fichiers.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
