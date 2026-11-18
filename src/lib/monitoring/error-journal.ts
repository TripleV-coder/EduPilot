/**
 * Journal des erreurs serveur et navigateur (2026-11-08) — remplace Sentry
 * (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SDK @sentry/nextjs).
 *
 * Plus complet que l'ancien branchement : Sentry ne voyait que les erreurs de
 * rendu non interceptées ; ce journal reçoit aussi les erreurs 500 des
 * routes API (createApiHandler) et les erreurs affichées dans le navigateur.
 *
 * - Table `error_logs` (consultée dans Supervision), purgée après 30 jours.
 * - Empreinte stable (source + message sans nombres ni identifiants +
 *   chemin) : regroupement, et UNE alerte aux super-administrateurs par
 *   erreur distincte et par 30 min (admin-alerts).
 * - Volume borné : 60 enregistrements par minute et par processus au plus —
 *   une avalanche d'erreurs ne sature pas la base qu'elle signale.
 * - Aucune donnée personnelle : pas de chaîne de requête, pas de corps,
 *   textes tronqués. Ne lève jamais.
 */
import { createHash } from "node:crypto";
import { prismaBase } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { alertPlatformAdmins } from "./admin-alerts";

export type ErrorSource = "server" | "client";

export interface ErrorReport {
    source: ErrorSource;
    message: string;
    stack?: string | null;
    path?: string | null;
    digest?: string | null;
    userId?: string | null;
}

export const MAX_ERRORS_PER_MINUTE = 60;
export const ERROR_RETENTION_DAYS = 30;

let windowStart = 0;
let windowCount = 0;
let dropped = 0;

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

/** Chemin sans chaîne de requête, identifiants remplacés (regroupement stable). */
export function normalizePath(path: string | null | undefined): string | null {
    if (!path) return null;
    const bare = path.split("?")[0].split("#")[0];
    return bare.replace(/\/(?:c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)(?=\/|$)/gi, "/:id").slice(0, 300);
}

export function errorFingerprint(report: Pick<ErrorReport, "source" | "message" | "path">): string {
    const firstLine = report.message.split("\n")[0].replace(/c[a-z0-9]{20,}/gi, ":id").replace(/\d+/g, "#").trim();
    return createHash("sha256")
        .update(`${report.source}|${firstLine}|${normalizePath(report.path) ?? ""}`)
        .digest("hex")
        .slice(0, 16);
}

/** Vrai si l'enregistrement tient dans le quota de la minute en cours. */
function withinQuota(now: number): boolean {
    if (now - windowStart >= 60_000) {
        if (dropped > 0) logger.warn("Erreurs non journalisées (quota par minute atteint)", { module: "monitoring/errors", dropped });
        windowStart = now;
        windowCount = 0;
        dropped = 0;
    }
    if (windowCount >= MAX_ERRORS_PER_MINUTE) {
        dropped += 1;
        return false;
    }
    windowCount += 1;
    return true;
}

export async function recordError(report: ErrorReport): Promise<void> {
    try {
        if (!withinQuota(Date.now())) return;
        const message = clip(report.message.trim() || "Erreur sans message", 500)!;
        const path = normalizePath(report.path);
        const fingerprint = errorFingerprint({ ...report, message });
        await prismaBase.errorLog.create({
            data: {
                source: report.source,
                message,
                fingerprint,
                path,
                digest: clip(report.digest, 100),
                stack: clip(report.stack, 4000),
                userId: clip(report.userId, 40),
            },
        });
        await alertPlatformAdmins({
            key: `error:${fingerprint}`,
            title: report.source === "server" ? "Erreur serveur" : "Erreur dans le navigateur",
            message: `${message}${path ? ` (${path})` : ""}`,
        });
    } catch (error) {
        // Le journal lui-même ne doit jamais provoquer d'erreur en cascade
        logger.warn("Erreur non journalisée", {
            module: "monitoring/errors",
            reason: error instanceof Error ? error.message : String(error),
        });
    }
}

/** Erreur quelconque (Error, chaîne, objet) → rapport serveur. */
export function serverErrorReport(error: unknown, path?: string | null, userId?: string | null): ErrorReport {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error ?? null));
    return {
        source: "server",
        message: `${err.name}: ${err.message}`,
        stack: err.stack ?? null,
        path: path ?? null,
        digest: (error as { digest?: string } | null)?.digest ?? null,
        userId: userId ?? null,
    };
}

/** Purge quotidienne (maintenance automatique). */
export async function purgeOldErrors(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - ERROR_RETENTION_DAYS * 24 * 60 * 60_000);
    const { count } = await prismaBase.errorLog.deleteMany({ where: { createdAt: { lt: before } } });
    return count;
}

/** Pour les tests : remet le quota à zéro. */
export function resetErrorQuotaForTests(): void {
    windowStart = 0;
    windowCount = 0;
    dropped = 0;
}
