import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importTeacherSchema } from "@/lib/import/schemas";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { data } = body; // Expecting { data: ImportTeacher[] }

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const results = {
            created: 0,
            errors: [] as any[],
        };

        // Helper to generate a temporary password
        const generatePassword = () => Math.random().toString(36).slice(-8);

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
                const hashedPassword = await hash(generatePassword(), 10); // In real app, send email with invite

                // We need the schoolId. Assuming session user is SCHOOL_ADMIN and has schoolId or is SUPER_ADMIN and provides it?
                // For onboard wizard, usually the admin is importing for their own school.

                let schoolId = session.user.schoolId;
                // If no schoolId in session (Super Admin?), maybe pass in query or body? 
                // For now assume user has schoolId.
                if (!schoolId) {
                    const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
                    schoolId = userFull?.schoolId || null;
                }

                if (!schoolId) {
                    throw new Error("School context required");
                }

                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            email: teacherData.email,
                            password: hashedPassword,
                            firstName: teacherData.firstName,
                            lastName: teacherData.lastName,
                            role: "TEACHER",
                            schoolId: schoolId,
                            phone: teacherData.phone,
                        },
                    });

                    await tx.teacherProfile.create({
                        data: {
                            userId: user.id,
                            specialization: teacherData.subjects || "General",
                            schoolId: schoolId || "",
                        },
                    });
                });

                results.created++;
            } catch (err: any) {
                console.error("Error creating teacher:", err);
                results.errors.push({
                    row: index + 1,
                    error: "Database error",
                    details: err.message,
                });
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error importing teachers:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
