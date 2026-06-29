import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/access-control/logs
 * Journal des passages récents (50 derniers) + métriques du jour.
 */
export const GET = createApiHandler(
    async (_request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [logs, todayTotal, todayRefused] = await Promise.all([
            prisma.scanLog.findMany({
                where: { schoolId },
                orderBy: { createdAt: "desc" },
                take: 50,
                include: {
                    scanPoint: { select: { name: true, type: true } },
                    student: { select: { matricule: true, user: { select: { firstName: true, lastName: true } } } },
                },
            }),
            prisma.scanLog.count({ where: { schoolId, createdAt: { gte: startOfDay } } }),
            prisma.scanLog.count({ where: { schoolId, createdAt: { gte: startOfDay }, result: "REFUSED" } }),
        ]);

        const entries = logs.map((l) => ({
            id: l.id,
            time: l.createdAt.toISOString(),
            name: l.student ? `${l.student.user.firstName} ${l.student.user.lastName}` : (l.matricule ?? "Inconnu"),
            matricule: l.student?.matricule ?? l.matricule ?? null,
            point: l.scanPoint?.name ?? "—",
            action: l.action,
            result: l.result,
            refused: l.result === "REFUSED",
        }));

        return NextResponse.json({
            logs: entries,
            metrics: { todayTotal, todayRefused, todayOk: todayTotal - todayRefused },
        });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_READ],
    }
);
