import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { ONLINE_UNAVAILABLE_MESSAGE, resolveCollectingAccount } from "@/lib/payments/school-accounts";

/**
 * GET /api/payments/online-status[?studentId=] — le paiement en ligne est-il
 * possible ? (S7, ADR-0011)
 *
 * La réponse dépend de l'ÉCOLE concernée, jamais d'une configuration globale :
 * il faut un compte marchand FedaPay actif, valide et déchiffrable de cette
 * école dans l'environnement autorisé. Parent ou élève : pour l'enfant demandé
 * (lien vérifié), sinon pour chacun de ses enfants ; personnel : école active.
 * Ne révèle ni le compte ni la raison technique d'une indisponibilité.
 */
type SchoolAvailability = { studentId?: string; schoolId: string; available: boolean };

export const GET = createApiHandler(
    async (request, { session }) => {
        const requestedStudent = new URL(request.url).searchParams.get("studentId");
        const ownIds = await getOwnStudentIds(session.user.role, session.user.id);

        let targets: Array<{ studentId?: string; schoolId: string }>;
        if (ownIds) {
            const ids = requestedStudent ? ownIds.filter((id) => id === requestedStudent) : ownIds;
            if (requestedStudent && ids.length === 0) {
                return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
            }
            const students = await prisma.studentProfile.findMany({ where: { id: { in: ids } }, select: { id: true, schoolId: true } });
            targets = students.map((s) => ({ studentId: s.id, schoolId: s.schoolId }));
        } else {
            const schoolId = getActiveSchoolId(session);
            if (!schoolId || !canAccessSchool(session, schoolId)) {
                return NextResponse.json({ available: false, schools: [], message: ONLINE_UNAVAILABLE_MESSAGE });
            }
            targets = [{ schoolId }];
        }

        const bySchool = new Map<string, boolean>();
        const schools: SchoolAvailability[] = [];
        for (const target of targets) {
            if (!bySchool.has(target.schoolId)) {
                bySchool.set(target.schoolId, (await resolveCollectingAccount(prisma, target.schoolId)).ok);
            }
            schools.push({ ...target, available: bySchool.get(target.schoolId)! });
        }
        const available = schools.length > 0 && schools.every((s) => s.available);
        return NextResponse.json({
            available,
            schools,
            message: available
                ? "Le paiement en ligne (Mobile Money via FedaPay) est disponible pour régler les frais."
                : ONLINE_UNAVAILABLE_MESSAGE,
        });
    },
    { allowedRoles: ["PARENT", "STUDENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
