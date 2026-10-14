import type { SMSType } from "@/lib/notifications/sms-service";

/** Charge utile de chaque type de tâche. Ajouter un type ici puis son traitement dans `handlers.ts`. */
export interface JobPayloads {
    "email.send": { to: string; subject: string; html: string; text?: string };
    "sms.send": { phoneNumber: string; message: string; smsType: SMSType; schoolId: string };
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
