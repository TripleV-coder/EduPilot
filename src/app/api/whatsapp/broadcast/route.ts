import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { sanitizePlainText } from "@/lib/sanitize";
import { familyRecipients } from "@/lib/notifications/family-recipients";
import { familyChannels, queueFamilyMessages } from "@/lib/notifications/family-channel";

const broadcastSchema = z.object({
    message: z.string().trim().min(5, "Message trop court.").max(900, "900 caractères au plus (limite WhatsApp)."),
    classId: z.string().cuid().nullable().optional(),
});

/**
 * POST /api/whatsapp/broadcast — message aux familles de l'école ou d'une
 * classe : WhatsApp en priorité, SMS en secours pour les familles que
 * WhatsApp n'atteint pas (lib/notifications/family-channel.ts, 2026-11-14).
 * Une tâche par famille (nouvel essai en cas de panne du prestataire), une
 * ligne CommunicationLog par message WhatsApp (statuts suivis).
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        if (!familyChannels("CUSTOM").any) {
            return NextResponse.json(
                { error: "Ni WhatsApp ni SMS ne sont configurés pour EduPilot : aucun message ne peut partir.", code: "WHATSAPP_NOT_CONFIGURED" },
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

        const queued = await queueFamilyMessages(
            recipients.map((r) => ({ phone: r.phone, message, kind: "CUSTOM" as const, schoolId, userId: r.userId, smsFallback: true })),
            "BROADCAST",
        );
        const total = queued.whatsapp + queued.sms;
        await createAuditLog({
            userId: session.user.id,
            action: "WHATSAPP_BROADCAST",
            entity: "CommunicationLog",
            schoolId,
            newValues: { recipients: total, whatsapp: queued.whatsapp, sms: queued.sms, classId: data.classId ?? null, length: message.length },
        });
        return NextResponse.json(
            { queued: total, whatsapp: queued.whatsapp, sms: queued.sms, withoutPhone, truncated },
            { status: 202 },
        );
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
