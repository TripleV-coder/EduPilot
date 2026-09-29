import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";

type TeacherOption = { teacherId: string; name: string; subjects: string[]; isMainTeacher: boolean };

/**
 * GET /api/appointments/options — de quoi demander un rendez-vous (parent) :
 * son profil, ses enfants et, pour chacun, les enseignants de sa classe
 * (professeur principal en tête). Avant, la page des rendez-vous n'offrait
 * aucun moyen d'en demander un.
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const parent = await prisma.parentProfile.findUnique({
            where: { userId: session.user.id },
            select: {
                id: true,
                parentStudents: {
                    select: {
                        student: {
                            select: {
                                id: true,
                                user: { select: { firstName: true, lastName: true } },
                                enrollments: {
                                    where: { status: "ACTIVE", deletedAt: null },
                                    orderBy: { academicYear: { startDate: "desc" } },
                                    take: 1,
                                    select: {
                                        class: {
                                            select: {
                                                name: true,
                                                mainTeacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                                                classSubjects: {
                                                    select: {
                                                        subject: { select: { name: true } },
                                                        teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!parent) return NextResponse.json({ error: "Profil parent introuvable" }, { status: 404 });

        const children = parent.parentStudents.map(({ student }) => {
            const klass = student.enrollments[0]?.class ?? null;
            const teachers = new Map<string, TeacherOption>();
            if (klass?.mainTeacher) {
                const t = klass.mainTeacher;
                teachers.set(t.id, { teacherId: t.id, name: `${t.user.firstName} ${t.user.lastName}`, subjects: [], isMainTeacher: true });
            }
            for (const cs of klass?.classSubjects ?? []) {
                if (!cs.teacher) continue;
                const existing = teachers.get(cs.teacher.id) ?? {
                    teacherId: cs.teacher.id,
                    name: `${cs.teacher.user.firstName} ${cs.teacher.user.lastName}`,
                    subjects: [],
                    isMainTeacher: false,
                };
                if (!existing.subjects.includes(cs.subject.name)) existing.subjects.push(cs.subject.name);
                teachers.set(cs.teacher.id, existing);
            }
            return {
                studentId: student.id,
                name: `${student.user.firstName} ${student.user.lastName}`,
                className: klass?.name ?? null,
                teachers: [...teachers.values()].sort((a, b) => Number(b.isMainTeacher) - Number(a.isMainTeacher)),
            };
        });

        return NextResponse.json({ parentId: parent.id, children });
    },
    { allowedRoles: ["PARENT"] },
);
