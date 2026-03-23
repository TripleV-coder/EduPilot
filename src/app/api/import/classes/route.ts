import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";
import { importClassSchema } from "@/lib/import/schemas";

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
        const { data, schoolId: bodySchoolId } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const results = {
            created: 0,
            errors: [] as any[],
        };

        let schoolId = session.user.schoolId || null;
        if (session.user.role === "SUPER_ADMIN") {
            const { searchParams } = new URL(request.url);
            schoolId = bodySchoolId || searchParams.get("schoolId") || null;
        }

        if (!schoolId) {
            const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
            schoolId = userFull?.schoolId ?? null;
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

        for (const [index, item] of data.entries()) {
            const validation = importClassSchema.safeParse(item);

            if (!validation.success) {
                results.errors.push({
                    row: index + 1,
                    error: "Validation failed",
                    details: validation.error.issues,
                    data: item,
                });
                continue;
            }

            const classData = validation.data;

            try {
                await prisma.$transaction(async (tx) => {
                    // 1. Find or create ClassLevel
                    // Logic: search by code

                    // Note: Level codes are often standardized like "6EME", "5EME".
                    // If level doesn't exist, we create it? Or require it to exist?
                    // For onboarding wizard, automatic creation is better UX.

                    let level = await tx.classLevel.findFirst({
                        where: {
                            schoolId,
                            code: classData.level
                        }
                    });

                    if (!level) {
                        level = await tx.classLevel.create({
                            data: {
                                schoolId,
                                name: classData.level,
                                code: classData.level,
                                level: "PRIMARY", // Default, should ideally be inferred
                                sequence: 1,      // Default
                            }
                        });
                    }

                    // 2. Find teacher if email provided
                    let mainTeacherId = undefined;
                    if (classData.mainTeacherEmail) {
                        const teacherUser = await tx.user.findUnique({
                            where: { email: classData.mainTeacherEmail },
                            include: { teacherProfile: true }
                        });
                        if (teacherUser?.teacherProfile && teacherUser.teacherProfile.schoolId === schoolId) {
                            mainTeacherId = teacherUser.teacherProfile.id;
                        } else {
                            // Warning: Teacher not found, but we create class anyway
                            // Could add warning to results
                        }
                    }

                    // 3. Create Class
                    // Check duplicate name in same school?
                    const existingClass = await tx.class.findFirst({
                        where: {
                            schoolId,
                            name: classData.name
                        }
                    });

                    if (existingClass) {
                        // Skip or update? Skip for now to avoid overwrites.
                        throw new Error(`Class ${classData.name} already exists`);
                    }

                    await tx.class.create({
                        data: {
                            name: classData.name,
                            schoolId,
                            classLevelId: level.id,
                            mainTeacherId,
                            capacity: classData.capacity,
                            // programId: TODO if we had programs
                        }
                    });
                });

                results.created++;
            } catch (err) {
                logger.error("Error creating class", err, { module: "api/import/classes", row: index + 1 });
                results.errors.push({
                    row: index + 1,
                    error: (err as any).message || "Database error",
                    data: item,
                });
            }
        }

        if (results.created > 0) {
            await invalidateByPath(CACHE_PATHS.classes).catch(() => { });
        }
        return NextResponse.json(results);
    } catch (error) {
        logger.error("Error importing classes", error instanceof Error ? error : new Error(String(error)), { module: "api/import/classes" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
