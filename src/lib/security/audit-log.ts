import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export interface AuditLogData {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
    severity?: "INFO" | "WARNING" | "CRITICAL";
}

export async function createAuditLog(data: AuditLogData) {
    const headersList = headers();
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
                oldValues: data.oldValues,
                newValues: { ...data.newValues, severity: data.severity || "INFO" },
                ipAddress: ip,
                userAgent: userAgent,
            },
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
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
