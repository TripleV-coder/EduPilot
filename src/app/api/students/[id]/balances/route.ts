import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { computeStudentBalances } from "@/lib/finance/expected-fees";

/**
 * GET /api/students/[id]/balances
 * Solde de l'élève frais par frais (année courante) : facturé, payé, en
 * attente, reste dû et montant à proposer au guichet.
 */
export const GET = createApiHandler(
    async (_request, context) => {
        const { id } = await context.params;
        const { session } = context;

        const student = await prisma.studentProfile.findUnique({
            where: { id },
            select: { id: true, schoolId: true },
        });
        if (!student) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }
        if (!canAccessSchool(session, student.schoolId)) {
            return NextResponse.json({ error: "Accès inter-établissement interdit" }, { status: 403 });
        }

        return NextResponse.json({ balances: await computeStudentBalances(student.id) });
    },
    {
        requireAuth: true,
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
    },
);
