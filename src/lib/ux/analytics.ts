import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Couche de LECTURE de la télémétrie UX.
 *
 * L'ingestion existe déjà (modèle `TelemetryEvent`, `POST /api/ux/events`).
 * Ce module agrège ces événements pour l'activation, la rétention et les
 * événements les plus fréquents. Aucune donnée n'est collectée ici.
 */

export interface ActivationFunnel {
    /** Utilisateurs distincts ayant vu la checklist d'onboarding. */
    viewed: number;
    /** Utilisateurs distincts ayant coché au moins une étape. */
    checkedStep: number;
    /** Utilisateurs distincts ayant terminé l'onboarding. */
    completed: number;
    /** Taux de complétion (completed / viewed), 0 si aucun viewed. */
    completionRate: number;
}

export interface RetentionPoint {
    /** Fenêtre (1, 7 ou 30 jours). */
    day: number;
    /** Utilisateurs éligibles (première activité il y a ≥ `day` jours). */
    eligible: number;
    /** Éligibles revenus au moins `day` jours après leur première activité. */
    retained: number;
    /** retained / eligible, 0 si aucun éligible. */
    rate: number;
}

export interface TopEvent {
    event: string;
    count: number;
}

export interface UxAnalytics {
    windowDays: number;
    totalEvents: number;
    distinctUsers: number;
    activation: ActivationFunnel;
    retention: RetentionPoint[];
    topEvents: TopEvent[];
    generatedAt: string;
}

type FunnelRow = { viewed: number; checked: number; completed: number };
type RetentionRow = { eligible: number; retained: number };

function ratio(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Math.round((numerator / denominator) * 1000) / 1000;
}

async function getActivationFunnel(): Promise<ActivationFunnel> {
    const rows = await prisma.$queryRaw<FunnelRow[]>(Prisma.sql`
        SELECT
            COUNT(DISTINCT "userId") FILTER (WHERE payload->>'event' = 'viewed')::int AS viewed,
            COUNT(DISTINCT "userId") FILTER (WHERE payload->>'event' = 'checked_step')::int AS checked,
            COUNT(DISTINCT "userId") FILTER (WHERE payload->>'event' = 'completed')::int AS completed
        FROM telemetry_events
        WHERE event = 'onboarding_event' AND "userId" IS NOT NULL
    `);
    const row = rows[0] ?? { viewed: 0, checked: 0, completed: 0 };
    return {
        viewed: row.viewed ?? 0,
        checkedStep: row.checked ?? 0,
        completed: row.completed ?? 0,
        completionRate: ratio(row.completed ?? 0, row.viewed ?? 0),
    };
}

async function getRetentionPoint(day: number): Promise<RetentionPoint> {
    // Rétention glissante : parmi les utilisateurs dont la première activité
    // date d'au moins `day` jours, combien sont revenus au moins `day` jours
    // après cette première activité.
    const rows = await prisma.$queryRaw<RetentionRow[]>(Prisma.sql`
        WITH spans AS (
            SELECT "userId",
                   MIN("createdAt") AS first_seen,
                   MAX("createdAt") AS last_seen
            FROM telemetry_events
            WHERE "userId" IS NOT NULL
            GROUP BY "userId"
        )
        SELECT
            COUNT(*) FILTER (
                WHERE first_seen <= NOW() - (${day} * INTERVAL '1 day')
            )::int AS eligible,
            COUNT(*) FILTER (
                WHERE first_seen <= NOW() - (${day} * INTERVAL '1 day')
                  AND last_seen >= first_seen + (${day} * INTERVAL '1 day')
            )::int AS retained
        FROM spans
    `);
    const row = rows[0] ?? { eligible: 0, retained: 0 };
    return {
        day,
        eligible: row.eligible ?? 0,
        retained: row.retained ?? 0,
        rate: ratio(row.retained ?? 0, row.eligible ?? 0),
    };
}

async function getTopEvents(windowDays: number, limit = 10): Promise<TopEvent[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const grouped = await prisma.telemetryEvent.groupBy({
        by: ["event"],
        where: { createdAt: { gte: since } },
        _count: { event: true },
        orderBy: { _count: { event: "desc" } },
        take: limit,
    });
    return grouped.map((g) => ({ event: g.event, count: g._count.event }));
}

/**
 * Agrège l'ensemble des métriques UX sur une fenêtre donnée (défaut 30 jours).
 */
export async function getUxAnalytics(windowDays = 30): Promise<UxAnalytics> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [totalEvents, distinctUsersRows, activation, r1, r7, r30, topEvents] =
        await Promise.all([
            prisma.telemetryEvent.count({ where: { createdAt: { gte: since } } }),
            prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
                SELECT COUNT(DISTINCT "userId")::int AS count
                FROM telemetry_events
                WHERE "userId" IS NOT NULL AND "createdAt" >= ${since}
            `),
            getActivationFunnel(),
            getRetentionPoint(1),
            getRetentionPoint(7),
            getRetentionPoint(30),
            getTopEvents(windowDays),
        ]);

    return {
        windowDays,
        totalEvents,
        distinctUsers: distinctUsersRows[0]?.count ?? 0,
        activation,
        retention: [r1, r7, r30],
        topEvents,
        generatedAt: new Date().toISOString(),
    };
}
