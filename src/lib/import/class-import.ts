import prisma from "@/lib/prisma";
import { importClassSchema } from "@/lib/import/schemas";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import {
    CONCURRENT_COLLISION,
    IMPORT_TRANSACTION,
    type ImportOutcome,
    type ImportRowError,
    duplicateErrors,
    isUniqueViolation,
    issuesToErrors,
    normalizeImportRow,
    rejectedImport,
} from "@/lib/import/all-or-nothing";

/**
 * Import des classes en tout ou rien (Lot 5, N47). Avant : un niveau inconnu
 * était CRÉÉ à la volée avec le cycle PRIMARY (donnée fausse pour un collège
 * ou un lycée) ; un professeur principal introuvable donnait une classe sans
 * titulaire, sans avertissement. Désormais niveau et enseignant doivent
 * exister ; les niveaux se créent dans « Niveaux d'étude ».
 */
export async function importClassesAllOrNothing(schoolId: string, rawRows: unknown[]): Promise<ImportOutcome> {
    const errors: ImportRowError[] = [];
    const prepared: Array<{ row: number; name: string; level: string; capacity: number; mainTeacherEmail?: string }> = [];

    rawRows.forEach((raw, index) => {
        const row = index + 1;
        const input = normalizeImportRow(raw);
        if (typeof input.mainTeacherEmail === "string") input.mainTeacherEmail = input.mainTeacherEmail.toLowerCase();
        const parsed = importClassSchema.safeParse(input);
        if (!parsed.success) {
            errors.push(...issuesToErrors(row, parsed.error.issues));
            return;
        }
        prepared.push({
            row,
            name: parsed.data.name,
            level: parsed.data.level,
            capacity: parsed.data.capacity,
            mainTeacherEmail: parsed.data.mainTeacherEmail || undefined,
        });
    });

    errors.push(...duplicateErrors(prepared.map((c) => ({ row: c.row, value: c.name })), "name", "Classe"));

    const teacherEmails = [...new Set(prepared.map((c) => c.mainTeacherEmail).filter((e): e is string => Boolean(e)))];
    // Classes et niveaux de l'établissement : listes bornées par nature.
    const [existingClasses, levels, teacherUsers] = await Promise.all([
        prisma.class.findMany({ where: { schoolId }, select: { name: true } }),
        prisma.classLevel.findMany({ where: { schoolId }, select: { id: true, code: true, name: true } }),
        teacherEmails.length
            ? prisma.user.findMany({
                  where: { OR: teacherEmails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) },
                  select: { email: true, teacherProfile: { select: { id: true } } },
              })
            : Promise.resolve([]),
    ]);

    const takenNames = new Set(existingClasses.map((klass) => klass.name.trim().toLowerCase()));
    const levelByKey = new Map<string, string>();
    for (const level of levels) {
        levelByKey.set(level.name.trim().toLowerCase(), level.id);
        levelByKey.set(level.code.trim().toLowerCase(), level.id);
    }
    const teacherByEmail = new Map<string, string | null>();
    for (const email of teacherEmails) {
        const profileId = teacherUsers.find((user) => user.email.toLowerCase() === email)?.teacherProfile?.id ?? null;
        teacherByEmail.set(email, profileId && (await isTeacherAssignedToSchool(profileId, schoolId)) ? profileId : null);
    }

    const toCreate: Array<{ row: number; name: string; capacity: number; classLevelId: string; mainTeacherId?: string }> = [];
    for (const klass of prepared) {
        const rowErrors: ImportRowError[] = [];
        if (takenNames.has(klass.name.toLowerCase())) {
            rowErrors.push({ row: klass.row, field: "name", message: `La classe « ${klass.name} » existe déjà dans l'établissement` });
        }
        const classLevelId = levelByKey.get(klass.level.toLowerCase());
        if (!classLevelId) {
            rowErrors.push({
                row: klass.row,
                field: "level",
                message: `Niveau « ${klass.level} » introuvable : créez-le d'abord (Paramètres › Niveaux d'étude)`,
            });
        }
        const mainTeacherId = klass.mainTeacherEmail ? teacherByEmail.get(klass.mainTeacherEmail) : undefined;
        if (klass.mainTeacherEmail && !mainTeacherId) {
            rowErrors.push({
                row: klass.row,
                field: "mainTeacherEmail",
                message: `Enseignant « ${klass.mainTeacherEmail} » introuvable dans l'établissement`,
            });
        }
        errors.push(...rowErrors);
        if (rowErrors.length === 0 && classLevelId) {
            toCreate.push({ row: klass.row, name: klass.name, capacity: klass.capacity, classLevelId, mainTeacherId: mainTeacherId ?? undefined });
        }
    }
    if (errors.length > 0) return rejectedImport(422, errors);

    try {
        await prisma.$transaction(async (tx) => {
            for (const klass of toCreate) {
                await tx.class.create({
                    data: {
                        name: klass.name,
                        schoolId,
                        classLevelId: klass.classLevelId,
                        mainTeacherId: klass.mainTeacherId,
                        capacity: klass.capacity,
                    },
                });
            }
        }, IMPORT_TRANSACTION);
    } catch (error) {
        if (isUniqueViolation(error)) return rejectedImport(409, [CONCURRENT_COLLISION]);
        throw error;
    }

    return { status: 200, body: { created: toCreate.length, credentials: [], errors: [] } };
}
