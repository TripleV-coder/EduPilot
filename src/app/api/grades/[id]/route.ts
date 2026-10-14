import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { assertModelAccess } from "@/lib/security/tenant";
import { assertNotCouncilLocked, assertSubjectTeacher, checkGradeValues, logGradeChanges } from "@/lib/academic/grade-write-guard";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { gradeValueSchema } from "@/lib/validations/evaluation";

const gradeUpdateSchema = z.object({
  value: gradeValueSchema.optional().nullable(),
  isAbsent: z.boolean().optional(),
  isExcused: z.boolean().optional(),
  excuseReason: z.string().max(300).optional().nullable(),
  /** « Ne pas compter cette note » pour cet élève (décision de l'enseignant, motif obligatoire). */
  excluded: z.boolean().optional(),
  excludedReason: z.string().max(300).optional().nullable(),
  comment: z.string().optional().nullable(),
});

export const GET = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const guard = await assertModelAccess(session, "grade", id, "Note introuvable");
    if (guard) return guard;
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
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
    });

    if (!grade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    return NextResponse.json(grade);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_READ],
  }
);

export const PATCH = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const guard = await assertModelAccess(session, "grade", id, "Note introuvable");
    if (guard) return guard;

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: { include: { teacher: { select: { userId: true } }, class: { select: { schoolId: true } } } },
          },
        },
      },
    });

    if (!existingGrade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    const yearLock = await guardPeriodWritable(existingGrade.evaluation.periodId);
    if (yearLock) return yearLock;

    // Seul l'enseignant de la matière modifie ses notes ; période figée après conseil
    const notTeacher = assertSubjectTeacher(session, existingGrade.evaluation.classSubject);
    if (notTeacher) return notTeacher;
    const councilLock = await assertNotCouncilLocked(
      existingGrade.evaluation.classSubject.classId,
      existingGrade.evaluation.periodId
    );
    if (councilLock) return councilLock;

    const body = await request.json();
    const validatedData = gradeUpdateSchema.parse(body);
    // État final de la note, contrôlé selon les règles de l'école (barème, pas, motif)
    const recomposed = !validatedData.isAbsent && validatedData.value !== null && validatedData.value !== undefined;
    const isAbsent = recomposed ? false : validatedData.isAbsent ?? existingGrade.isAbsent;
    const isExcused = recomposed ? validatedData.isExcused ?? false : validatedData.isExcused ?? existingGrade.isExcused;
    const excuseReason = isExcused ? (validatedData.excuseReason ?? existingGrade.excuseReason)?.trim() || null : null;
    const schoolRules = await getGradingSettings(existingGrade.evaluation.classSubject.class.schoolId);
    const invalidValues = checkGradeValues(
      [{ value: validatedData.value, isAbsent, isExcused, excuseReason }],
      Number(existingGrade.evaluation.maxGrade),
      schoolRules
    );
    if (invalidValues) return invalidValues;

    // Note non comptée pour cet élève : motif obligatoire, si l'école le permet
    let excludedReason: string | null = existingGrade.excludedReason ?? null;
    if (validatedData.excluded !== undefined) {
      if (validatedData.excluded) {
        if (!schoolRules.studentAdjustments) {
          return NextResponse.json(
            { error: "L'établissement ne permet pas d'adapter le calcul pour un élève.", code: "STUDENT_ADJUSTMENTS_DISABLED" },
            { status: 403 }
          );
        }
        excludedReason = (validatedData.excludedReason ?? "").trim() || null;
        if (!excludedReason) {
          return NextResponse.json(
            { error: "Indiquez pourquoi cette note ne compte pas pour l'élève.", code: "EXCLUSION_REASON_REQUIRED" },
            { status: 400 }
          );
        }
      } else {
        excludedReason = null;
      }
    }

    const updatedGrade = await prisma.grade.update({
      where: { id },
      // Absence : jamais de valeur. Recomposition : la note saisie retire l'absence.
      data: {
        ...(validatedData.comment !== undefined ? { comment: validatedData.comment } : {}),
        ...(isAbsent ? { value: null } : validatedData.value !== undefined ? { value: validatedData.value } : {}),
        isAbsent,
        isExcused,
        excuseReason,
        excludedReason,
      },
      include: {
        evaluation: true,
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    await logGradeChanges({
      userId: session.user.id,
      schoolId: existingGrade.evaluation.classSubject.class.schoolId,
      evaluationId: existingGrade.evaluationId,
      changes: [{ studentId: existingGrade.studentId, gradeId: id, before: existingGrade, after: updatedGrade }],
    });
    await syncAnalyticsAfterGradeChange(existingGrade.evaluationId, [
      existingGrade.studentId,
    ]);
    await Promise.all([
      invalidateByPath(CACHE_PATHS.grades),
      invalidateByPath("/api/analytics"),
      invalidateByPath("/api/grades/statistics"),
      invalidateByPath("/api/grades/report-cards"),
    ]);

    return NextResponse.json(updatedGrade);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_UPDATE],
  }
);

export const DELETE = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const guard = await assertModelAccess(session, "grade", id, "Note introuvable");
    if (guard) return guard;

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: { include: { teacher: { select: { userId: true } }, class: { select: { schoolId: true } } } },
          },
        },
      },
    });

    if (!existingGrade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    const yearLock = await guardPeriodWritable(existingGrade.evaluation.periodId);
    if (yearLock) return yearLock;

    // Seul l'enseignant de la matière supprime ses notes ; période figée après conseil
    const notTeacher = assertSubjectTeacher(session, existingGrade.evaluation.classSubject);
    if (notTeacher) return notTeacher;
    const councilLock = await assertNotCouncilLocked(
      existingGrade.evaluation.classSubject.classId,
      existingGrade.evaluation.periodId
    );
    if (councilLock) return councilLock;

    // Soft-delete: set deletedAt instead of permanently removing the grade
    await prisma.grade.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logGradeChanges({
      userId: session.user.id,
      schoolId: existingGrade.evaluation.classSubject.class.schoolId,
      evaluationId: existingGrade.evaluationId,
      action: "GRADE_DELETED",
      changes: [{ studentId: existingGrade.studentId, gradeId: id, before: existingGrade, after: null }],
    });

    await syncAnalyticsAfterGradeChange(existingGrade.evaluationId, [
      existingGrade.studentId,
    ]);
    await Promise.all([
      invalidateByPath(CACHE_PATHS.grades),
      invalidateByPath("/api/analytics"),
      invalidateByPath("/api/grades/statistics"),
      invalidateByPath("/api/grades/report-cards"),
    ]);

    return NextResponse.json({ success: true, softDeleted: true });
  },
  {
    requireAuth: true,
    // Seul l'enseignant de la matière supprime ses notes (vérifié ci-dessus) ;
    // la permission GRADE_DELETE, réservée à la direction, ne suffisait jamais
    allowedRoles: ["TEACHER"],
  }
);
