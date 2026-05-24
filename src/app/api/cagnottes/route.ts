import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALLOWED_ROLES = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "DIRECTOR",
    "TEACHER",
    "PARENT",
] as const;

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

    const status = url.searchParams.get("status");
    const where: { schoolId: string; status?: "OPEN" | "CLOSED" | "CANCELLED" } = {
        schoolId,
    };
    if (status === "OPEN" || status === "CLOSED" || status === "CANCELLED") {
        where.status = status;
    }

    const cagnottes = await prisma.cagnotte.findMany({
        where,
        orderBy: [{ status: "asc" }, { deadline: "asc" }],
        include: {
            host: {
                select: { id: true, firstName: true, lastName: true, role: true },
            },
            class: {
                select: { id: true, name: true, classLevel: { select: { name: true } } },
            },
            contributions: {
                select: {
                    id: true,
                    parentUserId: true,
                    amountFcfa: true,
                    paidAt: true,
                    parent: {
                        select: { firstName: true, lastName: true },
                    },
                },
                orderBy: { paidAt: "desc" },
            },
        },
    });

    // Compute aggregates + viewer-specific data (their own contribution)
    const viewerId = session.user.id;

    const payload = cagnottes.map((c) => {
        const raisedFcfa = c.contributions.reduce<bigint>(
            (sum, x) => sum + x.amountFcfa,
            BigInt(0),
        );
        const participantIds = new Set(c.contributions.map((x) => x.parentUserId));
        const myContribution = c.contributions
            .filter((x) => x.parentUserId === viewerId)
            .reduce<bigint>((sum, x) => sum + x.amountFcfa, BigInt(0));
        const lastContrib = c.contributions[0];

        const daysLeft = Math.max(
            0,
            Math.ceil((c.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        );

        const recentInitials = c.contributions.slice(0, 6).map((x) => {
            const f = (x.parent?.firstName ?? "?").slice(0, 1).toUpperCase();
            const l = (x.parent?.lastName ?? "?").slice(0, 1).toUpperCase();
            return `${f}${l}`;
        });

        const hostLabel = c.host
            ? `${c.host.firstName ?? ""} ${c.host.lastName ?? ""}`.trim() || "Organisateur"
            : "Organisateur";

        const classLabel = c.class
            ? `${c.class.classLevel?.name ?? ""} ${c.class.name}`.trim()
            : null;

        return {
            id: c.id,
            title: c.title,
            description: c.description,
            classLabel,
            hostLabel,
            targetFcfa: c.targetFcfa.toString(),
            raisedFcfa: raisedFcfa.toString(),
            participantCount: participantIds.size,
            expectedParticipants: c.expectedParticipants,
            deadline: c.deadline.toISOString(),
            daysLeft,
            status: c.status,
            myContributionFcfa: myContribution.toString(),
            hasContributed: myContribution > BigInt(0),
            lastContributionAt: lastContrib?.paidAt.toISOString() ?? null,
            recentInitials,
        };
    });

    return NextResponse.json(
        {
            schoolId,
            cagnottes: payload,
        },
        {
            headers: {
                "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
            },
        },
    );
}
