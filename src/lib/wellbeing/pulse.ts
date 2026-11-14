import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Pulse climat hebdomadaire : 5 questions, réponses ANONYMES.
 *
 * - Une participation par élève et par semaine (`ClimatePulseParticipation`
 *   garde QUI a répondu, jamais QUOI) ;
 * - les réponses n'existent qu'agrégées dans `ClimatePulseWeek` (compteurs,
 *   moyenne et pourcentages recalculés à chaque réponse) ;
 * - seuil d'anonymat : aucune statistique n'est montrée sous
 *   `PULSE_MIN_RESPONSES` réponses (une moyenne sur 2 élèves révèle leurs notes).
 */
export const PULSE_MIN_RESPONSES = 5;

/** Bénin : UTC+1 sans heure d'été — la semaine commence le lundi 00 h, heure de Cotonou. */
const BENIN_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PulseWeek {
    /** Instant UTC du lundi 00 h (heure du Bénin). */
    weekStart: Date;
    /** Unique par école : « 2026-S45 » (année ISO + numéro de semaine ISO). */
    weekLabel: string;
}

export function pulseWeekOf(now: Date = new Date()): PulseWeek {
    const local = new Date(now.getTime() + BENIN_OFFSET_MS);
    const dayIndex = (local.getUTCDay() + 6) % 7; // lundi = 0
    const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dayIndex);
    // Semaine ISO : celle qui contient le jeudi
    const thursday = new Date(mondayLocal + 3 * DAY_MS);
    const isoYear = thursday.getUTCFullYear();
    const firstThursday = Date.UTC(isoYear, 0, 4);
    const firstMonday = firstThursday - ((new Date(firstThursday).getUTCDay() + 6) % 7) * DAY_MS;
    const week = Math.floor((mondayLocal - firstMonday) / (7 * DAY_MS)) + 1;
    return {
        weekStart: new Date(mondayLocal - BENIN_OFFSET_MS),
        weekLabel: `${isoYear}-S${String(week).padStart(2, "0")}`,
    };
}

/** Libellé court affiché dans les graphiques (« S45 »). */
export function shortWeekLabel(weekLabel: string): string {
    return weekLabel.replace(/^\d{4}-S0?/, "S");
}

export const pulseAnswerSchema = z.object({
    score: z.number().int().min(0).max(10),
    safety: z.boolean(),
    friend: z.boolean(),
    adultListens: z.boolean(),
    harassWitness: z.boolean(),
});
export type PulseAnswer = z.infer<typeof pulseAnswerSchema>;

export const PULSE_QUESTIONS = {
    score: "Sur 10, comment te sens-tu à l'école cette semaine ?",
    safety: "Je me sens en sécurité à l'école.",
    friend: "J'ai au moins un ami proche à l'école.",
    adultListens: "Un adulte de l'école m'écoute quand j'en ai besoin.",
    harassWitness: "Cette semaine, j'ai vu un élève se faire harceler.",
} as const;

const pct = (yes: number, total: number) => Math.round((yes / total) * 1000) / 10;

export class PulseAlreadyAnsweredError extends Error {
    constructor() {
        super("Tu as déjà répondu cette semaine. Merci ! Le prochain questionnaire ouvre lundi.");
    }
}

/**
 * Enregistre une réponse : participation + compteurs incrémentés dans la même
 * transaction. Les incréments sont atomiques ; la ligne de la semaine reste
 * verrouillée jusqu'à la validation, donc les dérivés (moyenne, %) recalculés
 * ensuite incluent toujours les réponses concurrentes déjà validées.
 */
export async function recordPulseResponse(schoolId: string, userId: string, answer: PulseAnswer, now = new Date()) {
    const { weekStart, weekLabel } = pulseWeekOf(now);
    // Deux premières réponses simultanées de la semaine : l'une crée la ligne,
    // l'autre échoue sur l'unicité (école, semaine) et est rejouée une fois
    // (la ligne existe alors : simple incrément).
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await writePulseResponse(schoolId, userId, weekStart, weekLabel, answer);
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
            if (isParticipationConflict(error)) throw new PulseAlreadyAnsweredError();
            if (attempt >= 1) throw error;
        }
    }
}

function isParticipationConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
    const target = error.meta?.target;
    const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
    return text.includes("userId") || text.includes("participations");
}

async function writePulseResponse(
    schoolId: string,
    userId: string,
    weekStart: Date,
    weekLabel: string,
    answer: PulseAnswer,
) {
    return prisma.$transaction(async (tx) => {
        await tx.climatePulseParticipation.create({ data: { schoolId, userId, weekStart } });
        const counters = await tx.climatePulseWeek.upsert({
            where: { schoolId_weekLabel: { schoolId, weekLabel } },
            create: {
                schoolId,
                weekLabel,
                weekStart,
                averageScore: answer.score,
                responses: 1,
                scoreSum: answer.score,
                safetyYes: answer.safety ? 1 : 0,
                friendYes: answer.friend ? 1 : 0,
                adultYes: answer.adultListens ? 1 : 0,
                harassYes: answer.harassWitness ? 1 : 0,
            },
            update: {
                responses: { increment: 1 },
                scoreSum: { increment: answer.score },
                safetyYes: { increment: answer.safety ? 1 : 0 },
                friendYes: { increment: answer.friend ? 1 : 0 },
                adultYes: { increment: answer.adultListens ? 1 : 0 },
                harassYes: { increment: answer.harassWitness ? 1 : 0 },
            },
        });
        const total = counters.responses;
        await tx.climatePulseWeek.update({
            where: { id: counters.id },
            data: {
                averageScore: Math.round((counters.scoreSum / total) * 10) / 10,
                pctSafety: pct(counters.safetyYes, total),
                pctFriend: pct(counters.friendYes, total),
                pctAdultListens: pct(counters.adultYes, total),
                pctHarassWitness: pct(counters.harassYes, total),
            },
        });
        return { weekLabel };
    });
}

export async function hasAnsweredPulse(userId: string, now = new Date()): Promise<boolean> {
    const { weekStart } = pulseWeekOf(now);
    const found = await prisma.climatePulseParticipation.findUnique({
        where: { userId_weekStart: { userId, weekStart } },
        select: { id: true },
    });
    return found !== null;
}
