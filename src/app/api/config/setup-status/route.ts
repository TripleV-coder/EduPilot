import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(async (_request, context) => {
        const session = context.session;

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

});
