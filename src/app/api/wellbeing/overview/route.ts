import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const url = new URL(request.url);
    const requestedSchoolId = url.searchParams.get("schoolId");
    const accessError = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (accessError) return accessError;

    const schoolId = requestedSchoolId ?? getActiveSchoolId(session);
    if (!schoolId) {
        return NextResponse.json(
            { error: "Aucun établissement actif associé au compte." },
            { status: 400 },
        );
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [reports, activeReports, appointments, weeklyAppointmentsCount, pulseWeeks] = await Promise.all([
        prisma.wellbeingReport.findMany({
            where: { schoolId },
            orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
            take: 20,
        }),
        prisma.wellbeingReport.findMany({
            where: { schoolId, status: { in: ["OPEN", "IN_REVIEW", "IN_FOLLOWUP"] } },
            select: { id: true, tag: true, severity: true },
        }),
        prisma.psyAppointment.findMany({
            where: { schoolId, startAt: { gte: new Date(), lte: weekFromNow } },
            orderBy: { startAt: "asc" },
            take: 30,
        }),
        prisma.psyAppointment.count({
            where: { schoolId, startAt: { gte: weekAgo } },
        }),
        prisma.climatePulseWeek.findMany({
            where: { schoolId },
            orderBy: { weekStart: "desc" },
            take: 8,
        }),
    ]);

    const reportsAnonymous = activeReports.filter(
        (r) => r.tag === "ANONYME" || r.tag === "AUTO_IA",
    ).length;
    const reportsNominative = activeReports.length - reportsAnonymous;

    const sortedPulse = pulseWeeks.slice().reverse(); // chronological order S1..S8
    const latestPulse = pulseWeeks[0] ?? null;

    return NextResponse.json(
        {
            schoolId,
            kpis: {
                activeReports: activeReports.length,
                reportsAnonymous,
                reportsNominative,
                psyAppointmentsThisWeek: weeklyAppointmentsCount,
                climateScore: latestPulse ? latestPulse.averageScore : null,
                pulseResponses: latestPulse ? latestPulse.responses : 0,
            },
            reports: reports.map((r) => ({
                id: r.id,
                tag: r.tag,
                category: r.category,
                excerpt: r.excerpt,
                severity: r.severity,
                severityLabel: r.severityLabel,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
            })),
            pulseWeeks: sortedPulse.map((w, idx) => ({
                weekLabel: w.weekLabel,
                value: w.averageScore,
                isCurrent: idx === sortedPulse.length - 1,
                responses: w.responses,
            })),
            pulseStats: latestPulse
                ? [
                      { label: "Je me sens en sécurité", value: latestPulse.pctSafety, key: "safety" },
                      { label: "J'ai un ami proche", value: latestPulse.pctFriend, key: "friend" },
                      { label: "Un adulte m'écoute", value: latestPulse.pctAdultListens, key: "adult" },
                      { label: "Témoin harcèlement", value: latestPulse.pctHarassWitness, key: "harass" },
                  ]
                : [],
            appointments: appointments.map((a) => ({
                id: a.id,
                startAt: a.startAt.toISOString(),
                durationMinutes: a.durationMinutes,
                kind: a.kind,
                anonymousLabel: a.anonymousLabel,
                variantHint: a.variantHint,
                isUrgent: a.isUrgent,
            })),
            window: {
                monthAgoIso: monthAgo.toISOString(),
            },
        },
        {
            headers: {
                "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
            },
        },
    );
}
