import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluationSchema } from "@/lib/validations/evaluation";

import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import type { EvaluationWhereFilter } from "@/lib/types/api";

export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get("classSubjectId");
    const periodId = searchParams.get("periodId");
    const classId = searchParams.get("classId");

    const where: EvaluationWhereFilter = {};
    if (classSubjectId) where.classSubjectId = classSubjectId;
    if (periodId) where.periodId = periodId;
    if (classId) {
      where.classSubject = { classId };
    }

    // Multi-tenant security: filter by school
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      if (where.classSubject) {
        where.classSubject.class = { schoolId: session.user.schoolId };
      } else {
        where.classSubject = { class: { schoolId: session.user.schoolId } };
      }
    }

    // TEACHER can only see their own class subjects evaluations
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (teacherProfile) {
        const teacherClassSubjects = await prisma.classSubject.findMany({
          where: { teacherId: teacherProfile.id },
          select: { id: true },
        });

        if (teacherClassSubjects.length > 0) {
          const csIds = teacherClassSubjects.map((cs) => cs.id);
          const evaluations = await prisma.evaluation.findMany({
            where: {
              classSubjectId: { in: csIds },
              ...where,
            },
            include: {
              classSubject: {
                include: {
                  class: { include: { classLevel: true } },
                  subject: true,
                },
              },
              period: true,
              type: true,
              grades: {
                include: {
                  student: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                  },
                },
              },
            },
            orderBy: { date: "desc" },
          });
          return NextResponse.json(evaluations);
        }
      }
      return NextResponse.json([]);
    }

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        classSubject: {
          include: {
            class: {
              include: { classLevel: true },
            },
            subject: true,
          },
        },
        period: true,
        type: true,
        grades: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(evaluations);
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validatedData = evaluationSchema.parse(body);

    // Verify classSubject exists and belongs to user's school
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: validatedData.classSubjectId },
      include: {
        class: { select: { schoolId: true } },
        teacher: { select: { userId: true } },
      },
    });

    if (!classSubject) {
      return NextResponse.json(
        translateError({ error: "Matière de classe non trouvée", key: "api.issues.not_found", params: { resource: "Matière de classe" } }, t),
        { status: 404 }
      );
    }

    // Verify school access
    if (session.user.role !== "SUPER_ADMIN") {
      if (classSubject.class.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          translateError(API_ERRORS.FORBIDDEN, t),
          { status: 403 }
        );
      }

      // TEACHER can only create evaluations for their own subjects
      if (session.user.role === "TEACHER") {
        if (classSubject.teacher?.userId !== session.user.id) {
          return NextResponse.json(
            translateError({ error: "Vous ne pouvez créer des évaluations que pour vos propres matières", key: "api.issues.teacher_own_subjects_only" }, t),
            { status: 403 }
          );
        }
      }
    }

    // Verify period belongs to same school
    const period = await prisma.period.findUnique({
      where: { id: validatedData.periodId },
      include: { academicYear: { select: { schoolId: true } } },
    });

    if (!period) {
      return NextResponse.json(translateError({ error: "Période non trouvée", key: "api.issues.not_found", params: { resource: "Période" } }, t), { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      if (period.academicYear.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          translateError({ error: "Cette période n'appartient pas à votre établissement", key: "api.issues.period_wrong_school" }, t),
          { status: 403 }
        );
      }
    }

    // Verify evaluation type belongs to same school
    const evalType = await prisma.evaluationType.findUnique({
      where: { id: validatedData.typeId },
      select: { schoolId: true },
    });

    if (!evalType) {
      return NextResponse.json(translateError({ error: "Type d'évaluation non trouvé", key: "api.issues.not_found", params: { resource: "Type d'évaluation" } }, t), { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      if (evalType.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          translateError({ error: "Ce type d'évaluation n'appartient pas à votre établissement", key: "api.issues.eval_type_wrong_school" }, t),
          { status: 403 }
        );
      }
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        classSubjectId: validatedData.classSubjectId,
        periodId: validatedData.periodId,
        typeId: validatedData.typeId,
        title: validatedData.title,
        date: validatedData.date,
        maxGrade: validatedData.maxGrade,
        coefficient: validatedData.coefficient,
      },
      include: {
        classSubject: {
          include: {
            class: {
              include: { classLevel: true },
            },
            subject: true,
          },
        },
        period: true,
        type: true,
      },
    });

    return NextResponse.json(evaluation, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
  }
);
