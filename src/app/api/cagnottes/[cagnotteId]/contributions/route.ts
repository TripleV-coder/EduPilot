import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler } from "@/lib/api/api-helpers";
import { CAGNOTTE_REVIEWER_ROLES, canReviewCagnotte } from "@/lib/cagnotte/contributions";

// ─── POST /api/cagnottes/[cagnotteId]/contributions ───────────────────────
// Enregistre une contribution (TD-019) :
// - déclarée par un parent (espèces remises, référence Mobile Money) → « en
//   attente », hors du total collecté jusqu'à validation par l'école ;
// - saisie par le comptable ou la direction pour un parent (encaissement au
//   guichet) → confirmée d'emblée, la personne qui encaisse étant celle qui valide.
export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;
        const { cagnotteId } = await context.params;

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 },
            );
        }

        // Appartenance d'abord : une cagnotte d'une autre école répond 404 quel
        // que soit le corps envoyé (rien n'est validé ni révélé avant).
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
        // Plafond : au-delà, BigInt dépassait la colonne bigint (erreur 500).
        // FCFA entiers : 0,4 était arrondi à une contribution de 0 FCFA
        if (!Number.isInteger(numericAmount) || numericAmount <= 0 || numericAmount > 100_000_000) {
            return NextResponse.json(
                { error: "Le montant (FCFA entiers) doit être compris entre 1 et 100 000 000." },
                { status: 400 },
            );
        }
        const amount = BigInt(Math.round(numericAmount));

        // Un parent contribue pour lui-même ; l'école saisit pour un parent.
        const role = session.user.role as string;
        const recordedBySchool = canReviewCagnotte(role);
        if (recordedBySchool && !parentUserId) {
            return NextResponse.json(
                { error: "Indiquez la famille pour laquelle la contribution est encaissée." },
                { status: 400 },
            );
        }
        const contributorId = recordedBySchool ? (parentUserId as string) : session.user.id;

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

        const cleanRef = paymentRef ? sanitizePlainText(paymentRef).slice(0, 80) : null;

        const now = new Date();
        const created = await prisma.$transaction(async (tx) => {
            const contribution = await tx.cagnotteContribution.create({
                data: {
                    cagnotteId,
                    parentUserId: contributorId,
                    amountFcfa: amount,
                    paymentRef: cleanRef || null,
                    ...(recordedBySchool
                        ? { status: "CONFIRMED" as const, reviewedById: session.user.id, reviewedAt: now }
                        : { status: "PENDING" as const }),
                },
            });

            // Journal transparent : chaque mouvement apparaît, déclaration comprise.
            await tx.cagnotteJournalEntry.create({
                data: {
                    cagnotteId,
                    kind: recordedBySchool ? "CONTRIBUTION_PAID" : "CONTRIBUTION_DECLARED",
                    actorUserId: recordedBySchool ? session.user.id : contributorId,
                    amountFcfa: amount,
                    message: cleanRef ? `Réf. ${cleanRef}` : null,
                },
            });

            return contribution;
        });

        return NextResponse.json({ id: created.id, status: created.status }, { status: 201 });
    },
    { allowedRoles: ["PARENT", ...CAGNOTTE_REVIEWER_ROLES] }
);
