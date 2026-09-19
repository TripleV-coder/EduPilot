import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ProvisionalCredential } from "@/lib/auth/provisional-password";

/**
 * Socle commun des imports en TOUT OU RIEN (Lot 5, N46/N47) : tout le fichier
 * est validé avant la moindre écriture ; à la première erreur rien n'est
 * écrit et le rapport situe chaque erreur (ligne, champ, message) ; sinon une
 * seule transaction écrit tout.
 */
export type ImportRowError = { row: number; field?: string; message: string };

export type ImportOutcome =
    | { status: 200; body: { created: number; credentials: ProvisionalCredential[]; errors: [] } }
    | { status: 409 | 422; body: { created: 0; credentials: []; errors: ImportRowError[] } };

export function rejectedImport(status: 409 | 422, errors: ImportRowError[]): ImportOutcome {
    const sorted = [...errors].sort((a, b) => a.row - b.row || (a.field ?? "").localeCompare(b.field ?? ""));
    return { status, body: { created: 0, credentials: [], errors: sorted } };
}

/** Espaces retirés, email en minuscules. */
export function normalizeImportRow(raw: unknown): Record<string, unknown> {
    const row = Object.fromEntries(
        Object.entries((raw ?? {}) as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : value,
        ]),
    );
    if (typeof row.email === "string") row.email = row.email.toLowerCase();
    return row;
}

export function issuesToErrors(
    row: number,
    issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): ImportRowError[] {
    return issues.map((issue) => ({ row, field: String(issue.path[0] ?? ""), message: issue.message }));
}

/** Valeurs en double DANS le fichier : erreur sur chaque ligne concernée. */
export function duplicateErrors(
    items: ReadonlyArray<{ row: number; value: string | undefined }>,
    field: string,
    label: string,
): ImportRowError[] {
    const byValue = new Map<string, number[]>();
    for (const { row, value } of items) {
        if (!value) continue;
        const key = value.toLowerCase();
        byValue.set(key, [...(byValue.get(key) ?? []), row]);
    }
    const errors: ImportRowError[] = [];
    for (const [value, rows] of byValue) {
        if (rows.length < 2) continue;
        for (const row of rows) {
            errors.push({ row, field, message: `${label} « ${value} » en double dans le fichier (lignes ${rows.join(", ")})` });
        }
    }
    return errors;
}

/** Emails déjà utilisés par un compte (comparaison sans casse), en une requête. */
export async function takenEmails(emails: ReadonlyArray<string>): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const users = await prisma.user.findMany({
        where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
        select: { email: true },
    });
    return new Set(users.map((user) => user.email.toLowerCase()));
}

export function isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const CONCURRENT_COLLISION: ImportRowError = {
    row: 0,
    message: "Une valeur du fichier (email, nom…) vient d'être utilisée par ailleurs. Rien n'a été créé : réessayez.",
};

/** Délais d'une transaction d'import (jusqu'à 500 lignes). */
export const IMPORT_TRANSACTION = { maxWait: 10_000, timeout: 120_000 } as const;
