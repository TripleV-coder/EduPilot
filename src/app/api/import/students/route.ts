import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importStudentSchema } from "@/lib/import/schemas";
import { hash } from "bcryptjs";
import crypto from "crypto";

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
        const { data } = body; // Expecting { data: ImportStudent[] }

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const results = {
            created: 0,
            errors: [] as any[],
        };

        // Secure password generation
        const generatePassword = (): string => {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
            let password = "";
            for (let i = 0; i < 12; i++) {
                password += chars.charAt(crypto.randomInt(chars.length));
            }
            return password;
        };

        // Get School ID
        let schoolId = session.user.schoolId;
        if (!schoolId) {
            const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
            schoolId = userFull?.schoolId || null;
        }

        if (!schoolId) {
            return NextResponse.json({ error: "School context required" }, { status: 400 });
        }

        // Pre-fetch specific resources to optimize finding connections? 
        // For now, doing it per row for safety and simplicity, though slower.

        for (const [index, item] of data.entries()) {
            const validation = importStudentSchema.safeParse(item);

            if (!validation.success) {
                results.errors.push({
                    row: index + 1,
                    error: "Validation failed",
                    details: validation.error.issues,
                    data: item,
                });
                continue;
            }

            const studentData = validation.data;

            // Check if email exists (if provided)
            if (studentData.email) {
                const existingUser = await prisma.user.findUnique({
                    where: { email: studentData.email },
                });
                if (existingUser) {
                    results.errors.push({
                        row: index + 1,
                        error: "Email already exists",
                        email: studentData.email,
                    });
                    continue;
                }
            }

            // Check if matricule exists (if provided)
            if (studentData.matricule) {
                const existingStudent = await prisma.studentProfile.findFirst({
                    where: { matricule: studentData.matricule, schoolId: schoolId },
                });
                if (existingStudent) {
                    results.errors.push({
                        row: index + 1,
                        error: "Matricule already exists",
                        matricule: studentData.matricule,
                    });
                    continue;
                }
            }

            try {
                // Find Class if provided
                let classId = null;
                if (studentData.className) {
                    const classObj = await prisma.class.findFirst({
                        where: {
                            name: { equals: studentData.className, mode: "insensitive" },
                            schoolId: schoolId,
                        },
                    });
                    if (classObj) {
                        classId = classObj.id;
                    } else {
                        // Warn but don't fail? Or fail? 
                        // Let's create without class and note warning? 
                        // For simplicity, let's treat it as valid but not enrolled.
                    }
                }

                // Create User & Student Profile
                const hashedPassword = await hash(generatePassword(), 10);

                // If email is missing, generate a unique placeholder using crypto
                const emailToUse = studentData.email || `student.${crypto.randomUUID()}@placeholder.edupilot.local`;

                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            email: emailToUse,
                            password: hashedPassword,
                            firstName: studentData.firstName,
                            lastName: studentData.lastName,
                            role: "STUDENT",
                            schoolId: schoolId,
                            // phone: studentData.phone, // Not in student schema? Parent has phone.
                            // address: studentData.address, // Not in User schema
                        },
                    });

                    const studentProfile = await tx.studentProfile.create({
                        data: {
                            userId: user.id,
                            schoolId: schoolId,
                            matricule: studentData.matricule || `STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : undefined,
                            gender: studentData.gender as any || undefined,
                            birthPlace: studentData.birthPlace,
                        },
                    });

                    // Enroll if class found
                    if (classId) {
                        // Check if academic year exists? We need an active academic year.
                        // Ideally we pick the current one.
                        const academicYear = await tx.academicYear.findFirst({
                            where: { schoolId: schoolId, isCurrent: true },
                        });

                        if (academicYear) {
                            await tx.enrollment.create({
                                data: {
                                    studentId: studentProfile.id,
                                    classId: classId,
                                    academicYearId: academicYear.id,
                                    status: "ACTIVE",
                                },
                            });
                        }
                    }
                });

                results.created++;
            } catch (err: any) {
                console.error("Error creating student:", err);
                results.errors.push({
                    row: index + 1,
                    error: "Database error",
                    details: err.message,
                });
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error importing students:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
