import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importParentSchema } from "@/lib/import/schemas";
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
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        const results = {
            created: 0,
            errors: [] as any[],
        };

        let schoolId = session.user.schoolId;
        if (!schoolId) {
            const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
            schoolId = userFull?.schoolId || null;
        }
        if (!schoolId) {
            return NextResponse.json({ error: "School context required" }, { status: 400 });
        }

        const generatePassword = () => Math.random().toString(36).slice(-8);

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

            // Check existence
            const existingUser = await prisma.user.findUnique({
                // If no email, duplicate check is hard. 
                // If email is provided, check it.
                where: parentData.email ? { email: parentData.email } : { id: "non-existent" }
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
                const hashedPassword = await hash(generatePassword(), 10);

                await prisma.$transaction(async (tx) => {
                    // Create User if email provided or generate dummy email?
                    // Parents might not have email. System requires email for User.
                    // If no email, maybe use phone@placeholder?

                    let email = parentData.email;
                    if (!email) {
                        // Generate placeholder email: parent.[phone].[random]@school.com?
                        // Or require email? Schema says optional.
                        email = `parent.${parentData.phone}.${Date.now()}@edupilot.local`;
                    }

                    const user = await tx.user.create({
                        data: {
                            email,
                            password: hashedPassword,
                            firstName: parentData.firstName,
                            lastName: parentData.lastName,
                            phone: parentData.phone,
                            role: "PARENT",
                            schoolId,
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
            } catch (err: any) {
                console.error("Error creating parent:", err);
                results.errors.push({
                    row: index + 1,
                    error: err.message || "Database error",
                    data: item,
                });
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error importing parents:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
