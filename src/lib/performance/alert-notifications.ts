/**
 * Performance Alert Notifications
 * Envoi des alertes performance par email et/ou Slack
 */

import { logger } from "@/lib/utils/logger";
import type { Alert } from "./alerts";

const PERFORMANCE_ALERT_EMAIL = process.env.PERFORMANCE_ALERT_EMAIL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function formatAlertsSummary(alerts: Alert[]): string {
  const critical = alerts.filter((a) => a.type === "critical");
  const warning = alerts.filter((a) => a.type === "warning");
  const lines = [
    `Alertes performance EduPilot (${new Date().toLocaleString("fr-FR")})`,
    "",
    critical.length > 0 ? `Critiques (${critical.length}):` : "",
    ...critical.map((a) => `  • ${a.metric}: ${a.message}`),
    warning.length > 0 ? `\nAvertissements (${warning.length}):` : "",
    ...warning.map((a) => `  • ${a.metric}: ${a.message}`),
  ].filter(Boolean);
  return lines.join("\n");
}

function formatAlertsHtml(alerts: Alert[]): string {
  const critical = alerts.filter((a) => a.type === "critical");
  const warning = alerts.filter((a) => a.type === "warning");
  const rows = [
    ...critical.map((a) => `<tr><td style="color:#ef4444">Critique</td><td>${a.metric}</td><td>${a.message}</td></tr>`),
    ...warning.map((a) => `<tr><td style="color:#f59e0b">Avertissement</td><td>${a.metric}</td><td>${a.message}</td></tr>`),
  ].join("");
  return `
    <h2>Alertes performance EduPilot</h2>
    <p>Date : ${new Date().toLocaleString("fr-FR")}</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse">
      <thead><tr><th>Niveau</th><th>Métrique</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/**
 * Envoi des alertes par email (si PERFORMANCE_ALERT_EMAIL configuré)
 */
export async function sendPerformanceAlertsByEmail(alerts: Alert[]): Promise<void> {
  if (!PERFORMANCE_ALERT_EMAIL || alerts.length === 0) return;

  try {
    const { sendEmail } = await import("@/lib/email");
    const subject = `[EduPilot] ${alerts.filter((a) => a.type === "critical").length > 0 ? "CRITIQUE" : "Alerte"} - ${alerts.length} alerte(s) performance`;
    const text = formatAlertsSummary(alerts);
    const html = formatAlertsHtml(alerts);

    const sent = await sendEmail({
      to: PERFORMANCE_ALERT_EMAIL,
      subject,
      html,
      text,
    });

    if (sent) {
      logger.info("Performance alerts email sent", { to: PERFORMANCE_ALERT_EMAIL, count: alerts.length, module: "performance" });
    }
  } catch (error) {
    logger.error("Failed to send performance alerts email", error as Error, { module: "performance" });
  }
}

/**
 * Envoi des alertes vers Slack (si SLACK_WEBHOOK_URL configuré)
 */
export async function sendPerformanceAlertsToSlack(alerts: Alert[]): Promise<void> {
  if (!SLACK_WEBHOOK_URL || alerts.length === 0) return;

  try {
    const critical = alerts.filter((a) => a.type === "critical");
    const _warning = alerts.filter((a) => a.type === "warning");
    const color = critical.length > 0 ? "#ef4444" : "#f59e0b";
    const text = formatAlertsSummary(alerts);

    const payload = {
      attachments: [
        {
          color,
          title: `Alertes performance EduPilot (${new Date().toLocaleString("fr-FR")})`,
          text,
          footer: "EduPilot Performance",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Slack webhook failed: ${res.status}`);
    }

    logger.info("Performance alerts sent to Slack", { count: alerts.length, module: "performance" });
  } catch (error) {
    logger.error("Failed to send performance alerts to Slack", error as Error, { module: "performance" });
  }
}

/**
 * Envoi des alertes via tous les canaux configurés (email + Slack)
 */
export async function dispatchPerformanceAlertNotifications(alerts: Alert[]): Promise<void> {
  if (alerts.length === 0) return;

  await Promise.allSettled([
    sendPerformanceAlertsByEmail(alerts),
    sendPerformanceAlertsToSlack(alerts),
  ]);
}
