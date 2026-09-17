import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { createAuditLog } from "@/lib/security/audit-log";
import {
    CONSENT_CHILD_DATA,
    CONSENT_TERMS,
    LEGAL_TERMS_VERSION,
    getPendingConsent,
    recordConsent,
} from "@/lib/security/consent";

/**
 * Consentement de la personne connectée (Lot 6).
 *
 * GET  → ce qui reste à accepter : conditions (et leur version), enfants
 *        rattachés avec la réponse déjà donnée.
 * POST → enregistre l'acceptation des conditions et/ou la réponse par enfant.
 *        Un parent ne répond que pour les enfants qui lui sont rattachés.
 */

const bodySchema = z.object({
    acceptTerms: z.boolean().optional(),
    /** Réponse par identifiant de profil élève. */
    children: z.record(z.string(), z.boolean()).optional(),
});

export const GET = createApiHandler(async (_request, { session }) => {
    return NextResponse.json(await getPendingConsent(session.user.id));
});

export const POST = createApiHandler(async (request, { session }) => {
    const input = bodySchema.parse(await request.json());
    const userId = session.user.id;
    const ipAddress = request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    // Les rattachements sont vérifiés AVANT toute écriture : une réponse
    // refusée ne laisse jamais la moitié du formulaire enregistrée. Seul un
    // parent répond pour un enfant, et seulement pour les siens — l'élève ne
    // consent jamais à sa propre place (décision du 2026-09-14).
    const children = Object.entries(input.children ?? {});
    const own = new Map<string, string>();
    if (children.length > 0) {
        const parent = await prisma.parentProfile.findUnique({
            where: { userId },
            select: { parentStudents: { select: { student: { select: { id: true, userId: true } } } } },
        });
        for (const link of parent?.parentStudents ?? []) own.set(link.student.id, link.student.userId);

        if (children.some(([studentId]) => !own.has(studentId))) {
            return NextResponse.json(
                {
                    error: "Vous ne pouvez répondre que pour les enfants qui vous sont rattachés.",
                    code: "NOT_YOUR_CHILD",
                },
                { status: 403 },
            );
        }
    }

    if (input.acceptTerms === true) {
        await recordConsent({
            userId,
            consentType: CONSENT_TERMS,
            subjectUserId: userId,
            isGranted: true,
            version: LEGAL_TERMS_VERSION,
            ipAddress,
            userAgent,
        });
        await createAuditLog({
            userId,
            action: "CONSENT_TERMS_ACCEPTED",
            entity: "DataConsent",
            entityId: userId,
            newValues: { version: LEGAL_TERMS_VERSION },
        });
    }

    {
        for (const [studentId, granted] of children) {
            await recordConsent({
                userId,
                consentType: CONSENT_CHILD_DATA,
                subjectUserId: own.get(studentId)!,
                isGranted: granted,
                version: LEGAL_TERMS_VERSION,
                ipAddress,
                userAgent,
            });
            await createAuditLog({
                userId,
                action: granted ? "CONSENT_CHILD_GRANTED" : "CONSENT_CHILD_REVOKED",
                entity: "DataConsent",
                entityId: own.get(studentId)!,
                newValues: { version: LEGAL_TERMS_VERSION, granted },
                severity: granted ? "INFO" : "WARNING",
            });
        }
    }

    return NextResponse.json(await getPendingConsent(userId));
});
