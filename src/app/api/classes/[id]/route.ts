import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const GET = createApiHandler(
    async (request, { params, session }, t) => {
        const { id: classId } = await params;
        if (!classId) {
            return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
        }

        const schoolId = getActiveSchoolId(session);

        const classData = await prisma.class.findUnique({
            where: { id: classId as string },
            include: {
                classLevel: true,
                mainTeacher: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
                classSubjects: {
                    include: {
                        subject: {
                            select: { id: true, name: true, code: true, coefficient: true },
                        },
                        teacher: {
                            include: {
                                user: {
                                    select: { id: true, firstName: true, lastName: true },
                                },
                            },
                        },
                    },
                    orderBy: { subject: { name: "asc" } },
                },
                enrollments: {
                    where: { status: "ACTIVE" },
                    include: {
                        student: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        isActive: true,
                                    },
                                },
                            },
                        },
                        academicYear: {
                            select: { id: true, name: true, isCurrent: true },
                        },
                    },
                    orderBy: { student: { user: { lastName: "asc" } } },
                },
                schedules: {
                    select: {
                        id: true,
                        dayOfWeek: true,
                        startTime: true,
                        endTime: true,
                        room: true,
                        classSubjectId: true,
                    },
                    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
                },
                _count: {
                    select: {
                        enrollments: { where: { status: "ACTIVE" } },
                        classSubjects: true,
                    },
                },
            },
        });

        if (!classData) {
            return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Classe"), t), { status: 404 });
        }

        // Security check
        if (session.user.role !== "SUPER_ADMIN" && classData.schoolId !== schoolId) {
            return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        return NextResponse.json(classData);
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.CLASS_READ],
    }
);
