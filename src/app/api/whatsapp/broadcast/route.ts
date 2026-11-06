import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { enqueueJobs } from "@/lib/jobs/queue";
import { createAuditLog } from "@/lib/security/audit-log";
import { sanitizePlainText } from "@/lib/sanitize";
import { familyRecipients } from "@/lib/notifications/family-recipients";
import { whatsAppConfig } from "@/lib/notifications/whatsapp-service";

const broadcastSchema = z.object({
    message: z.string().trim().min(5, "Message trop court.").max(900, "900 caractères au plus (limite WhatsApp)."),
    classId: z.string().cuid().nullable().optional(),
});

/**
 * POST /api/whatsapp/broadcast — message WhatsApp aux familles de l'école ou
 * d'une classe. Le bouton « Diffuser un message » n'avait aucun gestionnaire
 * et aucun envoi n'était codé. Une tâche par famille (nouvel essai en cas de
 * panne du prestataire), une ligne CommunicationLog par message.
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        if (!whatsAppConfig().configured) {
            return NextResponse.json(
                { error: "WhatsApp Business n'est pas configuré pour EduPilot : aucun message ne peut partir.", code: "WHATSAPP_NOT_CONFIGURED" },
                { status: 503 },
            );
        }
        const data = broadcastSchema.parse(await request.json());
        if (data.classId) {
            const klass = await prisma.class.findFirst({ where: { id: data.classId, schoolId }, select: { id: true } });
            if (!klass) return NextResponse.json({ error: "Classe introuvable dans cet établissement." }, { status: 404 });
        }
        const message = sanitizePlainText(data.message);
        const { recipients, withoutPhone, truncated } = await familyRecipients(schoolId, data.classId);
        if (recipients.length === 0) {
            return NextResponse.json({ error: "Aucune famille joignable : aucun parent n'a de numéro de téléphone valide." }, { status: 409 });
        }

        const logs = await prisma.communicationLog.createManyAndReturn({
            data: recipients.map((r) => ({
                schoolId,
                userId: r.userId,
                recipient: r.phone,
                channel: "WHATSAPP",
                type: "BROADCAST",
                status: "QUEUED",
                metadata: { classId: data.classId ?? null, authorId: session.user.id },
            })),
            select: { id: true, recipient: true },
        });
        try {
            await enqueueJobs(
                logs.map((log) => ({
                    type: "whatsapp.send" as const,
                    payload: { to: log.recipient, text: message, schoolId, logId: log.id },
                    schoolId,
                })),
            );
        } catch (error) {
            // File saturée : rien ne partira, la trace le dit
            await prisma.communicationLog.updateMany({ where: { id: { in: logs.map((l) => l.id) } }, data: { status: "FAILED", error: "File d'envoi saturée" } });
            throw error;
        }
        await createAuditLog({
            userId: session.user.id,
            action: "WHATSAPP_BROADCAST",
            entity: "CommunicationLog",
            entityId: logs[0].id,
            schoolId,
            newValues: { recipients: logs.length, classId: data.classId ?? null, length: message.length },
        });
        return NextResponse.json({ queued: logs.length, withoutPhone, truncated }, { status: 202 });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
