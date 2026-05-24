/**
 * Seed Wellbeing — signalements, pulse climat, agenda psy par école
 *
 * Run: `npx tsx prisma/seed-wellbeing.ts`
 * Idempotent: skips schools that already have WellbeingReport rows.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
    const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    if (schools.length === 0) {
        console.log("Aucune école active.");
        return;
    }

    for (const school of schools) {
        const existing = await prisma.wellbeingReport.count({
            where: { schoolId: school.id },
        });
        if (existing > 0) {
            console.log(`⏭️  ${school.name} — déjà ${existing} signalements, skip.`);
            continue;
        }

        // Reports
        await prisma.wellbeingReport.createMany({
            data: [
                {
                    schoolId: school.id,
                    tag: "ANONYME",
                    category: "Harcèlement",
                    excerpt: "Harcèlement répété par camarade · pendant la récré",
                    severity: "P0",
                    severityLabel: "P0 · urgent",
                    status: "IN_REVIEW",
                    createdAt: daysAgo(0.08),
                },
                {
                    schoolId: school.id,
                    tag: "PARENT",
                    category: "Anxiété scolaire",
                    excerpt: "Mon fils ne veut plus venir le mercredi",
                    severity: "P1",
                    severityLabel: "P1",
                    status: "OPEN",
                    createdAt: daysAgo(1),
                },
                {
                    schoolId: school.id,
                    tag: "ENSEIGNANT",
                    category: "Signal faible",
                    excerpt: "Marie B. dessine sans cesse des images sombres",
                    severity: "P1",
                    severityLabel: "P1",
                    status: "OPEN",
                    createdAt: daysAgo(1),
                },
                {
                    schoolId: school.id,
                    tag: "ANONYME",
                    category: "Protection enfance",
                    excerpt: "Difficultés à la maison · violence verbale du beau-père",
                    severity: "P0",
                    severityLabel: "P0 · CPS prévenu",
                    status: "IN_FOLLOWUP",
                    createdAt: daysAgo(2),
                },
                {
                    schoolId: school.id,
                    tag: "AUTO_IA",
                    category: "Décrochage groupe",
                    excerpt: "Chute de présence collective · 4 élèves même quartier",
                    severity: "P2",
                    severityLabel: "P2",
                    status: "OPEN",
                    createdAt: daysAgo(3),
                },
                {
                    schoolId: school.id,
                    tag: "NOMINATIF",
                    category: "Risque vital",
                    excerpt: "Idées noires évoquées au journal intime",
                    severity: "P0",
                    severityLabel: "P0 · suivi actif",
                    status: "IN_FOLLOWUP",
                    createdAt: daysAgo(4),
                },
                {
                    schoolId: school.id,
                    tag: "PARENT",
                    category: "Suivi pédagogique",
                    excerpt: "Difficultés en lecture depuis le déménagement",
                    severity: "P2",
                    severityLabel: "P2",
                    status: "CLOSED",
                    createdAt: daysAgo(12),
                },
            ],
        });

        // Pulse climat — 8 dernières semaines
        const pulseRows = [
            { label: "S1", value: 6.8, responses: 880 },
            { label: "S2", value: 7.0, responses: 901 },
            { label: "S3", value: 6.4, responses: 845 },
            { label: "S4", value: 6.9, responses: 912 },
            { label: "S5", value: 7.2, responses: 933 },
            { label: "S6", value: 7.1, responses: 920 },
            { label: "S7", value: 7.4, responses: 938 },
            { label: "S8", value: 7.4, responses: 942 },
        ];
        for (let i = 0; i < pulseRows.length; i++) {
            const p = pulseRows[i];
            await prisma.climatePulseWeek.create({
                data: {
                    schoolId: school.id,
                    weekLabel: p.label,
                    weekStart: daysAgo((pulseRows.length - i) * 7),
                    averageScore: p.value,
                    responses: p.responses,
                    pctSafety: i === pulseRows.length - 1 ? 88 : null,
                    pctFriend: i === pulseRows.length - 1 ? 92 : null,
                    pctAdultListens: i === pulseRows.length - 1 ? 74 : null,
                    pctHarassWitness: i === pulseRows.length - 1 ? 12 : null,
                },
            });
        }

        // Agenda psy — 5 RDV cette semaine
        await prisma.psyAppointment.createMany({
            data: [
                {
                    schoolId: school.id,
                    anonymousLabel: "Aïcha H.",
                    startAt: daysFromNow(0).getTime() ? new Date(setTime(daysFromNow(1), 9, 0)) : daysFromNow(1),
                    kind: "Suivi régulier",
                    variantHint: "brand",
                },
                {
                    schoolId: school.id,
                    anonymousLabel: "Famille Dossou",
                    startAt: new Date(setTime(daysFromNow(1), 14, 0)),
                    kind: "Entretien parents",
                    variantHint: "info",
                },
                {
                    schoolId: school.id,
                    anonymousLabel: "Anonyme · 3ᵉ A",
                    startAt: new Date(setTime(daysFromNow(2), 10, 30)),
                    kind: "Première écoute",
                    variantHint: "warning",
                },
                {
                    schoolId: school.id,
                    anonymousLabel: "Atelier 6ᵉ",
                    startAt: new Date(setTime(daysFromNow(3), 11, 0)),
                    kind: "Groupe · estime de soi",
                    variantHint: "success",
                },
                {
                    schoolId: school.id,
                    anonymousLabel: "Pierre Akin",
                    startAt: new Date(setTime(daysFromNow(4), 15, 0)),
                    kind: "Suivi P0",
                    variantHint: "danger",
                    isUrgent: true,
                },
            ],
        });

        console.log(`✅ ${school.name} — 7 signalements + 8 sem. pulse + 5 RDV`);
    }
}

function setTime(date: Date, hours: number, minutes: number): number {
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
