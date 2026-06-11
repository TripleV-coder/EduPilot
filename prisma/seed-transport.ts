/**
 * Seed Transport — lignes, bus, arrêts et affectations élèves (demo per school)
 *
 * Run: `npx tsx prisma/seed-transport.ts`
 * Idempotent: skips schools that already have TransportLine rows.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LINE_TEMPLATES = [
    {
        number: "L1",
        label: "Ganhi → Campus",
        status: "ON_TIME" as const,
        note: null,
        stops: ["Carrefour Ganhi", "Marché Tokpa", "Étoile Rouge", "Campus"],
        bus: { plate: "AB-2041-RB", capacity: 45, driver: "Pierre Agossou", phone: "+22997010203" },
    },
    {
        number: "L2",
        label: "Calavi → Campus",
        status: "DELAYED" as const,
        note: "Embouteillage pont de Calavi, retard estimé 15 min",
        stops: ["Carrefour Calavi", "IITA", "Godomey", "Campus"],
        bus: { plate: "AB-3387-RB", capacity: 60, driver: "Honorine Dossa", phone: "+22996040506" },
    },
    {
        number: "L3",
        label: "Akpakpa → Campus",
        status: "ON_TIME" as const,
        note: null,
        stops: ["Marché Sègbèya", "Pont Martin Luther King", "Dantokpa", "Campus"],
        bus: { plate: "AB-1129-RB", capacity: 30, driver: "Rachidi Soulé", phone: "+22995070809" },
    },
];

async function main() {
    const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });

    if (schools.length === 0) {
        console.log("Aucune école active trouvée — rien à seed.");
        return;
    }

    for (const school of schools) {
        const existing = await prisma.transportLine.count({ where: { schoolId: school.id } });
        if (existing > 0) {
            console.log(`⏭️  ${school.name} — déjà ${existing} lignes, skip.`);
            continue;
        }

        // Élèves actifs de l'école à répartir sur les lignes
        const students = await prisma.studentProfile.findMany({
            where: { schoolId: school.id, deletedAt: null },
            select: { id: true },
            take: 90,
        });

        let lineIndex = 0;
        for (const template of LINE_TEMPLATES) {
            const line = await prisma.transportLine.create({
                data: {
                    schoolId: school.id,
                    number: template.number,
                    label: template.label,
                    status: template.status,
                    note: template.note,
                    stops: {
                        create: template.stops.map((name, order) => ({
                            name,
                            order,
                            scheduledTime: `0${7 + Math.floor(order / 2)}:${order % 2 === 0 ? "05" : "35"}`,
                        })),
                    },
                    buses: {
                        create: {
                            schoolId: school.id,
                            plateNumber: template.bus.plate,
                            capacity: template.bus.capacity,
                            driverName: template.bus.driver,
                            driverPhone: template.bus.phone,
                        },
                    },
                },
                include: { stops: { orderBy: { order: "asc" } } },
            });

            // Un tiers des élèves par ligne, répartis sur les arrêts
            const slice = students.slice(lineIndex * 30, (lineIndex + 1) * 30);
            if (slice.length > 0) {
                await prisma.studentTransport.createMany({
                    data: slice.map((student, index) => ({
                        studentId: student.id,
                        lineId: line.id,
                        stopId: line.stops[index % line.stops.length]?.id ?? null,
                    })),
                    skipDuplicates: true,
                });
            }

            console.log(
                `   🚌 ${school.name} — ${template.number} ${template.label} (${slice.length} élèves)`
            );
            lineIndex++;
        }
    }

    console.log("✅ Seed transport terminé.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
