/**
 * Helpers RH (personnel) — logique pure, testée : rôles, agrégats de présence,
 * calcul des congés et de la paie, construction de l'écriture OHADA.
 *
 * Aucun accès base ici : ces fonctions sont réutilisées par les routes API.
 */
import type { StaffAttendanceStatus, UserRole } from "@prisma/client";
import { roleSatisfies } from "@/lib/rbac/permissions";

/** Rôles considérés comme membres du personnel de l'établissement. */
export const STAFF_MEMBER_ROLES: UserRole[] = [
    "SCHOOL_ADMIN",
    "DIRECTOR",
    "TEACHER",
    "ACCOUNTANT",
    "STAFF",
];

/** Rôles autorisés à gérer la RH (écrire, voir tout le personnel). */
export const HR_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/** Vrai si le rôle peut administrer la RH (NETWORK_ADMIN hérite de SCHOOL_ADMIN). */
export function isHrManager(role: string | undefined | null): boolean {
    return roleSatisfies(role, HR_MANAGER_ROLES);
}

export interface AttendanceSummary {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    total: number;
}

/** Agrège une liste de statuts de présence en compteurs. */
export function summarizeAttendance(
    records: Array<{ status: StaffAttendanceStatus }>,
): AttendanceSummary {
    const summary: AttendanceSummary = { present: 0, absent: 0, late: 0, onLeave: 0, total: records.length };
    for (const r of records) {
        if (r.status === "PRESENT") summary.present += 1;
        else if (r.status === "ABSENT") summary.absent += 1;
        else if (r.status === "LATE") summary.late += 1;
        else if (r.status === "ON_LEAVE") summary.onLeave += 1;
    }
    return summary;
}

/** Nombre de jours de congé, bornes incluses (min. 1 si l'intervalle est valide). */
export function countLeaveDays(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    if (endUtc < startUtc) return 0;
    return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

/** Un intervalle de congé est valide si la fin n'est pas antérieure au début. */
export function isValidLeaveRange(start: Date, end: Date): boolean {
    return end.getTime() >= start.getTime();
}

export interface AmountLine {
    label: string;
    amount: number;
}

/** Somme des montants positifs d'une liste de lignes (primes / retenues). */
export function sumLines(lines: AmountLine[]): number {
    return lines.reduce((acc, l) => acc + Math.max(0, Math.round(l.amount || 0)), 0);
}

/**
 * Salaire net = base + primes − retenues, arrondi et jamais négatif.
 */
export function computePayrollNet(
    baseSalary: number,
    allowances: AmountLine[],
    deductions: AmountLine[],
): number {
    const gross = Math.max(0, Math.round(baseSalary || 0)) + sumLines(allowances);
    const net = gross - sumLines(deductions);
    return Math.max(0, net);
}

export interface JournalLineInput {
    debitAccountId?: string;
    creditAccountId?: string;
    amountFcfa: number;
    label: string;
}

/**
 * Écriture OHADA de charge de personnel (partie double équilibrée) :
 * débit 66 « Charges de personnel », crédit 42 « Personnel — rémunérations dues ».
 */
export function buildPayrollJournalLines(
    net: number,
    expenseAccountId: string,
    payableAccountId: string,
    label: string,
): JournalLineInput[] {
    return [
        { debitAccountId: expenseAccountId, amountFcfa: net, label },
        { creditAccountId: payableAccountId, amountFcfa: net, label },
    ];
}
