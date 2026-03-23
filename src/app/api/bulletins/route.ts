import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateWeightedAverage, getAppreciation, getRank } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";

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
    if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== session.user.schoolId) {
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

    // Get period info
    const period = await prisma.period.findUnique({
      where: { id: periodId },
    });

    // Calculate averages for each subject
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

      return {
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        coefficient: Number(cs.coefficient),
        average,
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

    // Get class rankings (all students in the same class for this period)
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
                  include: {
                    classSubject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate all students' averages for ranking
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

    const bulletin = {
      student: {
        id: student.id,
        matricule: student.matricule,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
      },
      class: {
        id: enrollment.class.id,
        name: enrollment.class.name,
        level: enrollment.class.classLevel.name,
      },
      academicYear: enrollment.academicYear.name,
      period: period?.name || "Période",
      subjects: subjectResults,
      generalAverage,
      rank,
      classSize,
      appreciation: getAppreciation(generalAverage),
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
