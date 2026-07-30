import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const READ_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;
const STATUSES = ["OPEN", "IN_REVIEW", "IN_FOLLOWUP", "CLOSED"] as const;
const SEVERITIES = ["P0", "P1", "P2"] as const;

// ─── GET /api/wellbeing/reports/[reportId] — dossier détaillé ─────────────
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!READ_ROLES.includes(session.user.role as (typeof READ_ROLES)[number])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { reportId } = await params;
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
        return NextResponse.json(
            { error: "Aucun établissement actif associé au compte." },
            { status: 400 },
        );
    }

    const report = await prisma.wellbeingReport.findFirst({
        where: { id: reportId, schoolId },
        include: {
            reporter: { select: { firstName: true, lastName: true, role: true } },
            reportedAbout: { select: { firstName: true, lastName: true } },
        },
    });

    if (!report) {
        return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    // Rendez-vous psy liés à l'élève concerné (si nominatif).
    const appointments = report.reportedUserId
        ? await prisma.psyAppointment.findMany({
              where: { schoolId, studentUserId: report.reportedUserId },
              orderBy: { startAt: "desc" },
              take: 10,
          })
        : [];

    return NextResponse.json({
        id: report.id,
        tag: report.tag,
        category: report.category,
        excerpt: report.excerpt,
        severity: report.severity,
        severityLabel: report.severityLabel,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        // Anonymat respecté : reporter null si signalement anonyme.
        reporterLabel: report.reporter
            ? `${report.reporter.firstName ?? ""} ${report.reporter.lastName ?? ""}`.trim()
            : null,
        reporterRole: report.reporter?.role ?? null,
        reportedAboutLabel: report.reportedAbout
            ? `${report.reportedAbout.firstName ?? ""} ${report.reportedAbout.lastName ?? ""}`.trim()
            : null,
        appointments: appointments.map((a) => ({
            id: a.id,
            startAt: a.startAt.toISOString(),
            durationMinutes: a.durationMinutes,
            kind: a.kind,
            isUrgent: a.isUrgent,
        })),
    });
}

// ─── PATCH /api/wellbeing/reports/[reportId] — statut / sévérité ──────────
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!READ_ROLES.includes(session.user.role as (typeof READ_ROLES)[number])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { reportId } = await params;
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
        return NextResponse.json(
            { error: "Aucun établissement actif associé au compte." },
            { status: 400 },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const { status, severity, severityLabel } = (body ?? {}) as {
        status?: string;
        severity?: string;
        severityLabel?: string;
    };

    const data: Record<string, unknown> = {};
    if (status !== undefined) {
        if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
            return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
        }
        data.status = status;
    }
    if (severity !== undefined) {
        if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
            return NextResponse.json({ error: "Sévérité invalide." }, { status: 400 });
        }
        data.severity = severity;
    }
    if (severityLabel !== undefined) {
        data.severityLabel = severityLabel?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
    }

    const existing = await prisma.wellbeingReport.findFirst({
        where: { id: reportId, schoolId },
        select: { id: true },
    });
    if (!existing) {
        return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const updated = await prisma.wellbeingReport.update({
        where: { id: reportId },
        data,
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
}
