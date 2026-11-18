// Profil SQL du calcul des moyennes d'une classe, sous le rôle applicatif soumis
// à la RLS (base jetable, lecture seule) : durée de chaque requête Prisma, puis
// EXPLAIN ANALYZE de la plus lente. Usage :
//   QUALITY_APP_DATABASE_URL=… QUALITY_DATABASE_URL=… npx tsx scripts/quality/profile-class-sql.ts
import { PrismaClient, Prisma } from "@prisma/client";

const appUrl = process.env.QUALITY_APP_DATABASE_URL!;
const ownerUrl = process.env.QUALITY_DATABASE_URL!;
if (!appUrl || !ownerUrl || /:5432\//.test(appUrl)) throw new Error("Base jetable uniquement");

type Q = { query: string; params: string; duration: number };

async function main() {
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  const admin = await owner.user.findUnique({ where: { email: "admin@saintmichel.bj" }, select: { schoolId: true } });
  const schoolId = admin!.schoolId!;
  const year = await owner.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
  const klass = await owner.class.findFirst({ where: { schoolId, enrollments: { some: { status: "ACTIVE" } } }, select: { id: true } });
  const studentIds = (await owner.enrollment.findMany({ where: { classId: klass!.id, academicYearId: year!.id, status: "ACTIVE" }, select: { studentId: true } })).map((e) => e.studentId);
  await owner.$disconnect();

  const app = new PrismaClient({ datasources: { db: { url: appUrl } }, log: [{ emit: "event", level: "query" }] });
  const queries: Q[] = [];
  app.$on("query", (e) => queries.push({ query: e.query, params: e.params, duration: e.duration }));
  const select = {
    studentId: true, evaluationId: true, value: true, isAbsent: true, isExcused: true, excludedReason: true,
    evaluation: { select: { date: true, maxGrade: true, periodId: true, classSubjectId: true, classSubject: { select: { subjectId: true } }, type: { select: { code: true, name: true, category: true } } } },
  } as const;
  for (const label of ["froid", "chaud"]) {
    queries.length = 0;
    const t0 = performance.now();
    const rows = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT set_config('app.school_ids', $1, true), set_config('app.rls_bypass', 'off', true)", schoolId);
      return tx.grade.findMany({ where: { studentId: { in: studentIds }, deletedAt: null, evaluation: { period: { academicYearId: year!.id } } }, select });
    });
    console.log(JSON.stringify({ passage: label, eleves: studentIds.length, notes: rows.length, total_ms: Math.round(performance.now() - t0), requetes: queries.filter((q) => !/set_config|BEGIN|COMMIT/.test(q.query)).map((q) => ({ ms: q.duration, sql: q.query.slice(0, 90) })) }));
  }
  // EXPLAIN ANALYZE de la requête principale des notes, même contexte
  const slow = queries.filter((q) => /FROM "public"."grades"/.test(q.query)).sort((a, b) => b.duration - a.duration)[0];
  if (slow) {
    const params = JSON.parse(slow.params) as unknown[];
    const plan = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SELECT set_config('app.school_ids', $1, true), set_config('app.rls_bypass', 'off', true)", schoolId);
      return tx.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(`EXPLAIN (ANALYZE, BUFFERS) ${slow.query}`, ...params);
    });
    console.log(plan.map((r) => r["QUERY PLAN"]).join("\n"));
  }
  void Prisma;
  await app.$disconnect();
}
main();
