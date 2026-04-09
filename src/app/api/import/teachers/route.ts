import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";
import { importTeacherSchema } from "@/lib/import/schemas";
import { hash } from "bcryptjs";
import { checkTeacherQuota } from "@/lib/saas/quotas";
import { buildTeacherSchoolAssignments } from "@/lib/teachers/school-assignments";

import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { data, schoolId: bodySchoolId } = body; // Expecting { data: ImportTeacher[], schoolId? }

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const results = {
            created: 0,
            errors: [] as any[],
        };

        const DEFAULT_IMPORT_PASSWORD = "00000000";

        // Resolve school context once
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

        // Quota check once before processing rows
        const quota = await checkTeacherQuota(schoolId);
        if (!quota.allowed) {
            return NextResponse.json({
                error: `Quota d'enseignants atteint (${quota.limit}).`,
                code: "QUOTA_EXCEEDED"
            }, { status: 403 });
        }

        if (quota.current + data.length > quota.limit) {
            return NextResponse.json({
                error: `L'import dépasserait votre quota restant de ${quota.limit - quota.current}.`,
                code: "QUOTA_WILL_EXCEED"
            }, { status: 403 });
        }

        for (const [index, item] of data.entries()) {
            const validation = importTeacherSchema.safeParse(item);

            if (!validation.success) {
                results.errors.push({
                    row: index + 1,
                    error: "Validation failed",
                    details: validation.error.issues,
                    data: item,
                });
                continue;
            }

            const teacherData = validation.data;

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { email: teacherData.email },
            });

            if (existingUser) {
                results.errors.push({
                    row: index + 1,
                    error: "Email already exists",
                    email: teacherData.email,
                });
                continue;
            }

            // Create User and Teacher
            try {
                const hashedPassword = await hash(DEFAULT_IMPORT_PASSWORD, 10);

                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            email: teacherData.email,
                            password: hashedPassword,
                            firstName: teacherData.firstName,
                            lastName: teacherData.lastName,
                            role: "TEACHER",
                            roles: ["TEACHER"],
                            schoolId: schoolId,
                            phone: teacherData.phone,
                            mustChangePassword: true,
                        },
                    });

                    const profile = await tx.teacherProfile.create({
                        data: {
                            userId: user.id,
                            specialization: teacherData.subjects || "General",
                            schoolId: schoolId || "",
                        },
                    });

                    await tx.teacherSchoolAssignment.createMany({
                        data: buildTeacherSchoolAssignments({
                            teacherId: profile.id,
                            userId: user.id,
                            primarySchoolId: schoolId || "",
                            schoolIds: [schoolId || ""],
                        }),
                        skipDuplicates: true,
                    });
                });

                results.created++;
            } catch (err) {
                logger.error("Error creating teacher", err, { module: "api/import/teachers", row: index + 1 });
                results.errors.push({
                    row: index + 1,
                    error: "Database error",
                    details: (err as any).message,
                });
            }
        }

        if (results.created > 0) {
            await invalidateByPath(CACHE_PATHS.teachers).catch(() => { });
            await invalidateByPath(CACHE_PATHS.users).catch(() => { });
        }
        return NextResponse.json(results);
    } catch (error) {
        logger.error("Error importing teachers", error instanceof Error ? error : new Error(String(error)), { module: "api/import/teachers" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
