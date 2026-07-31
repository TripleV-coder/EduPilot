import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { sanitizePlainText } from "@/lib/sanitize";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { createBulkNotifications } from "@/lib/services/notification.service";
import { createAuditLog } from "@/lib/security/audit-log";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";

const SENDER_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const;
// Destinataires : la direction et la comptabilité (qui transmettent au cabinet d'audit)
const RECIPIENT_ROLES = ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const;

const bodySchema = z.object({
    note: z.string().max(2000).optional(),
    fiscalYearId: z.string().cuid().optional(),
});

/**
 * POST /api/accounting/journal/send
 * Transmet le journal comptable (lien d'export SYSCOHADA/DGI + récapitulatif)
 * à la direction et à la comptabilité de l'établissement via la messagerie
 * interne. Étape réelle du circuit de révision avant envoi au cabinet d'audit.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!SENDER_ROLES.includes(session.user.role as (typeof SENDER_ROLES)[number])) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 }
            );
        }

        const rate = await checkRateLimit(strictLimiter, `journal-send:${session.user.id}`);
        if (!rate.success) {
            return NextResponse.json(
                { error: "Trop d'envois. Réessayez dans une minute." },
                { status: 429 }
            );
        }

        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const { note, fiscalYearId } = parsed.data;

        // Exercice ciblé : celui demandé, sinon l'exercice ouvert le plus récent
        const fiscalYear = await prisma.fiscalYear.findFirst({
            where: { schoolId, ...(fiscalYearId ? { id: fiscalYearId } : {}) },
            orderBy: [{ status: "asc" }, { startDate: "desc" }],
            select: { id: true, label: true },
        });

        const entryCount = await prisma.journalEntry.count({
            where: {
                schoolId,
                status: "POSTED",
                ...(fiscalYear ? { fiscalYearId: fiscalYear.id } : {}),
            },
        });

        // Destinataires : direction + comptabilité de l'école, hors expéditeur
        const recipients = await prisma.user.findMany({
            where: {
                schoolId,
                isActive: true,
                role: { in: [...RECIPIENT_ROLES] },
                id: { not: session.user.id },
            },
            select: { id: true },
        });

        if (recipients.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "Aucun destinataire disponible (direction ou comptabilité) dans l'établissement.",
                    sent: 0,
                },
                { status: 400 }
            );
        }

        const fiscalLabel = fiscalYear?.label ?? "en cours";
        const exportPath = `/api/accounting/export?format=csv${fiscalYear ? `&fiscalYearId=${fiscalYear.id}` : ""}`;

        const subject = sanitizePlainText(`Journal comptable — exercice ${fiscalLabel}`);
        const body = sanitizePlainText(
            [
                note?.trim() ? note.trim() : null,
                `Le journal comptable de l'exercice ${fiscalLabel} compte ${entryCount} écriture(s) validée(s) et est prêt pour transmission au cabinet d'audit.`,
                `Export SYSCOHADA / DGI : ${exportPath}`,
            ]
                .filter(Boolean)
                .join("\n\n")
        );

        const recipientIds = recipients.map((r) => r.id);

        const created = await prisma.message.createMany({
            data: recipientIds.map((recipientId) => ({
                senderId: session.user.id,
                recipientId,
                subject,
                content: body,
            })),
        });

        await createBulkNotifications({
            userIds: recipientIds,
            type: "MESSAGE",
            title: "Journal comptable transmis",
            message: `${session.user.firstName} ${session.user.lastName} a transmis le journal comptable (exercice ${fiscalLabel}).`,
            link: "/dashboard/accounting",
        });

        await createAuditLog({
            userId: session.user.id,
            action: "accounting.journal.send",
            entity: "JournalEntry",
            entityId: fiscalYear?.id,
            newValues: { fiscalYearId: fiscalYear?.id ?? null, entryCount, recipients: recipientIds.length },
            severity: "INFO",
        });

        await invalidateByPath(CACHE_PATHS.messages).catch(() => {});

        logger.info("Accounting journal sent", {
            schoolId,
            fiscalYearId: fiscalYear?.id,
            sentBy: session.user.id,
            recipientCount: created.count,
        });

        return NextResponse.json({
            success: true,
            sent: created.count,
            fiscalLabel,
            entryCount,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
        }
        logger.error("Journal send error", error as Error, { module: "api/accounting/journal/send" });
        return NextResponse.json({ error: "Erreur lors de l'envoi du journal" }, { status: 500 });
    }
}
