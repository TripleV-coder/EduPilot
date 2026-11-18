import { sendEmail } from "@/lib/email";
import { queueSMS } from "@/lib/notifications/sms-service";
import { sendWhatsAppText } from "@/lib/notifications/whatsapp-service";
import { markFailedAndFallback } from "@/lib/notifications/family-channel";
import { sendVoiceCall } from "@/lib/notifications/voice-service";
import { deliverPushItems } from "@/lib/push/deliver";
import prisma from "@/lib/prisma";
import { CIRCUITS, getCircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { PermanentJobError } from "./queue";
import type { JobHandlers } from "./types";

/**
 * Traitement de chaque type de tâche. Une exception déclenche un nouvel essai ;
 * `CircuitOpenError` (fournisseur coupé) diffère la tâche sans compter de tentative.
 */
export const JOB_HANDLERS: JobHandlers = {
    "email.send": async (payload) => {
        // `sendEmail` avale ses erreurs : le circuit est vérifié avant.
        await getCircuitBreaker(CIRCUITS.email).ensureAvailable();
        const sent = await sendEmail(payload);
        if (!sent) throw new Error("E-mail non envoyé (fournisseur indisponible ou non configuré)");
    },
    "sms.send": async (payload) => {
        const result = await queueSMS({
            phoneNumber: payload.phoneNumber,
            message: payload.message,
            type: payload.smsType,
            schoolId: payload.schoolId,
        });
        if (result.success) return;
        const reason = result.error ?? "SMS non envoyé";
        throw result.permanent ? new PermanentJobError(reason) : new Error(reason);
    },
    "whatsapp.send": async (payload) => {
        const result = await sendWhatsAppText(payload.to, payload.text, payload.kind);
        if (result.success) {
            // Accepté par Meta ; livraison, lecture ou échec arrivent ensuite
            // par /api/whatsapp/webhook, rattachés grâce à externalId.
            await prisma.communicationLog.update({
                where: { id: payload.logId },
                data: { status: "SENT", error: null, externalId: result.messageId ?? null },
            });
            return;
        }
        const reason = result.error ?? "WhatsApp non envoyé";
        if (result.permanent) {
            // Refus définitif (numéro, modèle, configuration) : SMS de secours s'il est permis
            await markFailedAndFallback(payload.logId, reason);
            return;
        }
        await prisma.communicationLog.update({ where: { id: payload.logId }, data: { status: "RETRYING", error: reason } });
        throw new Error(reason);
    },
    "voice.send": async (payload) => {
        const result = await sendVoiceCall({
            to: payload.to,
            lang: payload.lang,
            text: payload.text,
            audioUrl: payload.audioUrl,
            campaignId: payload.campaignId,
        });
        if (result.success) {
            // Appel confié à la passerelle : compté comme atteint
            await prisma.voiceCampaign.update({ where: { id: payload.campaignId }, data: { reachedCount: { increment: 1 } } });
            return;
        }
        const reason = result.error ?? "Appel vocal non passé";
        throw result.permanent ? new PermanentJobError(reason) : new Error(reason);
    },
    "push.send": async (payload) => {
        // Meilleur effort : les échecs d'appareil sont gérés abonnement par abonnement
        await deliverPushItems(payload.items);
    },
};
