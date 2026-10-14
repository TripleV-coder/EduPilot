import type { OhadaAccountType } from "@prisma/client";

/**
 * Plan SYSCOHADA minimal (classes 1 à 8), soldes à zéro.
 * Appelé par GET /api/accounting/entries?accounts=1 et POST /api/accounting/fiscal-year.
 * Le seed CLI `prisma/seed-accounting.ts` charge des soldes de démonstration : il ne sert pas ici.
 */
const CHART: Array<{ code: string; label: string; type: OhadaAccountType }> = [
    { code: "10100", label: "Capital", type: "EQUITY" },
    { code: "21100", label: "Immobilisations corporelles", type: "ASSET" },
    { code: "31100", label: "Stocks de fournitures", type: "ASSET" },
    { code: "41100", label: "Familles — scolarité à recevoir", type: "ASSET" },
    { code: "52100", label: "Banque", type: "ASSET" },
    { code: "57100", label: "Caisse", type: "ASSET" },
    { code: "60100", label: "Achats de fournitures", type: "EXPENSE" },
    { code: "70100", label: "Scolarité", type: "INCOME" },
    { code: "80100", label: "Engagements reçus", type: "LIABILITY" },
];

type ChartDb = {
    fiscalYear: {
        findFirst: (args: {
            where: { schoolId: string; status: "OPEN" };
            orderBy: { startDate: "desc" };
        }) => Promise<{ id: string } | null>;
        create: (args: {
            data: {
                schoolId: string;
                label: string;
                startDate: Date;
                endDate: Date;
                status: "OPEN";
            };
        }) => Promise<{ id: string }>;
    };
    ohadaAccount: {
        findMany: (args: {
            where: { schoolId: string };
            select: { syscohadaCode: true };
        }) => Promise<Array<{ syscohadaCode: string }>>;
        create: (args: {
            data: {
                schoolId: string;
                syscohadaCode: string;
                label: string;
                type: OhadaAccountType;
                balanceFcfa: bigint;
                isActive: true;
            };
        }) => Promise<unknown>;
    };
};

/** Exercice scolaire oct. → sept. : le 29 sept. 2026 relève encore de 2025-2026. */
export function currentFiscalWindow(now = new Date()): { label: string; startDate: Date; endDate: Date } {
    const year = now.getUTCFullYear();
    const startYear = now.getUTCMonth() >= 9 ? year : year - 1;
    return {
        label: `${startYear}-${startYear + 1}`,
        startDate: new Date(Date.UTC(startYear, 9, 1)),
        endDate: new Date(Date.UTC(startYear + 1, 8, 30)),
    };
}

/** Ouvre l'exercice s'il n'en existe pas, et ajoute les comptes manquants (sans toucher aux soldes). */
export async function ensureOpenChart(db: ChartDb, schoolId: string): Promise<void> {
    const open = await db.fiscalYear.findFirst({
        where: { schoolId, status: "OPEN" },
        orderBy: { startDate: "desc" },
    });
    if (!open) {
        const window = currentFiscalWindow();
        await db.fiscalYear.create({
            data: { schoolId, ...window, status: "OPEN" },
        });
    }

    const existing = await db.ohadaAccount.findMany({
        where: { schoolId },
        select: { syscohadaCode: true },
    });
    const codes = new Set(existing.map((account) => account.syscohadaCode));
    for (const account of CHART) {
        if (codes.has(account.code)) continue;
        await db.ohadaAccount.create({
            data: {
                schoolId,
                syscohadaCode: account.code,
                label: account.label,
                type: account.type,
                balanceFcfa: BigInt(0),
                isActive: true,
            },
        });
    }
}
