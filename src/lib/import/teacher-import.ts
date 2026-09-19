import prisma from "@/lib/prisma";
import { importTeacherSchema } from "@/lib/import/schemas";
import { buildTeacherSchoolAssignments } from "@/lib/teachers/school-assignments";
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

/** Import des enseignants en tout ou rien (Lot 5, N47). */
export async function importTeachersAllOrNothing(schoolId: string, rawRows: unknown[]): Promise<ImportOutcome> {
    const errors: ImportRowError[] = [];
    const prepared: Array<{ row: number; firstName: string; lastName: string; email: string; phone?: string; subjects?: string }> = [];

    rawRows.forEach((raw, index) => {
        const row = index + 1;
        const parsed = importTeacherSchema.safeParse(normalizeImportRow(raw));
        if (!parsed.success) {
            errors.push(...issuesToErrors(row, parsed.error.issues));
            return;
        }
        prepared.push({
            row,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            phone: parsed.data.phone || undefined,
            subjects: parsed.data.subjects || undefined,
        });
    });

    errors.push(...duplicateErrors(prepared.map((t) => ({ row: t.row, value: t.email })), "email", "Email"));
    const taken = await takenEmails([...new Set(prepared.map((t) => t.email))]);
    for (const teacher of prepared) {
        if (taken.has(teacher.email)) {
            errors.push({ row: teacher.row, field: "email", message: `Un compte utilise déjà l'email « ${teacher.email} »` });
        }
    }
    if (errors.length > 0) return rejectedImport(422, errors);

    // Hachage lent : hors transaction.
    const provisional: ProvisionalPassword[] = [];
    for (let i = 0; i < prepared.length; i++) provisional.push(await issueProvisionalPassword());

    try {
        await prisma.$transaction(async (tx) => {
            for (const [index, teacher] of prepared.entries()) {
                const user = await tx.user.create({
                    data: {
                        email: teacher.email,
                        password: provisional[index].hash,
                        firstName: teacher.firstName,
                        lastName: teacher.lastName,
                        role: "TEACHER",
                        roles: ["TEACHER"],
                        schoolId,
                        phone: teacher.phone,
                        mustChangePassword: true,
                    },
                    select: { id: true },
                });
                const profile = await tx.teacherProfile.create({
                    data: { userId: user.id, specialization: teacher.subjects || "General", schoolId },
                    select: { id: true },
                });
                await tx.teacherSchoolAssignment.createMany({
                    data: buildTeacherSchoolAssignments({
                        teacherId: profile.id,
                        userId: user.id,
                        primarySchoolId: schoolId,
                        schoolIds: [schoolId],
                    }),
                    skipDuplicates: true,
                });
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
            credentials: prepared.map((teacher, index) => ({
                row: teacher.row,
                email: teacher.email,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                provisionalPassword: provisional[index].plain,
            })),
            errors: [],
        },
    };
}
