// Cohérence : moyenne générale stockée (student_analytics) vs recalcul en direct (moteur),
// après des changements de formule successifs. Lecture seule, base jetable.
import prisma from "@/lib/prisma";
import { computeClassPeriod } from "@/lib/academic/class-averages";

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@saintmichel.bj" }, select: { schoolId: true } });
  const schoolId = admin!.schoolId!;
  const year = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
  const periods = await prisma.period.findMany({ where: { academicYearId: year!.id }, select: { id: true } });
  const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true, classSubjects: { select: { id: true, subjectId: true, coefficient: true } } } });
  let compared = 0, equal = 0, storedNull = 0, liveNull = 0;
  const diffs: Array<{ cls: string; period: string; stored: number | null; live: number | null }> = [];
  for (const c of classes) {
    for (const p of periods) {
      const live = await computeClassPeriod({ classId: c.id, periodId: p.id, academicYearId: year!.id, classSubjects: c.classSubjects });
      const stored = await prisma.studentAnalytics.findMany({ where: { periodId: p.id, studentId: { in: [...live.students.keys()] } }, select: { studentId: true, generalAverage: true } });
      for (const s of stored) {
        const l = live.students.get(s.studentId)?.general ?? null;
        const st = s.generalAverage === null ? null : Number(s.generalAverage);
        compared++;
        if (st === null) storedNull++;
        if (l === null) liveNull++;
        if (st === l || (st !== null && l !== null && Math.abs(st - l) < 1e-9)) equal++;
        else if (diffs.length < 10) diffs.push({ cls: c.id.slice(-4), period: p.id.slice(-4), stored: st, live: l });
      }
    }
  }
  console.log(JSON.stringify({ classes: classes.length, periods: periods.length, compared, equal, different: compared - equal, storedNull, liveNull, sampleDiffs: diffs }));
  await prisma.$disconnect();
}
main();
