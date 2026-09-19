import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET } from "@/app/api/analytics/bi/route";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M5 / C3 — `GET /api/analytics/bi` contre une vraie base.
 *
 * 1. Caractérisation (écrite AVANT l'optimisation, verte avant/après) : la route
 *    chargeait tous les frais et TOUS les paiements encaissés de l'établissement
 *    pour les sommer en mémoire.
 * 2. Troncature : le taux de réussite et les meilleures matières étaient calculés
 *    sur les 500 instantanés d'analyse les plus récents seulement (`take: 500`) :
 *    au-delà de 500 élèves, les chiffres affichés étaient faux, sans erreur.
 */
let fx: AnalyticsSchoolFixture;

/** Milieu de mois, midi : même mois quel que soit le fuseau du processus. */
function monthsAgo(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, 15, 12);
}

beforeAll(async () => {
  fx = await seedAnalyticsSchool();

  const fee = await prisma.fee.create({ data: { schoolId: fx.schoolId, name: "Scolarité", amount: 100000, createdAt: monthsAgo(0) } });
  await prisma.fee.create({ data: { schoolId: fx.schoolId, name: "Cantine", amount: 50000, createdAt: monthsAgo(2) } });
  const pay = (amount: number, method: "CASH" | "MOBILE_MONEY_MTN" | "BANK_TRANSFER", status: "VERIFIED" | "RECONCILED" | "PENDING", paidAt: Date | null, createdAt: Date, feeId = fee.id, studentId = fx.students.s1) =>
    prisma.payment.create({ data: { studentId, feeId, amount, method, status, paidAt, createdAt } });

  await pay(40000, "CASH", "VERIFIED", monthsAgo(0), monthsAgo(0));
  // Sans date d'encaissement : c'est la date de création qui compte
  await pay(10000, "MOBILE_MONEY_MTN", "RECONCILED", null, monthsAgo(3));
  // Encaissé il y a plus de 12 mois : dans les totaux, hors de la série mensuelle
  await pay(5000, "BANK_TRANSFER", "VERIFIED", monthsAgo(14), monthsAgo(14));
  // En attente : exclu partout
  await pay(99999, "CASH", "PENDING", monthsAgo(0), monthsAgo(0));

  // Paiement d'une autre école : exclu
  const other = await createSchool("IT-BI-OTHER");
  const otherFee = await prisma.fee.create({ data: { schoolId: other.id, name: "Scolarité", amount: 70000 } });
  const otherUser = await prisma.user.create({
    data: { email: `${uniqueCode("x")}@integration.test`, password: "x", firstName: "X", lastName: "Test", role: "STUDENT", schoolId: other.id },
  });
  const otherStudent = await prisma.studentProfile.create({ data: { userId: otherUser.id, matricule: uniqueCode("x"), schoolId: other.id } });
  await pay(70000, "CASH", "VERIFIED", monthsAgo(0), monthsAgo(0), otherFee.id, otherStudent.id);
});

describe("GET /api/analytics/bi — caractérisation", () => {
  it("indicateurs, série mensuelle, répartition des paiements et meilleures matières", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: "/api/analytics/bi" });
    expect(res.status).toBe(200);
    const body = res.body as {
      kpis: Record<string, number>;
      totalCollected: number;
      monthly: Array<{ label: string; billed: number; collected: number }>;
      paymentMix: unknown;
      topSubjects: unknown;
      insight: unknown;
    };

    // 6 élèves actifs dans l'école (l'annexe est exclue)
    // 55 000 encaissés / 150 000 facturés ; présences : 2 PRESENT + 1 LATE sur 4
    // Réussite : s1 16, s2 14, s5 12 ≥ 10 ; s3 8, s4 5, s6 (null) < 10 → 3/6
    expect(body.kpis).toEqual({ studentCount: 6, collectionRate: 36.7, attendanceRate: 75, passRate: 50 });
    expect(body.totalCollected).toBe(55000);
    expect(body.paymentMix).toEqual([
      { method: "CASH", amount: 40000, share: 72.7 },
      { method: "MOBILE_MONEY_MTN", amount: 10000, share: 18.2 },
      { method: "BANK_TRANSFER", amount: 5000, share: 9.1 },
    ]);

    expect(body.monthly).toHaveLength(12);
    const expectedMonthly = Array.from({ length: 12 }, (_, i) => {
      const d = monthsAgo(11 - i);
      return { label: d.toLocaleDateString("fr-FR", { month: "short" }), billed: 0, collected: 0 };
    });
    expectedMonthly[11] = { ...expectedMonthly[11], billed: 100000, collected: 40000 };
    expectedMonthly[9] = { ...expectedMonthly[9], billed: 50000 };
    expectedMonthly[8] = { ...expectedMonthly[8], collected: 10000 };
    expect(body.monthly).toEqual(expectedMonthly);

    // Dernier instantané de chaque élève (T2) : Français 14,16,10,12 → 13 ; Maths 18,12,6,4,12 → 10,4
    expect(body.topSubjects).toEqual([
      { subject: "Français", average: 13 },
      { subject: "Mathématiques", average: 10.4 },
    ]);
    expect(body.insight).toBeNull();
  });

  it("filtre par année scolaire : frais, paiements et analyses de l'année seulement", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: `/api/analytics/bi?academicYearId=${fx.yearId}` });
    expect(res.status).toBe(200);
    const body = res.body as { kpis: Record<string, number>; totalCollected: number; paymentMix: unknown; topSubjects: unknown };

    // Aucun frais rattaché à l'année : rien de facturé ni d'encaissé
    expect(body.totalCollected).toBe(0);
    expect(body.kpis.collectionRate).toBe(0);
    expect(body.paymentMix).toEqual([]);
    // Les analyses sont toutes de cette année : mêmes valeurs
    expect(body.kpis.passRate).toBe(50);
    expect(body.topSubjects).toEqual([
      { subject: "Français", average: 13 },
      { subject: "Mathématiques", average: 10.4 },
    ]);
  });

  it("école sans aucune donnée : zéros, séries vides, pas de division par zéro", async () => {
    const empty = await createSchool("IT-BI-EMPTY");
    actAs(sessionFor("SCHOOL_ADMIN", empty.id));
    const res = await callRoute(GET, { path: "/api/analytics/bi" });
    expect(res.status).toBe(200);
    const body = res.body as { kpis: Record<string, number>; totalCollected: number; monthly: Array<{ billed: number; collected: number }>; paymentMix: unknown; topSubjects: unknown };
    expect(body.kpis).toEqual({ studentCount: 0, collectionRate: 0, attendanceRate: 0, passRate: 0 });
    expect(body.totalCollected).toBe(0);
    expect(body.paymentMix).toEqual([]);
    expect(body.topSubjects).toEqual([]);
    expect(body.monthly.every((m) => m.billed === 0 && m.collected === 0)).toBe(true);
  });
});

describe("GET /api/analytics/bi — aucune troncature au-delà de 500 élèves", () => {
  it("taux de réussite et matières calculés sur le dernier instantané de CHAQUE élève", async () => {
    const school = await createSchool("IT-BI-501");
    const year = await prisma.academicYear.create({
      data: { schoolId: school.id, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
    });
    const period = await prisma.period.create({
      data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 },
    });
    const subject = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathématiques", code: uniqueCode("M") } });

    const count = 501;
    const tag = uniqueCode("bi");
    const users = await prisma.user.createManyAndReturn({
      data: Array.from({ length: count }, (_, i) => ({
        email: `${tag}-${i}@integration.test`, password: "x", firstName: `E${i}`, lastName: "Test", role: "STUDENT" as const, schoolId: school.id,
      })),
      select: { id: true, email: true },
    });
    users.sort((a, b) => Number(a.email.split("-").at(-1)!.split("@")[0]) - Number(b.email.split("-").at(-1)!.split("@")[0]));
    const profiles = await prisma.studentProfile.createManyAndReturn({
      data: users.map((u, i) => ({ userId: u.id, matricule: `${tag}-${i}`, schoolId: school.id })),
      select: { id: true, matricule: true },
    });
    const byMatricule = new Map(profiles.map((p) => [p.matricule, p.id]));

    // L'élève 0 (en échec, 4/20) a l'instantané le PLUS ANCIEN ; les 500 autres réussissent (16/20).
    const analytics = await prisma.studentAnalytics.createManyAndReturn({
      data: users.map((_, i) => ({
        studentId: byMatricule.get(`${tag}-${i}`)!,
        periodId: period.id,
        academicYearId: year.id,
        generalAverage: i === 0 ? 4 : 16,
        createdAt: i === 0 ? new Date("2025-10-01T10:00:00Z") : new Date("2026-01-10T10:00:00Z"),
      })),
      select: { id: true, generalAverage: true },
    });
    await prisma.subjectPerformance.createMany({
      data: analytics.map((a) => ({ analyticsId: a.id, subjectId: subject.id, average: a.generalAverage })),
    });

    actAs(sessionFor("SCHOOL_ADMIN", school.id));
    const res = await callRoute(GET, { path: "/api/analytics/bi" });
    expect(res.status).toBe(200);
    const body = res.body as { kpis: Record<string, number>; topSubjects: unknown };

    expect(body.kpis.studentCount).toBe(count);
    // 500 / 501 = 99,8 % (et non 100 % calculé sur les 500 plus récents)
    expect(body.kpis.passRate).toBe(99.8);
    // (500 × 16 + 4) / 501 = 15,976…
    expect(body.topSubjects).toEqual([{ subject: "Mathématiques", average: 15.98 }]);
  });
});
