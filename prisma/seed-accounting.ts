/**
 * Seed Accounting — OHADA / SYSCOHADA révisé
 * - 1 FiscalYear ouvert par école (label = "<startYear>-<endYear>")
 * - Plan comptable simplifié (10 comptes-clés)
 * - 8 écritures (4 entrées/paiements + 4 dépenses)
 *
 * Run: `npx tsx prisma/seed-accounting.ts`
 * Idempotent: skip si FiscalYear déjà présent.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AccountSeed = {
    code: string;
    label: string;
    type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
    initialBalance: number;
};

const ACCOUNT_PLAN: AccountSeed[] = [
    // Classes 5 — Trésorerie
    { code: "52100", label: "Banque Ecobank", type: "ASSET", initialBalance: 48_200_000 },
    { code: "52200", label: "Banque BoA", type: "ASSET", initialBalance: 12_000_000 },
    { code: "53100", label: "MoMo MTN", type: "ASSET", initialBalance: 4_200_000 },
    { code: "53200", label: "MoMo Moov", type: "ASSET", initialBalance: 1_800_000 },
    { code: "57000", label: "Caisse espèces", type: "ASSET", initialBalance: 2_800_000 },
    // Classe 7 — Produits
    { code: "70611", label: "Scolarité élèves", type: "INCOME", initialBalance: 248_500_000 },
    { code: "70612", label: "Cantine", type: "INCOME", initialBalance: 18_400_000 },
    { code: "75000", label: "Subventions MEMP", type: "INCOME", initialBalance: 4_800_000 },
    // Classe 6 — Charges
    { code: "641", label: "Salaires enseignants", type: "EXPENSE", initialBalance: 124_000_000 },
    { code: "642", label: "Charges sociales CNSS", type: "EXPENSE", initialBalance: 28_000_000 },
    { code: "60400", label: "Fournitures pédago", type: "EXPENSE", initialBalance: 18_000_000 },
    { code: "62200", label: "Entretien locaux", type: "EXPENSE", initialBalance: 22_000_000 },
    { code: "62600", label: "Téléphone / internet", type: "EXPENSE", initialBalance: 6_000_000 },
    { code: "60500", label: "Autres charges", type: "EXPENSE", initialBalance: 27_000_000 },
];

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
    const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });
    if (schools.length === 0) return console.log("Aucune école active.");

    for (const school of schools) {
        const existing = await prisma.fiscalYear.count({ where: { schoolId: school.id } });
        if (existing > 0) {
            console.log(`⏭️  ${school.name} — déjà ${existing} exercice(s), skip.`);
            continue;
        }

        const startDate = new Date(Date.UTC(2025, 9, 1)); // 1 oct 2025
        const endDate = new Date(Date.UTC(2026, 8, 30)); // 30 sept 2026
        const label = `${startDate.getUTCFullYear()}-${endDate.getUTCFullYear()}`;

        const fiscalYear = await prisma.fiscalYear.create({
            data: {
                schoolId: school.id,
                label,
                startDate,
                endDate,
                status: "OPEN",
            },
        });

        // Create accounts
        const accounts: Record<string, string> = {};
        for (const acc of ACCOUNT_PLAN) {
            const created = await prisma.ohadaAccount.create({
                data: {
                    schoolId: school.id,
                    syscohadaCode: acc.code,
                    label: acc.label,
                    type: acc.type,
                    balanceFcfa: BigInt(acc.initialBalance),
                    isActive: true,
                },
            });
            accounts[acc.code] = created.id;
        }

        // Sample journal entries (each = 2 lines, balanced)
        const writes: Array<{
            piece: string;
            label: string;
            daysAgo: number;
            debitCode: string;
            creditCode: string;
            amount: number;
            lineLabel: string;
        }> = [
            {
                piece: "FAC-2024",
                label: "Encaissement scolarité Aïcha Hounsou T2",
                daysAgo: 10,
                debitCode: "52100",
                creditCode: "70611",
                amount: 125_000,
                lineLabel: "Aïcha Hounsou · trim. 2",
            },
            {
                piece: "BNK-882",
                label: "Encaissement Flutterwave A0142",
                daysAgo: 10,
                debitCode: "52100",
                creditCode: "70611",
                amount: 95_000,
                lineLabel: "Famille Dossou · trim. 2",
            },
            {
                piece: "MOM-444",
                label: "Cantine repas Famille Dossou",
                daysAgo: 11,
                debitCode: "53100",
                creditCode: "70612",
                amount: 54_000,
                lineLabel: "Repas 18 enfants",
            },
            {
                piece: "SUB-001",
                label: "Subvention MEMP T2",
                daysAgo: 12,
                debitCode: "52100",
                creditCode: "75000",
                amount: 4_800_000,
                lineLabel: "Subvention 2025-T2",
            },
            {
                piece: "PAI-066",
                label: "Salaire enseignant M. Adjavon",
                daysAgo: 10,
                debitCode: "641",
                creditCode: "57000",
                amount: 380_000,
                lineLabel: "Salaire juin",
            },
            {
                piece: "CHR-201",
                label: "Achat fournitures Librairie SOFIB",
                daysAgo: 12,
                debitCode: "60400",
                creditCode: "57000",
                amount: 142_500,
                lineLabel: "Papier rame ×40",
            },
            {
                piece: "CNS-512",
                label: "Cotisations CNSS mai",
                daysAgo: 14,
                debitCode: "642",
                creditCode: "52100",
                amount: 3_800_000,
                lineLabel: "Échéance 30 mai",
            },
            {
                piece: "ENT-072",
                label: "Entretien locaux mai",
                daysAgo: 16,
                debitCode: "62200",
                creditCode: "52100",
                amount: 850_000,
                lineLabel: "Société NETPRO",
            },
        ];

        for (const w of writes) {
            await prisma.journalEntry.create({
                data: {
                    schoolId: school.id,
                    fiscalYearId: fiscalYear.id,
                    pieceRef: w.piece,
                    entryDate: daysAgo(w.daysAgo),
                    label: w.label,
                    status: "POSTED",
                    lines: {
                        create: [
                            {
                                debitAccountId: accounts[w.debitCode],
                                amountFcfa: BigInt(w.amount),
                                label: w.lineLabel,
                            },
                            {
                                creditAccountId: accounts[w.creditCode],
                                amountFcfa: BigInt(w.amount),
                                label: w.lineLabel,
                            },
                        ],
                    },
                },
            });
        }

        console.log(
            `✅ ${school.name} — exercice ${label} + ${ACCOUNT_PLAN.length} comptes + ${writes.length} écritures`,
        );
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
