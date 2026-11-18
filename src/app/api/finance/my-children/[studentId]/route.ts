import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { getChildFinance } from "@/lib/finance/family-finance";

/**
 * GET /api/finance/my-children/<élève> — situation financière d'UN enfant :
 * frais applicables (payé, en attente, reste, disponible), échéances,
 * historique et disponibilité du paiement en ligne de SON école.
 *
 * Lien parent → enfant vérifié en base ; tout autre élève, de la même école
 * ou d'une autre : 404, sans rien révéler.
 */
export const GET = createApiHandler(
    async (_request, { session, params }) => {
        const { studentId } = await params;
        const ownIds = (await getOwnStudentIds(session.user.role, session.user.id)) ?? [];
        const notFound = () => NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        if (typeof studentId !== "string" || !ownIds.includes(studentId)) return notFound();
        const finance = await getChildFinance(prisma, studentId);
        return finance ? NextResponse.json(finance) : notFound();
    },
    { allowedRoles: ["PARENT", "STUDENT"] },
);
