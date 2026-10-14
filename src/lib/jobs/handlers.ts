import { sendEmail } from "@/lib/email";
import { queueSMS } from "@/lib/notifications/sms-service";
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
};
