/**
 * Sentry serveur (runtime Node.js) — chargé automatiquement par @sentry/nextjs au build.
 */
import { initSentryServer } from "@/lib/monitoring/sentry";

initSentryServer();