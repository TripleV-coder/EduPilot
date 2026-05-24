/**
 * Seed Cagnotte — 2 pots communs par école avec contributions parents
 *
 * Run: `npx tsx prisma/seed-cagnotte.ts`
 * Idempotent: skips schools that already have Cagnotte rows.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
    const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    if (schools.length === 0) {
        console.log("Aucune école active trouvée — rien à seed.");
        return;
    }

    let created = 0;

    for (const school of schools) {
        const existing = await prisma.cagnotte.count({ where: { schoolId: school.id } });
        if (existing > 0) {
            console.log(`⏭️  ${school.name} — déjà ${existing} cagnottes, skip.`);
            continue;
        }

        // Pick a teacher as host of one cagnotte, a parent as host of the other.
        const teacher = await prisma.user.findFirst({
            where: { schoolId: school.id, role: "TEACHER" },
            select: { id: true, firstName: true, lastName: true },
        });
        const parents = await prisma.user.findMany({
            where: { schoolId: school.id, role: "PARENT" },
            take: 24,
            select: { id: true, firstName: true, lastName: true },
        });

        if (parents.length === 0) {
            console.log(`⏭️  ${school.name} — aucun parent, skip cagnotte.`);
            continue;
        }

        // First cagnotte: sortie scolaire, hosted by teacher if available
        const sortieClass = await prisma.class.findFirst({
            where: { schoolId: school.id },
            select: { id: true, name: true },
        });

        const sortie = await prisma.cagnotte.create({
            data: {
                schoolId: school.id,
                classId: sortieClass?.id ?? null,
                hostUserId: teacher?.id ?? parents[0].id,
                title: "Sortie pédagogique Ouidah · Route des Esclaves",
                description: "Visite guidée du parcours historique. Bus + repas + entrée musée.",
                targetFcfa: BigInt(350_000),
                deadline: daysFromNow(18),
                status: "OPEN",
                expectedParticipants: 28,
            },
        });

        await prisma.cagnotteJournalEntry.create({
            data: {
                cagnotteId: sortie.id,
                kind: "CREATED",
                actorUserId: teacher?.id ?? parents[0].id,
                message: "Cagnotte ouverte par le bureau parents",
                createdAt: daysAgo(20),
            },
        });

        const sortieContributors = parents.slice(0, 22);
        for (let i = 0; i < sortieContributors.length; i++) {
            const parent = sortieContributors[i];
            const paidAt = daysAgo(20 - Math.floor(i * 0.6));
            await prisma.cagnotteContribution.create({
                data: {
                    cagnotteId: sortie.id,
                    parentUserId: parent.id,
                    amountFcfa: BigInt(12_500),
                    paymentRef: `TRX-MTN-${100000 + i}`,
                    paidAt,
                },
            });
            await prisma.cagnotteJournalEntry.create({
                data: {
                    cagnotteId: sortie.id,
                    kind: "CONTRIBUTION_PAID",
                    actorUserId: parent.id,
                    amountFcfa: BigInt(12_500),
                    message: "Paiement MoMo MTN",
                    createdAt: paidAt,
                },
            });
        }

        // Second cagnotte: cadeau prof, hosted by a parent
        const cadeau = await prisma.cagnotte.create({
            data: {
                schoolId: school.id,
                hostUserId: parents[1]?.id ?? parents[0].id,
                title: "Pot commun cadeau · Mme Akin · départ retraite",
                description: "Toute la promotion CM2 pour un cadeau de départ.",
                targetFcfa: BigInt(80_000),
                deadline: daysFromNow(32),
                status: "OPEN",
                expectedParticipants: 42,
            },
        });

        await prisma.cagnotteJournalEntry.create({
            data: {
                cagnotteId: cadeau.id,
                kind: "CREATED",
                actorUserId: parents[1]?.id ?? parents[0].id,
                message: "Cagnotte ouverte par le bureau des parents CM2",
                createdAt: daysAgo(14),
            },
        });

        const cadeauContributors = parents.slice(0, Math.min(parents.length, 14));
        for (let i = 0; i < cadeauContributors.length; i++) {
            const parent = cadeauContributors[i];
            const paidAt = daysAgo(13 - i);
            await prisma.cagnotteContribution.create({
                data: {
                    cagnotteId: cadeau.id,
                    parentUserId: parent.id,
                    amountFcfa: BigInt(2_000),
                    paymentRef: `TRX-MOV-${200000 + i}`,
                    paidAt,
                },
            });
            await prisma.cagnotteJournalEntry.create({
                data: {
                    cagnotteId: cadeau.id,
                    kind: "CONTRIBUTION_PAID",
                    actorUserId: parent.id,
                    amountFcfa: BigInt(2_000),
                    message: "Paiement Moov Money",
                    createdAt: paidAt,
                },
            });
        }

        created += 2;
        console.log(
            `✅ ${school.name} — 2 cagnottes (${sortieContributors.length} + ${cadeauContributors.length} contributions)`,
        );
    }

    console.log(`\nTerminé. ${created} cagnottes créées.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
