/**
 * Performance Optimization Utilities
 */

interface PerformanceMetrics {
  navigationTiming: {
    pageLoadTime: number;
    domContentLoadedTime: number;
  };
  resourceTiming: {
    largestResourceTime: number;
    averageResourceSize: number;
  };
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Throttle function to limit function frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Request Animation Frame based throttle for smooth animations
 */
export function requestAnimationFrameThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number;

  return function (...args: Parameters<T>) {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      func(...args);
    });
  };
}

/**
 * Measure performance of a function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (typeof window !== "undefined") {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
}

/**
 * Get page performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics | null {
  if (typeof window === "undefined") return null;

  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming;
  const resources = performance.getEntriesByType("resource");

  if (!navigation) return null;

  const metrics: PerformanceMetrics = {
    navigationTiming: {
      pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoadedTime:
        navigation.domContentLoadedEventEnd - navigation.fetchStart,
    },
    resourceTiming: {
      largestResourceTime: Math.max(
        ...resources.map((r) => r.duration),
        0
      ),
      averageResourceSize:
        resources.reduce((sum, r) => sum + (r as PerformanceResourceTiming).transferSize, 0) /
        resources.length,
    },
  };

  // Memory metrics if available
  if ((performance as any).memory) {
    metrics.memory = {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
    };
  }

  return metrics;
}

/**
 * Setup performance monitoring
 */
export function setupPerformanceMonitoring() {
  if (typeof window === "undefined") return;

  // Monitor Core Web Vitals
  if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`[CWV] ${entry.name}: ${(entry as any).value}ms`);
      }
    });

    try {
      observer.observe({ entryTypes: ["paint", "largest-contentful-paint"] });
    } catch (_e) {
      // Silently fail if not supported
    }
  }

  // Log metrics when page unloads
  window.addEventListener("unload", () => {
    const metrics = getPerformanceMetrics();
    if (metrics) {
      console.table(metrics);
    }
  });
}

/**
 * Prefetch resources for better performance
 */
export function prefetchResource(url: string, as: string = "fetch") {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = as;
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Lazy load modules dynamically
 */
export function lazyLoadModule<T = any>(
  moduleLoader: () => Promise<T>
): Promise<T> {
  return moduleLoader();
}

/**
 * Batch multiple operations to reduce reflows
 */
export function batchDOM(fn: () => void) {
  if (typeof window === "undefined") {
    fn();
    return;
  }

  requestAnimationFrame(() => {
    fn();
  });
}

/**
 * Optimize image with srcset
 */
export function generateImageSrcSet(basePath: string, sizes: number[]): string {
  return sizes
    .map((size) => `${basePath}?w=${size} ${size}w`)
    .join(", ");
}
