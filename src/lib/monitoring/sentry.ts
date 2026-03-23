/**
 * Sentry Monitoring Configuration
 * Error tracking and performance monitoring
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/utils/logger";

/**
 * Initialize Sentry
 */
export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("Sentry DSN not configured, monitoring disabled", { module: "monitoring/sentry" });
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event: unknown, _hint: unknown) {
      // Filter out sensitive data
      const ev = event as { request?: { headers?: Record<string, string>; query_string?: string } };
      if (ev.request) {
        if (ev.request.headers) {
          delete ev.request.headers["authorization"];
          delete ev.request.headers["cookie"];
        }
        if (ev.request.query_string) {
          const params = new URLSearchParams(ev.request.query_string);
          params.delete("token");
          params.delete("password");
          ev.request.query_string = params.toString();
        }
      }
      return event;
    },
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, any>) {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context
 */
export function setUserContext(userId: string, email?: string, role?: string) {
  Sentry.setUser({
    id: userId,
    email,
    role,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = "info", data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Start transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({
    name,
    op,
  });
}
