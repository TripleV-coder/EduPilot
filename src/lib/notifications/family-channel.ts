/**
 * Messages aux familles : WhatsApp d'abord, SMS en secours (2026-11-14).
 *
 * Règles :
 * - WhatsApp configuré → chaque message part par WhatsApp (une ligne
 *   CommunicationLog par message, statuts suivis par /api/whatsapp/webhook) ;
 * - le SMS ne part qu'en SECOURS, et seulement si `smsFallback` est vrai :
 *   WhatsApp non configuré, refus définitif de Meta à l'envoi, ou échec
 *   signalé ensuite par Meta (numéro sans WhatsApp, modèle refusé…) ;
 * - un message ne bascule en SMS qu'UNE fois (transition vers FAILED
 *   conditionnelle, voir markFailedAndFallback).
 *
 * `smsFallback: false` : le destinataire a déjà un autre canal (compte
 * EduPilot → notification + e-mail) ; on ne paie pas un SMS en plus.
 */
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { enqueueJobs } from "@/lib/jobs/queue";
import type { NewJob } from "@/lib/jobs/types";
import { isSmsProviderConfigured, type SMSType } from "@/lib/notifications/sms-service";
import { whatsAppConfig } from "@/lib/notifications/whatsapp-service";
import { toInternationalDigits } from "@/lib/notifications/phone";
import { logger } from "@/lib/utils/logger";

export interface FamilyMessage {
    /** Numéro tel que saisi (le SMS le reçoit tel quel ; WhatsApp au format international). */
    phone: string;
    message: string;
    kind: SMSType;
    /** Établissement, ou "super_admin" pour un envoi hors établissement. */
    schoolId: string;
    userId?: string | null;
    /** Le SMS est-il permis si WhatsApp n'aboutit pas ? */
    smsFallback: boolean;
}

export interface FamilyQueueResult {
    /** Messages confiés à WhatsApp. */
    whatsapp: number;
    /** SMS programmés directement (WhatsApp indisponible pour eux). */
    sms: number;
    /** Messages qui ne partiront par aucun canal. */
    skipped: number;
}

/** Métadonnées d'un message WhatsApp suivi (CommunicationLog.metadata). */
export interface FamilyLogMetadata {
    kind: SMSType;
    smsFallback: boolean;
    /** Numéro d'origine et texte : nécessaires au SMS de secours. */
    phone: string;
    text: string;
    /** « SMS » une fois le secours programmé. */
    fallback?: "SMS";
    [key: string]: Prisma.JsonValue | undefined;
}

export function familyChannels(kind: SMSType = "CUSTOM") {
    const whatsapp = whatsAppConfig(kind).configured;
    const sms = isSmsProviderConfigured();
    return { whatsapp, sms, any: whatsapp || sms };
}

function smsJob(item: { phone: string; message: string; kind: SMSType; schoolId: string }): NewJob {
    return {
        type: "sms.send",
        schoolId: item.schoolId === "super_admin" ? null : item.schoolId,
        payload: { phoneNumber: item.phone, message: item.message, smsType: item.kind, schoolId: item.schoolId },
    };
}

/**
 * Programme les messages : WhatsApp quand c'est possible (numéro au format
 * international valide, canal configuré, établissement connu), sinon SMS si
 * permis. Rien n'est envoyé dans la requête : tout passe par la file d'envoi.
 */
export async function queueFamilyMessages(items: FamilyMessage[], type = "TRANSACTIONAL"): Promise<FamilyQueueResult> {
    const result: FamilyQueueResult = { whatsapp: 0, sms: 0, skipped: 0 };
    if (items.length === 0) return result;
    const smsConfigured = isSmsProviderConfigured();

    const jobs: NewJob[] = [];
    const bySchool = new Map<string, (FamilyMessage & { to: string })[]>();
    for (const item of items) {
        const to = toInternationalDigits(item.phone);
        // Hors établissement : pas de journal possible (schoolId requis) → SMS seulement
        if (to && item.schoolId !== "super_admin" && whatsAppConfig(item.kind).configured) {
            bySchool.set(item.schoolId, [...(bySchool.get(item.schoolId) ?? []), { ...item, to }]);
        } else if (item.smsFallback && smsConfigured) {
            jobs.push(smsJob(item));
            result.sms += 1;
        } else {
            result.skipped += 1;
        }
    }

    // WhatsApp : une ligne de suivi par message (statuts, secours SMS)
    const createdLogIds: string[] = [];
    for (const [schoolId, group] of bySchool) {
        const logs = await prisma.communicationLog.createManyAndReturn({
            data: group.map((item) => ({
                schoolId,
                userId: item.userId ?? null,
                recipient: item.to,
                channel: "WHATSAPP",
                type,
                status: "QUEUED",
                metadata: {
                    kind: item.kind,
                    smsFallback: item.smsFallback,
                    phone: item.phone,
                    text: item.message,
                } satisfies FamilyLogMetadata,
            })),
            select: { id: true },
        });
        logs.forEach((log, index) => {
            const item = group[index];
            createdLogIds.push(log.id);
            jobs.push({
                type: "whatsapp.send",
                schoolId,
                payload: { to: item.to, text: item.message, schoolId, logId: log.id, kind: item.kind },
            });
        });
        result.whatsapp += logs.length;
    }

    try {
        await enqueueJobs(jobs);
    } catch (error) {
        // File saturée : rien ne partira, la trace de CES messages le dit
        if (createdLogIds.length > 0) {
            await prisma.communicationLog
                .updateMany({ where: { id: { in: createdLogIds } }, data: { status: "FAILED", error: "File d'envoi saturée" } })
                .catch(() => {});
        }
        throw error;
    }
    return result;
}

/**
 * Passe un message WhatsApp en échec et programme le SMS de secours s'il est
 * permis. Idempotent : seule la PREMIÈRE transition vers FAILED déclenche le
 * SMS (une notification d'échec rejouée par Meta n'en renvoie pas un second).
 * Retourne vrai si un SMS a été programmé.
 */
export async function markFailedAndFallback(logId: string, error: string): Promise<boolean> {
    const log = await prisma.communicationLog.findUnique({ where: { id: logId }, select: { schoolId: true, metadata: true } });
    if (!log) return false;
    const transitioned = await prisma.communicationLog.updateMany({
        where: { id: logId, status: { not: "FAILED" } },
        data: { status: "FAILED", error: error.slice(0, 500) },
    });
    if (transitioned.count === 0) return false;

    const meta = (log.metadata ?? {}) as Partial<FamilyLogMetadata>;
    if (!meta.smsFallback || !meta.phone || !meta.text || !meta.kind || !isSmsProviderConfigured()) return false;
    await enqueueJobs([smsJob({ phone: meta.phone, message: meta.text, kind: meta.kind, schoolId: log.schoolId })]);
    await prisma.communicationLog.update({
        where: { id: logId },
        data: { metadata: { ...meta, fallback: "SMS" } as Prisma.InputJsonValue },
    });
    logger.info("[WhatsApp] échec → SMS de secours programmé", { module: "family-channel", logId });
    return true;
}
