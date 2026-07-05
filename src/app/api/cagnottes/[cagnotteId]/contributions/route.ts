import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { sanitizePlainText } from "@/lib/sanitize";
import { roleSatisfies } from "@/lib/rbac/permissions";

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
    if (!roleSatisfies(role, ["PARENT", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"])) {
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

    const numericAmount = Number(amountFcfa ?? 0);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return NextResponse.json(
            { error: "Le montant (FCFA) doit être strictement positif." },
            { status: 400 },
        );
    }
    const amount = BigInt(Math.round(numericAmount));

    // Un parent contribue pour lui-même ; un admin peut saisir pour un parent.
    const contributorId =
        role === "PARENT" ? session.user.id : (parentUserId ?? session.user.id);

    // L'admin qui saisit pour un parent : le parent doit appartenir à l'école
    if (contributorId !== session.user.id) {
        const contributor = await prisma.user.findFirst({
            where: { id: contributorId, schoolId, role: "PARENT", isActive: true },
            select: { id: true },
        });
        if (!contributor) {
            return NextResponse.json(
                { error: "Parent introuvable dans cet établissement." },
                { status: 404 },
            );
        }
    }

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

    const cleanRef = paymentRef ? sanitizePlainText(paymentRef).slice(0, 80) : null;

    const created = await prisma.$transaction(async (tx) => {
        const contribution = await tx.cagnotteContribution.create({
            data: {
                cagnotteId,
                parentUserId: contributorId,
                amountFcfa: amount,
                paymentRef: cleanRef || null,
            },
        });

        // Journal transparent : chaque centime apparaît publiquement.
        await tx.cagnotteJournalEntry.create({
            data: {
                cagnotteId,
                kind: "CONTRIBUTION_PAID",
                actorUserId: contributorId,
                amountFcfa: amount,
                message: cleanRef ? `Réf. ${cleanRef}` : null,
            },
        });

        return contribution;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
}
