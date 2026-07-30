import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

// Accès restreint : cellule d'écoute = psychologue + direction uniquement.
const READ_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;
// Création : tout membre authentifié peut signaler (élève, parent,
// enseignant) — c'est le principe de la cellule d'écoute.
const TAGS = ["ANONYME", "PARENT", "ENSEIGNANT", "AUTO_IA", "NOMINATIF"] as const;
const SEVERITIES = ["P0", "P1", "P2"] as const;

// ─── GET /api/wellbeing/reports — liste filtrée ───────────────────────────
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!READ_ROLES.includes(session.user.role as (typeof READ_ROLES)[number])) {
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

    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");

    const where: Record<string, unknown> = { schoolId };
    if (status && ["OPEN", "IN_REVIEW", "IN_FOLLOWUP", "CLOSED"].includes(status)) {
        where.status = status;
    }
    if (severity && SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
        where.severity = severity;
    }

    const reports = await prisma.wellbeingReport.findMany({
        where,
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: 100,
    });

    return NextResponse.json({
        schoolId,
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
    });
}

// ─── POST /api/wellbeing/reports — nouveau signalement / dossier ──────────
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

    const { tag, category, excerpt, severity, severityLabel, anonymous, reportedUserId } =
        (body ?? {}) as {
            tag?: string;
            category?: string;
            excerpt?: string;
            severity?: string;
            severityLabel?: string;
            anonymous?: boolean;
            reportedUserId?: string;
        };

    if (!TAGS.includes(tag as (typeof TAGS)[number])) {
        return NextResponse.json({ error: "Tag de signalement invalide." }, { status: 400 });
    }
    if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
        return NextResponse.json({ error: "Sévérité invalide (P0/P1/P2)." }, { status: 400 });
    }
    if (!category || typeof category !== "string" || !category.trim()) {
        return NextResponse.json({ error: "La catégorie est requise." }, { status: 400 });
    }
    if (!excerpt || typeof excerpt !== "string" || excerpt.trim().length < 10) {
        return NextResponse.json(
            { error: "La description est requise (10 caractères minimum)." },
            { status: 400 },
        );
    }

    const report = await prisma.wellbeingReport.create({
        data: {
            schoolId,
            // Anonymat by design : si anonymous, on ne stocke AUCUN lien
            // vers le compte déclarant.
            reporterUserId: anonymous || tag === "ANONYME" ? null : session.user.id,
            reportedUserId: reportedUserId || null,
            tag: tag as (typeof TAGS)[number],
            category: category.trim(),
            excerpt: excerpt.trim(),
            severity: severity as (typeof SEVERITIES)[number],
            severityLabel: severityLabel?.trim() || null,
        },
    });

    return NextResponse.json({ id: report.id }, { status: 201 });
}
