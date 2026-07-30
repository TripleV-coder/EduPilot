import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

// ─── POST /api/cagnottes/[cagnotteId]/contributions ───────────────────────
// Enregistre une contribution parent.
// NOTE production : ce endpoint enregistre la contribution déclarative
// (paiement espèces au secrétariat ou référence MoMo saisie). Pour le
// paiement Mobile Money intégré, brancher le webhook provider sur
// /api/payments/momo/webhook et créer la contribution à la confirmation.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ cagnotteId: string }> },
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    // Parents contribuent ; la direction peut saisir une contribution
    // espèces pour le compte d'une famille.
    const role = session.user.role as string;
    if (!["PARENT", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"].includes(role)) {
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

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const { amountFcfa, paymentRef, parentUserId } = (body ?? {}) as {
        amountFcfa?: number | string;
        paymentRef?: string;
        parentUserId?: string;
    };

    const amount = BigInt(Math.round(Number(amountFcfa ?? 0)));
    if (amount <= BigInt(0)) {
        return NextResponse.json(
            { error: "Le montant (FCFA) doit être strictement positif." },
            { status: 400 },
        );
    }

    // Un parent contribue pour lui-même ; un admin peut saisir pour un parent.
    const contributorId =
        role === "PARENT" ? session.user.id : (parentUserId ?? session.user.id);

    const cagnotte = await prisma.cagnotte.findFirst({
        where: { id: cagnotteId, schoolId },
        select: { id: true, status: true, title: true },
    });
    if (!cagnotte) {
        return NextResponse.json({ error: "Cagnotte introuvable" }, { status: 404 });
    }
    if (cagnotte.status !== "OPEN") {
        return NextResponse.json(
            { error: "Cette cagnotte n'accepte plus de contributions." },
            { status: 409 },
        );
    }

    const created = await prisma.$transaction(async (tx) => {
        const contribution = await tx.cagnotteContribution.create({
            data: {
                cagnotteId,
                parentUserId: contributorId,
                amountFcfa: amount,
                paymentRef: paymentRef?.trim() || null,
            },
        });

        // Journal transparent : chaque centime apparaît publiquement.
        await tx.cagnotteJournalEntry.create({
            data: {
                cagnotteId,
                kind: "CONTRIBUTION",
                actorUserId: contributorId,
                amountFcfa: amount,
                message: paymentRef ? `Réf. ${paymentRef.trim()}` : null,
            },
        });

        return contribution;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
}
