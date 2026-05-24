/**
 * Seed Wallet — Mobile Money & banques (demo data per school)
 *
 * Run: `npx tsx prisma/seed-wallet.ts`
 * Idempotent: skips schools that already have WalletAccount rows.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    if (schools.length === 0) {
        console.log("Aucune école active trouvée — rien à seed.");
        return;
    }

    let totalCreated = 0;

    for (const school of schools) {
        const existing = await prisma.walletAccount.count({
            where: { schoolId: school.id },
        });
        if (existing > 0) {
            console.log(`⏭️  ${school.name} — déjà ${existing} comptes, skip.`);
            continue;
        }

        const accounts = await prisma.$transaction(async (tx) => {
            const ecobank = await tx.walletAccount.create({
                data: {
                    schoolId: school.id,
                    name: "Ecobank",
                    kind: "BANK",
                    accountRef: "CPT 0341",
                    balanceFcfa: BigInt(48_200_000),
                    colorHex: "#60A5FA",
                },
            });
            const mtn = await tx.walletAccount.create({
                data: {
                    schoolId: school.id,
                    name: "MTN MoMo",
                    kind: "MTN",
                    accountRef: "+229 21 30 12 12",
                    balanceFcfa: BigInt(4_200_000),
                    colorHex: "#FBBF24",
                },
            });
            const moov = await tx.walletAccount.create({
                data: {
                    schoolId: school.id,
                    name: "Moov Money",
                    kind: "MOOV",
                    accountRef: "+229 95 80 12 12",
                    balanceFcfa: BigInt(1_800_000),
                    colorHex: "#60A5FA",
                },
            });
            const celtiis = await tx.walletAccount.create({
                data: {
                    schoolId: school.id,
                    name: "Celtiis Cash",
                    kind: "CELTIIS",
                    accountRef: "+229 51 00 12 12",
                    balanceFcfa: BigInt(400_000),
                    colorHex: "#34D399",
                },
            });
            const cash = await tx.walletAccount.create({
                data: {
                    schoolId: school.id,
                    name: "Caisse",
                    kind: "CASH",
                    accountRef: "Espèces siège",
                    balanceFcfa: BigInt(2_800_000),
                    colorHex: "#A78BFA",
                },
            });
            return { ecobank, mtn, moov, celtiis, cash };
        });

        const now = new Date();
        const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60_000);

        await prisma.walletTransaction.createMany({
            data: [
                {
                    schoolId: school.id,
                    accountId: accounts.mtn.id,
                    direction: "INFLOW",
                    amountFcfa: BigInt(125_000),
                    reference: "TRX-MTN-882104",
                    partyName: "Famille Hounsou",
                    detail: "Aïcha · trim. 2",
                    matchStatus: "AUTO_MATCHED",
                    occurredAt: minutesAgo(8),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.moov.id,
                    direction: "INFLOW",
                    amountFcfa: BigInt(95_000),
                    reference: "TRX-MOV-441998",
                    partyName: "Famille Dossou",
                    detail: "Mathieu · trim. 2",
                    matchStatus: "AUTO_MATCHED",
                    occurredAt: minutesAgo(12),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.ecobank.id,
                    direction: "INFLOW",
                    amountFcfa: BigInt(4_800_000),
                    reference: "VIR-ECO-12041",
                    partyName: "État · subv. MEMP",
                    detail: "Subvention 2025-T2",
                    matchStatus: "MANUAL_MATCHED",
                    matchLabel: "✓ Subvention rapprochée",
                    occurredAt: minutesAgo(18),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.celtiis.id,
                    direction: "INFLOW",
                    amountFcfa: BigInt(50_000),
                    reference: "TRX-CEL-009",
                    partyName: "Inconnu",
                    detail: "Pas de rappro auto",
                    matchStatus: "UNMATCHED",
                    occurredAt: minutesAgo(26),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.mtn.id,
                    direction: "OUTFLOW",
                    amountFcfa: BigInt(142_500),
                    reference: "DEC-MTN-7720",
                    partyName: "Librairie SOFIB",
                    detail: "Achat fournitures · CHR-201",
                    matchStatus: "DISBURSEMENT",
                    occurredAt: minutesAgo(42),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.moov.id,
                    direction: "INFLOW",
                    amountFcfa: BigInt(62_500),
                    reference: "TRX-MOV-441812",
                    partyName: "Famille Akin",
                    detail: "Pierre · trim. 2 · acompte 50%",
                    matchStatus: "AUTO_MATCHED",
                    occurredAt: minutesAgo(58),
                },
            ],
        });

        const dayMs = 24 * 60 * 60 * 1000;
        await prisma.scheduledDisbursement.createMany({
            data: [
                {
                    schoolId: school.id,
                    accountId: accounts.ecobank.id,
                    label: "Paie enseignants · juin",
                    amountFcfa: BigInt(22_400_000),
                    mode: "AUTO",
                    status: "VALIDATED",
                    scheduledAt: new Date(now.getTime() + dayMs),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.ecobank.id,
                    label: "CNSS · cotisations mai",
                    amountFcfa: BigInt(3_800_000),
                    mode: "AUTO",
                    status: "VALIDATED",
                    scheduledAt: new Date(now.getTime() + dayMs * 6),
                },
                {
                    schoolId: school.id,
                    accountId: accounts.ecobank.id,
                    label: "Loyer extension nord",
                    amountFcfa: BigInt(850_000),
                    mode: "MANUAL",
                    status: "PENDING",
                    scheduledAt: new Date(now.getTime() + dayMs * 4),
                },
                {
                    schoolId: school.id,
                    label: "Fournisseur cantine ATAB",
                    amountFcfa: BigInt(1_200_000),
                    mode: "MANUAL",
                    status: "PENDING",
                    scheduledAt: new Date(now.getTime() + dayMs * 2),
                },
            ],
        });

        totalCreated += 1;
        console.log(`✅ ${school.name} — 5 comptes + 6 tx + 4 décaissements`);
    }

    console.log(`\nTerminé. ${totalCreated} école(s) seedée(s).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
