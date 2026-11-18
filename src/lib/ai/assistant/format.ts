/**
 * Mise en forme française des réponses de l'assistant (notes, taux, FCFA, dates).
 */
import type { Tone } from "./types";

const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const integerFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFr = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function grade(value: number | null | undefined, max = 20): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${numberFr.format(value)}/${max}`;
}

export function percent(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${integerFr.format(Math.round(value))} %`;
}

export function fcfa(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${integerFr.format(Math.round(value))} FCFA`;
}

export function count(value: number, singular: string, plural = `${singular}s`): string {
    return `${integerFr.format(value)} ${value > 1 ? plural : singular}`;
}

/** Date calendaire (stockée à minuit UTC) au format court français. */
export function day(value: Date | string): string {
    return dateFr.format(new Date(value));
}

export const RISK_LABELS: Record<string, string> = {
    LOW: "Faible",
    MEDIUM: "Modéré",
    HIGH: "Élevé",
    CRITICAL: "Critique",
};

export function riskTone(level: string | null | undefined): Tone {
    if (level === "CRITICAL" || level === "HIGH") return "danger";
    if (level === "MEDIUM") return "warning";
    if (level === "LOW") return "success";
    return "neutral";
}

export function gradeTone(value: number | null | undefined, passing: number): Tone {
    if (value === null || value === undefined) return "neutral";
    if (value < passing) return "danger";
    if (value < passing + 2) return "warning";
    return "success";
}

export function firstName(fullName: string): string {
    return fullName.split(" ")[0] || fullName;
}
