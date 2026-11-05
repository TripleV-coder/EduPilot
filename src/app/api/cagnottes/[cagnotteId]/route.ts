import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { z } from "zod";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";
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
            // Organisateur ou école : modifier, clôturer, rouvrir, supprimer
            canManage: canReview || cagnotte.hostUserId === viewerId,
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

const cagnotteUpdateSchema = z
    .object({
        title: z.string().trim().min(4, "Le titre doit faire au moins 4 caractères.").max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        targetFcfa: z.coerce.number().int().positive().max(1_000_000_000).optional(),
        deadline: z.coerce.date().optional(),
        expectedParticipants: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
        status: z.enum(["OPEN", "CLOSED", "CANCELLED"]).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

/** Gère une cagnotte : son organisateur, ou l'école (direction, comptabilité). */
async function loadManaged(cagnotteId: string, session: { user: { id: string; role: string } }, schoolId: string | null) {
    if (!schoolId) return { error: NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 }) };
    const cagnotte = await prisma.cagnotte.findFirst({
        where: { id: cagnotteId, schoolId },
        select: { id: true, schoolId: true, title: true, status: true, hostUserId: true, targetFcfa: true, deadline: true },
    });
    if (!cagnotte) return { error: NextResponse.json({ error: "Cagnotte introuvable" }, { status: 404 }) };
    if (cagnotte.hostUserId !== session.user.id && !canReviewCagnotte(session.user.role)) {
        return { error: NextResponse.json({ error: "Seuls l'organisateur et l'école gèrent cette cagnotte." }, { status: 403 }) };
    }
    return { cagnotte };
}

/**
 * PATCH /api/cagnottes/[cagnotteId] — modifier une cagnotte ouverte, la
 * clôturer, la rouvrir ou l'annuler. Elle restait ouverte à jamais : aucune
 * route ne changeait son statut. Annuler est refusé tant que des contributions
 * confirmées existent (les rembourser d'abord, à l'économat).
 */
export const PATCH = createApiHandler(
    async (request, context) => {
        const { cagnotteId } = await context.params;
        const managed = await loadManaged(cagnotteId, context.session, getActiveSchoolId(context.session) ?? null);
        if (managed.error) return managed.error;
        const { cagnotte } = managed;
        const data = cagnotteUpdateSchema.parse(await request.json());

        const nextStatus = data.status ?? cagnotte.status;
        const editsFields = ["title", "description", "targetFcfa", "deadline", "expectedParticipants"].some((k) => k in data);
        if (editsFields && nextStatus !== "OPEN") {
            return NextResponse.json({ error: "Seule une cagnotte ouverte se modifie : rouvrez-la d'abord." }, { status: 409 });
        }
        if (nextStatus === "OPEN" && (data.deadline ?? cagnotte.deadline) < new Date()) {
            return NextResponse.json({ error: "L'échéance est passée : choisissez une nouvelle date pour la rouvrir." }, { status: 409 });
        }
        if (data.status === "CANCELLED" && cagnotte.status !== "CANCELLED") {
            const confirmed = await prisma.cagnotteContribution.count({ where: { cagnotteId, status: "CONFIRMED" } });
            if (confirmed > 0) {
                return NextResponse.json(
                    { error: `${confirmed} contribution(s) confirmée(s) : remboursez-les à l'économat, ou clôturez la cagnotte.` },
                    { status: 409 },
                );
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const row = await tx.cagnotte.update({
                where: { id: cagnotteId },
                data: {
                    ...(data.title !== undefined ? { title: data.title } : {}),
                    ...(data.description !== undefined ? { description: data.description || null } : {}),
                    ...(data.targetFcfa !== undefined ? { targetFcfa: BigInt(data.targetFcfa) } : {}),
                    ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
                    ...(data.expectedParticipants !== undefined ? { expectedParticipants: data.expectedParticipants } : {}),
                    ...(data.status !== undefined ? { status: data.status } : {}),
                },
            });
            // Journal transparent : les familles voient la clôture, l'annulation, la réouverture
            if (data.status && data.status !== cagnotte.status) {
                await tx.cagnotteJournalEntry.create({
                    data: {
                        cagnotteId,
                        kind: data.status === "CLOSED" ? "CLOSED" : "NOTE",
                        actorUserId: context.session.user.id,
                        message: data.status === "CLOSED" ? "Cagnotte clôturée" : data.status === "CANCELLED" ? "Cagnotte annulée" : "Cagnotte rouverte",
                    },
                });
            }
            return row;
        });
        await createAuditLog({
            userId: context.session.user.id,
            action: "CAGNOTTE_UPDATED",
            entity: "Cagnotte",
            entityId: cagnotteId,
            schoolId: cagnotte.schoolId,
            oldValues: { title: cagnotte.title, status: cagnotte.status, targetFcfa: cagnotte.targetFcfa.toString(), deadline: cagnotte.deadline },
            newValues: { title: updated.title, status: updated.status, targetFcfa: updated.targetFcfa.toString(), deadline: updated.deadline },
        });
        return NextResponse.json({ id: updated.id, status: updated.status, title: updated.title, targetFcfa: updated.targetFcfa.toString(), deadline: updated.deadline.toISOString() });
    },
    { allowedRoles: [...CAGNOTTE_REVIEWER_ROLES, "TEACHER"] },
);

/** DELETE /api/cagnottes/[cagnotteId] — cagnotte sans aucune contribution (sinon : la clôturer). */
export const DELETE = createApiHandler(
    async (_request, context) => {
        const { cagnotteId } = await context.params;
        const managed = await loadManaged(cagnotteId, context.session, getActiveSchoolId(context.session) ?? null);
        if (managed.error) return managed.error;
        const { cagnotte } = managed;
        const contributions = await prisma.cagnotteContribution.count({ where: { cagnotteId } });
        const conflict = dependencyConflict(
            `la cagnotte « ${cagnotte.title} »`,
            [{ count: contributions, one: "contribution", many: "contributions" }],
            "Clôturez-la : son journal reste consultable par les familles.",
        );
        if (conflict) return conflict;
        await prisma.cagnotte.delete({ where: { id: cagnotteId } });
        await createAuditLog({
            userId: context.session.user.id,
            action: "CAGNOTTE_DELETED",
            entity: "Cagnotte",
            entityId: cagnotteId,
            schoolId: cagnotte.schoolId,
            oldValues: { title: cagnotte.title, status: cagnotte.status },
            severity: "WARNING",
        });
        return NextResponse.json({ success: true });
    },
    { allowedRoles: [...CAGNOTTE_REVIEWER_ROLES, "TEACHER"] },
);
