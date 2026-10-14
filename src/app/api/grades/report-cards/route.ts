import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { countsInAverage, gradeStatus, toDisplay } from "@/lib/academic/average-engine";
import { computeClassPeriod } from "@/lib/academic/class-averages";
import { getPassingGrade } from "@/lib/academic/grading-settings";

// Types for report card data
interface SubjectGrade {
  subject: string;
  subjectCode?: string;
  teacher?: string;
  grades: {
    date: Date;
    type: string;
    grade: number;
    maxGrade: number;
    coefficient: number;
    comment?: string | null;
  }[];
  average: number;
  average20: number;
  rank?: number;
  passed: boolean;
}

interface ReportCardData {
  studentId: string;
  studentName: string;
  className: string;
  classId: string;
  academicYear: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  subjects: SubjectGrade[];
  overallAverage: number;
  overallAverage20: number;
  classRank?: number;
  classSize?: number;
  /** false tant qu'une note attendue n'est ni saisie ni justifiée */
  isComplete: boolean;
  missingGrades: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
  comments?: string;
  generatedAt: Date;
}

// Helper function to get report card data
async function getReportCardData(studentId: string, periodId: string): Promise<ReportCardData> {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
  });

  if (!period) throw new Error("Period not found");

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      enrollments: {
        where: {
          academicYearId: period.academicYearId,
        },
        // Inscription active d'abord (un élève passé d'une classe à l'autre garde
        // une inscription close)
        orderBy: { status: "asc" },
        include: {
          class: {
            include: {
              classLevel: true,
              classSubjects: { select: { id: true, subjectId: true, coefficient: true } },
            },
          },
          academicYear: true,
        },
      },
    },
  });

  if (!student) throw new Error("Student not found");

  const enrollment = student.enrollments[0];
  if (!enrollment) throw new Error("No active enrollment");

  const classObj = enrollment.class;

  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      deletedAt: null,
      evaluation: { periodId, classSubject: { classId: enrollment.classId } },
    },
    include: {
      evaluation: {
        include: {
          classSubject: {
            include: {
              subject: { select: { name: true, code: true } },
              teacher: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          type: { select: { name: true, code: true, category: true } },
        },
      },
    },
  });

  // Calcul de la classe entière, identique au bulletin : règles de l'école,
  // coefficients et règles gelés par le conseil, notes manquantes, rang, effectif
  const classPeriod = await computeClassPeriod({
    classId: classObj.id,
    periodId,
    academicYearId: enrollment.academicYearId,
    classSubjects: classObj.classSubjects,
  });
  const own = classPeriod.students.get(studentId);
  const rules = classPeriod.rules;
  const passingGrade = await getPassingGrade(classObj.schoolId);

  // Process grades into report card format
  interface SubjectData {
    subject: string;
    subjectCode?: string;
    teacher: string | undefined;
    grades: {
      date: Date;
      type: string;
      grade: number;
      maxGrade: number;
      coefficient: number;
      comment: string | null;
    }[];
    average: number;
    average20: number;
    passed: boolean;
    classSubjectId: string;
  }
  const subjectMap = new Map<string, SubjectData>();

  grades.forEach((grade) => {
    const subjectName = grade.evaluation.classSubject.subject.name;

    if (!subjectMap.has(subjectName)) {
      subjectMap.set(subjectName, {
        subject: subjectName,
        subjectCode: grade.evaluation.classSubject.subject.code,
        teacher: grade.evaluation.classSubject.teacher
          ? `${grade.evaluation.classSubject.teacher.user.firstName} ${grade.evaluation.classSubject.teacher.user.lastName}`
          : undefined,
        grades: [],
        average: 0,
        average20: 0,
        passed: false,
        classSubjectId: grade.evaluation.classSubjectId,
      });
    }

    const subject = subjectMap.get(subjectName)!;
    // Liste imprimée : notes comptées dans la moyenne (hors compétences) et,
    // si l'école les compte 0, les absences non justifiées
    if (!countsInAverage(grade.evaluation.type)) return;
    const status = gradeStatus(grade);
    const absenceCounted = status === "ABSENT_UNJUSTIFIED" && rules.unjustifiedAbsence === "ZERO";
    if (status !== "GRADED" && !absenceCounted) return;
    subject.grades.push({
      date: grade.evaluation.date,
      type: absenceCounted ? `${grade.evaluation.type.name} (absence non justifiée)` : grade.evaluation.type.name,
      grade: status === "ABSENT_UNJUSTIFIED" ? 0 : Number(grade.value),
      maxGrade: Number(grade.evaluation.maxGrade),
      coefficient: Number(grade.evaluation.coefficient) || 1,
      comment: grade.comment,
    });
  });

  const show = (v: Parameters<typeof toDisplay>[0]) => toDisplay(v, rules.rounding);

  const subjects: SubjectGrade[] = [];
  subjectMap.forEach((subject) => {
    subject.grades.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const subjectAverage20 = show(own?.averages.subjects.get(subject.classSubjectId) ?? null);
    // Matière sans note comptée (uniquement des absences justifiées) : rien à imprimer
    if (subjectAverage20 === null) return;
    subjects.push({
      subject: subject.subject,
      subjectCode: subject.subjectCode,
      teacher: subject.teacher,
      grades: subject.grades,
      average: subjectAverage20,
      average20: subjectAverage20,
      passed: subjectAverage20 >= passingGrade,
    });
  });

  const overallAverage20 = own?.general ?? 0;


  // Get attendance
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      studentId,
      date: { gte: period.startDate, lte: period.endDate },
    },
  });

  const attendance = {
    present: attendanceRecords.filter((a) => a.status === "PRESENT").length,
    absent: attendanceRecords.filter((a) => a.status === "ABSENT").length,
    late: attendanceRecords.filter((a) => a.status === "LATE").length,
  };

  const comments = subjects
    .map((subject) => {
      const latestComment = [...subject.grades]
        .reverse()
        .find((grade) => typeof grade.comment === "string" && grade.comment.trim().length > 0);

      if (!latestComment?.comment) return null;

      return `${subject.subject}: ${latestComment.comment.trim()}`;
    })
    .filter((comment): comment is string => comment !== null)
    .join("\n") || undefined;

  return {
    studentId,
    studentName: `${student.user.firstName} ${student.user.lastName}`,
    className: `${classObj.name} - ${classObj.classLevel?.name || ""}`,
    classId: classObj.id,
    academicYear: enrollment.academicYear?.name || "",
    period: period.name,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    subjects: subjects.sort((a, b) => a.subject.localeCompare(b.subject)),
    overallAverage: overallAverage20,
    overallAverage20,
    classRank: own?.rank ?? undefined,
    classSize: classPeriod.classSize,
    isComplete: own?.averages.complete ?? false,
    missingGrades: own?.averages.missing.length ?? 0,
    attendance,
    comments,
    generatedAt: new Date(),
  };
}

// GET /api/grades/report-cards - Get report card data
export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const periodId = searchParams.get("periodId");

    if (!studentId || !periodId) {
      return NextResponse.json(
        { error: "studentId et periodId requis" },
        { status: 400 }
      );
    }

    // Access Check Logic
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    // Protection Multi-Tenant : Vérifier que l'utilisateur a accès à l'école de l'élève
    const accessError = ensureSchoolAccess(session, student.schoolId);
    if (accessError) {
      return accessError;
    }

    // Verify access
    if (session.user.role === "STUDENT" && session.user.id !== student.userId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: {
          userId: session.user.id,
          parentStudents: { some: { studentId } },
        },
      });
      if (!parentProfile) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const reportCard = await getReportCardData(studentId, periodId);
    return NextResponse.json(reportCard);

  } catch (error) {
    logger.error("Error generating report card", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du bulletin" },
      { status: 500 }
    );
  }

  }
);

// POST /api/grades/report-cards - Generate PDF report card
export const POST = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const body = await request.json();
    const { studentId, periodId, format = "pdf" } = body;

    if (!studentId || !periodId) {
      return NextResponse.json(
        { error: "studentId et periodId requis" },
        { status: 400 }
      );
    }

    // Protection Multi-Tenant : Vérifier l'école avant toute action
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    const accessError = ensureSchoolAccess(session, student.schoolId);
    if (accessError) {
      return accessError;
    }


    const reportCardData = await getReportCardData(studentId, periodId);

    if (format === "json") {
      return NextResponse.json(reportCardData);
    }

    // Une note « NC » ne bloque rien (décision du 2026-10-02) : le bulletin est
    // édité, les notes manquantes restent signalées (missingGrades)
    logger.info("Generating PDF report card", { studentId, periodId });

    const pdfData = {
      ...reportCardData,
      generatedBy: session.user.id,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: "Bulletin généré avec succès",
      data: pdfData,
    });
  } catch (error) {
    logger.error("Error generating PDF report card", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }

  },
  { allowedRoles: ["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"] }
);
