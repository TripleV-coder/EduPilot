/**
 * Dates des fichiers d'import (Lot 5, N46). Les établissements saisissent les
 * dates au format français JJ/MM/AAAA ; l'ancienne route faisait
 * `new Date("15/03/2012")` : date invalide (ligne en erreur) ou mois et jour
 * inversés. Formats acceptés : JJ/MM/AAAA (séparateur / . ou -), AAAA-MM-JJ.
 * Une date impossible (31/02) est refusée, jamais corrigée en silence.
 */
export type ImportDate = { ok: true; date: Date | undefined } | { ok: false };

function utcDate(year: number, month: number, day: number): Date | null {
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid =
        date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return valid ? date : null;
}

export function parseImportDate(value: unknown): ImportDate {
    if (value === undefined || value === null || String(value).trim() === "") return { ok: true, date: undefined };
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? { ok: false } : { ok: true, date: value };

    const text = String(value).trim();
    const french = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (french) {
        const date = utcDate(Number(french[3]), Number(french[2]), Number(french[1]));
        return date ? { ok: true, date } : { ok: false };
    }
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
    if (iso) {
        const date = utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
        return date ? { ok: true, date } : { ok: false };
    }
    return { ok: false };
}
