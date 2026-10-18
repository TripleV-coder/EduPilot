import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { resolveFinanceSchool } from "@/lib/finance/finance-scope";
import { ensureOpenChart } from "@/lib/accounting/ensure-chart";
import { Permission } from "@/lib/rbac/permissions";

/** Ouvre l'exercice et charge le plan SYSCOHADA (classes 1 à 8). */
export const POST = createApiHandler(
    async (_request, { session }) => {
        // S6 : école active vérifiée (existence, périmètre) et accès audité
        const scope = await resolveFinanceSchool(session, null, "accounting:fiscal-year");
        if (!scope.ok) return scope.response;
        const schoolId = scope.schoolId;

        await ensureOpenChart(prisma, schoolId);

        const fiscalYear = await prisma.fiscalYear.findFirst({
            where: { schoolId, status: "OPEN" },
            orderBy: { startDate: "desc" },
            select: { id: true, label: true, status: true },
        });

        return NextResponse.json({ fiscalYear });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
        requiredPermissions: [Permission.SCHOOL_READ],
    },
);
