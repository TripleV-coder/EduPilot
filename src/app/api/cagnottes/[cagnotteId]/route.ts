import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import {
    CAGNOTTE_REVIEWER_ROLES,
    canReviewCagnotte,
    contributionVisibleTo,
    summarizeContributions,
} from "@/lib/cagnotte/contributions";

// ─── GET /api/cagnottes/[cagnotteId] — détail + journal transparent ───────
export const GET = createApiHandler(
    async (_request, context) => {
        const session = context.session;
        const { cagnotteId } = await context.params;

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
                    select: { id: true, name: true, classLevel: { select: { name: true } } },
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
        const viewer = { id: viewerId, role: session.user.role };
        const canReview = canReviewCagnotte(session.user.role);
        // TD-019 : seul le confirmé compte comme collecté.
        const summary = summarizeContributions(cagnotte.contributions, viewerId);

        const daysLeft = Math.max(
            0,
            Math.ceil((cagnotte.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        );

        return NextResponse.json({
            id: cagnotte.id,
            title: cagnotte.title,
            description: cagnotte.description,
            status: cagnotte.status,
            classId: cagnotte.class?.id ?? null,
            classLabel: cagnotte.class
                ? `${cagnotte.class.classLevel?.name ?? ""} ${cagnotte.class.name}`.trim()
                : null,
            hostLabel: cagnotte.host
                ? `${cagnotte.host.firstName ?? ""} ${cagnotte.host.lastName ?? ""}`.trim() ||
                  "Organisateur"
                : "Organisateur",
            targetFcfa: cagnotte.targetFcfa.toString(),
            raisedFcfa: summary.raisedFcfa.toString(),
            myContributionFcfa: summary.myConfirmedFcfa.toString(),
            myPendingFcfa: summary.myPendingFcfa.toString(),
            hasContributed: summary.myConfirmedFcfa + summary.myPendingFcfa > BigInt(0),
            participantCount: summary.participantCount,
            canReview,
            // File de validation : visible de l'école seulement.
            pendingCount: canReview ? summary.pendingCount : 0,
            pendingFcfa: canReview ? summary.pendingFcfa.toString() : "0",
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
            // Confirmées pour tous ; en attente ou rejetées pour l'école et l'auteur.
            contributions: cagnotte.contributions.filter((x) => contributionVisibleTo(x, viewer)).map((x) => ({
                id: x.id,
                isMine: x.parentUserId === viewerId,
                status: x.status,
                // Le nom complet et la référence servent à l'école pour vérifier
                // l'encaissement ; les familles ne voient que des initiales.
                parentName:
                    canReview && x.status === "PENDING"
                        ? `${x.parent?.firstName ?? ""} ${x.parent?.lastName ?? ""}`.trim() || null
                        : null,
                paymentRef: canReview || x.parentUserId === viewerId ? x.paymentRef : null,
                reviewNote: x.parentUserId === viewerId || canReview ? x.reviewNote : null,
                // Affichage pseudonymisé : initiales seulement, montant visible
                // (journal 100% transparent, identités protégées).
                initials: `${(x.parent?.firstName ?? "?").slice(0, 1)}${(x.parent?.lastName ?? "?").slice(0, 1)}`.toUpperCase(),
                amountFcfa: x.amountFcfa.toString(),
                paidAt: x.paidAt.toISOString(),
            })),
        });
    },
    { allowedRoles: [...CAGNOTTE_REVIEWER_ROLES, "TEACHER", "PARENT"] }
);
