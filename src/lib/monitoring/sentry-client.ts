/**
 * Sentry — initialisation CLIENT (navigateur uniquement).
 * Module séparé du fichier principal pour que le bundle edge/serveur
 * ne charge JAMAIS les intégrations navigateur (browserTracing, replay),
 * inexistantes dans les bundles edge de @sentry/nextjs.
 */

import * as Sentry from "@sentry/nextjs";
import { buildSentryConfig } from "./sentry";

/**
 * Initialise Sentry côté client (navigateur) : tracing + replay.
 */
export function initSentryClient() {
  const dsn = buildSentryConfig.dsn(true);
  if (!dsn) return;

  Sentry.init({
    ...buildSentryConfig.base(dsn),
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}