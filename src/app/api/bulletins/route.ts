import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { gradeStatus, toDisplay } from "@/lib/academic/average-engine";
import { computeClassAnnual, computeClassPeriod, computePromotionRanks } from "@/lib/academic/class-averages";
import { getGradingSettings, mentionFor } from "@/lib/academic/grading-settings";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";

export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
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
                          where: { studentId, deletedAt: null },
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
    } else if (!roleSatisfies(userRole, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"])) {
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

    // Moyennes de la classe : module unique (formule officielle, calcul exact,
    // coefficients figés par le conseil, notes « NC » exclues sans rien bloquer)
    const classSubjectRefs = enrollment.class.classSubjects.map((cs) => ({
      id: cs.id,
      subjectId: cs.subjectId,
      coefficient: cs.coefficient,
    }));
    const [current, previous, nextPeriod, gradingSettings] = await Promise.all([
      computeClassPeriod({
        classId: enrollment.classId,
        periodId,
        academicYearId: enrollment.academicYearId,
        classSubjects: classSubjectRefs,
      }),
      previousPeriod
        ? computeClassPeriod({
            classId: enrollment.classId,
            periodId: previousPeriod.id,
            academicYearId: enrollment.academicYearId,
            classSubjects: classSubjectRefs,
          })
        : Promise.resolve(null),
      period
        ? prisma.period.findFirst({
            where: { academicYearId: period.academicYearId, sequence: { gt: period.sequence } },
            select: { id: true },
          })
        : Promise.resolve(null),
      getGradingSettings(student.schoolId),
    ]);
    const mine = current.students.get(studentId);
    // Calculs adaptés par l'enseignant pour cet élève (signalés sur le bulletin)
    const adaptedRows = await prisma.studentFormula.findMany({
      where: { studentId, periodId },
      select: { classSubjectId: true, formula: true, reason: true },
    });
    const adaptedBySubject = new Map(adaptedRows.map((r) => [r.classSubjectId, r]));
    const previousMine = previous?.students.get(studentId);

    const subjectResults = enrollment.class.classSubjects.map((cs) => {
      // Arrondi selon les règles de la période (gelées par le conseil, sinon celles de l'école)
      const average = toDisplay(mine?.averages.subjects.get(cs.id) ?? null, current.rules.rounding);
      const stats = current.subjectStats.get(cs.id);
      const teacherNotes = [
        ...new Set(
          cs.evaluations
            .flatMap((evaluation) => evaluation.grades.map((grade) => grade.comment?.trim() || ""))
            .filter((note) => note.length > 0),
        ),
      ];

      return {
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        coefficient: Number(current.coefficients.get(cs.id) ?? cs.coefficient),
        // null = « NC » (non classé dans la matière)
        average,
        // Moyenne des interrogations (colonne MI du bulletin)
        interroAverage: toDisplay(mine?.averages.interrogations.get(cs.id) ?? null, current.rules.rounding),
        previousAverage: previous ? toDisplay(previousMine?.averages.subjects.get(cs.id) ?? null, previous.rules.rounding) : null,
        classAverage: stats?.average ?? null,
        classMin: stats?.min ?? null,
        classMax: stats?.max ?? null,
        appreciation: teacherNotes.length > 0 ? teacherNotes.join(" · ") : mentionFor(average, gradingSettings.mentions) ?? "Non évalué",
        evaluationsCount: cs.evaluations.length,
        // Calcul adapté pour cet élève : formule particulière et/ou notes non comptées
        adaptedFormula: adaptedBySubject.get(cs.id)?.formula ?? null,
        adaptationReason: adaptedBySubject.get(cs.id)?.reason ?? null,
        excludedGrades: cs.evaluations.filter((evaluation) => (evaluation.grades[0]?.excludedReason ?? "").trim()).length,
        grades: cs.evaluations.map((eval_) => {
          const g = eval_.grades[0];
          const status = g ? gradeStatus(g) : "EMPTY";
          return {
            title: eval_.title || eval_.type.name,
            date: eval_.date,
            maxGrade: Number(eval_.maxGrade),
            value: g && g.value !== null ? Number(g.value) : null,
            isAbsent: g?.isAbsent || false,
            isExcused: g?.isExcused || false,
            // « NC » : note pas encore tranchée par le professeur (exclue du calcul)
            status: status === "EMPTY" || status === "DELETED" ? "NC" : status,
          };
        }),
      };
    });

    const generalAverage = mine?.general ?? null;
    const previousGeneralAverage = previousMine?.general ?? null;
    const rank = mine?.rank ?? null;
    // Effectif : inscrits actifs (un élève qui abandonne n'est plus compté)
    const classSize = current.classSize;
    const classGeneralAverage = current.classGeneralAverage;
    const ncGrades = (mine?.averages.missing ?? []).length;

    // Dernière période de l'année : moyenne et rang annuels
    const annualResult = !nextPeriod
      ? await computeClassAnnual({
          classId: enrollment.classId,
          academicYearId: enrollment.academicYearId,
          classSubjects: classSubjectRefs,
        })
      : null;
    const annualMine = annualResult?.students.get(studentId) ?? null;

    // Rang par promotion (option de l'établissement)
    const promotion = gradingSettings.promotionRank
      ? await computePromotionRanks({
          schoolId: student.schoolId,
          classLevelId: enrollment.class.classLevelId,
          academicYearId: enrollment.academicYearId,
          periodId,
        })
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
      // Notes « NC » (non tranchées par le professeur) : exclues du calcul, rien n'est bloqué
      ncGrades,
      previousGeneralAverage,
      classGeneralAverage,
      rank,
      classSize,
      promotionRank: promotion ? promotion.ranks.get(studentId) ?? null : null,
      promotionSize: promotion ? promotion.size : null,
      annual: annualMine
        ? {
            // Officielle quand toutes les périodes ont une moyenne, sinon provisoire
            average: annualMine.general ?? annualMine.provisional,
            isProvisional: annualMine.general === null,
            rank: annualMine.rank,
          }
        : null,
      councilValidated: current.councilValidated,
      appreciation: mentionFor(generalAverage, gradingSettings.mentions) ?? "Non évalué",
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
);
