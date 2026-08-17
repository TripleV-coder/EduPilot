/**
 * Sentry Monitoring Configuration
 * Error tracking and performance monitoring
 * — init séparé par runtime (serveur nodejs / edge) ; l'initialisation
 *   client vit dans ./sentry-client.ts.
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/utils/logger";

/**
 * Configuration partagée (DSN + filtrage des données sensibles).
 */
export const buildSentryConfig = {
  dsn(client = false): string | null {
    const dsn = client
      ? process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
      : process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    return dsn || null;
  },

  base(dsn: string) {
    return {
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend: buildBeforeSend(),
    };
  },
};

/**
 * Filtre les données sensibles avant envoi à Sentry.
 */
function buildBeforeSend() {
  return (event: unknown, _hint: unknown) => {
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
  };
}

/**
 * Initialise Sentry côté serveur Node.js (route handlers, instrumentation).
 */
export function initSentryServer() {
  const dsn = buildSentryConfig.dsn();
  if (!dsn) {
    logger.warn("Sentry DSN not configured, server monitoring disabled", { module: "monitoring/sentry" });
    return;
  }

  Sentry.init({
    ...buildSentryConfig.base(dsn),
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

/**
 * Initialise Sentry côté runtime Edge (proxy / middleware).
 */
export function initSentryEdge() {
  const dsn = buildSentryConfig.dsn();
  if (!dsn) return;

  Sentry.init({
    ...buildSentryConfig.base(dsn),
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, unknown>) {
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
export function addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = "info", data?: Record<string, unknown>) {
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