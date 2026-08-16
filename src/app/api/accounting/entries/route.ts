import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withTenantRls } from "@/lib/db/tenant-rls";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler } from "@/lib/api/api-helpers";

// ─── GET /api/accounting/entries — plan de comptes + dernières écritures ──
export const GET = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 },
            );
        }

        const url = new URL(request.url);
        const wantAccounts = url.searchParams.get("accounts") === "1";

        return withTenantRls(schoolId, async (tx) => {
            if (wantAccounts) {
                const [accounts, fiscalYears] = await Promise.all([
                    tx.ohadaAccount.findMany({
                        where: { schoolId, isActive: true },
                        orderBy: { syscohadaCode: "asc" },
                        select: { id: true, syscohadaCode: true, label: true, type: true },
                    }),
                    tx.fiscalYear.findMany({
                        where: { schoolId, status: "OPEN" },
                        orderBy: { startDate: "desc" },
                        select: { id: true, label: true },
                    }),
                ]);
                return NextResponse.json({ accounts, fiscalYears });
            }

            const entries = await tx.journalEntry.findMany({
                where: { schoolId },
                orderBy: { entryDate: "desc" },
                take: 50,
                include: {
                    lines: {
                        include: {
                            debitAccount: { select: { syscohadaCode: true, label: true } },
                            creditAccount: { select: { syscohadaCode: true, label: true } },
                        },
                    },
                },
            });

            return NextResponse.json({
                entries: entries.map((e) => ({
                    id: e.id,
                    pieceRef: e.pieceRef,
                    entryDate: e.entryDate.toISOString(),
                    label: e.label,
                    status: e.status,
                    lines: e.lines.map((l) => ({
                        id: l.id,
                        amountFcfa: l.amountFcfa.toString(),
                        label: l.label,
                        debit: l.debitAccount
                            ? `${l.debitAccount.syscohadaCode} · ${l.debitAccount.label}`
                            : null,
                        credit: l.creditAccount
                            ? `${l.creditAccount.syscohadaCode} · ${l.creditAccount.label}`
                            : null,
                    })),
                })),
            });
        });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);

// ─── POST /api/accounting/entries — nouvelle écriture équilibrée ──────────
export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 },
            );
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
        }

        const { fiscalYearId, entryDate, label, lines } = (body ?? {}) as {
            fiscalYearId?: string;
            entryDate?: string;
            label?: string;
            lines?: Array<{
                debitAccountId?: string | null;
                creditAccountId?: string | null;
                amountFcfa?: number | string;
                label?: string;
            }>;
        };

        if (!label || typeof label !== "string" || label.trim().length < 3) {
            return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });
        }
        const date = entryDate ? new Date(entryDate) : new Date();
        if (Number.isNaN(date.getTime())) {
            return NextResponse.json({ error: "Date d'écriture invalide." }, { status: 400 });
        }
        if (!Array.isArray(lines) || lines.length < 2) {
            return NextResponse.json(
                { error: "Une écriture nécessite au moins 2 lignes (débit + crédit)." },
                { status: 400 },
            );
        }

        // Validation partie double : Σ débits === Σ crédits, strictly > 0.
        let totalDebit = BigInt(0);
        let totalCredit = BigInt(0);
        for (const l of lines) {
            const amount = BigInt(Math.round(Number(l.amountFcfa ?? 0)));
            if (amount <= BigInt(0)) {
                return NextResponse.json(
                    { error: "Chaque ligne doit avoir un montant strictement positif." },
                    { status: 400 },
                );
            }
            const hasDebit = !!l.debitAccountId;
            const hasCredit = !!l.creditAccountId;
            if (hasDebit === hasCredit) {
                return NextResponse.json(
                    { error: "Chaque ligne impute soit un compte au débit, soit au crédit." },
                    { status: 400 },
                );
            }
            if (hasDebit) totalDebit += amount;
            else totalCredit += amount;
        }
        if (totalDebit !== totalCredit) {
            return NextResponse.json(
                {
                    error: `Écriture déséquilibrée : débits ${totalDebit} ≠ crédits ${totalCredit}.`,
                },
                { status: 400 },
            );
        }

        return withTenantRls(schoolId, async (tx) => {
            // Exercice fiscal : fourni ou exercice ouvert le plus récent.
            const fiscalYear = fiscalYearId
                ? await tx.fiscalYear.findFirst({
                      where: { id: fiscalYearId, schoolId, status: "OPEN" },
                  })
                : await tx.fiscalYear.findFirst({
                      where: { schoolId, status: "OPEN" },
                      orderBy: { startDate: "desc" },
                  });
            if (!fiscalYear) {
                return NextResponse.json(
                    { error: "Aucun exercice fiscal ouvert. Créez-en un dans les paramètres." },
                    { status: 409 },
                );
            }

            // Vérifie que tous les comptes appartiennent au tenant.
            const accountIds = lines
                .flatMap((l) => [l.debitAccountId, l.creditAccountId])
                .filter((x): x is string => !!x);
            const validCount = await tx.ohadaAccount.count({
                where: { id: { in: accountIds }, schoolId },
            });
            if (validCount !== new Set(accountIds).size) {
                return NextResponse.json(
                    { error: "Un ou plusieurs comptes sont invalides pour cet établissement." },
                    { status: 400 },
                );
            }

            // Référence pièce auto-incrémentée : PIECE-YYYY-MM-NNNN.
            const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const countThisMonth = await tx.journalEntry.count({
                where: { schoolId, pieceRef: { startsWith: `PIECE-${ym}` } },
            });
            const pieceRef = `PIECE-${ym}-${String(countThisMonth + 1).padStart(4, "0")}`;

            const entry = await tx.journalEntry.create({
                data: {
                    schoolId,
                    fiscalYearId: fiscalYear.id,
                    pieceRef,
                    entryDate: date,
                    label: sanitizePlainText(label),
                    status: "POSTED",
                    lines: {
                        create: lines.map((l) => ({
                            debitAccountId: l.debitAccountId || null,
                            creditAccountId: l.creditAccountId || null,
                            amountFcfa: BigInt(Math.round(Number(l.amountFcfa))),
                            label: l.label ? sanitizePlainText(l.label) : null,
                        })),
                    },
                },
            });

            // Met à jour les soldes des comptes touchés.
            for (const l of lines) {
                const amount = BigInt(Math.round(Number(l.amountFcfa)));
                if (l.debitAccountId) {
                    await tx.ohadaAccount.update({
                        where: { id: l.debitAccountId },
                        data: { balanceFcfa: { increment: amount } },
                    });
                }
                if (l.creditAccountId) {
                    await tx.ohadaAccount.update({
                        where: { id: l.creditAccountId },
                        data: { balanceFcfa: { decrement: amount } },
                    });
                }
            }

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    schoolId,
                    action: "CREATE_JOURNAL_ENTRY",
                    entity: "JournalEntry",
                    entityId: entry.id,
                    newValues: { pieceRef, label: entry.label, lines: lines.length },
                },
            });

            return NextResponse.json({ id: entry.id, pieceRef }, { status: 201 });
        });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);

