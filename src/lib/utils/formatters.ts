/**
 * Fonctions de formatage centralisées pour l'application.
 * Utilise le locale fr-FR par défaut.
 */

/** Format court : "12 janv. 2026" */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

/** Format numérique : "12/01/2026" */
export function formatDateNumeric(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr));
}

/** Format long : "lundi 12 janvier" (pour calendrier/cantine) */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(dateStr));
}

/** Format court avec heure : "12 janv. 2026, 14:30" */
export function formatDateTimeShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

/** Format long avec heure : "12 janvier 2026, 14:30" */
export function formatDateTimeLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

/** Format heure seule : "14:30:05" */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateStr));
}

/** Format taille de fichier : "1.2 MB" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
