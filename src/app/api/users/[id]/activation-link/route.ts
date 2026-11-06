import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { canCreateRole } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/security/audit-log";
import { ACTIVATION_LINK_TTL_HOURS, activationLinkUrl, newActivationToken } from "@/lib/auth/activation-link";
import { sendActivationEmail } from "@/lib/email";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/users/[id]/activation-link — la direction (ré)émet le lien
 * d'activation d'un compte qu'elle aurait pu créer et qui n'est pas encore
 * activé (`mustChangePassword`). Le lien est envoyé par e-mail et renvoyé à
 * la direction, qui peut le transmettre autrement (de nombreuses familles
 * n'ont pas d'e-mail consulté) : il ne donne pas plus de pouvoir que le mot
 * de passe provisoire qu'elle reçoit déjà à la création. Un compte activé
 * est refusé — sinon la direction pourrait remplacer le mot de passe choisi
 * par son titulaire. Émettre un lien annule les liens précédents non utilisés.
 */
export const POST = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const target = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                role: true,
                schoolId: true,
                isActive: true,
                mustChangePassword: true,
                school: { select: { name: true } },
            },
        });
        const inScope =
            target !== null && (session.user.role === "SUPER_ADMIN" || canAccessSchool(session, target.schoolId));
        if (!target || !inScope) {
            return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
        }
        if (target.id === session.user.id) {
            return NextResponse.json({ error: "Vous ne pouvez pas émettre de lien pour votre propre compte." }, { status: 400 });
        }
        if (!canCreateRole(session.user.role as UserRole, target.role)) {
            return NextResponse.json({ error: "Votre rôle ne permet pas d'activer ce type de compte." }, { status: 403 });
        }
        if (!target.isActive) {
            return NextResponse.json({ error: "Ce compte est désactivé : réactivez-le avant d'envoyer un lien." }, { status: 409 });
        }
        if (!target.mustChangePassword) {
            return NextResponse.json(
                { error: "Ce compte est déjà activé : la personne se connecte avec son mot de passe ou utilise « Mot de passe oublié »." },
                { status: 409 },
            );
        }

        const { token, hash } = newActivationToken();
        const expiresAt = new Date(Date.now() + ACTIVATION_LINK_TTL_HOURS * 60 * 60 * 1000);
        await prisma.$transaction([
            prisma.firstLoginToken.deleteMany({ where: { userId: target.id, usedAt: null } }),
            prisma.firstLoginToken.create({ data: { userId: target.id, token: hash, tempPassword: null, expiresAt } }),
        ]);
        const link = activationLinkUrl(token);

        let emailSent = false;
        try {
            emailSent = await sendActivationEmail({
                email: target.email,
                firstName: target.firstName,
                schoolName: target.school?.name ?? null,
                activationUrl: link,
                expiresInHours: ACTIVATION_LINK_TTL_HOURS,
            });
        } catch (error) {
            logger.error("Envoi du lien d'activation impossible", error, {
                module: "users/activation-link",
                userId: target.id,
            });
        }

        await createAuditLog({
            userId: session.user.id,
            action: "ACTIVATION_LINK_ISSUED",
            entity: "User",
            entityId: target.id,
            schoolId: target.schoolId,
            newValues: { expiresAt: expiresAt.toISOString(), emailSent },
        });

        // createApiHandler pose « Cache-Control: private, no-store » : le lien n'est mis en cache nulle part.
        return NextResponse.json({ link, expiresAt: expiresAt.toISOString(), emailSent, email: target.email });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
