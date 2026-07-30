import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALLOWED_ROLES = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "DIRECTOR",
    "TEACHER",
    "PARENT",
] as const;

// ─── GET /api/cagnottes/[cagnotteId] — détail + journal transparent ───────
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ cagnotteId: string }> },
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { cagnotteId } = await params;
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
        return NextResponse.json(
            { error: "Aucun établissement actif associé au compte." },
            { status: 400 },
        );
    }

    const cagnotte = await prisma.cagnotte.findFirst({
        where: { id: cagnotteId, schoolId },
        include: {
            host: { select: { firstName: true, lastName: true } },
            class: {
                select: { name: true, classLevel: { select: { name: true } } },
            },
            contributions: {
                orderBy: { paidAt: "desc" },
                include: { parent: { select: { firstName: true, lastName: true } } },
            },
            journal: {
                orderBy: { createdAt: "desc" },
                take: 50,
                include: { actor: { select: { firstName: true, lastName: true } } },
            },
        },
    });

    if (!cagnotte) {
        return NextResponse.json({ error: "Cagnotte introuvable" }, { status: 404 });
    }

    const viewerId = session.user.id;
    const raisedFcfa = cagnotte.contributions.reduce<bigint>(
        (sum, x) => sum + x.amountFcfa,
        BigInt(0),
    );
    const myContribution = cagnotte.contributions
        .filter((x) => x.parentUserId === viewerId)
        .reduce<bigint>((sum, x) => sum + x.amountFcfa, BigInt(0));
    const participantIds = new Set(cagnotte.contributions.map((x) => x.parentUserId));

    const daysLeft = Math.max(
        0,
        Math.ceil((cagnotte.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    return NextResponse.json({
        id: cagnotte.id,
        title: cagnotte.title,
        description: cagnotte.description,
        status: cagnotte.status,
        classLabel: cagnotte.class
            ? `${cagnotte.class.classLevel?.name ?? ""} ${cagnotte.class.name}`.trim()
            : null,
        hostLabel: cagnotte.host
            ? `${cagnotte.host.firstName ?? ""} ${cagnotte.host.lastName ?? ""}`.trim() ||
              "Organisateur"
            : "Organisateur",
        targetFcfa: cagnotte.targetFcfa.toString(),
        raisedFcfa: raisedFcfa.toString(),
        myContributionFcfa: myContribution.toString(),
        hasContributed: myContribution > BigInt(0),
        participantCount: participantIds.size,
        expectedParticipants: cagnotte.expectedParticipants,
        deadline: cagnotte.deadline.toISOString(),
        daysLeft,
        // Journal public : chaque mouvement est visible par toutes les familles.
        journal: cagnotte.journal.map((j) => ({
            id: j.id,
            kind: j.kind,
            amountFcfa: j.amountFcfa?.toString() ?? null,
            message: j.message,
            actorLabel: j.actor
                ? `${j.actor.firstName ?? ""} ${j.actor.lastName ?? ""}`.trim() || "Système"
                : "Système",
            createdAt: j.createdAt.toISOString(),
        })),
        contributions: cagnotte.contributions.map((x) => ({
            id: x.id,
            isMine: x.parentUserId === viewerId,
            // Affichage pseudonymisé : initiales seulement, montant visible
            // (journal 100% transparent, identités protégées).
            initials: `${(x.parent?.firstName ?? "?").slice(0, 1)}${(x.parent?.lastName ?? "?").slice(0, 1)}`.toUpperCase(),
            amountFcfa: x.amountFcfa.toString(),
            paidAt: x.paidAt.toISOString(),
        })),
    });
}
