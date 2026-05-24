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

    const snapshot = await prisma.benchmarkSnapshot.findFirst({
        where: { schoolId },
        orderBy: { capturedAt: "desc" },
        include: { indicators: true },
    });

    if (!snapshot) {
        return NextResponse.json({
            schoolId,
            snapshot: null,
        });
    }

    return NextResponse.json(
        {
            schoolId,
            snapshot: {
                id: snapshot.id,
                capturedAt: snapshot.capturedAt.toISOString(),
                periodLabel: snapshot.periodLabel,
                rankNational: snapshot.rankNational,
                rankDept: snapshot.rankDept,
                rankPeerGroup: snapshot.rankPeerGroup,
                totalNational: snapshot.totalNational,
                totalDept: snapshot.totalDept,
                totalPeer: snapshot.totalPeer,
                scoreOverall: snapshot.scoreOverall,
                indicators: snapshot.indicators.map((i) => ({
                    id: i.id,
                    label: i.label,
                    schoolValue: i.schoolValue,
                    nationalValue: i.nationalValue,
                    departmentValue: i.departmentValue,
                    peerValue: i.peerValue,
                    unit: i.unit,
                    tone: i.tone,
                })),
            },
        },
        {
            headers: {
                "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
            },
        },
    );
}
