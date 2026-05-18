import { PrismaClient } from "@prisma/client";

/**
 * Optimized Prisma client with connection pooling
 * Reuses connections to reduce overhead
 */
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  prismaInstance = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Connection pool optimization
  // Prisma automatically manages connection pooling, but we can configure it
  // via DATABASE_URL: postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=20

  // Handle graceful shutdown
  if (typeof process !== "undefined") {
    process.on("beforeExit", async () => {
      await prismaInstance?.$disconnect();
    });
  }

  return prismaInstance;
}

/**
 * Optimized query helper with select optimization
 * Only fetches required fields to reduce data transfer.
 *
 * `model` is typed as the minimal shape Prisma delegates share: a `findMany`
 * method. This keeps the helper generic over every Prisma model while still
 * preventing arbitrary objects from being passed in.
 */
interface PrismaFindManyDelegate<T> {
  findMany: (args?: unknown) => Promise<T[]>;
}

export interface OptimizedFindManyOptions {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  take?: number;
  skip?: number;
}

export async function optimizedFindMany<T>(
  model: PrismaFindManyDelegate<T>,
  options: OptimizedFindManyOptions,
): Promise<T[]> {
  // Prefer select over include when possible (more efficient)
  if (options.select && !options.include) {
    return model.findMany({
      ...options,
      select: options.select,
    });
  }

  return model.findMany(options);
}

/**
 * Batch queries helper
 * Executes multiple queries in parallel
 */
export async function batchQueries<T>(
  queries: (() => Promise<T>)[]
): Promise<T[]> {
  return Promise.all(queries.map((query) => query()));
}
