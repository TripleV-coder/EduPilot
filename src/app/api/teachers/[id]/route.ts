import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import {
    buildTeacherSchoolAssignments,
    isTeacherAssignedToSchool,
    normalizeTeacherSchoolIds,
} from "@/lib/teachers/school-assignments";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { checkTeacherQuota } from "@/lib/saas/quotas";
import { teacherUpdateSchema } from "@/lib/validations/user";

const READ_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * GET /api/teachers/[id]
 * Get full teacher detail: profile, classes taught, subjects, schedule
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!READ_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { id } = await params;
        const activeSchoolId = getActiveSchoolId(session);

        const teacher = await prisma.teacherProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        avatar: true,
                        createdAt: true,
                    },
                },
                school: {
                    select: { id: true, name: true, code: true },
                },
                classSubjects: {
                    include: {
                        subject: {
                            select: { id: true, name: true, code: true, coefficient: true },
                        },
                        class: {
                            include: {
                                school: {
                                    select: { id: true, name: true, code: true },
                                },
                                classLevel: { select: { id: true, name: true, level: true } },
                                _count: {
                                    select: { enrollments: { where: { status: "ACTIVE" } } },
                                },
                            },
                        },
                    },
                    orderBy: { class: { name: "asc" } },
                },
                mainClasses: {
                    select: {
                        id: true,
                        name: true,
                        schoolId: true,
                        classLevel: { select: { id: true, name: true } },
                        _count: {
                            select: { enrollments: { where: { status: "ACTIVE" } } },
                        },
                    },
                },
                schoolAssignments: {
                    where: { status: "ACTIVE" },
                    include: {
                        school: {
                            select: { id: true, name: true, code: true },
                        },
                    },
                    orderBy: [{ isPrimary: "desc" }, { school: { name: "asc" } }],
                },
            },
        });

        if (!teacher || teacher.deletedAt) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        // Security: ensure same school
        if (
            session.user.role !== "SUPER_ADMIN" &&
            (!activeSchoolId || !(await isTeacherAssignedToSchool(teacher.id, activeSchoolId)))
        ) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const canViewAllSchools =
            session.user.role === "SUPER_ADMIN" ||
            (session.user.role === "TEACHER" && teacher.userId === session.user.id);

        const visibleClassSubjects =
            canViewAllSchools || !activeSchoolId
                ? teacher.classSubjects
                : teacher.classSubjects.filter((classSubject) => classSubject.class.schoolId === activeSchoolId);

        const visibleMainClasses =
            canViewAllSchools || !activeSchoolId
                ? teacher.mainClasses
                : teacher.mainClasses.filter((schoolClass) => schoolClass.schoolId === activeSchoolId);

        const visibleSchools =
            canViewAllSchools || !activeSchoolId
                ? (
                    teacher.schoolAssignments.length > 0
                        ? teacher.schoolAssignments.map((assignment) => assignment.school)
                        : (teacher.school ? [teacher.school] : [])
                )
                : (
                    teacher.schoolAssignments.length > 0
                        ? teacher.schoolAssignments
                            .filter((assignment) => assignment.schoolId === activeSchoolId)
                            .map((assignment) => assignment.school)
                        : (teacher.school?.id === activeSchoolId ? [teacher.school] : [])
                );

        // Deduplicate subjects
        const seenSubjects = new Map<string, { id: string; name: string; code: string }>();
        visibleClassSubjects.forEach((cs) => {
            if (cs.subject && !seenSubjects.has(cs.subject.id)) {
                seenSubjects.set(cs.subject.id, cs.subject);
            }
        });

        // Deduplicate classes
        const seenClasses = new Map<string, any>();
        visibleClassSubjects.forEach((cs) => {
            if (cs.class && !seenClasses.has(cs.class.id)) {
                seenClasses.set(cs.class.id, {
                    id: cs.class.id,
                    name: cs.class.name,
                    classLevel: cs.class.classLevel,
                    studentCount: cs.class._count?.enrollments ?? 0,
                });
            }
        });

        // Fetch schedule for this teacher
        const schedules = await prisma.schedule.findMany({
            where: {
                classSubjectId: {
                    in: visibleClassSubjects.map((cs) => cs.id),
                },
            },
            select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                room: true,
                classId: true,
                classSubjectId: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });

        return NextResponse.json({
            ...teacher,
            classSubjects: visibleClassSubjects,
            schoolAssignments: canViewAllSchools || !activeSchoolId
                ? teacher.schoolAssignments
                : teacher.schoolAssignments.filter((assignment) => assignment.schoolId === activeSchoolId),
            subjects: Array.from(seenSubjects.values()),
            classes: Array.from(seenClasses.values()),
            mainClasses: visibleMainClasses,
            schools: visibleSchools,
            schedules,
        });
    } catch (error) {
        logger.error("Error fetching teacher detail", error as Error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération de l'enseignant" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/teachers/[id]
 * Update teacher profile and school assignments
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!MANAGE_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validatedData = teacherUpdateSchema.parse(body);
        const activeSchoolId = getActiveSchoolId(session);

        const teacher = await prisma.teacherProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
                classSubjects: {
                    select: {
                        id: true,
                        class: {
                            select: { schoolId: true, name: true },
                        },
                    },
                },
                mainClasses: {
                    select: {
                        id: true,
                        name: true,
                        schoolId: true,
                    },
                },
                schoolAssignments: {
                    where: { status: "ACTIVE" },
                    select: { schoolId: true, isPrimary: true },
                },
            },
        });

        if (!teacher || teacher.deletedAt) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        if (
            session.user.role !== "SUPER_ADMIN" &&
            (!activeSchoolId || !(await isTeacherAssignedToSchool(id, activeSchoolId)))
        ) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const normalizedSchools = normalizeTeacherSchoolIds({
            primarySchoolId: validatedData.primarySchoolId ?? validatedData.schoolId ?? teacher.schoolId,
            schoolId: validatedData.schoolId,
            additionalSchoolIds: validatedData.additionalSchoolIds,
        });

        const currentSchoolIds = Array.from(new Set([
            teacher.schoolId,
            ...teacher.schoolAssignments.map((assignment) => assignment.schoolId),
        ]));
        const currentPrimarySchoolId =
            teacher.schoolAssignments.find((assignment) => assignment.isPrimary)?.schoolId ?? teacher.schoolId;

        if (
            session.user.role !== "SUPER_ADMIN" &&
            (
                validatedData.schoolId !== undefined ||
                validatedData.primarySchoolId !== undefined ||
                validatedData.additionalSchoolIds !== undefined
            )
        ) {
            return NextResponse.json({ error: "Seul le SUPER_ADMIN peut modifier les affectations multi-établissements" }, { status: 403 });
        }

        const assignedSchoolIds = session.user.role === "SUPER_ADMIN"
            ? normalizedSchools.schoolIds
            : currentSchoolIds;

        const existingSchools = await prisma.school.findMany({
            where: { id: { in: assignedSchoolIds } },
            select: { id: true },
        });

        if (existingSchools.length !== assignedSchoolIds.length) {
            return NextResponse.json({ error: "Un ou plusieurs établissements sélectionnés sont introuvables" }, { status: 400 });
        }

        const removedSchoolIds = currentSchoolIds.filter((schoolId) => !assignedSchoolIds.includes(schoolId));

        if (removedSchoolIds.length > 0) {
            const stillLinkedClass = teacher.classSubjects.find((classSubject) => removedSchoolIds.includes(classSubject.class.schoolId));
            const stillLinkedMainClass = teacher.mainClasses.find((schoolClass) => removedSchoolIds.includes(schoolClass.schoolId));

            if (stillLinkedClass || stillLinkedMainClass) {
                return NextResponse.json(
                    {
                        error: "Impossible de retirer une école tant que l'enseignant y est encore affecté à des classes ou matières",
                    },
                    { status: 400 }
                );
            }
        }

        for (const schoolId of assignedSchoolIds.filter((schoolId) => !currentSchoolIds.includes(schoolId))) {
            const quota = await checkTeacherQuota(schoolId);
            if (!quota.allowed) {
                return NextResponse.json({ error: `Quota d'enseignants atteint (${quota.limit}) pour l'établissement sélectionné.` }, { status: 403 });
            }
        }

        if (validatedData.email && validatedData.email !== teacher.user.email) {
            const emailOwner = await prisma.user.findUnique({
                where: { email: validatedData.email },
                select: { id: true },
            });

            if (emailOwner && emailOwner.id !== teacher.user.id) {
                return NextResponse.json({ error: "Un utilisateur existe déjà avec cet email" }, { status: 400 });
            }
        }

        const primarySchoolId =
            session.user.role === "SUPER_ADMIN"
                ? (normalizedSchools.primarySchoolId ?? assignedSchoolIds[0] ?? teacher.schoolId)
                : currentPrimarySchoolId;

        const updatedTeacher = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: teacher.userId },
                data: {
                    ...(validatedData.email ? { email: validatedData.email } : {}),
                    ...(validatedData.firstName ? { firstName: validatedData.firstName } : {}),
                    ...(validatedData.lastName ? { lastName: validatedData.lastName } : {}),
                    ...(validatedData.phone !== undefined ? { phone: validatedData.phone || null } : {}),
                    ...(validatedData.isActive !== undefined ? { isActive: validatedData.isActive } : {}),
                    schoolId: primarySchoolId,
                },
            });

            await tx.teacherProfile.update({
                where: { id },
                data: {
                    schoolId: primarySchoolId,
                    ...(validatedData.matricule !== undefined ? { matricule: validatedData.matricule || null } : {}),
                    ...(validatedData.specialization !== undefined ? { specialization: validatedData.specialization || null } : {}),
                    ...(validatedData.hireDate !== undefined ? { hireDate: validatedData.hireDate ? new Date(validatedData.hireDate) : null } : {}),
                },
            });

            await tx.teacherSchoolAssignment.updateMany({
                where: {
                    teacherId: id,
                    schoolId: { notIn: assignedSchoolIds },
                    status: "ACTIVE",
                },
                data: {
                    status: "INACTIVE",
                    isPrimary: false,
                    endDate: new Date(),
                },
            });

            for (const schoolId of assignedSchoolIds) {
                await tx.teacherSchoolAssignment.upsert({
                    where: {
                        teacherId_schoolId: {
                            teacherId: id,
                            schoolId,
                        },
                    },
                    create: buildTeacherSchoolAssignments({
                        teacherId: id,
                        userId: teacher.userId,
                        primarySchoolId,
                        schoolIds: [schoolId],
                    })[0],
                    update: {
                        status: "ACTIVE",
                        isPrimary: schoolId === primarySchoolId,
                        endDate: null,
                    },
                });
            }

            return tx.teacherProfile.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            isActive: true,
                        },
                    },
                    school: {
                        select: { id: true, name: true, code: true },
                    },
                    schoolAssignments: {
                        where: { status: "ACTIVE" },
                        include: {
                            school: {
                                select: { id: true, name: true, code: true },
                            },
                        },
                        orderBy: [{ isPrimary: "desc" }, { school: { name: "asc" } }],
                    },
                },
            });
        });

        if (!updatedTeacher) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        if (session.user.role === "SUPER_ADMIN" || !activeSchoolId) {
            return NextResponse.json(updatedTeacher);
        }

        return NextResponse.json({
            ...updatedTeacher,
            schoolAssignments: updatedTeacher.schoolAssignments.filter(
                (assignment) => assignment.schoolId === activeSchoolId
            ),
            schools: updatedTeacher.schoolAssignments
                .filter((assignment) => assignment.schoolId === activeSchoolId)
                .map((assignment) => assignment.school),
        });
    } catch (error) {
        logger.error("Error updating teacher", error as Error);
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: "Erreur lors de la mise à jour de l'enseignant" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/teachers/[id]
 * Soft delete teacher and archive school assignments
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!MANAGE_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { id } = await params;
        const teacher = await prisma.teacherProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, email: true },
                },
                schoolAssignments: {
                    where: { status: "ACTIVE" },
                    select: { schoolId: true },
                },
            },
        });

        if (!teacher || teacher.deletedAt) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        const activeSchoolId = getActiveSchoolId(session);

        if (
            session.user.role !== "SUPER_ADMIN" &&
            (!activeSchoolId || !(await isTeacherAssignedToSchool(id, activeSchoolId)))
        ) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        if (session.user.role !== "SUPER_ADMIN") {
            const activeSchoolIds = Array.from(new Set([
                teacher.schoolId,
                ...teacher.schoolAssignments.map((assignment) => assignment.schoolId),
            ]));

            if (activeSchoolIds.some((schoolId) => schoolId !== activeSchoolId)) {
                return NextResponse.json(
                    { error: "La suppression globale d'un enseignant multi-établissements requiert un SUPER_ADMIN" },
                    { status: 403 }
                );
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.classSubject.updateMany({
                where: { teacherId: id },
                data: { teacherId: null },
            });

            await tx.class.updateMany({
                where: { mainTeacherId: id },
                data: { mainTeacherId: null },
            });

            await tx.teacherAvailability.deleteMany({
                where: { teacherId: id },
            });

            await tx.teacherSchoolAssignment.updateMany({
                where: { teacherId: id, status: "ACTIVE" },
                data: {
                    status: "ARCHIVED",
                    isPrimary: false,
                    endDate: new Date(),
                },
            });

            await tx.teacherProfile.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                },
            });

            await tx.user.update({
                where: { id: teacher.userId },
                data: {
                    isActive: false,
                },
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting teacher", error as Error);
        return NextResponse.json(
            { error: "Erreur lors de la suppression de l'enseignant" },
            { status: 500 }
        );
    }
}
