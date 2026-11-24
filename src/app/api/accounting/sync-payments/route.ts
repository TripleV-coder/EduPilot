import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { resolveFinanceSchool } from "@/lib/finance/finance-scope";
import { lockStudentFee } from "@/lib/finance/online-payments";
import { backfillSchoolAccounting } from "@/lib/accounting/payment-posting";

/**
 * POST /api/accounting/sync-payments — FIN-04 : passe au journal les
 * paiements de frais de l'école qui n'y figurent pas encore (historique
 * antérieur au 2026-11-24, ou rattrapage après incident). Idempotent : un
 * second lancement n'écrit rien. Chaque couple élève/frais est traité sous son
 * verrou, dans sa propre transaction (pas de transaction géante).
 */
export const POST = createApiHandler(
    async (_request, context) => {
        const scope = await resolveFinanceSchool(context.session, null, "accounting:sync-payments");
        if (!scope.ok) return scope.response;
        const schoolId = scope.schoolId;

        const result = await backfillSchoolAccounting(
            (pair, fn) =>
                prisma.$transaction(
                    async (tx) => {
                        await lockStudentFee(tx, pair.studentId, pair.feeId);
                        return fn(tx);
                    },
                    { timeout: 30_000, maxWait: 10_000 },
                ),
            async () => {
                const rows = await prisma.payment.findMany({
                    where: { fee: { schoolId } },
                    select: { studentId: true, feeId: true },
                    distinct: ["studentId", "feeId"],
                });
                return rows;
            },
        );
        await prisma.auditLog.create({
            data: {
                userId: context.session.user.id,
                action: "ACCOUNTING_PAYMENTS_SYNCED",
                entity: "School",
                entityId: schoolId,
                newValues: result,
            },
        });
        return NextResponse.json(result);
    },
    { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
