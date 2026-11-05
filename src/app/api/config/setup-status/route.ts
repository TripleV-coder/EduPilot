import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const GET = createApiHandler(async (_request, context) => {
        const session = context.session;

    // École ouverte (et non l'école principale du compte) : un compte rattaché
    // à plusieurs écoles voit l'avancement de celle qu'il configure.
    const schoolId = getActiveSchoolId(session);
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

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
