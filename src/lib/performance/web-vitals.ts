"use client";

/**
 * Web Vitals tracking for performance monitoring
 * Tracks Core Web Vitals and sends to analytics
 */
export function reportWebVitals() {
  if (typeof window === "undefined") return;

  function sendToAnalytics(metric: any) {
    // Send to Sentry if available
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.metrics.distribution("web_vitals", metric.value, {
        tags: {
          metric_id: metric.id,
          metric_name: metric.name,
          metric_rating: metric.rating,
        },
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[Web Vitals] ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
      });
    }

    // Send to custom analytics endpoint
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true") {
      fetch("/api/analytics/web-vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metric),
        keepalive: true,
      }).catch(() => {
        // Ignore errors
      });
    }
  }

  // Dynamic import to avoid SSR issues and reduce initial bundle
  // onFID was deprecated in web-vitals v4 in favor of onINP
  import("web-vitals").then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);
  }).catch(() => {
    // Web Vitals not available, skip tracking
  });
}
