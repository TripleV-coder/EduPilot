import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { normalizeGradeTo20, roundTo } from "@/lib/analytics/helpers";

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
  attendance: {
    present: number;
    absent: number;
    late: number;
  };
  comments?: string;
  generatedAt: Date;
}

// Simple in-memory cache for rankings to avoid N^2 during batch generation
const rankingCache = new Map<string, { studentId: string; rank: number; size: number; timestamp: number }[]>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function getClassRanking(studentId: string, classId: string, periodId: string, academicYearId: string) {
  const cacheKey = `${classId}-${periodId}`;
  const now = Date.now();

  let ranking = rankingCache.get(cacheKey);

  if (!ranking || (now - ranking[0].timestamp) > CACHE_TTL) {
    const classStudents = await prisma.enrollment.findMany({
      where: { classId, academicYearId, status: "ACTIVE" },
      select: { studentId: true },
    });

    if (classStudents.length === 0) return { classRank: undefined, classSize: 0 };

    const rankingGrades = await prisma.grade.findMany({
      where: {
        studentId: { in: classStudents.map(s => s.studentId) },
        deletedAt: null,
        value: { not: null },
        isAbsent: false,
        evaluation: { periodId, classSubject: { classId } },
      },
      select: {
        studentId: true,
        value: true,
        evaluation: {
          select: {
            maxGrade: true,
            coefficient: true,
            classSubjectId: true,
            classSubject: { select: { coefficient: true } },
          },
        },
      },
    });

    const studentStats = new Map<string, Map<string, { sum: number; coeff: number; subCoeff: number }>>();

    rankingGrades.forEach(g => {
      const norm = normalizeGradeTo20(Number(g.value), Number(g.evaluation.maxGrade));
      if (norm === null) return;

      if (!studentStats.has(g.studentId)) studentStats.set(g.studentId, new Map());
      const subMap = studentStats.get(g.studentId)!;
      const subId = g.evaluation.classSubjectId;

      if (!subMap.has(subId)) {
        subMap.set(subId, { sum: 0, coeff: 0, subCoeff: Number(g.evaluation.classSubject.coefficient) || 1 });
      }
      const stat = subMap.get(subId)!;
      stat.sum += norm * (Number(g.evaluation.coefficient) || 1);
      stat.coeff += Number(g.evaluation.coefficient) || 1;
    });

    const finalRanking = Array.from(studentStats.entries()).map(([sId, subs]) => {
      let totalWeighted = 0;
      let totalSubCoeff = 0;
      subs.forEach(s => {
        if (s.coeff > 0) {
          totalWeighted += (s.sum / s.coeff) * s.subCoeff;
          totalSubCoeff += s.subCoeff;
        }
      });
      return { studentId: sId, average: totalSubCoeff > 0 ? totalWeighted / totalSubCoeff : 0 };
    })
      .sort((a, b) => b.average - a.average)
      .map((r, index, arr) => ({ studentId: r.studentId, rank: index + 1, size: arr.length, timestamp: now }));

    rankingCache.set(cacheKey, finalRanking);
    ranking = finalRanking;
  }

  const studentRank = ranking.find(r => r.studentId === studentId);
  return { classRank: studentRank?.rank, classSize: ranking.length };
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
        include: {
          class: {
            include: {
              classLevel: true,
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
      value: { not: null },
      isAbsent: false,
      isExcused: false,
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
          type: { select: { name: true } },
        },
      },
    },
  });

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
    subjectCoefficient: number;
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
        subjectCoefficient: Number(grade.evaluation.classSubject.coefficient) || 1,
      });
    }

    const subject = subjectMap.get(subjectName)!;
    subject.grades.push({
      date: grade.evaluation.date,
      type: grade.evaluation.type.name,
      grade: Number(grade.value),
      maxGrade: Number(grade.evaluation.maxGrade),
      coefficient: Number(grade.evaluation.coefficient) || 1,
      comment: grade.comment,
    });
  });

  const subjects: SubjectGrade[] = [];
  let totalWeighted = 0;
  let totalCoefficients = 0;

  subjectMap.forEach((subject) => {
    subject.grades.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let weightedSum = 0;
    let totalCoeff = 0;

    subject.grades.forEach((grade) => {
      const normalizedGrade = normalizeGradeTo20(grade.grade, grade.maxGrade);
      if (normalizedGrade === null) return;

      weightedSum += normalizedGrade * grade.coefficient;
      totalCoeff += grade.coefficient;
    });

    const subjectAverage = totalCoeff > 0 ? weightedSum / totalCoeff : 0;
    const subjectAverage20 = roundTo(subjectAverage);

    totalWeighted += subjectAverage20 * subject.subjectCoefficient;
    totalCoefficients += subject.subjectCoefficient;

    subjects.push({
      subject: subject.subject,
      subjectCode: subject.subjectCode,
      teacher: subject.teacher,
      grades: subject.grades,
      average: subjectAverage20,
      average20: subjectAverage20,
      passed: subjectAverage20 >= 10,
    });
  });

  const overallAverage20 =
    totalCoefficients > 0 ? roundTo(totalWeighted / totalCoefficients) : 0;

  // Calculate class rank efficiently
  const { classRank, classSize } = await getClassRanking(studentId, classObj.id, periodId, enrollment.academicYearId);

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
    classRank,
    classSize,
    attendance,
    comments,
    generatedAt: new Date(),
  };
}

// GET /api/grades/report-cards - Get report card data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

// POST /api/grades/report-cards - Generate PDF report card
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

    // Verify access
    if (!["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const reportCardData = await getReportCardData(studentId, periodId);

    if (format === "json") {
      return NextResponse.json(reportCardData);
    }

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
      downloadUrl: `/api/grades/report-cards/download?studentId=${studentId}&periodId=${periodId}`,
    });
  } catch (error) {
    logger.error("Error generating PDF report card", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
