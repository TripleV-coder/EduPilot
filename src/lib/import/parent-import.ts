import prisma from "@/lib/prisma";
import { importParentSchema } from "@/lib/import/schemas";
import { issueProvisionalPassword, type ProvisionalPassword } from "@/lib/auth/provisional-password";
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
    takenEmails,
} from "@/lib/import/all-or-nothing";

/**
 * Import des parents en tout ou rien (Lot 5, N47). Avant : un matricule
 * d'enfant inconnu était ignoré en silence — parent créé sans enfant.
 * Désormais chaque matricule doit exister dans l'établissement.
 */
export async function importParentsAllOrNothing(schoolId: string, rawRows: unknown[]): Promise<ImportOutcome> {
    const errors: ImportRowError[] = [];
    const prepared: Array<{
        row: number;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        job?: string;
        matricules: string[];
    }> = [];

    rawRows.forEach((raw, index) => {
        const row = index + 1;
        const parsed = importParentSchema.safeParse(normalizeImportRow(raw));
        if (!parsed.success) {
            errors.push(...issuesToErrors(row, parsed.error.issues));
            return;
        }
        prepared.push({
            row,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            phone: parsed.data.phone,
            job: parsed.data.job || undefined,
            matricules: [
                ...new Set(
                    (parsed.data.childrenMatricules ?? "")
                        .split(/[,;]/)
                        .map((value) => value.trim())
                        .filter(Boolean),
                ),
            ],
        });
    });

    errors.push(...duplicateErrors(prepared.map((p) => ({ row: p.row, value: p.email })), "email", "Email"));

    const allMatricules = [...new Set(prepared.flatMap((p) => p.matricules))];
    const [taken, students] = await Promise.all([
        takenEmails([...new Set(prepared.map((p) => p.email))]),
        allMatricules.length
            ? prisma.studentProfile.findMany({ where: { schoolId, matricule: { in: allMatricules } }, select: { id: true, matricule: true } })
            : Promise.resolve([]),
    ]);
    const studentByMatricule = new Map(students.map((student) => [student.matricule, student.id]));

    for (const parent of prepared) {
        if (taken.has(parent.email)) {
            errors.push({ row: parent.row, field: "email", message: `Un compte utilise déjà l'email « ${parent.email} »` });
        }
        const unknown = parent.matricules.filter((matricule) => !studentByMatricule.has(matricule));
        if (unknown.length > 0) {
            errors.push({
                row: parent.row,
                field: "childrenMatricules",
                message: `Matricule(s) d'élève introuvable(s) dans l'établissement : ${unknown.join(", ")}`,
            });
        }
    }
    if (errors.length > 0) return rejectedImport(422, errors);

    const provisional: ProvisionalPassword[] = [];
    for (let i = 0; i < prepared.length; i++) provisional.push(await issueProvisionalPassword());

    try {
        await prisma.$transaction(async (tx) => {
            for (const [index, parent] of prepared.entries()) {
                const user = await tx.user.create({
                    data: {
                        email: parent.email,
                        password: provisional[index].hash,
                        firstName: parent.firstName,
                        lastName: parent.lastName,
                        phone: parent.phone,
                        role: "PARENT",
                        schoolId,
                        mustChangePassword: true,
                    },
                    select: { id: true },
                });
                const profile = await tx.parentProfile.create({
                    data: { userId: user.id, profession: parent.job },
                    select: { id: true },
                });
                for (const matricule of parent.matricules) {
                    await tx.parentStudent.create({
                        data: {
                            parentId: profile.id,
                            studentId: studentByMatricule.get(matricule) as string,
                            relationship: "PARENT",
                            isPrimary: true,
                        },
                    });
                }
            }
        }, IMPORT_TRANSACTION);
    } catch (error) {
        if (isUniqueViolation(error)) return rejectedImport(409, [CONCURRENT_COLLISION]);
        throw error;
    }

    return {
        status: 200,
        body: {
            created: prepared.length,
            credentials: prepared.map((parent, index) => ({
                row: parent.row,
                email: parent.email,
                firstName: parent.firstName,
                lastName: parent.lastName,
                provisionalPassword: provisional[index].plain,
            })),
            errors: [],
        },
    };
}
