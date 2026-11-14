import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { classSchema } from "@/lib/validations/school";
import { assertModelAccess } from "@/lib/security/tenant";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";

export const GET = createApiHandler(
    async (request, { params, session }, t) => {
        const { id: classId } = await params;
        if (!classId) {
            return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
        }

        const schoolId = getActiveSchoolId(session);

        // Classe d'un autre établissement → 404 : ses élèves sont de toute façon
        // masqués par la RLS (audit M2), le chargement des inscriptions échouerait.
        const classData = await prisma.class.findFirst({
            where: {
                id: classId as string,
                ...(session.user.role === "SUPER_ADMIN" ? {} : { schoolId }),
            },
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

/** Champs modifiables d'une classe (au moins un). */
const classUpdateSchema = classSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

/**
 * PATCH /api/classes/[id] — renommer une classe, changer son niveau, sa capacité
 * ou son professeur principal. Aucune route ne le permettait : une faute de frappe
 * ou un changement de professeur principal restait définitif.
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const access = await assertModelAccess(session, "class", id, "Classe introuvable");
        if (access) return access;

        const data = classUpdateSchema.parse(await request.json());
        const current = await prisma.class.findUnique({
            where: { id },
            select: { id: true, schoolId: true, classLevelId: true, name: true, capacity: true, mainTeacherId: true },
        });
        if (!current) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });

        const nextLevelId = data.classLevelId ?? current.classLevelId;
        const nextName = (data.name ?? current.name).trim();
        if (!nextName) return NextResponse.json({ error: "Le nom de la classe est obligatoire." }, { status: 400 });

        if (data.classLevelId && data.classLevelId !== current.classLevelId) {
            const level = await prisma.classLevel.findUnique({ where: { id: data.classLevelId }, select: { schoolId: true, level: true } });
            if (!level || level.schoolId !== current.schoolId) {
                return NextResponse.json({ error: "Ce niveau n'appartient pas à votre établissement." }, { status: 403 });
            }
            // Même règle qu'à la création : le cycle doit être offert par l'école
            const school = await prisma.school.findUnique({ where: { id: current.schoolId }, select: { offeredLevels: true } });
            if (school?.offeredLevels?.length && !school.offeredLevels.includes(level.level)) {
                return NextResponse.json({ error: "Ce cycle n'est pas offert par votre établissement." }, { status: 403 });
            }
        }

        if (nextName !== current.name || nextLevelId !== current.classLevelId) {
            const duplicate = await prisma.class.findFirst({
                where: { schoolId: current.schoolId, classLevelId: nextLevelId, name: nextName, id: { not: id } },
                select: { id: true },
            });
            if (duplicate) {
                return NextResponse.json({ error: "Une classe porte déjà ce nom à ce niveau." }, { status: 409 });
            }
        }

        if (data.capacity !== undefined) {
            const enrolled = await prisma.enrollment.count({ where: { classId: id, status: "ACTIVE", deletedAt: null } });
            if (data.capacity < enrolled) {
                return NextResponse.json(
                    { error: `La capacité (${data.capacity}) est inférieure au nombre d'élèves inscrits (${enrolled}).` },
                    { status: 409 },
                );
            }
        }

        if (data.mainTeacherId && !(await isTeacherAssignedToSchool(data.mainTeacherId, current.schoolId))) {
            return NextResponse.json({ error: "Cet enseignant n'appartient pas à votre établissement." }, { status: 403 });
        }

        const updated = await prisma.class.update({
            where: { id },
            data: {
                name: nextName,
                classLevelId: nextLevelId,
                ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
                ...(data.mainTeacherId !== undefined ? { mainTeacherId: data.mainTeacherId } : {}),
            },
            include: {
                classLevel: true,
                mainTeacher: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "CLASS_UPDATED",
            entity: "Class",
            entityId: id,
            schoolId: current.schoolId,
            oldValues: { name: current.name, classLevelId: current.classLevelId, capacity: current.capacity, mainTeacherId: current.mainTeacherId },
            newValues: { name: updated.name, classLevelId: updated.classLevelId, capacity: updated.capacity, mainTeacherId: updated.mainTeacherId },
        });
        await invalidateByPath(CACHE_PATHS.classes);
        return NextResponse.json(updated);
    },
    { requireAuth: true, requiredPermissions: [Permission.CLASS_UPDATE] },
);

/**
 * DELETE /api/classes/[id] — supprime une classe VIDE (règle prudente) : avec des
 * élèves, des matières, un emploi du temps, des présences ou un conseil, la
 * réponse 409 dit quoi retirer d'abord. La page appelait cette route alors
 * qu'elle n'existait pas (405, « Erreur lors de la suppression »).
 */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const access = await assertModelAccess(session, "class", id, "Classe introuvable");
        if (access) return access;

        const current = await prisma.class.findUnique({ where: { id }, select: { id: true, name: true, schoolId: true } });
        if (!current) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });

        const [enrollments, classSubjects, schedules, attendances, councils, cagnottes] = await Promise.all([
            prisma.enrollment.count({ where: { classId: id } }),
            prisma.classSubject.count({ where: { classId: id } }),
            prisma.schedule.count({ where: { classId: id } }),
            prisma.attendance.count({ where: { classId: id } }),
            prisma.classCouncil.count({ where: { classId: id } }),
            prisma.cagnotte.count({ where: { classId: id } }),
        ]);
        const conflict = dependencyConflict(
            `la classe ${current.name}`,
            [
                { count: enrollments, one: "inscription d'élève", many: "inscriptions d'élèves" },
                { count: classSubjects, one: "matière", many: "matières" },
                { count: schedules, one: "créneau d'emploi du temps", many: "créneaux d'emploi du temps" },
                { count: attendances, one: "relevé de présence", many: "relevés de présence" },
                { count: councils, one: "conseil de classe", many: "conseils de classe" },
                { count: cagnottes, one: "cagnotte", many: "cagnottes" },
            ],
            "Changez d'abord les élèves de classe et retirez ses matières et son emploi du temps ; une classe qui a servi reste dans l'historique.",
        );
        if (conflict) return conflict;

        await prisma.class.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "CLASS_DELETED",
            entity: "Class",
            entityId: id,
            schoolId: current.schoolId,
            oldValues: { name: current.name },
            severity: "WARNING",
        });
        await invalidateByPath(CACHE_PATHS.classes);
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, requiredPermissions: [Permission.CLASS_DELETE] },
);
