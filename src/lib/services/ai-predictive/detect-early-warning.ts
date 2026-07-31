/**
 * AI Predictive Service — Early Warning Detection
 *
 * Détecte des signaux AIGUS PONCTUELS (déclencheurs) plutôt que des tendances
 * lentes : chute soudaine de note, absences consécutives, arrêt des devoirs,
 * pic comportemental. Chaque signal est actionnable immédiatement.
 *
 * 100% local et déterministe. Ne lève jamais d'exception.
 */

import prisma from "@/lib/prisma";
import type { EarlyWarning } from "./types";
import { detectAnomalies, temporalWeightedAverage } from "./algorithms/statistics";

const DAY = 24 * 60 * 60 * 1000;

/** Seuils centralisés (calibrage + tests). */
export const EARLY_WARNING_THRESHOLDS = {
    gradeDropPoints: 3, // chute vs baseline pondérée (points/20)
    attendanceCliffAbsences: 3, // absences non justifiées consécutives
    windowDays: 14, // fenêtre d'observation des signaux aigus
    homeworkStopMinDue: 2, // devoirs dus min. pour signaler l'arrêt
    behaviorSpikeCount: 2, // incidents HIGH/CRITICAL dans la fenêtre
} as const;

function longestAbsenceStreak(records: { status: string; date: Date }[]): {
    length: number;
    since: Date | null;
} {
    const sorted = [...records].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let length = 0;
    let since: Date | null = null;
    let current = 0;
    let currentStart: Date | null = null;
    for (const r of sorted) {
        if (r.status === "ABSENT") {
            if (current === 0) currentStart = new Date(r.date);
            current += 1;
            if (current > length) {
                length = current;
                since = currentStart;
            }
        } else {
            current = 0;
            currentStart = null;
        }
    }
    return { length, since };
}

export async function detectEarlyWarnings(studentId: string): Promise<EarlyWarning[]> {
    const now = Date.now();
    const windowStart = new Date(now - EARLY_WARNING_THRESHOLDS.windowDays * DAY);

    const [gradeHistory, attendance, submissions, incidents] = await Promise.all([
        prisma.gradeHistory.findMany({
            where: { studentId, subjectId: null },
            orderBy: { period: { sequence: "asc" } },
            select: { average: true },
        }),
        prisma.attendance.findMany({
            where: { studentId, date: { gte: windowStart } },
            select: { status: true, date: true },
        }),
        prisma.homeworkSubmission.findMany({
            where: { studentId, createdAt: { gte: windowStart } },
            select: { id: true },
        }),
        prisma.behaviorIncident.findMany({
            where: { studentId, date: { gte: windowStart } },
            select: { severity: true, date: true },
        }),
    ]);

    const warnings: EarlyWarning[] = [];

    // 1. GRADE_DROP — chute soudaine vs baseline pondérée, ou anomalie z-score
    if (gradeHistory.length >= 2) {
        const values = gradeHistory.map((g) => Number(g.average));
        const latest = values[values.length - 1];
        const baseline = temporalWeightedAverage(values.slice(0, -1));
        const drop = baseline - latest;

        const anomalies = detectAnomalies(values);
        const isAnomalousDrop = anomalies[anomalies.length - 1] && latest < baseline;

        if (drop >= EARLY_WARNING_THRESHOLDS.gradeDropPoints || isAnomalousDrop) {
            warnings.push({
                type: "GRADE_DROP",
                severity: drop >= 2 * EARLY_WARNING_THRESHOLDS.gradeDropPoints ? "CRITICAL" : "WARNING",
                value: Math.round(drop * 100) / 100,
                message: `Chute de moyenne de ${drop.toFixed(1)} pt (${latest.toFixed(1)}/20 vs baseline ${baseline.toFixed(1)}/20)`,
                since: null,
            });
        }
    }

    // 2. ATTENDANCE_CLIFF — absences non justifiées consécutives
    const streak = longestAbsenceStreak(attendance);
    if (streak.length >= EARLY_WARNING_THRESHOLDS.attendanceCliffAbsences) {
        warnings.push({
            type: "ATTENDANCE_CLIFF",
            severity: streak.length >= 5 ? "CRITICAL" : "WARNING",
            value: streak.length,
            message: `${streak.length} absences non justifiées consécutives`,
            since: streak.since,
        });
    }

    // 3. HOMEWORK_STOP — aucun rendu alors que des devoirs étaient dus
    if (submissions.length === 0) {
        const dueInWindow = await prisma.homework.count({
            where: {
                isPublished: true,
                dueDate: { gte: windowStart, lte: new Date(now) },
                classSubject: {
                    class: { enrollments: { some: { studentId, status: "ACTIVE" } } },
                },
            },
        });
        if (dueInWindow >= EARLY_WARNING_THRESHOLDS.homeworkStopMinDue) {
            warnings.push({
                type: "HOMEWORK_STOP",
                severity: dueInWindow >= 4 ? "CRITICAL" : "WARNING",
                value: dueInWindow,
                message: `Aucun devoir rendu sur ${EARLY_WARNING_THRESHOLDS.windowDays} jours (${dueInWindow} attendus)`,
                since: windowStart,
            });
        }
    }

    // 4. BEHAVIOR_SPIKE — pic d'incidents graves
    const severeIncidents = incidents.filter(
        (i) => i.severity === "HIGH" || i.severity === "CRITICAL"
    );
    if (severeIncidents.length >= EARLY_WARNING_THRESHOLDS.behaviorSpikeCount) {
        const earliest = severeIncidents
            .map((i) => new Date(i.date).getTime())
            .reduce((min, t) => Math.min(min, t), now);
        warnings.push({
            type: "BEHAVIOR_SPIKE",
            severity: severeIncidents.some((i) => i.severity === "CRITICAL") ? "CRITICAL" : "WARNING",
            value: severeIncidents.length,
            message: `${severeIncidents.length} incidents graves sur ${EARLY_WARNING_THRESHOLDS.windowDays} jours`,
            since: new Date(earliest),
        });
    }

    return warnings;
}
