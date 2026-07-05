import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";

/**
 * GET /api/staff — liste des membres du personnel actifs de l'établissement.
 * Sert de source aux sélecteurs RH (présence, paie). Gestionnaires uniquement.
 */
export const GET = createApiHandler(
    async (_request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const staff = await prisma.user.findMany({
            where: { schoolId, isActive: true, role: { in: STAFF_MEMBER_ROLES } },
            select: { id: true, firstName: true, lastName: true, role: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        return NextResponse.json({
            staff: staff.map((s) => ({
                userId: s.id,
                name: `${s.firstName} ${s.lastName}`.trim(),
                role: s.role,
            })),
        });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
