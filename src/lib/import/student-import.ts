import crypto from "crypto";
import { Prisma, type Gender } from "@prisma/client";
import prisma from "@/lib/prisma";
import { importStudentSchema } from "@/lib/import/schemas";
import { parseImportDate } from "@/lib/import/dates";
import {
    issueProvisionalPassword,
    type ProvisionalCredential,
    type ProvisionalPassword,
} from "@/lib/auth/provisional-password";

/**
 * Import des élèves en TOUT OU RIEN (Lot 5, N46).
 *
 * Avant : une transaction par ligne ; les lignes valides étaient créées, les
 * autres ignorées, l'écran annonçait « Importation réussie » ; une classe
 * introuvable donnait un élève inscrit nulle part, sans avertissement ; les
 * doublons internes au fichier passaient pour des doublons en base ; une date
 * JJ/MM/AAAA échouait ; un arrêt en cours d'import laissait un import partiel.
 *
 * Désormais : tout le fichier est validé d'abord (schéma, dates, doublons dans
 * le fichier et en base, classes, année en cours) ; à la moindre erreur, rien
 * n'est écrit et le rapport situe chaque erreur (ligne, champ, message). Sinon
 * tous les élèves sont créés dans UNE transaction.
 */
export type ImportRowError = { row: number; field?: string; message: string };

export type StudentImportOutcome =
    | { status: 200; body: { created: number; credentials: ProvisionalCredential[]; errors: [] } }
    | { status: 409 | 422; body: { created: 0; credentials: []; errors: ImportRowError[] } };

type PreparedRow = {
    row: number;
    firstName: string;
    lastName: string;
    email: string;
    matricule?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    birthPlace?: string;
    classId?: string;
};

const GENDERS: Record<string, Gender> = { M: "MALE", F: "FEMALE" };

function trimmed(value: unknown): unknown {
    return typeof value === "string" ? value.trim() : value;
}

function rejected(status: 409 | 422, errors: ImportRowError[]): StudentImportOutcome {
    return { status, body: { created: 0, credentials: [], errors: errors.sort((a, b) => a.row - b.row) } };
}

function fieldMessage(field: string, message: string): string {
    if (field === "gender") return "Genre attendu : M ou F";
    return message;
}

export async function importStudentsAllOrNothing(schoolId: string, rawRows: unknown[]): Promise<StudentImportOutcome> {
    const errors: ImportRowError[] = [];
    const prepared: PreparedRow[] = [];

    // 1. Chaque ligne : schéma et date.
    rawRows.forEach((raw, index) => {
        const row = index + 1;
        const input = Object.fromEntries(
            Object.entries((raw ?? {}) as Record<string, unknown>).map(([key, value]) => [key, trimmed(value)]),
        );
        if (typeof input.email === "string") input.email = input.email.toLowerCase();
        if (input.gender === "") delete input.gender;
        const parsed = importStudentSchema.safeParse(input);
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = String(issue.path[0] ?? "");
                errors.push({ row, field, message: fieldMessage(field, issue.message) });
            }
            return;
        }
        const date = parseImportDate(parsed.data.dateOfBirth);
        if (!date.ok) {
            errors.push({ row, field: "dateOfBirth", message: "Date de naissance invalide (attendu : JJ/MM/AAAA)" });
            return;
        }
        prepared.push({
            row,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            matricule: parsed.data.matricule || undefined,
            dateOfBirth: date.date,
            gender: parsed.data.gender ? GENDERS[parsed.data.gender] : undefined,
            birthPlace: parsed.data.birthPlace || undefined,
            classId: parsed.data.className ? `?${parsed.data.className}` : undefined,
        });
    });

    // 2. Doublons dans le fichier (email sans casse, matricule) : toutes les lignes concernées.
    const flagDuplicates = (field: "email" | "matricule", label: string) => {
        const byValue = new Map<string, number[]>();
        for (const item of prepared) {
            const value = item[field];
            if (!value) continue;
            byValue.set(value, [...(byValue.get(value) ?? []), item.row]);
        }
        for (const [value, rows] of byValue) {
            if (rows.length < 2) continue;
            for (const row of rows) {
                errors.push({ row, field, message: `${label} « ${value} » en double dans le fichier (lignes ${rows.join(", ")})` });
            }
        }
    };
    flagDuplicates("email", "Email");
    flagDuplicates("matricule", "Matricule");

    // 3. Doublons en base, classes et année en cours : une requête chacun.
    const emails = [...new Set(prepared.map((item) => item.email))];
    const matricules = [...new Set(prepared.map((item) => item.matricule).filter((m): m is string => Boolean(m)))];
    const [existingUsers, existingMatricules, classes, currentYear] = await Promise.all([
        emails.length
            ? prisma.user.findMany({
                  where: { OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
                  select: { email: true },
              })
            : Promise.resolve([]),
        matricules.length
            ? prisma.studentProfile.findMany({ where: { schoolId, matricule: { in: matricules } }, select: { matricule: true } })
            : Promise.resolve([]),
        // Classes de l'établissement : liste bornée par nature.
        prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true } }),
        prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } }),
    ]);
    const takenEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));
    const takenMatricules = new Set(existingMatricules.map((profile) => profile.matricule));
    const classByName = new Map(classes.map((klass) => [klass.name.trim().toLowerCase(), klass.id]));

    for (const item of prepared) {
        if (takenEmails.has(item.email)) {
            errors.push({ row: item.row, field: "email", message: `Un compte utilise déjà l'email « ${item.email} »` });
        }
        if (item.matricule && takenMatricules.has(item.matricule)) {
            errors.push({ row: item.row, field: "matricule", message: `Le matricule « ${item.matricule} » existe déjà dans l'établissement` });
        }
        if (item.classId) {
            const name = item.classId.slice(1);
            const classId = classByName.get(name.toLowerCase());
            if (!classId) {
                errors.push({ row: item.row, field: "className", message: `Classe « ${name} » introuvable dans l'établissement` });
            } else if (!currentYear) {
                errors.push({ row: item.row, field: "className", message: "Aucune année scolaire en cours : impossible d'inscrire l'élève dans une classe" });
            } else {
                item.classId = classId;
            }
        }
    }

    if (errors.length > 0) return rejected(422, errors);

    // 4. Mots de passe provisoires (un par compte) préparés HORS transaction : le hachage est lent.
    const provisional: ProvisionalPassword[] = [];
    for (let i = 0; i < prepared.length; i++) provisional.push(await issueProvisionalPassword());

    // 5. Écriture en une seule transaction : tout ou rien, y compris en cas d'arrêt brutal.
    try {
        await prisma.$transaction(
            async (tx) => {
                for (const [index, item] of prepared.entries()) {
                    const user = await tx.user.create({
                        data: {
                            email: item.email,
                            password: provisional[index].hash,
                            firstName: item.firstName,
                            lastName: item.lastName,
                            role: "STUDENT",
                            schoolId,
                            mustChangePassword: true,
                        },
                        select: { id: true },
                    });
                    const profile = await tx.studentProfile.create({
                        data: {
                            userId: user.id,
                            schoolId,
                            matricule: item.matricule ?? `STU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                            dateOfBirth: item.dateOfBirth,
                            gender: item.gender,
                            birthPlace: item.birthPlace,
                        },
                        select: { id: true },
                    });
                    if (item.classId && currentYear) {
                        await tx.enrollment.create({
                            data: { studentId: profile.id, classId: item.classId, academicYearId: currentYear.id, status: "ACTIVE" },
                        });
                    }
                }
            },
            { maxWait: 10_000, timeout: 120_000 },
        );
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return rejected(409, [
                { row: 0, message: "Un email ou un matricule du fichier vient d'être utilisé par ailleurs. Aucun élève n'a été créé : réessayez." },
            ]);
        }
        throw error;
    }

    return {
        status: 200,
        body: {
            created: prepared.length,
            credentials: prepared.map((item, index) => ({
                row: item.row,
                email: item.email,
                firstName: item.firstName,
                lastName: item.lastName,
                provisionalPassword: provisional[index].plain,
            })),
            errors: [],
        },
    };
}
