import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: t("api.errors.unauthenticated") }, { status: 401 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
        return NextResponse.json({
            academicYears: 0,
            teachers: 0,
            classes: 0,
            students: 0,
        });
    }

    try {
        const [academicYears, teachers, classes, students] = await Promise.all([
            prisma.academicYear.count({ where: { schoolId } }),
            prisma.teacherProfile.count({ where: { schoolId } }),
            prisma.class.count({ where: { schoolId } }),
            prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
        ]);

        return NextResponse.json({
            academicYears,
            teachers,
            classes,
            students,
        });
    } catch {
        return NextResponse.json({
            academicYears: 0,
            teachers: 0,
            classes: 0,
            students: 0,
        });
    }
}
