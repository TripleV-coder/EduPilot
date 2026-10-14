/**
 * Calculs monétaires en FCFA : le franc CFA n'a pas de centimes, tout montant
 * est un nombre ENTIER de francs et les sommes doivent tomber juste.
 */
import { z } from "zod";

/** Montant en FCFA : entier strictement positif. */
export const fcfaAmountSchema = z.coerce
    .number()
    .positive("Le montant doit être supérieur à 0")
    .int("Le montant est en FCFA entiers (pas de centimes)");

/** Arrondi au franc le plus proche (demi vers le haut), sans dérive flottante. */
export function roundFcfa(amount: number): number {
    return Math.round(Math.round(amount * 100) / 100);
}

/**
 * Répartit un total en `count` échéances de FCFA entiers dont la somme est
 * EXACTEMENT le total : les premières échéances portent le franc restant.
 * Ex. 100 000 en 3 → 33 334 + 33 333 + 33 333.
 */
export function splitInstallments(total: number, count: number): number[] {
    if (!Number.isInteger(count) || count < 1) throw new RangeError("Nombre d'échéances invalide");
    const whole = roundFcfa(total);
    const base = Math.floor(whole / count);
    const remainder = whole - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Ajoute des mois en restant dans le mois visé : le 31 janvier + 1 mois donne
 * le 28 (ou 29) février, pas le 3 mars.
 */
export function addMonthsClamped(date: Date, months: number): Date {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
}
