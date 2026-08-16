import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/nav-counts — compteurs live de la sidebar (NavCounts).
 * Chaque rôle ne calcule que les compteurs affichés par sa navigation
 * (voir src/components/edu-shell/role-nav.ts).
 */
export const GET = createApiHandler(async (_request, context) => {
        const session = context.session;
const role = session.user.role;
    const userId = session.user.id;
    const schoolId = getActiveSchoolId(session) ?? null;

    const counts: Record<string, number> = {};

    const unreadNotifications = () =>
        prisma.notification.count({ where: { userId, isRead: false } }).catch(() => 0);

    try {
        if (roleSatisfies(role, ["DIRECTOR", "SCHOOL_ADMIN"])) {
            if (schoolId) {
                const [students, pendingPayments, alerts] = await Promise.all([
                    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
                    prisma.payment.count({
                        where: { status: "PENDING", fee: { schoolId }, deletedAt: null },
                    }),
                    unreadNotifications(),
                ]);
                counts.students = students;
                counts.finance = pendingPayments;
                counts.notifications = alerts;
            }
        } else if (role === "TEACHER") {
            const teacher = await prisma.teacherProfile.findFirst({
                where: { userId },
                select: { id: true },
            });
            if (teacher) {
                const classSubjects = await prisma.classSubject.findMany({
                    where: { teacherId: teacher.id },
                    select: { id: true, classId: true },
                });
                const classIds = [...new Set(classSubjects.map((cs) => cs.classId))];
                const classSubjectIds = classSubjects.map((cs) => cs.id);

                const [enrollments, unreadMessages, pendingGradeEntry] = await Promise.all([
                    classIds.length
                        ? prisma.enrollment.count({
                              where: { classId: { in: classIds }, status: "ACTIVE" },
                          })
                        : Promise.resolve(0),
                    prisma.message.count({
                        where: { recipientId: userId, isRead: false, deletedByRecipient: false },
                    }),
                    // Évaluations passées sans aucune note saisie = saisie en attente
                    classSubjectIds.length
                        ? prisma.evaluation.count({
                              where: {
                                  classSubjectId: { in: classSubjectIds },
                                  date: { lte: new Date() },
                                  grades: { none: {} },
                              },
                          })
                        : Promise.resolve(0),
                ]);
                counts.teacherStudents = enrollments;
                counts.teacherMessages = unreadMessages;
                counts.teacherGradeEntry = pendingGradeEntry;
            }
        } else if (role === "PARENT") {
            const parent = await prisma.parentProfile.findFirst({
                where: { userId },
                include: { parentStudents: true },
            });
            counts.children = parent?.parentStudents.length ?? 0;
            counts.notifications = await unreadNotifications();
            if (parent) {
                const studentIds = parent.parentStudents.map((ps) => ps.studentId);
                if (studentIds.length) {
                    counts.pendingPayments = await prisma.payment.count({
                        where: {
                            studentId: { in: studentIds },
                            status: "PENDING",
                            deletedAt: null,
                        },
                    });
                }
            }
        } else if (role === "STUDENT") {
            const student = await prisma.studentProfile.findFirst({
                where: { userId },
                select: { id: true },
            });
            if (student) {
                counts.homework = await prisma.homework
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
                        },
                    })
                    .catch(() => 0);
            }
        } else if (role === "SUPER_ADMIN") {
            const [schools, users, alerts] = await Promise.all([
                prisma.school.count({ where: { isActive: true } }),
                prisma.user.count({ where: { isActive: true } }),
                unreadNotifications(),
            ]);
            counts.networkSchools = schools;
            counts.networkUsers = users;
            counts.networkAlerts = alerts;
        }
    } catch (err) {
        logger.error("nav-counts error", err as Error, { module: "api/dashboard/nav-counts" });
    }

    return NextResponse.json(counts);

});
