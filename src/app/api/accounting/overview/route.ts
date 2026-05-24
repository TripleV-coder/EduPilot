import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALLOWED_ROLES = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "DIRECTOR",
    "ACCOUNTANT",
] as const;

const CASH_PREFIXES = {
    cash: ["57"], // caisse
    bank: ["52"], // banques
    momo: ["53"], // valeurs en cours / on use as MoMo
};

function classifyCashAccount(code: string): "cash" | "bank" | "momo" | null {
    if (CASH_PREFIXES.cash.some((p) => code.startsWith(p))) return "cash";
    if (CASH_PREFIXES.bank.some((p) => code.startsWith(p))) return "bank";
    if (CASH_PREFIXES.momo.some((p) => code.startsWith(p))) return "momo";
    return null;
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

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
        Math.max(Number(url.searchParams.get("txLimit")) || 20, 1),
        100,
    );

    // Active fiscal year (most recent OPEN, fallback to most recent any)
    const fiscalYear =
        (await prisma.fiscalYear.findFirst({
            where: { schoolId, status: "OPEN" },
            orderBy: { startDate: "desc" },
        })) ??
        (await prisma.fiscalYear.findFirst({
            where: { schoolId },
            orderBy: { startDate: "desc" },
        }));

    if (!fiscalYear) {
        return NextResponse.json({
            schoolId,
            fiscalYear: null,
            kpis: {
                cashBalanceFcfa: "0",
                bankBalanceFcfa: "0",
                momoBalanceFcfa: "0",
                exerciseResultFcfa: "0",
                journalEntryCount: 0,
            },
            journalEntries: [],
            expenseAccounts: [],
        });
    }

    const [accounts, journalEntries, journalEntryCount] = await Promise.all([
        prisma.ohadaAccount.findMany({
            where: { schoolId, isActive: true },
            orderBy: { syscohadaCode: "asc" },
        }),
        prisma.journalEntry.findMany({
            where: { schoolId, fiscalYearId: fiscalYear.id, status: "POSTED" },
            orderBy: { entryDate: "desc" },
            take: txLimit,
            include: {
                lines: {
                    include: {
                        debitAccount: {
                            select: { syscohadaCode: true, label: true },
                        },
                        creditAccount: {
                            select: { syscohadaCode: true, label: true },
                        },
                    },
                },
            },
        }),
        prisma.journalEntry.count({
            where: { schoolId, fiscalYearId: fiscalYear.id, status: "POSTED" },
        }),
    ]);

    // KPIs: cash / bank / momo balances
    let cashBalance = BigInt(0);
    let bankBalance = BigInt(0);
    let momoBalance = BigInt(0);
    let incomeTotal = BigInt(0);
    let expenseTotal = BigInt(0);

    for (const acc of accounts) {
        const bucket = classifyCashAccount(acc.syscohadaCode);
        if (bucket === "cash") cashBalance += acc.balanceFcfa;
        else if (bucket === "bank") bankBalance += acc.balanceFcfa;
        else if (bucket === "momo") momoBalance += acc.balanceFcfa;

        if (acc.type === "INCOME") incomeTotal += acc.balanceFcfa;
        if (acc.type === "EXPENSE") expenseTotal += acc.balanceFcfa;
    }

    const exerciseResult = incomeTotal - expenseTotal;

    // Top expense accounts (sorted by balance desc, top 6)
    const expenseAccounts = accounts
        .filter((acc) => acc.type === "EXPENSE")
        .sort((a, b) => {
            const diff = b.balanceFcfa - a.balanceFcfa;
            if (diff > BigInt(0)) return 1;
            if (diff < BigInt(0)) return -1;
            return 0;
        })
        .slice(0, 6);

    const expenseTotalForPct = expenseAccounts.reduce<bigint>(
        (sum, acc) => sum + acc.balanceFcfa,
        BigInt(0),
    );

    return NextResponse.json(
        {
            schoolId,
            fiscalYear: {
                id: fiscalYear.id,
                label: fiscalYear.label,
                status: fiscalYear.status,
            },
            kpis: {
                cashBalanceFcfa: cashBalance.toString(),
                bankBalanceFcfa: bankBalance.toString(),
                momoBalanceFcfa: momoBalance.toString(),
                exerciseResultFcfa: exerciseResult.toString(),
                journalEntryCount,
            },
            journalEntries: journalEntries.map((je) => ({
                id: je.id,
                pieceRef: je.pieceRef,
                entryDate: je.entryDate.toISOString(),
                label: je.label,
                lines: je.lines.map((l) => ({
                    id: l.id,
                    amountFcfa: l.amountFcfa.toString(),
                    label: l.label,
                    debit: l.debitAccount
                        ? {
                              code: l.debitAccount.syscohadaCode,
                              label: l.debitAccount.label,
                          }
                        : null,
                    credit: l.creditAccount
                        ? {
                              code: l.creditAccount.syscohadaCode,
                              label: l.creditAccount.label,
                          }
                        : null,
                })),
            })),
            expenseAccounts: expenseAccounts.map((acc) => ({
                code: acc.syscohadaCode,
                label: acc.label,
                balanceFcfa: acc.balanceFcfa.toString(),
                pct:
                    expenseTotalForPct === BigInt(0)
                        ? 0
                        : Number((acc.balanceFcfa * BigInt(10000)) / expenseTotalForPct) / 100,
            })),
            expenseTotalFcfa: expenseTotal.toString(),
        },
        {
            headers: {
                "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
            },
        },
    );
}
