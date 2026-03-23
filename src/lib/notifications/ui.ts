export type NotificationUiType =
  | "critical"
  | "academic"
  | "finance"
  | "discipline"
  | "success"
  | "info";

export const NOTIFICATION_FILTERS: Array<{ id: "all" | NotificationUiType; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "critical", label: "Critiques" },
  { id: "academic", label: "Academiques" },
  { id: "finance", label: "Finances" },
  { id: "discipline", label: "Discipline" },
  { id: "success", label: "Succes" },
  { id: "info", label: "Infos" },
];

export function toNotificationUiType(type?: string): NotificationUiType {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "GRADE" || normalized === "BULLETIN") return "academic";
  if (normalized === "PAYMENT") return "finance";
  if (normalized === "ERROR" || normalized === "WARNING") return "critical";
  if (normalized === "SUCCESS") return "success";
  if (normalized === "SYSTEM" || normalized === "INFO" || normalized === "ENROLLMENT") return "info";
  return "info";
}

export function formatNotificationRelativeTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Maintenant";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
