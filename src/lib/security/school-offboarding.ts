/**
 * Fin de conservation d'un établissement (Lot 6).
 *
 * Quand une école quitte EduPilot, ses données lui sont rendues puis effacées.
 * Le module fait les trois gestes, dans cet ordre, et **prouve** le dernier :
 *
 * 1. `exportSchoolData`  — toutes les données de l'école, table par table, en
 *    JSON, y compris celles rattachées à ses comptes sans porter de `schoolId` ;
 * 2. `purgeSchool`       — suppression de l'école (les relations en cascade
 *    emportent comptes, élèves, notes, paiements…) ;
 * 3. `verifySchoolRemoval` — rapport de vérification : nombre de lignes
 *    restantes, table par table, pour cette école et pour ses comptes.
 *
 * Les tables ne sont pas listées à la main : elles sont lues dans le schéma
 * (`information_schema`). Une table ajoutée demain sera donc exportée et
 * vérifiée sans que personne ait à y penser.
 *
 * Les trois gestes s'exécutent en contexte système déclaré : sans lui, la
 * sécurité par ligne (M2) masquerait justement les tables les plus sensibles
 * — élèves, notes, dossiers médicaux — et l'export comme la vérification
 * seraient faux en annonçant « rien à effacer ».
 */
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";

/** Colonnes qui rattachent une ligne à un compte ou à un élève. */
const USER_COLUMNS = ["userId", "senderId", "recipientId", "authorUserId", "actorUserId", "hostUserId", "reporterUserId", "reportedUserId", "psyUserId", "studentUserId", "processedBy", "recordedById", "subjectUserId"];
const STUDENT_COLUMNS = ["studentId"];

export interface TableCount {
    table: string;
    rows: number;
}

export interface SchoolScope {
    schoolId: string;
    userIds: string[];
    studentIds: string[];
}

interface ColumnRow {
    table_name: string;
    column_name: string;
}

async function columnsOfInterest(): Promise<ColumnRow[]> {
    return prisma.$queryRawUnsafe<ColumnRow[]>(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND column_name = ANY($1::text[])`,
        ["schoolId", ...USER_COLUMNS, ...STUDENT_COLUMNS],
    );
}

/** Identifiants rattachés à l'établissement, relevés AVANT toute suppression. */
async function collectSchoolScopeInner(schoolId: string): Promise<SchoolScope> {
    const [users, students] = await Promise.all([
        prisma.user.findMany({ where: { schoolId }, select: { id: true } }),
        prisma.studentProfile.findMany({ where: { schoolId }, select: { id: true } }),
    ]);
    return { schoolId, userIds: users.map((u) => u.id), studentIds: students.map((s) => s.id) };
}

function valuesFor(column: string, scope: SchoolScope): string[] {
    if (column === "schoolId") return [scope.schoolId];
    if (STUDENT_COLUMNS.includes(column)) return scope.studentIds;
    return scope.userIds;
}

async function countRows(table: string, column: string, values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "${column}" = ANY($1::text[])`,
        values,
    );
    return Number(rows[0]?.count ?? 0);
}

/**
 * Rapport de vérification : lignes restantes par table, pour cet établissement
 * et pour ses comptes. Après une purge complète, la liste est vide.
 */
async function verifySchoolRemovalInner(scope: SchoolScope): Promise<TableCount[]> {
    const totals = new Map<string, number>();
    for (const { table_name, column_name } of await columnsOfInterest()) {
        const rows = await countRows(table_name, column_name, valuesFor(column_name, scope));
        if (rows > 0) totals.set(table_name, (totals.get(table_name) ?? 0) + rows);
    }
    return [...totals.entries()]
        .map(([table, rows]) => ({ table, rows }))
        .sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));
}

export interface ExportResult {
    directory: string;
    tables: TableCount[];
}

/**
 * Export complet, une ligne JSON par enregistrement (JSON Lines) : un fichier
 * par table, écrit par lots, pour qu'un établissement de plusieurs milliers
 * d'élèves ne soit jamais chargé en mémoire d'un seul bloc.
 */
async function exportSchoolDataInner(scope: SchoolScope, outDir: string): Promise<ExportResult> {
    await mkdir(outDir, { recursive: true });

    const byTable = new Map<string, Set<string>>();
    for (const { table_name, column_name } of await columnsOfInterest()) {
        if (!byTable.has(table_name)) byTable.set(table_name, new Set());
        byTable.get(table_name)!.add(column_name);
    }

    const tables: TableCount[] = [];
    const BATCH = 1_000;

    for (const [table, columns] of [...byTable.entries()].sort()) {
        const conditions: string[] = [];
        const params: string[][] = [];
        for (const column of [...columns].sort()) {
            const values = valuesFor(column, scope);
            if (values.length === 0) continue;
            params.push(values);
            conditions.push(`"${column}" = ANY($${params.length}::text[])`);
        }
        if (conditions.length === 0) continue;

        const where = conditions.join(" OR ");
        const total = Number(
            (
                await prisma.$queryRawUnsafe<{ count: bigint }[]>(
                    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE ${where}`,
                    ...params,
                )
            )[0]?.count ?? 0,
        );
        if (total === 0) continue;

        const file = createWriteStream(path.join(outDir, `${table}.jsonl`), { encoding: "utf-8" });
        try {
            for (let offset = 0; offset < total; offset += BATCH) {
                const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
                    `SELECT * FROM "${table}" WHERE ${where} ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`,
                    ...params,
                );
                for (const row of rows) {
                    file.write(`${JSON.stringify(row, jsonSafe)}\n`);
                }
            }
        } finally {
            await new Promise<void>((resolve, reject) => file.end((error?: Error) => (error ? reject(error) : resolve())));
        }
        tables.push({ table, rows: total });
    }

    return { directory: outDir, tables: tables.sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table)) };
}

/** `bigint` et `Decimal` ne passent pas `JSON.stringify` tels quels. */
function jsonSafe(_key: string, value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (value && typeof value === "object" && "toFixed" in value && typeof (value as { toFixed: unknown }).toFixed === "function") {
        return String(value);
    }
    return value;
}

/**
 * Suppression définitive de l'établissement. Les relations en cascade
 * emportent ses comptes, ses élèves et tout ce qui en dépend ; les lignes
 * rattachées à ses comptes par une relation « mise à nul » sont retirées
 * explicitement avant, sinon leur contenu survivrait sans plus être
 * rattachable à personne.
 */
async function purgeSchoolInner(scope: SchoolScope): Promise<void> {
    for (const { table_name, column_name } of await columnsOfInterest()) {
        if (column_name === "schoolId") continue;
        const values = valuesFor(column_name, scope);
        if (values.length === 0) continue;
        await prisma.$executeRawUnsafe(
            `DELETE FROM "${table_name}" WHERE "${column_name}" = ANY($1::text[])`,
            values,
        );
    }
    await prisma.school.delete({ where: { id: scope.schoolId } });
}

// ── Contexte système déclaré (M2) ────────────────────────────────────────────
// Sortie d'un établissement : l'opération porte sur toutes ses tables, y
// compris celles fermées par la sécurité par ligne. Sans ce contexte, l'export
// serait vide et la vérification annoncerait à tort « rien à effacer ».
const REASON = "school-offboarding";

export const collectSchoolScope = (schoolId: string): Promise<SchoolScope> =>
    runAsSystem(REASON, () => collectSchoolScopeInner(schoolId));

export const verifySchoolRemoval = (scope: SchoolScope): Promise<TableCount[]> =>
    runAsSystem(REASON, () => verifySchoolRemovalInner(scope));

export const exportSchoolData = (scope: SchoolScope, outDir: string): Promise<ExportResult> =>
    runAsSystem(REASON, () => exportSchoolDataInner(scope, outDir));

export const purgeSchool = (scope: SchoolScope): Promise<void> =>
    runAsSystem(REASON, () => purgeSchoolInner(scope));
