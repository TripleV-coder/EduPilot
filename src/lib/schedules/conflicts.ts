import prisma from "@/lib/prisma";

export interface SlotQuery {
    classId: string;
    dayOfWeek: number;
    /** « HH:MM » (zéro initial : la comparaison de chaînes suit l'ordre horaire). */
    startTime: string;
    endTime: string;
    /** Enseignant de la matière du créneau, s'il y en a un. */
    teacherId: string | null;
    /** Créneau modifié, exclu de la recherche. */
    excludeId?: string;
}

/**
 * Chevauchement de deux plages [a, b) et [c, d) : a < d ET c < b. L'ancienne
 * condition ne voyait pas un créneau qui en ENGLOBE un autre (9h-10h existant,
 * 8h-11h accepté). Deux créneaux qui se touchent (fin = début) ne se chevauchent pas.
 */
function overlapping(startTime: string, endTime: string) {
    return { startTime: { lt: endTime }, endTime: { gt: startTime } };
}

/** « CLASS » ou « TEACHER » si le créneau en chevauche un autre, sinon null. */
export async function findScheduleConflict(slot: SlotQuery): Promise<"CLASS" | "TEACHER" | null> {
    const exclude = slot.excludeId ? { id: { not: slot.excludeId } } : {};
    const classConflict = await prisma.schedule.findFirst({
        where: { classId: slot.classId, dayOfWeek: slot.dayOfWeek, ...overlapping(slot.startTime, slot.endTime), ...exclude },
        select: { id: true },
    });
    if (classConflict) return "CLASS";
    if (slot.teacherId) {
        const teacherConflict = await prisma.schedule.findFirst({
            where: {
                classSubject: { teacherId: slot.teacherId },
                dayOfWeek: slot.dayOfWeek,
                ...overlapping(slot.startTime, slot.endTime),
                ...exclude,
            },
            select: { id: true },
        });
        if (teacherConflict) return "TEACHER";
    }
    return null;
}
