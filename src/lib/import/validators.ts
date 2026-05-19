/**
 * Client-side validators that derive the named checks shown on the import
 * wizard's "Validations automatiques" sidebar from a mapped, in-memory file.
 *
 * Pure functions — no API calls. The caller passes in the data and any
 * reference lists (e.g. existing class names fetched via /api/classes).
 */

import type { SupportedImportType } from "@/lib/import/types";

export interface ValidationCheck {
    label: string;
    passed: number;
    total: number;
    severity: "success" | "warning" | "danger" | "neutral";
}

const BENIN_PHONE = /^\+?229[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}$/;

function isParseableDate(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
    const s = String(value).trim();
    // Accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return true;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    const t = Date.parse(s);
    return !Number.isNaN(t);
}

function isBeninPhone(value: unknown): boolean {
    if (!value) return false;
    return BENIN_PHONE.test(String(value).trim());
}

function fingerprint(row: Record<string, unknown>): string | null {
    const name = String(row.lastName ?? row.firstName ?? "").trim().toLowerCase();
    const dob = String(row.dateOfBirth ?? "").trim();
    if (!name || !dob) return null;
    return `${name}|${dob}`;
}

function birthYearFromValue(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getFullYear();
    const s = String(value).trim();
    const ddMmYyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddMmYyyy) return Number(ddMmYyyy[3]);
    const yyyyMmDd = s.match(/^(\d{4})-\d{2}-\d{2}/);
    if (yyyyMmDd) return Number(yyyyMmDd[1]);
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).getFullYear();
    return null;
}

interface RunValidationsInput {
    rows: Record<string, unknown>[];
    type: SupportedImportType;
    /** Reference list of class names for the "Classe existante" check. */
    knownClassNames?: string[];
    /** Reference year used to compute student ages. Defaults to the current year. */
    referenceYear?: number;
}

/**
 * Hard ages-per-level expectations used by the "Âge cohérent / niveau" check.
 * The matching is heuristic: if the class name contains one of the tokens,
 * the expected age range is applied. Out-of-range ages count as failures.
 */
const LEVEL_AGE_RANGES: Array<{ pattern: RegExp; min: number; max: number }> = [
    { pattern: /CP/i,                min: 5,  max: 8 },
    { pattern: /CE1|CE 1/i,          min: 6,  max: 9 },
    { pattern: /CE2|CE 2/i,          min: 7,  max: 10 },
    { pattern: /CM1|CM 1/i,          min: 8,  max: 11 },
    { pattern: /CM2|CM 2/i,          min: 9,  max: 12 },
    { pattern: /6\b|6e|6ème|6eme/i,  min: 10, max: 14 },
    { pattern: /5\b|5e|5ème|5eme/i,  min: 11, max: 15 },
    { pattern: /4\b|4e|4ème|4eme/i,  min: 12, max: 16 },
    { pattern: /3\b|3e|3ème|3eme/i,  min: 13, max: 17 },
    { pattern: /2nd|seconde/i,       min: 14, max: 18 },
    { pattern: /1er|première|1ere/i, min: 15, max: 19 },
    { pattern: /terminale|tle/i,     min: 16, max: 20 },
];

export function runValidations(input: RunValidationsInput): ValidationCheck[] {
    const { rows, type, knownClassNames, referenceYear = new Date().getFullYear() } = input;
    const total = rows.length;
    if (total === 0) return [];

    // 1. Doublons (only meaningful for STUDENTS/TEACHERS/PARENTS who have names)
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of rows) {
        const fp = fingerprint(row);
        if (!fp) continue;
        if (seen.has(fp)) duplicates++;
        else seen.add(fp);
    }
    const dupCheck: ValidationCheck = {
        label: "Doublons (nom + date naissance)",
        passed: total - duplicates,
        total,
        severity: duplicates === 0 ? "success" : duplicates < 5 ? "warning" : "danger",
    };

    // 2. Format date valide (only when the row has a dob field)
    const datedRows = rows.filter((r) => "dateOfBirth" in r);
    const validDates = datedRows.filter((r) => isParseableDate(r.dateOfBirth)).length;
    const dateCheck: ValidationCheck = {
        label: "Format date valide",
        passed: validDates,
        total: datedRows.length || total,
        severity: validDates === (datedRows.length || total) ? "success" : "warning",
    };

    // 3. Téléphone format Bénin
    const phoneField = type === "PARENTS" ? "phone" : type === "TEACHERS" ? "phone" : "parentPhone";
    const phonedRows = rows.filter((r) => phoneField in r && r[phoneField] != null && r[phoneField] !== "");
    const validPhones = phonedRows.filter((r) => isBeninPhone(r[phoneField])).length;
    const phoneCheck: ValidationCheck = {
        label: "Téléphone format Bénin",
        passed: validPhones,
        total: phonedRows.length || total,
        severity: validPhones === (phonedRows.length || total) ? "success" : "warning",
    };

    // 4. Classe existante (only when a className column is mapped)
    const knownLower = new Set((knownClassNames ?? []).map((n) => n.trim().toLowerCase()));
    const classRows = rows.filter((r) => "className" in r && r.className != null && r.className !== "");
    let matchedClasses = classRows.length;
    if (knownLower.size > 0) {
        matchedClasses = classRows.filter((r) =>
            knownLower.has(String(r.className).trim().toLowerCase()),
        ).length;
    }
    const classCheck: ValidationCheck = {
        label: "Classe existante",
        passed: matchedClasses,
        total: classRows.length || total,
        severity: matchedClasses === (classRows.length || total) ? "success" : "warning",
    };

    // 5. Âge cohérent / niveau
    let coherent = classRows.length || total;
    if (classRows.length > 0) {
        coherent = classRows.filter((r) => {
            const year = birthYearFromValue(r.dateOfBirth);
            if (year === null) return true;
            const age = referenceYear - year;
            const range = LEVEL_AGE_RANGES.find((lr) => lr.pattern.test(String(r.className ?? "")));
            if (!range) return true;
            return age >= range.min && age <= range.max;
        }).length;
    }
    const ageCheck: ValidationCheck = {
        label: "Âge cohérent / niveau",
        passed: coherent,
        total: classRows.length || total,
        severity: coherent === (classRows.length || total) ? "success" : "warning",
    };

    return [dupCheck, dateCheck, phoneCheck, classCheck, ageCheck];
}

/**
 * Sum of rows that pass every validation. Lossy: if a row fails ANY check,
 * it's excluded. Used for the "X élèves prêts" tally on the right sidebar.
 */
export function readyCount(checks: ValidationCheck[], totalRows: number): number {
    if (checks.length === 0) return totalRows;
    const minPassed = checks
        .map((c) => (c.total === totalRows ? c.passed : totalRows))
        .reduce((min, n) => Math.min(min, n), totalRows);
    return Math.max(0, minPassed);
}
