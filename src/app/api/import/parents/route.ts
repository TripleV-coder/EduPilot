import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";
import { importParentSchema } from "@/lib/import/schemas";
import { hash } from "bcryptjs";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { generateImportPassword } from "@/lib/import/initial-password";
import { createApiHandler } from "@/lib/api/api-helpers";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const body = await request.json();
        const { data, schoolId: bodySchoolId } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });

        }

        if (data.length > 500) {
            return NextResponse.json(
                { error: "Maximum 500 lignes par import. Découpez votre fichier." },
                { status: 400 }
            );
        }

        const results = {
            created: 0,
            errors: [] as Array<{
                row: number;
                error: string;
                details?: unknown;
                data?: unknown;
                email?: string;
            }>,
        };

        let schoolId = getActiveSchoolId(session) || null;
        if (session.user.role === "SUPER_ADMIN") {
            const { searchParams } = new URL(request.url);
            schoolId = bodySchoolId || searchParams.get("schoolId") || null;
        }

        if (!schoolId) {
            const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
            schoolId = userFull?.schoolId || null;
        }
        if (!schoolId) {
            return NextResponse.json({ error: "School context required" }, { status: 400 });
        }

        const schoolExists = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { id: true },
        });
        if (!schoolExists) {
            return NextResponse.json({ error: "School not found" }, { status: 400 });
        }

        // Secret aléatoire par lot — jamais de mot de passe partagé connu (cf. lib/import/initial-password)
        const DEFAULT_IMPORT_PASSWORD = generateImportPassword();

        for (const [index, item] of data.entries()) {
            const validation = importParentSchema.safeParse(item);

            if (!validation.success) {
                results.errors.push({
                    row: index + 1,
                    error: "Validation failed",
                    details: validation.error.issues,
                    data: item,
                });
                continue;
            }

            const parentData = validation.data;

            // Email réel obligatoire + unicité
            const existingUser = await prisma.user.findUnique({
                where: { email: parentData.email },
            });

            if (existingUser) {
                results.errors.push({
                    row: index + 1,
                    error: "Email already exists",
                    email: parentData.email,
                });
                continue;
            }

            // Also check phone uniqueness if critical?

            try {
                const hashedPassword = await hash(DEFAULT_IMPORT_PASSWORD, 10);

                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            email: parentData.email,
                            password: hashedPassword,
                            firstName: parentData.firstName,
                            lastName: parentData.lastName,
                            phone: parentData.phone,
                            role: "PARENT",
                            schoolId,
                            mustChangePassword: true,
                            // address: parentData.address // User does not have address column
                        }
                    });

                    const parentProfile = await tx.parentProfile.create({
                        data: {
                            userId: user.id,
                            profession: parentData.job || undefined, // Mapped to profession
                            // Removed cin/address as not in schema. Address is on User?
                            // Wait, schema check for User didn't show address.
                            // If address is not in User or ParentProfile, we skip it or assume schema is outdated in previous grep?
                            // Let's assume schema grep output is correct: User has NO address, ParentProfile has NO address?
                            // Wait, StudentProfile usually has address. Parent address might be implicitly student address?
                            // Or `address` should be added to User?
                            // Checking grep output: user has no address.
                            // Let's SKIP properties that don't exist to fix types.
                        }
                    });

                    // Link students
                    if (parentData.childrenMatricules) {
                        const matricules = parentData.childrenMatricules.split(",").map(m => m.trim());
                        if (matricules.length > 0) {
                            const students = await tx.studentProfile.findMany({
                                where: {
                                    matricule: { in: matricules },
                                    schoolId: schoolId || undefined // fix boolean/string mismatch
                                }
                            });

                            for (const student of students) {
                                // Use ParentStudent join table
                                await tx.parentStudent.create({
                                    data: {
                                        parentId: parentProfile.id,
                                        studentId: student.id,
                                        relationship: "PARENT", // Default
                                        isPrimary: true
                                    }
                                });
                            }
                        }
                    }
                });
                results.created++;
            } catch (err) {
                logger.error("Error creating parent", err, { module: "api/import/parents", row: index + 1 });
                results.errors.push({
                    row: index + 1,
                    error: err instanceof Error ? err.message : "Database error",
                    data: item,
                });
            }
        }

        if (results.created > 0) {
            await invalidateByPath(CACHE_PATHS.users).catch(() => { });
        }
        return NextResponse.json(results);
    },
    { allowedRoles: ALLOWED_ROLES },
);
