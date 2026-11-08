/**
 * Alertes de performance → super-administrateurs (notification instantanée
 * dans l'application + e-mail), via monitoring/admin-alerts (2026-11-08).
 * Remplace PERFORMANCE_ALERT_EMAIL et SLACK_WEBHOOK_URL : plus rien à
 * configurer. Une alerte par combinaison de métriques et par heure.
 */
import { alertPlatformAdmins, type AlertOutcome } from "@/lib/monitoring/admin-alerts";
import type { Alert } from "./alerts";

export const PERFORMANCE_ALERT_THROTTLE_MS = 60 * 60_000;

export function formatAlertsSummary(alerts: Alert[]): string {
  const critical = alerts.filter((a) => a.type === "critical");
  const warning = alerts.filter((a) => a.type === "warning");
  return [
    critical.length > 0 ? `Critiques (${critical.length}) : ${critical.map((a) => `${a.metric} — ${a.message}`).join(" ; ")}` : "",
    warning.length > 0 ? `Avertissements (${warning.length}) : ${warning.map((a) => `${a.metric} — ${a.message}`).join(" ; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function dispatchPerformanceAlertNotifications(alerts: Alert[]): Promise<AlertOutcome | null> {
  if (alerts.length === 0) return null;
  const metrics = [...new Set(alerts.map((a) => `${a.type}:${a.metric}`))].sort().join(",");
  const critical = alerts.some((a) => a.type === "critical");
  return alertPlatformAdmins({
    key: `perf:${metrics}`,
    title: critical ? "Performance dégradée (critique)" : "Performance à surveiller",
    message: formatAlertsSummary(alerts),
    link: "/dashboard/root-control/monitoring",
    throttleMs: PERFORMANCE_ALERT_THROTTLE_MS,
  });
}
