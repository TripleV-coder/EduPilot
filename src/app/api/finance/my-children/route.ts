import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { listFamilyChildren } from "@/lib/finance/family-finance";

/**
 * GET /api/finance/my-children — enfants de la famille (liens vérifiés en
 * base), chacun avec SON école et SON reste à payer : jamais de cumul entre
 * enfants ni entre écoles (parcours de paiement parent).
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const ownIds = (await getOwnStudentIds(session.user.role, session.user.id)) ?? [];
        return NextResponse.json({ children: await listFamilyChildren(prisma, ownIds) });
    },
    { allowedRoles: ["PARENT", "STUDENT"] },
);
