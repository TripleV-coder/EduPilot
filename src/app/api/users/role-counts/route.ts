import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/users/role-counts
 * Returns the number of active users per role, scoped to the current school
 * (SUPER_ADMIN sees a global tally).
 */
export const GET = createApiHandler(
    async (_request, { session }, _t) => {
        const schoolId = getActiveSchoolId(session);
        const grouped = await prisma.user.groupBy({
            by: ["role"],
            where: {
                isActive: true,
                ...(session.user.role === "SUPER_ADMIN" || !schoolId
                    ? {}
                    : { schoolId }),
            },
            _count: { _all: true },
        });

        const counts: Record<string, number> = {};
        for (const row of grouped) {
            counts[row.role] = row._count._all;
        }

        return NextResponse.json({ counts });
    },
    {
        requireAuth: true,
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
    },
);
