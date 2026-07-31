/**
 * AI Predictive Service — Dropout / Disengagement Risk
 *
 * Mesure une TRAJECTOIRE DE DÉSENGAGEMENT, distincte du risque d'échec
 * (qui parle de niveau de notes). Le décrochage combine des signaux
 * dynamiques : détérioration de l'assiduité, absences consécutives, abandon
 * progressif des devoirs, effondrement des notes, escalade comportementale et
 * récence d'engagement.
 *
 * 100% local et déterministe. Ne lève jamais d'exception : défaut prudent
 * quand les données sont insuffisantes.
 */

import prisma from "@/lib/prisma";
import type { DropoutRisk, DropoutSignal, RiskLevel, DataQuality } from "./types";
import { linearRegression } from "./algorithms/regression";

const DAY = 24 * 60 * 60 * 1000;

// Pondération des signaux (somme = 1)
export const DROPOUT_WEIGHTS = {
    attendanceTrend: 0.3,
    consecutiveAbsences: 0.2,
    homeworkAbandon: 0.2,
    gradeCollapse: 0.15,
    behaviorEscalation: 0.1,
    engagementRecency: 0.05,
} as const;

function levelFromScore(score: number): RiskLevel {
    if (score >= 75) return "TRÈS ÉLEVÉ";
    if (score >= 55) return "ÉLEVÉ";
    if (score >= 35) return "MODÉRÉ";
    if (score >= 15) return "FAIBLE";
    return "TRÈS FAIBLE";
}

function severityFromScore(score: number): DropoutSignal["severity"] {
    if (score >= 70) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
}

/** Taux d'absences non justifiées (ABSENT) sur un ensemble de relevés. */
function unexcusedRate(records: { status: string }[]): number {
    if (records.length === 0) return 0;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    return (absent / records.length) * 100;
}

/** Plus longue série d'absences non justifiées consécutives (relevés triés par date). */
function longestAbsenceStreak(records: { status: string; date: Date }[]): number {
    const sorted = [...records].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let longest = 0;
    let current = 0;
    for (const r of sorted) {
        if (r.status === "ABSENT") {
            current += 1;
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    }
    return longest;
}

export async function predictDropoutRisk(studentId: string): Promise<DropoutRisk> {
    const now = Date.now();
    const since60 = new Date(now - 60 * DAY);

    const [attendance, submissions, gradeHistory, incidents] = await Promise.all([
        prisma.attendance.findMany({
            where: { studentId, date: { gte: since60 } },
            select: { status: true, date: true },
        }),
        prisma.homeworkSubmission.findMany({
            where: { studentId, createdAt: { gte: since60 } },
            select: { createdAt: true },
        }),
        prisma.gradeHistory.findMany({
            where: { studentId, subjectId: null },
            orderBy: { period: { sequence: "asc" } },
            select: { average: true },
        }),
        prisma.behaviorIncident.findMany({
            where: { studentId, date: { gte: since60 } },
            select: { date: true },
        }),
    ]);

    const signals: DropoutSignal[] = [];
    const recommendations: string[] = [];

    const recentWindow = (d: Date) => new Date(d).getTime() > now - 30 * DAY;
    const priorWindow = (d: Date) => {
        const t = new Date(d).getTime();
        return t <= now - 30 * DAY && t > now - 60 * DAY;
    };

    // 1. Tendance d'assiduité (0-30j vs 30-60j)
    let attendanceScore = 0;
    const recentAtt = attendance.filter((a) => recentWindow(a.date));
    const priorAtt = attendance.filter((a) => priorWindow(a.date));
    if (recentAtt.length > 0) {
        const recentRate = unexcusedRate(recentAtt);
        const priorRate = priorAtt.length > 0 ? unexcusedRate(priorAtt) : recentRate;
        // Niveau absolu + aggravation
        const delta = Math.max(0, recentRate - priorRate);
        attendanceScore = Math.min(100, recentRate * 0.6 + delta * 2);
        if (attendanceScore >= 30) {
            signals.push({
                factor: "assiduite_en_deterioration",
                severity: severityFromScore(attendanceScore),
                contribution: Math.round(attendanceScore),
                description: `Absences non justifiées ${recentRate.toFixed(0)}% (30 derniers j.)${
                    delta > 0 ? `, en hausse vs ${priorRate.toFixed(0)}%` : ""
                }`,
            });
            recommendations.push("Contacter les parents au sujet des absences répétées");
        }
    }

    // 2. Absences consécutives (30 derniers j.)
    let streakScore = 0;
    const streak = longestAbsenceStreak(recentAtt);
    if (streak >= 2) {
        streakScore = Math.min(100, streak * 25);
        signals.push({
            factor: "absences_consecutives",
            severity: severityFromScore(streakScore),
            contribution: Math.round(streakScore),
            description: `${streak} absences non justifiées consécutives`,
        });
        recommendations.push("Vérifier la situation de l'élève (décrochage possible)");
    }

    // 3. Abandon des devoirs (taux de rendu en baisse)
    let homeworkScore = 0;
    const [recentDue, priorDue] = await Promise.all([
        prisma.homework.count({
            where: {
                isPublished: true,
                dueDate: { gte: new Date(now - 30 * DAY), lte: new Date(now) },
                classSubject: {
                    class: { enrollments: { some: { studentId, status: "ACTIVE" } } },
                },
            },
        }),
        prisma.homework.count({
            where: {
                isPublished: true,
                dueDate: { gte: new Date(now - 60 * DAY), lt: new Date(now - 30 * DAY) },
                classSubject: {
                    class: { enrollments: { some: { studentId, status: "ACTIVE" } } },
                },
            },
        }),
    ]);
    const recentSubs = submissions.filter((s) => recentWindow(s.createdAt)).length;
    const priorSubs = submissions.filter((s) => priorWindow(s.createdAt)).length;
    if (recentDue > 0) {
        const recentRate = Math.min(100, (recentSubs / recentDue) * 100);
        const priorRate = priorDue > 0 ? Math.min(100, (priorSubs / priorDue) * 100) : recentRate;
        const drop = Math.max(0, priorRate - recentRate);
        // Score = faiblesse du rendu récent + accélération de la baisse
        homeworkScore = Math.min(100, (100 - recentRate) * 0.5 + drop * 1.5);
        if (homeworkScore >= 30) {
            signals.push({
                factor: "abandon_devoirs",
                severity: severityFromScore(homeworkScore),
                contribution: Math.round(homeworkScore),
                description: `Rendu des devoirs ${recentRate.toFixed(0)}%${
                    drop > 0 ? `, en baisse vs ${priorRate.toFixed(0)}%` : ""
                }`,
            });
            recommendations.push("Mettre en place un suivi rapproché des devoirs");
        }
    }

    // 4. Effondrement des notes (pente négative)
    let gradeScore = 0;
    if (gradeHistory.length >= 2) {
        const points = gradeHistory.map((g, i) => ({ x: i + 1, y: Number(g.average) }));
        const { slope } = linearRegression(points);
        if (slope < 0) {
            gradeScore = Math.min(100, Math.abs(slope) * 30);
            if (gradeScore >= 20) {
                signals.push({
                    factor: "effondrement_notes",
                    severity: severityFromScore(gradeScore),
                    contribution: Math.round(gradeScore),
                    description: `Moyenne en baisse de ${Math.abs(slope).toFixed(2)} pt/période`,
                });
                recommendations.push("Soutien scolaire ciblé pour enrayer la baisse");
            }
        }
    }

    // 5. Escalade comportementale (0-30j vs 30-60j)
    let behaviorScore = 0;
    const recentInc = incidents.filter((i) => recentWindow(i.date)).length;
    const priorInc = incidents.filter((i) => priorWindow(i.date)).length;
    if (recentInc > priorInc && recentInc > 0) {
        behaviorScore = Math.min(100, (recentInc - priorInc) * 25 + recentInc * 10);
        signals.push({
            factor: "escalade_comportementale",
            severity: severityFromScore(behaviorScore),
            contribution: Math.round(behaviorScore),
            description: `Incidents en hausse : ${priorInc} → ${recentInc} sur 30 j.`,
        });
        recommendations.push("Entretien avec le conseiller d'éducation");
    }

    // 6. Récence d'engagement (jours depuis dernière présence / dernier devoir)
    let recencyScore = 0;
    const lastPresent = attendance
        .filter((a) => a.status === "PRESENT" || a.status === "LATE")
        .map((a) => new Date(a.date).getTime());
    const lastSub = submissions.map((s) => new Date(s.createdAt).getTime());
    const lastEngagement = Math.max(0, ...lastPresent, ...lastSub);
    if (lastEngagement > 0) {
        const daysSince = (now - lastEngagement) / DAY;
        if (daysSince > 7) {
            recencyScore = Math.min(100, (daysSince - 7) * 8);
            if (recencyScore >= 20) {
                signals.push({
                    factor: "engagement_faible",
                    severity: severityFromScore(recencyScore),
                    contribution: Math.round(recencyScore),
                    description: `Aucun engagement observé depuis ${Math.round(daysSince)} jours`,
                });
            }
        }
    }

    // Score composite pondéré
    const probability = Math.min(
        100,
        Math.round(
            attendanceScore * DROPOUT_WEIGHTS.attendanceTrend +
                streakScore * DROPOUT_WEIGHTS.consecutiveAbsences +
                homeworkScore * DROPOUT_WEIGHTS.homeworkAbandon +
                gradeScore * DROPOUT_WEIGHTS.gradeCollapse +
                behaviorScore * DROPOUT_WEIGHTS.behaviorEscalation +
                recencyScore * DROPOUT_WEIGHTS.engagementRecency
        )
    );

    // Qualité des données : disponibilité assiduité + notes
    const dataPoints = attendance.length + gradeHistory.length;
    let dataQuality: DataQuality = "LOW";
    if (dataPoints >= 20) dataQuality = "HIGH";
    else if (dataPoints >= 8) dataQuality = "MEDIUM";

    const confidence =
        dataQuality === "HIGH" ? 85 : dataQuality === "MEDIUM" ? 60 : 30;

    signals.sort((a, b) => b.contribution - a.contribution);

    if (recommendations.length === 0) {
        recommendations.push("Aucun signe de décrochage — poursuivre le suivi habituel");
    }

    return {
        probability,
        level: levelFromScore(probability),
        signals,
        recommendations: [...new Set(recommendations)],
        confidence,
        dataQuality,
    };
}
