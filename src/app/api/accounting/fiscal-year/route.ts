import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { ensureOpenChart } from "@/lib/accounting/ensure-chart";
import { Permission } from "@/lib/rbac/permissions";

/** Ouvre l'exercice et charge le plan SYSCOHADA (classes 1 à 8). */
export const POST = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        }

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
