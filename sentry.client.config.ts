/**
 * Sentry client (navigateur) — chargé automatiquement par @sentry/nextjs au build.
 */
import { initSentryClient } from "@/lib/monitoring/sentry-client";

initSentryClient();