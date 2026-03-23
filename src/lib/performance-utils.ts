/**
 * EduPilot - Performance Monitoring & Optimization Utilities
 */

import { logger } from "@/lib/utils/logger";

// ─── Performance Metrics ─────────────────────────────────────────

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Mesurer la performance d'une fonction
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.recordMetric({
        name,
        duration,
        timestamp: Date.now(),
        metadata,
      });

      // Log slow operations (>1 second)
      if (duration > 1000) {
        logger.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`, metadata);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`[Performance] Operation failed: ${name} after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Obtenir les statistiques de performance
   */
  getStats(name?: string) {
    const filtered = name
      ? this.metrics.filter((m) => m.name === name)
      : this.metrics;

    if (filtered.length === 0) {
      return null;
    }

    const durations = filtered.map((m) => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    // Calculate percentiles
    const sorted = durations.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      name: name || "all",
      count: filtered.length,
      avg: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
    };
  }

  /**
   * Réinitialiser les métriques
   */
  reset() {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ─── Database Query Optimization ─────────────────────────────────

/**
 * Optimiser une requête Prisma avec les best practices
 */
export function optimizePrismaQuery<T>(queryBuilder: T): T {
  // Les optimisations sont déjà appliquées au niveau du type
  // Cette fonction sert de documentation et de point d'extension futur
  return queryBuilder;
}

/**
 * Batch multiple database operations
 */
export async function batchDatabaseOperations<T>(
  operations: Array<() => Promise<T>>,
  batchSize = 10
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((op) => op()));
    results.push(...batchResults);
  }

  return results;
}

// ─── Response Compression ────────────────────────────────────────

/**
 * Vérifier si la réponse doit être compressée
 */
export function shouldCompress(contentType: string, size: number): boolean {
  const compressibleTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
  ];

  const isCompressible = compressibleTypes.some((type) =>
    contentType.startsWith(type)
  );

  // Only compress if > 1KB
  return isCompressible && size > 1024;
}

// ─── Image Optimization Helpers ──────────────────────────────────

/**
 * Générer les paramètres optimisés pour next/image
 */
export function getOptimizedImageProps(
  src: string,
  alt: string,
  size: "small" | "medium" | "large" | "full" = "medium"
) {
  const sizes = {
    small: { width: 256, height: 256, sizes: "256px" },
    medium: { width: 512, height: 512, sizes: "512px" },
    large: { width: 1024, height: 1024, sizes: "1024px" },
    full: { width: 1920, height: 1080, sizes: "100vw" },
  };

  const config = sizes[size];

  return {
    src,
    alt,
    width: config.width,
    height: config.height,
    sizes: config.sizes,
    loading: "lazy" as const,
    placeholder: "blur" as const,
    quality: 85,
  };
}

// ─── API Response Optimization ───────────────────────────────────

/**
 * Optimiser une réponse API pour réduire la taille
 */
export function optimizeAPIResponse<T extends Record<string, unknown>>(
  data: T,
  fields?: string[]
): Partial<T> {
  if (!fields || fields.length === 0) {
    return data;
  }

  const optimized: Partial<T> = {};

  for (const field of fields) {
    if (field in data) {
      optimized[field as keyof T] = data[field];
    }
  }

  return optimized;
}

/**
 * Paginer des résultats
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: items.slice(start, end),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ─── Bundle Size Optimization ────────────────────────────────────

/**
 * Dynamic import wrapper avec error handling
 */
export async function lazyImport<T>(
  importFn: () => Promise<{ default: T }>
): Promise<T> {
  try {
    const module = await importFn();
    return module.default;
  } catch (error) {
    logger.error("[Performance] Lazy import failed", error);
    throw error;
  }
}

// ─── Memory Optimization ─────────────────────────────────────────

/**
 * Nettoyer les objets volumineux en mémoire
 */
export function cleanupLargeObjects<T>(obj: T): void {
  if (obj && typeof obj === "object") {
    Object.keys(obj).forEach((key) => {
      delete (obj as Record<string, unknown>)[key];
    });
  }
}

/**
 * Limiter la taille d'un tableau
 */
export function limitArraySize<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) {
    return arr;
  }
  return arr.slice(0, maxSize);
}
