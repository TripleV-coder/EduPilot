import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const url = new URL(request.url);
        const requestedSchoolId = url.searchParams.get("schoolId");
        const accessError = ensureRequestedSchoolAccess(session, requestedSchoolId);
        if (accessError) return accessError;

        const schoolId = requestedSchoolId ?? getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 },
            );
        }

        const txLimit = Math.min(
            Math.max(Number(url.searchParams.get("txLimit")) || 25, 1),
            100,
        );

        const [accounts, transactions, disbursements] = await Promise.all([
            prisma.walletAccount.findMany({
                where: { schoolId, isActive: true },
                orderBy: [{ kind: "asc" }, { name: "asc" }],
            }),
            prisma.walletTransaction.findMany({
                where: { schoolId },
                orderBy: { occurredAt: "desc" },
                take: txLimit,
                include: { account: { select: { name: true, kind: true } } },
            }),
            prisma.scheduledDisbursement.findMany({
                where: { schoolId, status: { in: ["PENDING", "VALIDATED"] } },
                orderBy: { scheduledAt: "asc" },
                take: 10,
            }),
        ]);

        const totalBalanceFcfa = accounts.reduce<bigint>(
            (sum, acc) => sum + acc.balanceFcfa,
            BigInt(0),
        );

        return NextResponse.json(
            {
                schoolId,
                totalBalanceFcfa: totalBalanceFcfa.toString(),
                accounts: accounts.map((acc) => ({
                    id: acc.id,
                    name: acc.name,
                    kind: acc.kind,
                    accountRef: acc.accountRef,
                    balanceFcfa: acc.balanceFcfa.toString(),
                    colorHex: acc.colorHex,
                })),
                transactions: transactions.map((tx) => ({
                    id: tx.id,
                    accountId: tx.accountId,
                    accountName: tx.account.name,
                    accountKind: tx.account.kind,
                    direction: tx.direction,
                    amountFcfa: tx.amountFcfa.toString(),
                    reference: tx.reference,
                    partyName: tx.partyName,
                    detail: tx.detail,
                    matchStatus: tx.matchStatus,
                    matchLabel: tx.matchLabel,
                    occurredAt: tx.occurredAt.toISOString(),
                })),
                scheduledDisbursements: disbursements.map((d) => ({
                    id: d.id,
                    label: d.label,
                    amountFcfa: d.amountFcfa.toString(),
                    mode: d.mode,
                    status: d.status,
                    scheduledAt: d.scheduledAt.toISOString(),
                })),
            },
            {
                headers: {
                    "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
                },
            },
        );
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
