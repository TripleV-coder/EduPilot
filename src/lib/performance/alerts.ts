/**
 * Performance Alerts System
 * Monitors performance metrics and triggers alerts when thresholds are exceeded
 */

import { logger } from "@/lib/utils/logger";

export interface PerformanceThresholds {
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint (ms)
  ttfb?: number; // Time to First Byte (ms)
  inp?: number; // Interaction to Next Paint (ms)
  apiResponseTime?: number; // Average API response time (ms)
  errorRate?: number; // Error rate percentage
  cacheHitRate?: number; // Cache hit rate percentage (minimum)
}

export interface PerformanceMetrics {
  webVitals?: {
    lcp?: { value: number; rating: string };
    fid?: { value: number; rating: string };
    cls?: { value: number; rating: string };
    fcp?: { value: number; rating: string };
    ttfb?: { value: number; rating: string };
    inp?: { value: number; rating: string };
  };
  apiPerformance?: {
    averageResponseTime?: number;
    errorRate?: number;
    cacheHitRate?: number;
  };
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: 2500, // Good: < 2500ms, Needs improvement: 2500-4000ms, Poor: > 4000ms
  fid: 100, // Good: < 100ms, Needs improvement: 100-300ms, Poor: > 300ms
  cls: 0.1, // Good: < 0.1, Needs improvement: 0.1-0.25, Poor: > 0.25
  fcp: 1800, // Good: < 1800ms, Needs improvement: 1800-3000ms, Poor: > 3000ms
  ttfb: 800, // Good: < 800ms, Needs improvement: 800-1800ms, Poor: > 1800ms
  inp: 200, // Good: < 200ms, Needs improvement: 200-500ms, Poor: > 500ms
  apiResponseTime: 500, // Alert if average > 500ms
  errorRate: 5, // Alert if error rate > 5%
  cacheHitRate: 70, // Alert if cache hit rate < 70%
};

export interface Alert {
  type: "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

/**
 * Check performance metrics against thresholds
 */
export function checkPerformanceThresholds(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): Alert[] {
  const alerts: Alert[] = [];

  // Check Web Vitals
  if (metrics.webVitals) {
    const { lcp, fid, cls, fcp, ttfb, inp } = metrics.webVitals;

    if (lcp && thresholds.lcp && lcp.value > thresholds.lcp) {
      alerts.push({
        type: lcp.value > thresholds.lcp * 1.6 ? "critical" : "warning",
        metric: "LCP",
        value: lcp.value,
        threshold: thresholds.lcp,
        message: `LCP (${lcp.value}ms) exceeds threshold (${thresholds.lcp}ms)`,
        timestamp: new Date(),
      });
    }

    if (fid && thresholds.fid && fid.value > thresholds.fid) {
      alerts.push({
        type: fid.value > thresholds.fid * 3 ? "critical" : "warning",
        metric: "FID",
        value: fid.value,
        threshold: thresholds.fid,
        message: `FID (${fid.value}ms) exceeds threshold (${thresholds.fid}ms)`,
        timestamp: new Date(),
      });
    }

    if (cls && thresholds.cls && cls.value > thresholds.cls) {
      alerts.push({
        type: cls.value > thresholds.cls * 2.5 ? "critical" : "warning",
        metric: "CLS",
        value: cls.value,
        threshold: thresholds.cls,
        message: `CLS (${cls.value}) exceeds threshold (${thresholds.cls})`,
        timestamp: new Date(),
      });
    }

    if (fcp && thresholds.fcp && fcp.value > thresholds.fcp) {
      alerts.push({
        type: fcp.value > thresholds.fcp * 1.67 ? "critical" : "warning",
        metric: "FCP",
        value: fcp.value,
        threshold: thresholds.fcp,
        message: `FCP (${fcp.value}ms) exceeds threshold (${thresholds.fcp}ms)`,
        timestamp: new Date(),
      });
    }

    if (ttfb && thresholds.ttfb && ttfb.value > thresholds.ttfb) {
      alerts.push({
        type: ttfb.value > thresholds.ttfb * 2.25 ? "critical" : "warning",
        metric: "TTFB",
        value: ttfb.value,
        threshold: thresholds.ttfb,
        message: `TTFB (${ttfb.value}ms) exceeds threshold (${thresholds.ttfb}ms)`,
        timestamp: new Date(),
      });
    }

    if (inp && thresholds.inp && inp.value > thresholds.inp) {
      alerts.push({
        type: inp.value > thresholds.inp * 2.5 ? "critical" : "warning",
        metric: "INP",
        value: inp.value,
        threshold: thresholds.inp,
        message: `INP (${inp.value}ms) exceeds threshold (${thresholds.inp}ms)`,
        timestamp: new Date(),
      });
    }
  }

  // Check API Performance
  if (metrics.apiPerformance) {
    const { averageResponseTime, errorRate, cacheHitRate } = metrics.apiPerformance;

    if (averageResponseTime !== undefined && thresholds.apiResponseTime && averageResponseTime > thresholds.apiResponseTime) {
      alerts.push({
        type: averageResponseTime > thresholds.apiResponseTime * 2 ? "critical" : "warning",
        metric: "API Response Time",
        value: averageResponseTime,
        threshold: thresholds.apiResponseTime,
        message: `Average API response time (${averageResponseTime}ms) exceeds threshold (${thresholds.apiResponseTime}ms)`,
        timestamp: new Date(),
      });
    }

    if (errorRate !== undefined && thresholds.errorRate && errorRate > thresholds.errorRate) {
      alerts.push({
        type: errorRate > thresholds.errorRate * 2 ? "critical" : "warning",
        metric: "Error Rate",
        value: errorRate,
        threshold: thresholds.errorRate,
        message: `Error rate (${errorRate}%) exceeds threshold (${thresholds.errorRate}%)`,
        timestamp: new Date(),
      });
    }

    if (cacheHitRate !== undefined && thresholds.cacheHitRate && cacheHitRate < thresholds.cacheHitRate) {
      alerts.push({
        type: cacheHitRate < thresholds.cacheHitRate * 0.7 ? "critical" : "warning",
        metric: "Cache Hit Rate",
        value: cacheHitRate,
        threshold: thresholds.cacheHitRate,
        message: `Cache hit rate (${cacheHitRate}%) below threshold (${thresholds.cacheHitRate}%)`,
        timestamp: new Date(),
      });
    }
  }

  return alerts;
}

/**
 * Log performance alerts
 */
export function logPerformanceAlerts(alerts: Alert[]): void {
  if (alerts.length === 0) return;

  const criticalAlerts = alerts.filter((a) => a.type === "critical");
  const warningAlerts = alerts.filter((a) => a.type === "warning");

  if (criticalAlerts.length > 0) {
    logger.error("Performance critical alerts detected", {
      alerts: criticalAlerts,
      module: "performance",
    });
  }

  if (warningAlerts.length > 0) {
    logger.warn("Performance warning alerts detected", {
      alerts: warningAlerts,
      module: "performance",
    });
  }
}

/**
 * Send performance alerts (log + email si PERFORMANCE_ALERT_EMAIL + Slack si SLACK_WEBHOOK_URL)
 */
export async function sendPerformanceAlerts(alerts: Alert[]): Promise<void> {
  if (alerts.length === 0) return;

  // Log alerts
  logPerformanceAlerts(alerts);

  // Notifications externes (email + Slack)
  try {
    const { dispatchPerformanceAlertNotifications } = await import("./alert-notifications");
    await dispatchPerformanceAlertNotifications(alerts);
  } catch (error) {
    logger.error("Error dispatching performance alert notifications", error as Error, { module: "performance" });
  }

  logger.info("Performance alerts processed", {
    count: alerts.length,
    critical: alerts.filter((a) => a.type === "critical").length,
    warnings: alerts.filter((a) => a.type === "warning").length,
    module: "performance",
  });
}
