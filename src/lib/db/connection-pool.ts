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
 * Only fetches required fields to reduce data transfer
 */
export async function optimizedFindMany<T>(
  model: any,
  options: {
    where?: any;
    select?: any;
    include?: any;
    orderBy?: any;
    take?: number;
    skip?: number;
  }
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
