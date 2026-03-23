import prisma from "@/lib/prisma";
import { generateStudentAnalytics } from "@/lib/services/student-analytics";

const analyticsInclude = {
  student: {
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  },
  period: {
    select: { name: true, sequence: true },
  },
  academicYear: {
    select: { name: true },
  },
  subjectPerformances: {
    include: {
      subject: {
        select: { name: true, code: true },
      },
    },
  },
} as const;

type StudentAnalyticsSnapshot = Awaited<
  ReturnType<typeof generateStudentAnalytics>
>;

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function syncGradeHistory(
  analyticsData: StudentAnalyticsSnapshot
): Promise<void> {
  const { studentId, periodId, academicYearId, generalAverage, classRank, classSize } =
    analyticsData;

  await prisma.gradeHistory.deleteMany({
    where: {
      studentId,
      periodId,
      subjectId: null,
    },
  });

  if (generalAverage !== null) {
    await prisma.gradeHistory.create({
      data: {
        studentId,
        subjectId: null,
        periodId,
        academicYearId,
        average: generalAverage,
        rank: classRank,
        classSize,
      },
    });
  }

  const activeSubjectPerformances = analyticsData.subjectPerformances.filter(
    (performance) => performance.average !== null
  );
  const activeSubjectIds = activeSubjectPerformances.map(
    (performance) => performance.subjectId
  );

  if (activeSubjectIds.length === 0) {
    await prisma.gradeHistory.deleteMany({
      where: {
        studentId,
        periodId,
        subjectId: { not: null },
      },
    });
    return;
  }

  await prisma.gradeHistory.deleteMany({
    where: {
      studentId,
      periodId,
      AND: [
        {
          subjectId: {
            notIn: activeSubjectIds,
          },
        },
        {
          subjectId: {
            not: null,
          },
        },
      ],
    },
  });

  for (const performance of activeSubjectPerformances) {
    await prisma.gradeHistory.upsert({
      where: {
        studentId_subjectId_periodId: {
          studentId,
          subjectId: performance.subjectId,
          periodId,
        },
      },
      create: {
        studentId,
        subjectId: performance.subjectId,
        periodId,
        academicYearId,
        average: performance.average!,
      },
      update: {
        academicYearId,
        average: performance.average!,
      },
    });
  }
}

async function syncSubjectPerformances(
  analyticsId: string,
  analyticsData: StudentAnalyticsSnapshot
): Promise<void> {
  const activeSubjectIds = analyticsData.subjectPerformances.map(
    (performance) => performance.subjectId
  );

  if (activeSubjectIds.length === 0) {
    await prisma.subjectPerformance.deleteMany({
      where: { analyticsId },
    });
    return;
  }

  await prisma.subjectPerformance.deleteMany({
    where: {
      analyticsId,
      subjectId: {
        notIn: activeSubjectIds,
      },
    },
  });

  for (const performance of analyticsData.subjectPerformances) {
    await prisma.subjectPerformance.upsert({
      where: {
        analyticsId_subjectId: {
          analyticsId,
          subjectId: performance.subjectId,
        },
      },
      create: {
        analyticsId,
        subjectId: performance.subjectId,
        average: performance.average,
        gradesCount: performance.gradesCount,
        minGrade: performance.min,
        maxGrade: performance.max,
        standardDev: performance.standardDev,
        isStrength: performance.isStrength,
        isWeakness: performance.isWeakness,
        trend: performance.trend,
        progressionRate: performance.progressionRate,
      },
      update: {
        average: performance.average,
        gradesCount: performance.gradesCount,
        minGrade: performance.min,
        maxGrade: performance.max,
        standardDev: performance.standardDev,
        isStrength: performance.isStrength,
        isWeakness: performance.isWeakness,
        trend: performance.trend,
        progressionRate: performance.progressionRate,
      },
    });
  }
}

export async function persistStudentAnalyticsSnapshot(
  studentId: string,
  periodId: string,
  academicYearId: string
) {
  const analyticsData = await generateStudentAnalytics(
    studentId,
    periodId,
    academicYearId
  );

  const analytics = await prisma.studentAnalytics.upsert({
    where: {
      studentId_periodId: {
        studentId,
        periodId,
      },
    },
    create: {
      studentId,
      periodId,
      academicYearId,
      generalAverage: analyticsData.generalAverage,
      classRank: analyticsData.classRank,
      classSize: analyticsData.classSize,
      performanceLevel: analyticsData.performanceLevel,
      progressionRate: analyticsData.progressionRate,
      consistencyRate: analyticsData.consistencyRate,
      riskLevel: analyticsData.riskLevel,
      riskFactors: analyticsData.riskFactors,
    },
    update: {
      academicYearId,
      generalAverage: analyticsData.generalAverage,
      classRank: analyticsData.classRank,
      classSize: analyticsData.classSize,
      performanceLevel: analyticsData.performanceLevel,
      progressionRate: analyticsData.progressionRate,
      consistencyRate: analyticsData.consistencyRate,
      riskLevel: analyticsData.riskLevel,
      riskFactors: analyticsData.riskFactors,
      analyzedAt: new Date(),
    },
  });

  await syncSubjectPerformances(analytics.id, analyticsData);
  await syncGradeHistory(analyticsData);

  return prisma.studentAnalytics.findUnique({
    where: { id: analytics.id },
    include: analyticsInclude,
  });
}

async function getStudentPeriodsToSync(
  studentId: string,
  academicYearId: string
): Promise<string[]> {
  const [analyticsRows, grades] = await Promise.all([
    prisma.studentAnalytics.findMany({
      where: { studentId, academicYearId },
      select: { periodId: true },
    }),
    prisma.grade.findMany({
      where: {
        studentId,
        deletedAt: null,
        evaluation: {
          period: {
            academicYearId,
          },
        },
      },
      select: {
        evaluation: {
          select: { periodId: true },
        },
      },
    }),
  ]);

  return uniqueIds([
    ...analyticsRows.map((row) => row.periodId),
    ...grades.map((grade) => grade.evaluation.periodId),
  ]);
}

export async function syncFutureAnalyticsForStudents(
  studentIds: string[],
  academicYearId: string,
  afterSequence: number
): Promise<void> {
  const uniqueStudentIds = uniqueIds(studentIds);
  if (uniqueStudentIds.length === 0) return;

  const existingFutureAnalytics = await prisma.studentAnalytics.findMany({
    where: {
      studentId: { in: uniqueStudentIds },
      academicYearId,
      period: {
        sequence: { gt: afterSequence },
      },
    },
    select: {
      studentId: true,
      periodId: true,
    },
  });

  for (const analytics of existingFutureAnalytics) {
    await persistStudentAnalyticsSnapshot(
      analytics.studentId,
      analytics.periodId,
      academicYearId
    );
  }
}

export async function syncAnalyticsForClassPeriod(
  classId: string,
  periodId: string,
  academicYearId: string
): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId,
      academicYearId,
      status: "ACTIVE",
    },
    select: { studentId: true },
  });

  for (const enrollment of enrollments) {
    await persistStudentAnalyticsSnapshot(
      enrollment.studentId,
      periodId,
      academicYearId
    );
  }
}

export async function syncAnalyticsAfterGradeChange(
  evaluationId: string,
  changedStudentIds: string[]
): Promise<void> {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: {
      periodId: true,
      period: {
        select: {
          academicYearId: true,
          sequence: true,
        },
      },
    },
  });

  if (!evaluation || changedStudentIds.length === 0) return;

  const uniqueStudentIds = uniqueIds(changedStudentIds);

  // Sync affected students for the current period
  await Promise.all(uniqueStudentIds.map(studentId =>
    persistStudentAnalyticsSnapshot(
      studentId,
      evaluation.periodId,
      evaluation.period.academicYearId
    )
  ));

  // Sync affected students for future periods (to update progression/ranks)
  await syncFutureAnalyticsForStudents(
    uniqueStudentIds,
    evaluation.period.academicYearId,
    evaluation.period.sequence
  );
}

async function resolveAcademicYearsForStudentEvent(
  studentId: string,
  occurredAt: Date
): Promise<string[]> {
  const academicYears = await prisma.academicYear.findMany({
    where: {
      enrollments: {
        some: {
          studentId,
        },
      },
      startDate: { lte: occurredAt },
      endDate: { gte: occurredAt },
    },
    select: { id: true },
  });

  return academicYears.map((year) => year.id);
}

export async function syncAnalyticsAfterStudentActivityChange(
  studentIds: string[],
  occurredAt: Date
): Promise<void> {
  const uniqueStudentIds = uniqueIds(studentIds);
  if (uniqueStudentIds.length === 0) return;

  // Process students in parallel batches to avoid N*P*S sequential bottle-neck
  await Promise.all(uniqueStudentIds.map(async (studentId) => {
    const academicYearIds = await resolveAcademicYearsForStudentEvent(
      studentId,
      occurredAt
    );

    for (const academicYearId of academicYearIds) {
      const [periodIds, matchingPeriods] = await Promise.all([
        getStudentPeriodsToSync(studentId, academicYearId),
        prisma.period.findMany({
          where: {
            academicYearId,
            startDate: { lte: occurredAt },
            endDate: { gte: occurredAt },
          },
          select: { id: true },
        }),
      ]);

      const periodIdsToSync = uniqueIds([
        ...periodIds,
        ...matchingPeriods.map((period) => period.id),
      ]);

      // Batch analytics persistence for this student
      await Promise.all(periodIdsToSync.map(periodId =>
        persistStudentAnalyticsSnapshot(studentId, periodId, academicYearId)
      ));
    }
  }));
}
export async function syncAllStudentsForSchool(
  schoolId: string,
  academicYearId: string
): Promise<{ processed: number; errors: number }> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: { schoolId },
      academicYearId,
      status: "ACTIVE",
    },
    select: { studentId: true, classId: true },
  });

  const periods = await prisma.period.findMany({
    where: { academicYearId },
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    for (const period of periods) {
      try {
        await persistStudentAnalyticsSnapshot(
          enrollment.studentId,
          period.id,
          academicYearId
        );
        processed++;
      } catch (err) {
        errors++;
        console.error(`Failed to sync student ${enrollment.studentId} for period ${period.id}:`, err as Error);
      }
    }
  }

  return { processed, errors };
}
