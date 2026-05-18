import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { logger } from "@/lib/utils/logger";

export type AuditValue = Record<string, unknown> | unknown[] | null | undefined;

export interface AuditLogData {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: AuditValue;
    newValues?: AuditValue;
    severity?: "INFO" | "WARNING" | "CRITICAL";
}

/**
 * Expulse les champs sensibles des objets logs
 */
function sanitizeAuditData(data: AuditValue): AuditValue {
    if (data === null || data === undefined) return data;
    if (typeof data !== "object") return data;

    const SENSITIVE_FIELDS = ["password", "token", "secret", "twoFactorSecret", "twoFactorBackupCodes", "tempPassword"];

    if (Array.isArray(data)) {
        return data.map((item) =>
            sanitizeAuditData(item as AuditValue),
        ) as unknown[];
    }

    const sanitized: Record<string, unknown> = { ...(data as Record<string, unknown>) };

    for (const key of Object.keys(sanitized)) {
        if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = "[PROTECTED]";
        } else if (sanitized[key] !== null && typeof sanitized[key] === "object") {
            sanitized[key] = sanitizeAuditData(sanitized[key] as AuditValue);
        }
    }

    return sanitized;
}

export async function createAuditLog(data: AuditLogData) {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] ||
        headersList.get("x-real-ip") ||
        "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    try {
        const sanitizedOld = sanitizeAuditData(data.oldValues);
        const sanitizedNewBase = sanitizeAuditData(data.newValues);
        const newValuesWithSeverity =
            sanitizedNewBase &&
            typeof sanitizedNewBase === "object" &&
            !Array.isArray(sanitizedNewBase)
                ? { ...(sanitizedNewBase as Record<string, unknown>), severity: data.severity || "INFO" }
                : { severity: data.severity || "INFO" };

        await prisma.auditLog.create({
            data: {
                userId: data.userId || "SYSTEM",
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                oldValues: (sanitizedOld ?? undefined) as Prisma.InputJsonValue | undefined,
                newValues: newValuesWithSeverity as Prisma.InputJsonValue,
                ipAddress: ip,
                userAgent: userAgent,
            },
        });
    } catch (error) {
        logger.error("Failed to create audit log", error instanceof Error ? error : new Error(String(error)), { module: "security/audit-log" });
    }
}

export const auditLog = {
    login: (userId: string, success: boolean) =>
        createAuditLog({
            userId,
            action: success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
            entity: "AUTH",
            severity: success ? "INFO" : "WARNING",
        }),

    dataAccess: (userId: string, entity: string, entityId: string) =>
        createAuditLog({
            userId,
            action: "DATA_ACCESS",
            entity,
            entityId,
            severity: "INFO",
        }),

    dataModification: (
        userId: string,
        entity: string,
        entityId: string,
        oldValues: AuditValue,
        newValues: AuditValue,
    ) =>
        createAuditLog({
            userId,
            action: "DATA_MODIFICATION",
            entity,
            entityId,
            severity: "WARNING",
            oldValues,
            newValues,
        }),

    deletion: (userId: string, entity: string, entityId: string) =>
        createAuditLog({
            userId,
            action: "DATA_DELETION",
            entity,
            entityId,
            severity: "CRITICAL",
        }),

    securityEvent: (
        userId: string | undefined,
        event: string,
        details: Record<string, unknown>,
    ) =>
        createAuditLog({
            userId,
            action: "SECURITY_EVENT",
            entity: "SECURITY",
            severity: "CRITICAL",
            newValues: { event, ...details },
        }),
};
