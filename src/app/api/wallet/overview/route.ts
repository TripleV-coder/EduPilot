import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { computeWalletBalances } from "@/lib/finance/wallet";

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

        const [accounts, transactions, disbursements, receipts] = await Promise.all([
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
            // Encaissements réels validés (guichet, Mobile Money, en ligne) : ce que la caisse a reçu
            prisma.payment.findMany({
                where: { student: { schoolId }, status: { in: ["VERIFIED", "RECONCILED"] }, deletedAt: null },
                orderBy: { createdAt: "desc" },
                take: txLimit,
                select: {
                    id: true, amount: true, method: true, provider: true, reference: true, paidAt: true, createdAt: true,
                    student: { select: { user: { select: { firstName: true, lastName: true } } } },
                    fee: { select: { name: true } },
                },
            }),
        ]);

        // Soldes calculés sur les encaissements validés (lib/finance/wallet) :
        // le champ balanceFcfa n'est que le solde d'ouverture déclaré.
        const balances = await computeWalletBalances(schoolId, accounts);
        const balanceOf = new Map(balances.map((b) => [b.accountId, b]));
        const totalBalanceFcfa = balances.reduce<bigint>((sum, b) => sum + b.balanceFcfa, BigInt(0));

        return NextResponse.json(
            {
                schoolId,
                totalBalanceFcfa: totalBalanceFcfa.toString(),
                accounts: accounts.map((acc) => ({
                    id: acc.id,
                    name: acc.name,
                    kind: acc.kind,
                    accountRef: acc.accountRef,
                    balanceFcfa: (balanceOf.get(acc.id)?.balanceFcfa ?? acc.balanceFcfa).toString(),
                    openingBalanceFcfa: acc.balanceFcfa.toString(),
                    collectedFcfa: (balanceOf.get(acc.id)?.collectedFcfa ?? BigInt(0)).toString(),
                    manualNetFcfa: (balanceOf.get(acc.id)?.manualNetFcfa ?? BigInt(0)).toString(),
                    disbursedFcfa: (balanceOf.get(acc.id)?.disbursedFcfa ?? BigInt(0)).toString(),
                    receivesPayments: balanceOf.get(acc.id)?.receivesPayments ?? false,
                    declaredAt: acc.createdAt.toISOString(),
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
                recentReceipts: receipts.map((p) => ({
                    id: p.id,
                    amountFcfa: Math.round(Number(p.amount)),
                    method: p.method,
                    online: Boolean(p.provider),
                    reference: p.reference,
                    occurredAt: (p.paidAt ?? p.createdAt).toISOString(),
                    studentName: `${p.student.user.firstName} ${p.student.user.lastName}`.trim(),
                    feeName: p.fee?.name ?? null,
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
