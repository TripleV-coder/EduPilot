import type { SMSType } from "@/lib/notifications/sms-service";
import type { PushItem } from "@/lib/push/message";

/** Charge utile de chaque type de tâche. Ajouter un type ici puis son traitement dans `handlers.ts`. */
export interface JobPayloads {
    "email.send": { to: string; subject: string; html: string; text?: string };
    "sms.send": { phoneNumber: string; message: string; smsType: SMSType; schoolId: string };
    /**
     * Message WhatsApp : `logId` = ligne CommunicationLog mise à jour à l'envoi ;
     * `kind` choisit le modèle Meta (défaut : modèle par défaut).
     */
    "whatsapp.send": { to: string; text: string; schoolId: string; logId: string; kind?: SMSType };
    "voice.send": { to: string; lang: string; text: string; audioUrl: string | null; campaignId: string; schoolId: string };
    /** Notifications push web vers les appareils abonnés (lib/push). */
    "push.send": { items: PushItem[] };
}

export type JobType = keyof JobPayloads;

export type NewJob = {
    [T in JobType]: {
        type: T;
        payload: JobPayloads[T];
        /** Établissement concerné : la tâche s'exécute dans son seul contexte RLS. */
        schoolId?: string | null;
        runAt?: Date;
        maxAttempts?: number;
    };
}[JobType];

export type JobHandlers = {
    [T in JobType]: (payload: JobPayloads[T]) => Promise<void>;
};
