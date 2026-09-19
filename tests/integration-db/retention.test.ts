import { beforeAll, describe, expect, it } from "vitest";
import { enforceDataRetentionPolicies, planRetention, type RetentionPlanItem } from "@/lib/security/retention";
import { runAsSystem } from "@/lib/db/db-context";
import ownerDb from "./owner-db";
import { callRoute, createSchool, uniqueCode } from "./helpers";

/**
 * Lot 6 (N57) — purge de conservation sur une vraie base.
 *
 * Avant : durées lues en années (impossible d'exprimer 3 mois) ; dossiers
 * médicaux effacés selon leur date de mise à jour, élèves encore inscrits
 * compris ; départ de l'élève jamais pris en compte ; badges et journaux
 * techniques jamais purgés ; aucun aperçu ; erreurs avalées.
 *
 * Décision du propriétaire (2026-09-14) : durées en mois, comptées depuis le
 * départ de l'élève (fin de l'année de sa dernière inscription terminée) ; un
 * élève encore inscrit n'est jamais concerné ; l'aperçu annonce ce que la
 * purge efface ; la comptabilité (10 ans) est signalée, jamais supprimée
 * automatiquement.
 */
const monthsAgo = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

let schoolId: string;
const students: Record<"active" | "gone3y" | "gone6y" | "goneRecent", { profileId: string; userId: string }> = {} as never;
let paymentId: string;
const scanLogIds: { old?: string; recent?: string } = {};
const telemetryIds: { old?: string; recent?: string } = {};

async function createStudent(key: keyof typeof students, yearId: string, classId: string, status: "ACTIVE" | "GRADUATED" | "DROPPED") {
  const user = await ownerDb.user.create({
    data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: `Élève-${key}`, lastName: "Conservation", role: "STUDENT", schoolId, phone: "+22997000000" },
  });
  const profile = await ownerDb.studentProfile.create({
    data: { userId: user.id, schoolId, matricule: uniqueCode("MAT"), dateOfBirth: new Date("2010-05-04"), birthPlace: "Cotonou" },
  });
  await ownerDb.enrollment.create({ data: { studentId: profile.id, classId, academicYearId: yearId, status } });
  students[key] = { profileId: profile.id, userId: user.id };
  return profile.id;
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-RET")).id;
  const year = (name: string, endMonthsAgo: number, isCurrent = false) =>
    ownerDb.academicYear.create({
      data: { schoolId, name: uniqueCode(name), startDate: monthsAgo(endMonthsAgo + 10), endDate: monthsAgo(endMonthsAgo), isCurrent },
    });
  const [yOld, yMid, yRecent, yCurrent] = [await year("Y-6", 72), await year("Y-3", 36), await year("Y-rec", 2), await year("Y-cur", -8, true)];

  const level = await ownerDb.classLevel.create({ data: { schoolId, name: "CM2", code: uniqueCode("CM2"), level: "PRIMARY", sequence: 1 } });
  const klass = await ownerDb.class.create({ data: { schoolId, classLevelId: level.id, name: "CM2 A" } });
  const subject = await ownerDb.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("MATH") } });
  const classSubject = await ownerDb.classSubject.create({ data: { classId: klass.id, subjectId: subject.id } });
  const evalType = await ownerDb.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("DEV") } });

  await createStudent("active", yCurrent.id, klass.id, "ACTIVE");
  await createStudent("gone3y", yMid.id, klass.id, "GRADUATED");
  await createStudent("gone6y", yOld.id, klass.id, "GRADUATED");
  await createStudent("goneRecent", yRecent.id, klass.id, "DROPPED");

  // Dossiers médicaux : celui de l'élève inscrit n'a pas bougé depuis 20 ans.
  await ownerDb.medicalRecord.create({ data: { studentId: students.active.profileId, notes: "Asthme", updatedAt: monthsAgo(240) } });
  await ownerDb.medicalRecord.create({ data: { studentId: students.gone3y.profileId, notes: "Allergie" } });
  await ownerDb.medicalRecord.create({ data: { studentId: students.goneRecent.profileId, notes: "Lunettes" } });

  // Notes des élèves partis il y a 3 et 6 ans.
  for (const [key, y] of [["gone3y", yMid], ["gone6y", yOld]] as const) {
    const period = await ownerDb.period.create({
      data: { academicYearId: y.id, name: "T1", type: "TRIMESTER", startDate: y.startDate, endDate: y.endDate, sequence: 1 },
    });
    const evaluation = await ownerDb.evaluation.create({
      data: { classSubjectId: classSubject.id, periodId: period.id, typeId: evalType.id, date: y.startDate },
    });
    await ownerDb.grade.create({ data: { evaluationId: evaluation.id, studentId: students[key].profileId, value: 14 } });
  }

  // Pièce comptable de plus de 10 ans.
  const fee = await ownerDb.fee.create({ data: { schoolId, name: "Scolarité", amount: 50000 } });
  paymentId = (
    await ownerDb.payment.create({
      data: { studentId: students.gone6y.profileId, feeId: fee.id, amount: 50000, method: "CASH", createdAt: monthsAgo(132) },
    })
  ).id;

  scanLogIds.old = (await ownerDb.scanLog.create({ data: { schoolId, studentId: students.active.profileId, createdAt: monthsAgo(4) } })).id;
  scanLogIds.recent = (await ownerDb.scanLog.create({ data: { schoolId, studentId: students.active.profileId, createdAt: monthsAgo(1) } })).id;
  telemetryIds.old = (await ownerDb.telemetryEvent.create({ data: { event: "it_retention_old", createdAt: monthsAgo(13) } })).id;
  telemetryIds.recent = (await ownerDb.telemetryEvent.create({ data: { event: "it_retention_recent", createdAt: monthsAgo(1) } })).id;

  // Durées décidées par le propriétaire, en mois.
  const policies: Array<[string, number]> = [
    ["STUDENT_ACCOUNT", 12],
    ["ACADEMIC_RECORDS", 60],
    ["MEDICAL_RECORDS", 12],
    ["ACCOUNTING", 120],
    ["BADGE_SCAN_LOGS", 3],
  ];
  for (const [dataType, retentionPeriod] of policies) {
    await ownerDb.dataRetentionPolicy.create({ data: { schoolId, dataType, retentionPeriod, isActive: true } });
  }
});

const byType = (items: RetentionPlanItem[]) => Object.fromEntries(items.map((item) => [item.dataType, item]));

describe("Lot 6 — purge de conservation", () => {
  it("l'aperçu annonce exactement ce que la purge efface", async () => {
    const plan = byType(await runAsSystem("it:retention", () => planRetention(schoolId)));
    expect(plan.STUDENT_ACCOUNT.affected).toBe(2); // partis il y a 3 et 6 ans
    expect(plan.ACADEMIC_RECORDS.affected).toBe(1); // parti il y a 6 ans
    expect(plan.MEDICAL_RECORDS.affected).toBe(1); // parti il y a 3 ans ; ni l'inscrit, ni le départ récent
    expect(plan.BADGE_SCAN_LOGS.affected).toBe(1);
    expect(plan.ACCOUNTING).toMatchObject({ affected: 1, action: "report" });

    const results = await runAsSystem("it:retention", () => enforceDataRetentionPolicies());
    const mine = results.filter((r) => r.schoolId === schoolId);
    expect(mine.every((r) => !r.error), JSON.stringify(mine)).toBe(true);
    for (const result of mine) {
      if (result.action !== "report") expect(result.deletedCount, result.dataType).toBe(plan[result.dataType].affected);
    }
  });

  it("le dossier médical d'un élève encore inscrit n'est jamais effacé ; celui d'un départ ancien l'est", async () => {
    expect(await ownerDb.medicalRecord.count({ where: { studentId: students.active.profileId } })).toBe(1);
    expect(await ownerDb.medicalRecord.count({ where: { studentId: students.goneRecent.profileId } })).toBe(1);
    expect(await ownerDb.medicalRecord.count({ where: { studentId: students.gone3y.profileId } })).toBe(0);
  });

  it("à 1 an, le compte est fermé et ses coordonnées effacées ; le nom reste au registre", async () => {
    const gone = await ownerDb.user.findUniqueOrThrow({ where: { id: students.gone3y.userId } });
    expect(gone).toMatchObject({ isActive: false, phone: null, firstName: "Élève-gone3y" });
    expect(gone.email).toMatch(/@anonymized\.local$/);
    const active = await ownerDb.user.findUniqueOrThrow({ where: { id: students.active.userId } });
    expect(active).toMatchObject({ isActive: true, phone: "+22997000000" });
  });

  it("à 5 ans, l'élève est entièrement anonymisé ; à 3 ans, ses notes restent", async () => {
    const old = await ownerDb.user.findUniqueOrThrow({ where: { id: students.gone6y.userId } });
    expect(old.firstName).not.toBe("Élève-gone6y");
    expect(await ownerDb.grade.count({ where: { studentId: students.gone6y.profileId } })).toBe(0);
    expect(await ownerDb.grade.count({ where: { studentId: students.gone3y.profileId } })).toBe(1);
  });

  it("aucune pièce comptable n'est supprimée automatiquement", async () => {
    expect(await ownerDb.payment.count({ where: { id: paymentId } })).toBe(1);
  });

  it("badges au-delà de 3 mois et journaux techniques au-delà de 12 mois sont purgés", async () => {
    expect(await ownerDb.scanLog.count({ where: { id: scanLogIds.old } })).toBe(0);
    expect(await ownerDb.scanLog.count({ where: { id: scanLogIds.recent } })).toBe(1);
    expect(await ownerDb.telemetryEvent.count({ where: { id: telemetryIds.old } })).toBe(0);
    expect(await ownerDb.telemetryEvent.count({ where: { id: telemetryIds.recent } })).toBe(1);
  });

  it("une seconde passe n'a plus rien à effacer", async () => {
    const plan = await runAsSystem("it:retention", () => planRetention(schoolId));
    for (const item of plan) {
      if (item.action !== "report") expect(item.affected, item.dataType).toBe(0);
    }
  });
});

/**
 * Lot 7 — aperçu global avant d'armer la purge en cron. L'exploitant doit
 * pouvoir voir ce que la tâche effacerait sur TOUS les établissements avant de
 * la planifier ; seule la purge elle-même existait.
 */
describe("Lot 7 — aperçu de la purge pour l'exploitant", () => {
  it("GET /api/system/retention décrit ce que la purge ferait, sans rien effacer", async () => {
    const { GET } = await import("@/app/api/system/retention/route");
    const secret = process.env.CRON_SECRET ?? "";
    const before = await ownerDb.user.count();

    const res = await callRoute(GET, {
      method: "GET",
      path: "/api/system/retention",
      headers: { authorization: `Bearer ${secret}` },
    });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as { schools: Array<{ schoolId: string; school: string; rules: Array<{ dataType: string; affected: number; isActive: boolean }> }> };
    expect(Array.isArray(body.schools)).toBe(true);
    // Rien n'a été touché.
    expect(await ownerDb.user.count()).toBe(before);
  });

  it("sans secret, l'aperçu est refusé", async () => {
    const { GET } = await import("@/app/api/system/retention/route");
    const res = await callRoute(GET, { method: "GET", path: "/api/system/retention" });
    expect(res.status).toBe(401);
  });
});
