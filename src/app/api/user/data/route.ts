import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { exportUserData } from "@/lib/security/rgpd";
import { createApiHandler } from "@/lib/api/api-helpers";
import { createAuditLog } from "@/lib/security/audit-log";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/** GET : export de ses propres données (droit d'accès et de portabilité). */
export const GET = createApiHandler(async (_request, { session }) => {
    try {
        return NextResponse.json(await exportUserData(session.user.id));
    } catch (error) {
        logger.error("Export des données personnelles impossible", error as Error, { module: "user/data" });
        return NextResponse.json({ error: "L'export de vos données a échoué. Réessayez." }, { status: 500 });
    }
});

/**
 * DELETE : demande d'effacement (droit à l'effacement).
 *
 * Elle est **enregistrée**, pas exécutée. Avant le Lot 6, cette route
 * anonymisait le compte sur-le-champ, alors que l'écran annonçait « votre
 * demande a été enregistrée » : un élève pouvait effacer lui-même ses notes,
 * son dossier et son historique, sans retour possible et sans que
 * l'établissement — qui doit tenir son registre — en soit informé.
 * L'anonymisation est désormais faite par l'administration, en traitant la
 * demande (/api/compliance/data-requests/[id]/fulfill).
 */
export const DELETE = createApiHandler(async (_request, { session }) => {
    const userId = session.user.id;

    const existing = await prisma.dataAccessRequest.findFirst({
        where: { userId, requestType: "DELETION", status: { in: ["PENDING", "IN_PROGRESS"] } },
    });
    if (existing) {
        return NextResponse.json(
            {
                message: "Votre demande d'effacement est déjà enregistrée. L'établissement doit la traiter.",
                requestId: existing.id,
                status: existing.status,
            },
            { status: 202 },
        );
    }

    const created = await prisma.dataAccessRequest.create({
        data: { userId, requestType: "DELETION", notes: "Demande faite depuis « Mes données »." },
    });

    const schoolId = getActiveSchoolId(session);
    const admins = await prisma.user.findMany({
        where: schoolId
            ? { OR: [{ role: "SUPER_ADMIN" }, { role: "SCHOOL_ADMIN", schoolId }] }
            : { role: "SUPER_ADMIN" },
        select: { id: true },
    });
    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type: "WARNING" as const,
                title: "Demande d'effacement de données",
                message: "Un compte demande l'effacement de ses données personnelles.",
                link: `/dashboard/compliance`,
            })),
        });
    }

    await createAuditLog({
        userId,
        action: "CREATE_DATA_REQUEST",
        entity: "DataAccessRequest",
        entityId: created.id,
        newValues: { requestType: "DELETION" },
        severity: "WARNING",
    });

    return NextResponse.json(
        {
            message: "Votre demande d'effacement a été enregistrée. L'établissement va la traiter.",
            requestId: created.id,
            status: created.status,
        },
        { status: 202 },
    );
});
