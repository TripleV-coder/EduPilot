/**
 * Prévenir les familles d'une absence ou d'un retard à l'enregistrement de l'appel.
 *
 * Avant : l'appel ne prévenait personne (la fonction SMS d'absence existait
 * mais n'était jamais appelée). Règles :
 * - parent avec un compte → notification dans l'application, courriel et
 *   WhatsApp (canal principal depuis le 2026-11-14) ;
 * - responsable sans compte → WhatsApp, et SMS en secours si WhatsApp
 *   n'aboutit pas (lib/notifications/family-channel.ts) ;
 * - seulement quand l'élève DEVIENT absent ou en retard (pas à chaque
 *   réenregistrement du même appel) — l'appelant fournit ces changements ;
 * - un échec d'envoi ne remet jamais en cause l'appel déjà enregistré.
 *
 * Courriels, WhatsApp et SMS passent par la file d'envoi : l'enseignant n'attend plus
 * un aller-retour fournisseur par famille avant de voir son appel enregistré.
 */
import prisma from "@/lib/prisma";
import { createNotifications } from "@/lib/services/notification.service";
import { attendanceSmsMessage } from "@/lib/notifications/sms-service";
import { queueFamilyMessages, type FamilyMessage } from "@/lib/notifications/family-channel";
import { toInternationalDigits } from "@/lib/notifications/phone";
import { enqueueJobs } from "@/lib/jobs/queue";
import type { NewJob } from "@/lib/jobs/types";
import { logger } from "@/lib/utils/logger";

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export type AbsenceChange = { studentId: string; status: "ABSENT" | "LATE" };

const STATUS_LABEL: Record<AbsenceChange["status"], string> = {
    ABSENT: "absent(e)",
    LATE: "en retard",
};

export async function notifyParentsOfAbsences(input: {
    schoolId: string;
    date: Date;
    changes: AbsenceChange[];
}): Promise<{ notified: number; whatsapp: number; sms: number }> {
    if (input.changes.length === 0) return { notified: 0, whatsapp: 0, sms: 0 };
    const statusById = new Map(input.changes.map((change) => [change.studentId, change.status]));

    const students = await prisma.studentProfile.findMany({
        where: { id: { in: [...statusById.keys()] } },
        select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            parentStudents: {
                select: { parent: { select: { user: { select: { id: true, phone: true, email: true, firstName: true } } } } },
            },
            guardians: { select: { phone: true } },
        },
    });

    const day = input.date.toLocaleDateString("fr-FR");
    const notifications: Parameters<typeof createNotifications>[0] = [];
    const jobs: NewJob[] = [];
    const family: FamilyMessage[] = [];

    for (const student of students) {
        const status = statusById.get(student.id);
        if (!status) continue;
        const name = `${student.user.firstName} ${student.user.lastName}`.trim();
        const accountUsers = student.parentStudents.map((link) => link.parent.user);

        for (const parent of accountUsers) {
            notifications.push({
                userId: parent.id,
                type: "ATTENDANCE",
                title: status === "ABSENT" ? "Absence signalée" : "Retard signalé",
                message: `${name} a été marqué(e) ${STATUS_LABEL[status]} le ${day}.`,
                link: `/dashboard/students/${student.id}`,
            });
            // Courriel : le parent n'ouvre pas forcément l'application le jour même.
            if (parent.email) {
                const title = status === "ABSENT" ? "Absence" : "Retard";
                jobs.push({
                    type: "email.send",
                    schoolId: input.schoolId,
                    payload: {
                        to: parent.email,
                        subject: `${title} de ${name} le ${day}`,
                        html: `<p>Bonjour ${escapeHtml(parent.firstName ?? "")},</p><p>${escapeHtml(name)} a été marqué(e) ${STATUS_LABEL[status]} le ${day} lors de l'appel.</p><p>Vous pouvez justifier cette ${status === "ABSENT" ? "absence" : "arrivée tardive"} depuis votre espace EduPilot, rubrique Assiduité.</p>`,
                        text: `${name} a été marqué(e) ${STATUS_LABEL[status]} le ${day}. Justification possible depuis votre espace EduPilot (Assiduité).`,
                    },
                });
            }
        }

        // WhatsApp à chaque numéro de la famille ; SMS de secours seulement pour
        // les responsables sans compte (les autres ont notification + courriel).
        const text = attendanceSmsMessage({ studentName: name, status: STATUS_LABEL[status], date: input.date });
        const seen = new Set<string>();
        for (const parent of accountUsers) {
            const key = toInternationalDigits(parent.phone);
            if (!parent.phone || !key || seen.has(key)) continue;
            seen.add(key);
            family.push({ phone: parent.phone, message: text, kind: "ATTENDANCE", schoolId: input.schoolId, userId: parent.id, smsFallback: false });
        }
        for (const guardian of student.guardians) {
            const key = toInternationalDigits(guardian.phone) ?? guardian.phone;
            if (!guardian.phone || seen.has(key)) continue;
            seen.add(key);
            family.push({ phone: guardian.phone, message: text, kind: "ATTENDANCE", schoolId: input.schoolId, smsFallback: true });
        }
    }

    let notified = 0;
    try {
        notified = (await createNotifications(notifications)).count;
    } catch (error) {
        logger.error("[appel] notifications parents impossibles", error as Error);
    }
    try {
        await enqueueJobs(jobs);
    } catch (error) {
        logger.error("[appel] courriels aux familles non programmés", error as Error);
    }
    let whatsapp = 0;
    let sms = 0;
    try {
        const queued = await queueFamilyMessages(family);
        whatsapp = queued.whatsapp;
        sms = queued.sms;
    } catch (error) {
        logger.error("[appel] WhatsApp et SMS aux familles non programmés", error as Error);
    }

    return { notified, whatsapp, sms };
}
