import prisma from "@/lib/prisma";
import { createBulkNotifications } from "@/lib/services/notification.service";
import { formatCurrency } from "@/lib/types/finance";
import { logger } from "@/lib/utils/logger";

/**
 * Rappels d'échéances financières aux parents.
 *
 * Deux problèmes historiques résolus ici :
 *  1. Aucune échéance ne passait en OVERDUE tant qu'un paiement n'était pas
 *     enregistré (la transition n'existait que dans le recalcul post-paiement).
 *     → `runInstallmentReminders` balaie chaque jour les échéances échues.
 *  2. Aucun rappel proactif (avant/à l'échéance) et risque de spam quotidien.
 *     → relances ÉTAGÉES + idempotence via `lastReminderStage`.
 */

export const REMINDER_LEAD_DAYS = 7;
export const CRITICAL_OVERDUE_DAYS = 30;

export type ReminderStage = "UPCOMING" | "DUE" | "OVERDUE" | "CRITICAL";

/**
 * Début de journée normalisé en **UTC** (et non dans le fuseau du serveur).
 * Rendre le calcul déterministe quel que soit le TZ du runner de cron évite
 * qu'une échéance bascule DUE/OVERDUE un jour trop tôt ou trop tard selon
 * l'hôte. Les échéances (`dueDate`) sont stockées à minuit UTC : la comparaison
 * se fait donc de jour civil UTC à jour civil UTC.
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Nombre de jours calendaires (UTC) entre `a` et `b` (b - a), normalisé au jour. */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/**
 * Étape de relance pour une échéance, ou `null` si aucune relance n'est pertinente.
 * - PAID / CANCELLED → null
 * - échéance dans plus de `leadDays` jours → null (trop tôt)
 * - échéance dans [1, leadDays] jours → UPCOMING
 * - échéance aujourd'hui → DUE
 * - en retard de [1, criticalDays] jours → OVERDUE
 * - en retard de plus de `criticalDays` jours → CRITICAL
 */
export function computeReminderStage(params: {
  status: string;
  dueDate: Date;
  now: Date;
  leadDays?: number;
  criticalDays?: number;
}): ReminderStage | null {
  const { status, dueDate, now } = params;
  const leadDays = params.leadDays ?? REMINDER_LEAD_DAYS;
  const criticalDays = params.criticalDays ?? CRITICAL_OVERDUE_DAYS;

  if (status === "PAID" || status === "CANCELLED") return null;

  const daysUntilDue = daysBetween(now, dueDate); // >0 futur, 0 aujourd'hui, <0 passé
  if (daysUntilDue > leadDays) return null;
  if (daysUntilDue >= 1) return "UPCOMING";
  if (daysUntilDue === 0) return "DUE";

  const daysLate = -daysUntilDue;
  return daysLate <= criticalDays ? "OVERDUE" : "CRITICAL";
}

/** Titre + message FR d'une relance selon l'étape. */
export function reminderContent(
  stage: ReminderStage,
  params: { studentName: string; amount: number; dueDate: Date }
): { title: string; message: string } {
  const amountText = formatCurrency(params.amount);
  const dateText = params.dueDate.toLocaleDateString("fr-FR");
  const student = params.studentName;

  switch (stage) {
    case "UPCOMING":
      return {
        title: "Échéance de paiement à venir",
        message: `Échéance du ${dateText} : ${amountText} pour ${student}. Pensez à préparer le règlement.`,
      };
    case "DUE":
      return {
        title: "Échéance de paiement aujourd'hui",
        message: `L'échéance de ${amountText} pour ${student} arrive à terme aujourd'hui (${dateText}). Merci de procéder au règlement.`,
      };
    case "OVERDUE":
      return {
        title: "Paiement en retard",
        message: `Le paiement de l'échéance du ${dateText} (${amountText}) pour ${student} est en retard. Merci de régulariser la situation.`,
      };
    case "CRITICAL":
      return {
        title: "Retard de paiement critique",
        message: `Le paiement de l'échéance du ${dateText} (${amountText}) pour ${student} est en retard de plus de ${CRITICAL_OVERDUE_DAYS} jours. Merci de régulariser au plus vite.`,
      };
  }
}

export interface ReminderRunResult {
  swept: number;
  notified: number;
  UPCOMING: number;
  DUE: number;
  OVERDUE: number;
  CRITICAL: number;
}

/**
 * Balaie les échéances et envoie les relances étagées aux parents.
 * Idempotent : une notification est émise uniquement au CHANGEMENT d'étape,
 * donc plusieurs passages le même jour n'entraînent aucun doublon.
 */
export async function runInstallmentReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const today = startOfDay(now);

  // 1. Balayage temporel : échéances PENDING échues → OVERDUE (état réel en base).
  const swept = await prisma.installmentPayment.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
      paymentPlan: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    data: { status: "OVERDUE" },
  });

  // 2. Candidats : échéances non réglées dans la fenêtre de relance
  //    (à venir ≤ leadDays, aujourd'hui, ou en retard), plan actif, élève actif.
  //    On exclut les échéances déjà au stade terminal CRITICAL : elles ne
  //    généreront plus de relance, inutile de les recharger chaque jour — cela
  //    borne l'ensemble des candidats dans le temps.
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + REMINDER_LEAD_DAYS);

  const candidates = await prisma.installmentPayment.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { lte: horizon },
      lastReminderStage: { not: "CRITICAL" },
      paymentPlan: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        student: { user: { isActive: true } },
      },
    },
    include: {
      paymentPlan: {
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              parentStudents: {
                include: { parent: { include: { user: { select: { id: true } } } } },
              },
            },
          },
        },
      },
    },
  });

  const result: ReminderRunResult = {
    swept: swept.count,
    notified: 0,
    UPCOMING: 0,
    DUE: 0,
    OVERDUE: 0,
    CRITICAL: 0,
  };

  for (const installment of candidates) {
    const stage = computeReminderStage({
      status: installment.status,
      dueDate: installment.dueDate,
      now,
    });
    if (!stage) continue;
    // Déjà notifié pour cette étape : on ne renvoie pas la même relance.
    if (installment.lastReminderStage === stage) continue;

    const student = installment.paymentPlan.student;
    const parentIds = student.parentStudents.map((ps) => ps.parent.user.id);
    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();

    // Aucun parent rattaché : on ne marque PAS l'étape. Sinon un parent lié
    // plus tard ne recevrait jamais la relance de cette étape (le marqueur
    // signifierait « déjà notifié » alors qu'aucune notification n'est partie).
    // L'échéance reste candidate aux prochains passages jusqu'à ce qu'un parent
    // existe — c'est borné en pratique (peu d'élèves sans parent, requête indexée).
    if (parentIds.length === 0) continue;

    // On marque l'étape AVANT de notifier (idempotence contre plusieurs passages
    // le même jour). Si l'envoi échoue, on restaure l'état précédent (étape ET
    // horodatage) pour réessayer : le marqueur reflète « notification envoyée ».
    const previousStage = installment.lastReminderStage;
    const previousAt = installment.lastReminderAt;
    await prisma.installmentPayment.update({
      where: { id: installment.id },
      data: { lastReminderStage: stage, lastReminderAt: now },
    });

    try {
      const { title, message } = reminderContent(stage, {
        studentName,
        amount: Number(installment.amount),
        dueDate: installment.dueDate,
      });
      await createBulkNotifications({
        userIds: parentIds,
        type: "PAYMENT",
        title,
        message,
        link: "/dashboard/finance",
      });
      result[stage] += 1;
      result.notified += 1;
    } catch (err) {
      await prisma.installmentPayment.update({
        where: { id: installment.id },
        data: { lastReminderStage: previousStage, lastReminderAt: previousAt },
      });
      logger.error("Échec d'envoi d'une relance d'échéance", err as Error);
    }
  }

  logger.info("Rappels d'échéances traités", { ...result });
  return result;
}
