import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { enqueueJobs } from "@/lib/jobs/queue";
import { createAuditLog } from "@/lib/security/audit-log";
import { sanitizePlainText } from "@/lib/sanitize";
import { familyRecipients } from "@/lib/notifications/family-recipients";
import { isVoiceGatewayConfigured } from "@/lib/notifications/voice-service";

const campaignSchema = z
    .object({
        /** Langue de diffusion : la passerelle lit `text` dans cette langue. */
        lang: z.enum(["FR", "FON", "YOR", "BAR", "DIN"]),
        text: z.string().trim().min(5, "Message trop court.").max(600, "600 caractères au plus (environ une minute d'écoute)."),
        /** Version française, conservée pour l'école (obligatoire si la langue n'est pas le français). */
        textFr: z.string().trim().max(600).optional(),
        templateKind: z.enum(["RAPPEL_SCOLARITE", "ABSENCE", "CONVOCATION", "BULLETIN", "LIBRE"]).default("LIBRE"),
        classId: z.string().cuid().nullable().optional(),
    })
    .refine((v) => v.lang === "FR" || Boolean(v.textFr && v.textFr.length >= 5), {
        message: "Ajoutez la version française du message.",
        path: ["textFr"],
    });

/**
 * POST /api/voice-notifs — campagne de messages vocaux aux familles, dans une
 * langue locale. Aucun code ne créait de campagne : la page lisait une table
 * toujours vide. La passerelle vocale (VOICE_WEBHOOK_URL) passe les appels.
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        if (!isVoiceGatewayConfigured()) {
            return NextResponse.json(
                { error: "Aucune passerelle vocale n'est configurée pour EduPilot : aucun appel ne peut partir.", code: "VOICE_NOT_CONFIGURED" },
                { status: 503 },
            );
        }
        const data = campaignSchema.parse(await request.json());
        if (data.classId) {
            const klass = await prisma.class.findFirst({ where: { id: data.classId, schoolId }, select: { id: true } });
            if (!klass) return NextResponse.json({ error: "Classe introuvable dans cet établissement." }, { status: 404 });
        }
        const text = sanitizePlainText(data.text);
        const textFr = data.lang === "FR" ? text : sanitizePlainText(data.textFr ?? "");
        const { recipients, withoutPhone, truncated } = await familyRecipients(schoolId, data.classId);
        if (recipients.length === 0) {
            return NextResponse.json({ error: "Aucune famille joignable : aucun parent n'a de numéro de téléphone valide." }, { status: 409 });
        }

        const campaign = await prisma.voiceCampaign.create({
            data: {
                schoolId,
                authorUserId: session.user.id,
                templateKind: data.templateKind,
                textFr,
                status: "DISPATCHED",
                audienceSize: recipients.length,
                dispatchedAt: new Date(),
                ...(data.lang !== "FR" ? { translations: { create: { lang: data.lang, text } } } : {}),
            },
        });
        try {
            await enqueueJobs(
                recipients.map((r) => ({
                    type: "voice.send" as const,
                    payload: { to: r.phone, lang: data.lang, text, audioUrl: null, campaignId: campaign.id, schoolId },
                    schoolId,
                })),
            );
        } catch (error) {
            await prisma.voiceCampaign.update({ where: { id: campaign.id }, data: { status: "CANCELLED" } });
            throw error;
        }
        await createAuditLog({
            userId: session.user.id,
            action: "VOICE_CAMPAIGN_DISPATCHED",
            entity: "VoiceCampaign",
            entityId: campaign.id,
            schoolId,
            newValues: { lang: data.lang, audience: recipients.length, classId: data.classId ?? null },
        });
        return NextResponse.json({ id: campaign.id, queued: recipients.length, withoutPhone, truncated }, { status: 202 });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
