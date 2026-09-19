import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluationSchema } from "@/lib/validations/evaluation";

import type { Prisma } from "@prisma/client";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { buildCursorPage, getCursorParams, keysetOrderBy, keysetWhere } from "@/lib/api/pagination";
import { getOwnStudentIds } from "@/lib/auth/family-scope";

/** Champs strictement nécessaires aux écrans de liste : aucune note individuelle. */
const EVALUATION_LIST_SELECT = {
  id: true,
  title: true,
  date: true,
  maxGrade: true,
  coefficient: true,
  type: { select: { id: true, name: true, code: true } },
  period: { select: { id: true, name: true } },
  classSubject: {
    select: {
      id: true,
      classId: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EvaluationSelect;

/**
 * Nombre de notes des seules évaluations de la page, en une requête groupée.
 * `_count: { grades }` dans la liste se traduisait par une jointure sur un
 * agrégat de TOUTES les notes ; sous RLS (audit M2), le planificateur le
 * réexécutait pour chaque évaluation : 11 s pour la liste d'un enseignant.
 */
async function gradeCountsFor(evaluationIds: string[]): Promise<Map<string, number>> {
  if (evaluationIds.length === 0) return new Map();
  const groups = await prisma.grade.groupBy({
    by: ["evaluationId"],
    where: { evaluationId: { in: evaluationIds } },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.evaluationId, group._count._all]));
}

/** Bornes d'un filtre `from`/`to` (AAAA-MM-JJ, jours inclus). */
function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(day.getTime()) ? null : day;
}

/**
 * Classes dont un parent ou un élève peut voir les évaluations (N9) :
 * inscriptions actives de ses enfants / de lui-même. `null` = pas de restriction de classe.
 */
async function visibleClassIds(role: string, userId: string): Promise<string[] | null> {
  const studentIds = await getOwnStudentIds(role, userId);
  if (studentIds === null) return null;
  if (studentIds.length === 0) return [];
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: { in: studentIds }, status: "ACTIVE", deletedAt: null },
    select: { classId: true },
  });
  return [...new Set(enrollments.map((e) => e.classId))];
}

/**
 * GET /api/evaluations — liste paginée par curseur (C3/N1), sans notes
 * individuelles, périmètre par rôle (N9).
 *
 * Filtres : classSubjectId, periodId, classId, type (code exact ou fragment du
 * nom, insensible à la casse), from / to (AAAA-MM-JJ, inclus).
 */
export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const pageParams = getCursorParams(searchParams);

    const filters: Prisma.EvaluationWhereInput[] = [];
    const classSubjectId = searchParams.get("classSubjectId");
    const periodId = searchParams.get("periodId");
    const classId = searchParams.get("classId");
    const type = searchParams.get("type")?.trim();
    if (classSubjectId) filters.push({ classSubjectId });
    if (periodId) filters.push({ periodId });
    if (classId) filters.push({ classSubject: { classId } });
    if (type) {
      filters.push({
        type: {
          OR: [
            { code: { equals: type, mode: "insensitive" } },
            { name: { contains: type, mode: "insensitive" } },
          ],
        },
      });
    }
    const from = parseDay(searchParams.get("from"));
    const to = parseDay(searchParams.get("to"));
    if (from) filters.push({ date: { gte: from } });
    if (to) filters.push({ date: { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } });

    // Isolation multi-tenant
    const activeSchoolId = getActiveSchoolId(session);
    if (session.user.role !== "SUPER_ADMIN" && activeSchoolId) {
      filters.push({ classSubject: { class: { schoolId: activeSchoolId } } });
    }

    // Périmètre par rôle
    if (session.user.role === "TEACHER") {
      filters.push({ classSubject: { teacher: { userId: session.user.id } } });
    }
    const classIds = await visibleClassIds(session.user.role, session.user.id);
    if (classIds !== null) {
      if (classIds.length === 0) {
        return NextResponse.json({ data: [], pagination: { limit: pageParams.limit, nextCursor: null, hasNextPage: false, total: 0 } });
      }
      filters.push({ classSubject: { classId: { in: classIds } } });
    }

    const where: Prisma.EvaluationWhereInput = { AND: filters };
    const [rows, total] = await Promise.all([
      prisma.evaluation.findMany({
        where: { AND: [where, keysetWhere("date", "desc", pageParams.cursor)] },
        select: EVALUATION_LIST_SELECT,
        orderBy: keysetOrderBy("date", "desc"),
        take: pageParams.limit + 1,
      }),
      pageParams.withTotal ? prisma.evaluation.count({ where }) : Promise.resolve(undefined),
    ]);

    const page = buildCursorPage(rows, pageParams.limit, (row) => row.date);
    const counts = await gradeCountsFor(page.data.map((evaluation) => evaluation.id));
    const data = page.data.map((evaluation) => ({ ...evaluation, gradeCount: counts.get(evaluation.id) ?? 0 }));

    return NextResponse.json({
      data,
      pagination: total === undefined ? page.pagination : { ...page.pagination, total },
    });
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
      if (!canAccessSchool(session, classSubject.class.schoolId)) {
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
      if (!canAccessSchool(session, period.academicYear.schoolId)) {
        return NextResponse.json(
          translateError({ error: "Cette période n'appartient pas à votre établissement", key: "api.issues.period_wrong_school" }, t),
          { status: 403 }
        );
      }
    }

    const yearLock = await guardPeriodWritable(period.id);
    if (yearLock) return yearLock;

    // Verify evaluation type belongs to same school
    const evalType = await prisma.evaluationType.findUnique({
      where: { id: validatedData.typeId },
      select: { schoolId: true },
    });

    if (!evalType) {
      return NextResponse.json(translateError({ error: "Type d'évaluation non trouvé", key: "api.issues.not_found", params: { resource: "Type d'évaluation" } }, t), { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      if (!canAccessSchool(session, evalType.schoolId)) {
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
