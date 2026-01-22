import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { feeSchema } from "@/lib/validations/finance";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const schoolId = searchParams.get("schoolId");

        // Only allow fetching fees for user's school or if admin
        // For now, assume schoolId is passed or derived from user profile
        // But schema doesn't link User directly to School easily for all roles,
        // usually we use `session.user.schoolId` if added to session, or fetch profile.

        // Let's check user permissions
        const userRole = session.user.role;
        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"];

        if (!allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Since we don't have schoolId in session easily (yet), we fetch user profile
        // Or we rely on client passing schoolId (which should be validated)

        let targetSchoolId = schoolId;

        if (!targetSchoolId) {
            // Try to find school from user profile
            // This depends on how User is linked to School. 
            // TeacherProfile, StudentProfile have schoolId. But what about Accountant?
            // Accountant should likely have a profile or a direct link.
            // Looking at ProfileData in profile/page.tsx, it seems there is `school` relation on User or profile.
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { school: true } // Assuming User has schoolId or relation
            });
            targetSchoolId = user?.schoolId || null;
        }

        if (!targetSchoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const fees = await prisma.fee.findMany({
            where: {
                schoolId: targetSchoolId,
                isActive: true, // You might want to filter by active
            },
            include: {
                academicYear: true,
                _count: {
                    select: {
                        payments: true,
                        paymentPlans: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(fees);
    } catch (error) {
        console.error("Error fetching fees:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = session.user.role;
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = feeSchema.parse(body);

        // Ensure schoolId is present. If not in body (schema doesn't have it?), get from user.
        // feeSchema has: name, description, amount, academicYearId, classLevelCode, dueDate, isRequired.
        // It does NOT have schoolId. So we must infer it.

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { schoolId: true }
        });

        if (!user?.schoolId) {
            return NextResponse.json({ error: "User not associated with a school" }, { status: 400 });
        }

        const fee = await prisma.fee.create({
            data: {
                schoolId: user.schoolId,
                name: validatedData.name,
                description: validatedData.description,
                amount: validatedData.amount,
                academicYearId: validatedData.academicYearId,
                classLevelCode: validatedData.classLevelCode,
                dueDate: validatedData.dueDate,
                isRequired: validatedData.isRequired,
                isActive: true,
            },
        });

        return NextResponse.json(fee, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error creating fee:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
