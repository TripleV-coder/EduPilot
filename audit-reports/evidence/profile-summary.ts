// Profil de studentAveragesSummary sur la base jetable (lecture seule).
import prisma from "@/lib/prisma";
import { computeClassAnnual, computeClassPeriod, studentAveragesSummary } from "@/lib/academic/class-averages";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "kate.agbossou0@eleve.saintmichel.bj" }, select: { studentProfile: { select: { id: true } } } });
  const studentId = user!.studentProfile!.id;
  const e = await prisma.enrollment.findFirst({ where: { studentId, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" },
    select: { classId: true, academicYearId: true, class: { select: { _count: { select: { enrollments: true } }, classSubjects: { select: { id: true, subjectId: true, coefficient: true } } } } } });
  const cs = e!.class.classSubjects;
  const t = async (label: string, f: () => Promise<unknown>) => { const s = performance.now(); await f(); console.log(label, Math.round(performance.now() - s), "ms"); };
  await t("warmup summary", () => studentAveragesSummary(studentId));
  let periods: Array<{ id: string }> = [];
  await t("computeClassAnnual", async () => { periods = (await computeClassAnnual({ classId: e!.classId, academicYearId: e!.academicYearId, classSubjects: cs })).periods; });
  for (const p of periods) await t(`computeClassPeriod ${p.id.slice(-4)}`, () => computeClassPeriod({ classId: e!.classId, periodId: p.id, academicYearId: e!.academicYearId, classSubjects: cs }));
  await t("studentAveragesSummary total", () => studentAveragesSummary(studentId));
  console.log("enrollments in class:", e!.class._count.enrollments, "subjects:", cs.length, "periods:", periods.length);
  await prisma.$disconnect();
}
main();
