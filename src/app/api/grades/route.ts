import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bulkGradeSchema } from "@/lib/validations/evaluation";

import type { GradeWhereFilter } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody } from "@/lib/sanitize";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { createPaginatedResponse, getPaginationParams } from "@/lib/api/api-helpers"; // Assuming these are exported or I should move them to helpers or just replicate logic
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";

export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const evaluationId = searchParams.get("evaluationId");
    const studentId = searchParams.get("studentId");
    const _search = searchParams.get("search");

    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 50, maxLimit: 200 });

    const where: GradeWhereFilter = {};

    if (evaluationId) where.evaluationId = evaluationId;
    if (studentId) where.studentId = studentId;

    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.evaluation = {
        classSubject: {
          class: {
            schoolId: session.user.schoolId,
          },
        },
      };
    }

    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      } else {
        return createPaginatedResponse([], page, limit, 0);
      }
    }

    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId: session.user.id },
        include: {
          children: {
            select: { studentId: true },
          },
        },
      });
      if (parentProfile && parentProfile.children.length > 0) {
        const childrenIds = parentProfile.children.map((c) => c.studentId);
        if (studentId && !childrenIds.includes(studentId)) {
          return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }
        const studentFilter = studentId ? { equals: studentId } : { in: childrenIds };
        where.studentId = studentFilter as any;
      } else {
        return createPaginatedResponse([], page, limit, 0);
      }
    }

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        include: {
          evaluation: {
            include: {
              classSubject: {
                include: {
                  subject: true,
                  class: {
                    include: { classLevel: true },
                  },
                },
              },
              period: true,
              type: true,
            },
          },
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.grade.count({ where }),
    ]);

    return createPaginatedResponse(grades, page, limit, total);
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const validatedData = bulkGradeSchema.parse(sanitizedBody);

    const evaluation = await prisma.evaluation.findUnique({
      where: { id: validatedData.evaluationId },
      include: {
        classSubject: {
          include: {
            class: {
              select: { id: true, schoolId: true },
            },
            teacher: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!evaluation) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Évaluation"), t), { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      if (evaluation.classSubject.class.schoolId !== session.user.schoolId) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }

      if (session.user.role === "TEACHER") {
        if (evaluation.classSubject.teacher?.userId !== session.user.id) {
          return NextResponse.json(
            translateError(API_ERRORS.FORBIDDEN, t), // Custom error message might be better: "Only own subjects"
            { status: 403 }
          );
        }
      }
    }

    const classId = evaluation.classSubject.class.id;
    const studentIds = validatedData.grades.map((g) => g.studentId);

    const enrolledStudents = await prisma.enrollment.findMany({
      where: {
        classId,
        studentId: { in: studentIds },
        status: "ACTIVE",
      },
      select: { studentId: true },
    });

    const enrolledIds = new Set(enrolledStudents.map((e) => e.studentId));
    const invalidStudents = studentIds.filter((id) => !enrolledIds.has(id));

    if (invalidStudents.length > 0) {
      return NextResponse.json(
        {
          error: "Certains élèves ne sont pas inscrits dans cette classe",
          code: "INVALID_STUDENTS",
          invalidStudents,
        },
        { status: 400 }
      );
    }

    const maxGrade = Number(evaluation.maxGrade);
    for (const grade of validatedData.grades) {
      if (grade.value !== null && grade.value !== undefined) {
        if (grade.value < 0 || grade.value > maxGrade) {
          return NextResponse.json(
            {
              error: `La note doit être comprise entre 0 et ${maxGrade}`,
              code: "INVALID_GRADE",
            },
            { status: 400 }
          );
        }
      }
    }

    const results = await prisma.$transaction(async (tx) => {
      const gradeResults = await Promise.all(
        validatedData.grades.map((grade) =>
          tx.grade.upsert({
            where: {
              evaluationId_studentId: {
                evaluationId: validatedData.evaluationId,
                studentId: grade.studentId,
              },
            },
            create: {
              evaluationId: validatedData.evaluationId,
              studentId: grade.studentId,
              value: grade.value,
              isAbsent: grade.isAbsent || false,
              isExcused: grade.isExcused || false,
              comment: grade.comment || null,
            },
            update: {
              value: grade.value,
              isAbsent: grade.isAbsent || false,
              isExcused: grade.isExcused || false,
              comment: grade.comment || null,
            },
          })
        )
      );

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Grade",
          entityId: validatedData.evaluationId,
          newValues: { gradesCount: validatedData.grades.length },
        },
      });

      return gradeResults;
    });

    logger.info("Grades saved", { evaluationId: validatedData.evaluationId, count: results.length, savedBy: session.user.id });
    return NextResponse.json({ success: true, grades: results, count: results.length }, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_CREATE],
  }
);
