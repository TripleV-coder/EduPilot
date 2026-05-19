import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateWeightedAverage, getAppreciation, getRank } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const _BULLETIN_ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const periodId = searchParams.get("periodId");

    if (!studentId || !periodId) {
      return NextResponse.json(
        { error: "studentId et periodId sont requis" },
        { status: 400 }
      );
    }

    // Get student info
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            class: {
              include: {
                classLevel: true,
                classSubjects: {
                  include: {
                    subject: true,
                    evaluations: {
                      where: { periodId },
                      include: {
                        grades: {
                          where: { studentId },
                        },
                        type: true,
                      },
                    },
                  },
                },
              },
            },
            academicYear: true,
          },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }
    if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== getActiveSchoolId(session)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Vérification d'accès selon le rôle
    const userRole = session.user.role;
    if (userRole === "STUDENT") {
      // Un élève ne peut accéder qu'à son propre bulletin
      if (student.userId !== session.user.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (userRole === "PARENT") {
      // Un parent ne peut accéder qu'aux bulletins de ses enfants
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!parentProfile) {
        return NextResponse.json({ error: "Profil parent non trouvé" }, { status: 403 });
      }
      const isParentOf = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: parentProfile.id, studentId } },
      });
      if (!isParentOf) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(userRole)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const enrollment = student.enrollments[0];
    if (!enrollment) {
      return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
    }

    // Get period info + previous period (same year, sequence - 1)
    const period = await prisma.period.findUnique({
      where: { id: periodId },
    });
    const previousPeriod = period
      ? await prisma.period.findFirst({
          where: {
            academicYearId: period.academicYearId,
            sequence: { lt: period.sequence },
          },
          orderBy: { sequence: "desc" },
        })
      : null;

    // School identity (used on the printed bulletin header)
    const school = await prisma.school.findUnique({
      where: { id: student.schoolId },
      select: {
        name: true,
        address: true,
        city: true,
        phone: true,
        email: true,
        logo: true,
        motto: true,
        mempCode: true,
        code: true,
      },
    });

    // ── Class-wide grades for this period (needed for class min/max/avg per subject)
    const classStudents = await prisma.enrollment.findMany({
      where: {
        classId: enrollment.classId,
        academicYearId: enrollment.academicYearId,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: {
            grades: {
              where: {
                evaluation: { periodId },
              },
              include: {
                evaluation: {
                  include: { classSubject: true },
                },
              },
            },
          },
        },
      },
    });

    // Per-class-subject stats (avg/min/max across the class)
    const classStatsBySubject = new Map<
      string,
      { sum: number; n: number; min: number; max: number }
    >();
    for (const cs of enrollment.class.classSubjects) {
      let sum = 0;
      let n = 0;
      let min = Infinity;
      let max = -Infinity;
      for (const e of classStudents) {
        const grades = e.student.grades
          .filter((g) => g.evaluation.classSubjectId === cs.id)
          .map((g) => ({
            value: g.value,
            coefficient: g.evaluation.coefficient,
            isAbsent: g.isAbsent,
            isExcused: g.isExcused,
          }));
        const avg = calculateWeightedAverage(grades);
        if (avg !== null) {
          sum += avg;
          n += 1;
          if (avg < min) min = avg;
          if (avg > max) max = avg;
        }
      }
      classStatsBySubject.set(cs.id, {
        sum,
        n,
        min: n > 0 ? min : 0,
        max: n > 0 ? max : 0,
      });
    }

    // Previous-period averages for THIS student (one per class-subject)
    const prevGrades = previousPeriod
      ? await prisma.grade.findMany({
          where: {
            studentId,
            evaluation: { periodId: previousPeriod.id },
          },
          include: { evaluation: { include: { classSubject: true } } },
        })
      : [];
    const prevBySubjectId = new Map<string, number | null>();
    for (const cs of enrollment.class.classSubjects) {
      const gs = prevGrades
        .filter((g) => g.evaluation.classSubjectId === cs.id)
        .map((g) => ({
          value: g.value,
          coefficient: g.evaluation.coefficient,
          isAbsent: g.isAbsent,
          isExcused: g.isExcused,
        }));
      prevBySubjectId.set(cs.subject.id, calculateWeightedAverage(gs));
    }

    // Calculate averages for each subject (current period)
    const subjectResults = enrollment.class.classSubjects.map((cs) => {
      const grades = cs.evaluations.flatMap((eval_) =>
        eval_.grades.map((g) => ({
          value: g.value,
          coefficient: eval_.coefficient,
          isAbsent: g.isAbsent,
          isExcused: g.isExcused,
        }))
      );

      const average = calculateWeightedAverage(grades);
      const stats = classStatsBySubject.get(cs.id) ?? { sum: 0, n: 0, min: 0, max: 0 };

      return {
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        coefficient: Number(cs.coefficient),
        average,
        previousAverage: prevBySubjectId.get(cs.subject.id) ?? null,
        classAverage: stats.n > 0 ? stats.sum / stats.n : null,
        classMin: stats.n > 0 ? stats.min : null,
        classMax: stats.n > 0 ? stats.max : null,
        appreciation: getAppreciation(average),
        evaluationsCount: cs.evaluations.length,
        grades: cs.evaluations.map((eval_) => ({
          title: eval_.title || eval_.type.name,
          date: eval_.date,
          maxGrade: Number(eval_.maxGrade),
          value: eval_.grades[0]?.value ? Number(eval_.grades[0].value) : null,
          isAbsent: eval_.grades[0]?.isAbsent || false,
        })),
      };
    });

    // Calculate general average
    const validSubjects = subjectResults.filter((s) => s.average !== null);
    const generalAverage =
      validSubjects.length > 0
        ? validSubjects.reduce((sum, s) => sum + s.average! * s.coefficient, 0) /
          validSubjects.reduce((sum, s) => sum + s.coefficient, 0)
        : null;

    // Previous-period general average (same weighting, computed on prevBySubjectId)
    const prevValidSubjects = enrollment.class.classSubjects
      .map((cs) => ({
        coefficient: Number(cs.coefficient),
        average: prevBySubjectId.get(cs.subject.id) ?? null,
      }))
      .filter((s) => s.average !== null);
    const previousGeneralAverage =
      prevValidSubjects.length > 0
        ? prevValidSubjects.reduce((sum, s) => sum + s.average! * s.coefficient, 0) /
          prevValidSubjects.reduce((sum, s) => sum + s.coefficient, 0)
        : null;

    // Class-wide general averages for ranking
    const allAverages = classStudents.map((e) => {
      const studentGrades = e.student.grades;
      const subjectAverages: { average: number | null; coefficient: number }[] = [];

      enrollment.class.classSubjects.forEach((cs) => {
        const subjectGrades = studentGrades.filter(
          (g) => g.evaluation.classSubjectId === cs.id
        );
        const gradesData = subjectGrades.map((g) => ({
          value: g.value,
          coefficient: g.evaluation.coefficient,
          isAbsent: g.isAbsent,
          isExcused: g.isExcused,
        }));
        const avg = calculateWeightedAverage(gradesData);
        subjectAverages.push({ average: avg, coefficient: Number(cs.coefficient) });
      });

      const validSubs = subjectAverages.filter((s) => s.average !== null);
      if (validSubs.length === 0) return null;

      return (
        validSubs.reduce((sum, s) => sum + s.average! * s.coefficient, 0) /
        validSubs.reduce((sum, s) => sum + s.coefficient, 0)
      );
    });

    const rank = getRank(generalAverage, allAverages);
    const classSize = classStudents.length;

    // Class general average (sum of valid student averages / count)
    const classValidAverages = allAverages.filter((a): a is number => a !== null);
    const classGeneralAverage =
      classValidAverages.length > 0
        ? classValidAverages.reduce((sum, a) => sum + a, 0) / classValidAverages.length
        : null;

    // ── Vie scolaire: attendance + incidents during the period
    const periodRange =
      period && {
        gte: period.startDate,
        lte: period.endDate,
      };

    const [absences, lates, excused, incidents] = periodRange
      ? await Promise.all([
          prisma.attendance.count({
            where: {
              studentId,
              date: periodRange,
              status: "ABSENT",
            },
          }),
          prisma.attendance.count({
            where: {
              studentId,
              date: periodRange,
              status: "LATE",
            },
          }),
          prisma.attendance.count({
            where: {
              studentId,
              date: periodRange,
              status: "EXCUSED",
            },
          }),
          prisma.behaviorIncident.count({
            where: {
              studentId,
              date: periodRange,
            },
          }),
        ])
      : [0, 0, 0, 0];

    // Reference number: BJ-{year}-T{seq}-{matricule-suffix}
    const yearLabel = enrollment.academicYear.name.split("-")[0]?.trim() || "2026";
    const matriculeSuffix = student.matricule.slice(-5).toUpperCase();
    const referenceNumber = period
      ? `BJ-${yearLabel}-T${period.sequence}-${matriculeSuffix}`
      : `BJ-${yearLabel}-${matriculeSuffix}`;

    const bulletin = {
      school: school
        ? {
            name: school.name,
            address: [school.address, school.city].filter(Boolean).join(" · "),
            phone: school.phone,
            email: school.email,
            mempCode: school.mempCode || school.code,
            motto: school.motto,
            logo: school.logo,
          }
        : null,
      student: {
        id: student.id,
        matricule: student.matricule,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
      },
      class: {
        id: enrollment.class.id,
        name: enrollment.class.name,
        level: enrollment.class.classLevel.name,
      },
      academicYear: enrollment.academicYear.name,
      period: period?.name || "Période",
      periodSequence: period?.sequence ?? null,
      previousPeriod: previousPeriod
        ? { id: previousPeriod.id, name: previousPeriod.name }
        : null,
      subjects: subjectResults,
      generalAverage,
      previousGeneralAverage,
      classGeneralAverage,
      rank,
      classSize,
      appreciation: getAppreciation(generalAverage),
      vieScolaire: {
        absences,
        lates,
        excused,
        incidents,
      },
      referenceNumber,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(bulletin);
  } catch (error) {
    logger.error(" generating bulletin:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du bulletin" },
      { status: 500 }
    );
  }
}
