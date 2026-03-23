import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { logger } from "@/lib/utils/logger";

export interface AuditLogData {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
    severity?: "INFO" | "WARNING" | "CRITICAL";
}

/**
 * Expulse les champs sensibles des objets logs
 */
function sanitizeAuditData(data: any): any {
    if (!data || typeof data !== "object") return data;

    const SENSITIVE_FIELDS = ["password", "token", "secret", "twoFactorSecret", "twoFactorBackupCodes", "tempPassword"];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
        if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = "[PROTECTED]";
        } else if (typeof sanitized[key] === "object") {
            sanitized[key] = sanitizeAuditData(sanitized[key]);
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
        await prisma.auditLog.create({
            data: {
                userId: data.userId || "SYSTEM",
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                oldValues: sanitizeAuditData(data.oldValues),
                newValues: { ...sanitizeAuditData(data.newValues), severity: data.severity || "INFO" },
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
        oldValues: any,
        newValues: any
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

    securityEvent: (userId: string | undefined, event: string, details: any) =>
        createAuditLog({
            userId,
            action: "SECURITY_EVENT",
            entity: "SECURITY",
            severity: "CRITICAL",
            newValues: { event, ...details },
        }),
};
