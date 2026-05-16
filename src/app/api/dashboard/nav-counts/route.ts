import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({}, { status: 401 });

    const role = session.user.role;
    const userId = session.user.id;
    const schoolId = getActiveSchoolId(session) ?? null;

    const counts: Record<string, number> = {};

    try {
        if (role === "DIRECTOR" || role === "SCHOOL_ADMIN") {
            if (schoolId) {
                const [students, pendingPayments, alerts] = await Promise.all([
                    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
                    prisma.payment.count({ where: { status: "PENDING", fee: { schoolId }, deletedAt: null } }),
                    prisma.notification.count({
                        where: { userId, isRead: false } as Record<string, unknown>,
                    }).catch(() => 0),
                ]);
                counts.students = students;
                counts.finance = pendingPayments;
                counts.notifications = alerts;
            }
        } else if (role === "TEACHER") {
            const teacher = await prisma.teacherProfile.findFirst({ where: { userId } });
            if (teacher) {
                const classSubjects = await prisma.classSubject.findMany({
                    where: { teacherId: teacher.id },
                    select: { classId: true },
                });
                const classIds = [...new Set(classSubjects.map((cs) => cs.classId))];
                if (classIds.length) {
                    const enrollments = await prisma.enrollment.count({
                        where: { classId: { in: classIds }, status: "ACTIVE" },
                    });
                    counts.teacherStudents = enrollments;
                }
            }
        } else if (role === "PARENT") {
            const parent = await prisma.parentProfile.findFirst({
                where: { userId },
                include: { parentStudents: true },
            });
            counts.children = parent?.parentStudents.length ?? 0;
            if (parent) {
                const studentIds = parent.parentStudents.map((ps) => ps.studentId);
                if (studentIds.length) {
                    const pending = await prisma.payment.count({
                        where: { studentId: { in: studentIds }, status: "PENDING", deletedAt: null },
                    });
                    counts.pendingPayments = pending;
                }
            }
        } else if (role === "STUDENT") {
            const student = await prisma.studentProfile.findFirst({ where: { userId } });
            if (student) {
                const homework = await prisma.homework
                    .count({
                        where: {
                            classSubject: {
                                class: {
                                    enrollments: {
                                        some: { studentId: student.id, status: "ACTIVE" },
                                    },
                                },
                            },
                            dueDate: { gte: new Date() },
                        } as Record<string, unknown>,
                    })
                    .catch(() => 0);
                counts.homework = homework;
            }
        } else if (role === "SUPER_ADMIN") {
            const [schools, users] = await Promise.all([
                prisma.school.count({ where: { isActive: true } }),
                prisma.user.count({ where: { isActive: true } }),
            ]);
            counts.networkSchools = schools;
            counts.networkUsers = users;
        }
    } catch (err) {
        console.error("nav-counts error", err);
    }

    return NextResponse.json(counts);
}
