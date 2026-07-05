import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { buildPayrollJournalLines } from "@/lib/staff/hr";

const patchSchema = z.object({ action: z.enum(["validate", "pay"]) });

/** Récupère ou crée un compte OHADA (transaction). */
async function ensureAccount(
    tx: Prisma.TransactionClient,
    schoolId: string,
    code: string,
    label: string,
    type: "EXPENSE" | "LIABILITY",
) {
    return tx.ohadaAccount.upsert({
        where: { schoolId_syscohadaCode: { schoolId, syscohadaCode: code } },
        update: {},
        create: { schoolId, syscohadaCode: code, label, type },
        select: { id: true },
    });
}

/**
 * PATCH /api/staff/payroll/[id]
 * - validate : brouillon → validé, génère l'écriture OHADA de charge de personnel
 *   (débit 66 « Charges de personnel » / crédit 42 « Personnel — rémunérations dues »).
 * - pay : validé → payé (horodatage).
 * Gestionnaires RH / comptable.
 */
export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { action } = parsed.data;

        const entry = await prisma.payrollEntry.findFirst({
            where: { id, schoolId },
            include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (!entry) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

        // ─── Paiement : validé → payé ──────────────────────────────────────
        if (action === "pay") {
            if (entry.status !== "VALIDATED") {
                return NextResponse.json({ error: "Seule une fiche validée peut être payée." }, { status: 409 });
            }
            await prisma.payrollEntry.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
            return NextResponse.json({ status: "PAID" });
        }

        // ─── Validation : brouillon → validé + écriture OHADA ──────────────
        if (entry.status !== "DRAFT") {
            return NextResponse.json({ error: "Cette fiche est déjà validée." }, { status: 409 });
        }

        const fiscalYear = await prisma.fiscalYear.findFirst({
            where: { schoolId, status: "OPEN" },
            orderBy: { startDate: "desc" },
            select: { id: true },
        });
        if (!fiscalYear) {
            return NextResponse.json(
                { error: "Aucun exercice fiscal ouvert. Créez-en un dans la comptabilité." },
                { status: 409 },
            );
        }

        const net = entry.netAmount;
        const label = `Salaire ${entry.period} — ${entry.user.firstName} ${entry.user.lastName}`.trim();

        const result = await prisma.$transaction(async (tx) => {
            const expense = await ensureAccount(tx, schoolId, "66", "Charges de personnel", "EXPENSE");
            const payable = await ensureAccount(tx, schoolId, "42", "Personnel — rémunérations dues", "LIABILITY");

            const now = new Date();
            const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const countThisMonth = await tx.journalEntry.count({
                where: { schoolId, pieceRef: { startsWith: `PIECE-${ym}` } },
            });
            const pieceRef = `PIECE-${ym}-${String(countThisMonth + 1).padStart(4, "0")}`;

            const lines = buildPayrollJournalLines(net, expense.id, payable.id, label);

            const journal = await tx.journalEntry.create({
                data: {
                    schoolId,
                    fiscalYearId: fiscalYear.id,
                    pieceRef,
                    entryDate: now,
                    label,
                    status: "POSTED",
                    lines: {
                        create: lines.map((l) => ({
                            debitAccountId: l.debitAccountId || null,
                            creditAccountId: l.creditAccountId || null,
                            amountFcfa: BigInt(l.amountFcfa),
                            label: l.label,
                        })),
                    },
                },
                select: { id: true, pieceRef: true },
            });

            // Soldes : charge (débit) +, dette (crédit) − (cf. écritures existantes).
            await tx.ohadaAccount.update({ where: { id: expense.id }, data: { balanceFcfa: { increment: BigInt(net) } } });
            await tx.ohadaAccount.update({ where: { id: payable.id }, data: { balanceFcfa: { decrement: BigInt(net) } } });

            const updated = await tx.payrollEntry.update({
                where: { id },
                data: { status: "VALIDATED", journalEntryId: journal.id },
                select: { id: true },
            });

            await tx.auditLog.create({
                data: {
                    userId: context.session.user.id,
                    schoolId,
                    action: "VALIDATE_PAYROLL",
                    entity: "PayrollEntry",
                    entityId: updated.id,
                    newValues: { period: entry.period, net, pieceRef: journal.pieceRef },
                },
            });

            return { journalEntryId: journal.id, pieceRef: journal.pieceRef };
        });

        return NextResponse.json({ status: "VALIDATED", ...result });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
