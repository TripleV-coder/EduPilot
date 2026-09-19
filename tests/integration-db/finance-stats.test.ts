import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET } from "@/app/api/finance/stats/route";
import { roundTo } from "@/lib/analytics/helpers";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * M5 — `GET /api/finance/stats` : test de CARACTÉRISATION contre une vraie base,
 * écrit avant l'optimisation. La route chargeait TOUS les plans de paiement non
 * annulés de l'établissement (toutes années confondues, avec leurs échéances) et
 * tous les paiements des deux périodes comparées, pour les sommer en mémoire.
 * La réponse doit rester identique.
 *
 * Période courante : 1er janvier → 31 mars 2026 (UTC) ; période précédente :
 * même durée juste avant (octobre → décembre 2025).
 */
const CURRENT = "period=custom&startDate=2026-01-01T00:00:00.000Z&endDate=2026-03-31T23:59:59.999Z";
let schoolId: string;
let accountantId: string;

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

beforeAll(async () => {
  schoolId = (await createSchool("IT-FIN")).id;
  const user = (first: string, role: "ACCOUNTANT" | "STUDENT", school = schoolId) =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school } });
  accountantId = (await user("compta", "ACCOUNTANT")).id;

  const code6 = uniqueCode("6E");
  const code5 = uniqueCode("5E");
  await prisma.classLevel.createMany({
    data: [
      { schoolId, name: "6ème", code: code6, level: "SECONDARY_COLLEGE", sequence: 1 },
      { schoolId, name: "5ème", code: code5, level: "SECONDARY_COLLEGE", sequence: 2 },
    ],
  });
  const student = async (key: string, school = schoolId) =>
    (await prisma.studentProfile.create({ data: { userId: (await user(key, "STUDENT", school)).id, matricule: uniqueCode(key), schoolId: school } })).id;
  const s1 = await student("s1");
  const s2 = await student("s2");

  const f6 = await prisma.fee.create({ data: { schoolId, name: "Scolarité 6e", amount: 100000, classLevelCode: code6, dueDate: d("2026-02-15") } });
  const f5 = await prisma.fee.create({ data: { schoolId, name: "Scolarité 5e", amount: 60000, classLevelCode: code5, dueDate: d("2025-11-15") } });
  const fAll = await prisma.fee.create({ data: { schoolId, name: "Assurance", amount: 10000 } });

  const pay = (feeId: string, amount: number, status: "VERIFIED" | "RECONCILED" | "PENDING", paidAt: Date | null, createdAt: Date, studentId = s1) =>
    ({ studentId, feeId, amount, method: "CASH" as const, status, paidAt, createdAt });
  await prisma.payment.createMany({
    data: [
      pay(f6.id, 50000, "VERIFIED", d("2026-01-10"), d("2026-01-10")), // courant, janvier, 6ème
      pay(f5.id, 30000, "RECONCILED", null, d("2026-02-20"), s2), // courant (date de création), février, 5ème
      pay(fAll.id, 10000, "VERIFIED", d("2026-03-05"), d("2026-03-05")), // courant, mars, tous niveaux
      pay(f6.id, 99999, "PENDING", d("2026-01-15"), d("2026-01-15")), // en attente : exclu
      pay(f6.id, 20000, "VERIFIED", d("2025-11-20"), d("2025-11-20")), // période précédente
      pay(f6.id, 4000, "VERIFIED", d("2025-12-30"), d("2026-01-02")), // encaissé en décembre : précédente
      pay(f6.id, 7777, "VERIFIED", d("2025-06-01"), d("2025-06-01")), // hors des deux périodes
    ],
  });

  // Plans de paiement
  const plan = (studentId: string, feeId: string, totalAmount: number, paidAmount: number, status: "ACTIVE" | "CANCELLED" = "ACTIVE") =>
    prisma.paymentPlan.create({ data: { studentId, feeId, totalAmount, paidAmount, status } });
  // PL1 : échéances — seule I1 (payée) tombe dans la période courante
  const pl1 = await plan(s1, f6.id, 100000, 40000);
  await prisma.installmentPayment.createMany({
    data: [
      { paymentPlanId: pl1.id, amount: 50000, dueDate: d("2026-01-31"), status: "PAID" },
      { paymentPlanId: pl1.id, amount: 50000, dueDate: d("2026-04-30"), status: "PENDING" },
    ],
  });
  // PL2 : sans échéance, frais 5e dus en novembre 2025 → période précédente
  await plan(s2, f5.id, 60000, 10000);
  // PL3 : sans échéance, frais 6e dus en février 2026 → période courante
  await plan(s2, f6.id, 80000, 0);
  // PL4 : annulé → exclu partout
  await plan(s1, f6.id, 999, 0, "CANCELLED");
  // PL5 : échéances courantes, une en retard (impayée) et une annulée (attendue, non due)
  const pl5 = await plan(s1, fAll.id, 30000, 0);
  await prisma.installmentPayment.createMany({
    data: [
      { paymentPlanId: pl5.id, amount: 20000, dueDate: d("2026-03-01"), status: "OVERDUE" },
      { paymentPlanId: pl5.id, amount: 10000, dueDate: d("2026-02-01"), status: "CANCELLED" },
    ],
  });
  // PL6 : sans échéance, frais sans date d'échéance → hors de toute période datée
  await plan(s2, fAll.id, 15000, 15000);

  // Autre école : paiement courant, exclu
  const other = await createSchool("IT-FIN-OTHER");
  const otherFee = await prisma.fee.create({ data: { schoolId: other.id, name: "Scolarité", amount: 70000 } });
  await prisma.payment.create({ data: pay(otherFee.id, 88888, "VERIFIED", d("2026-01-10"), d("2026-01-10"), await student("x", other.id)) });
});

describe("GET /api/finance/stats — caractérisation", () => {
  it("période datée : revenus, recouvrement, croissance, répartition par mois et par cycle", async () => {
    actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
    const res = await callRoute(GET, { path: `/api/finance/stats?${CURRENT}` });

    expect(res.status).toBe(200);
    // Attendu : PL1 50 000 (I1) + PL3 80 000 + PL5 30 000 = 160 000 ; dû : 0 + 80 000 + 20 000
    // Précédente : revenus 20 000 + 4 000 ; attendu PL2 60 000, dû 50 000
    expect(res.body).toEqual({
      totalRevenue: 90000,
      totalPending: 100000,
      collectionRate: roundTo((90000 / 160000) * 100),
      revenueByMonth: [
        { month: "2026-01", amount: 50000 },
        { month: "2026-02", amount: 30000 },
        { month: "2026-03", amount: 10000 },
      ],
      revenueByCycle: [
        { name: "6ème", value: 50000 },
        { name: "5ème", value: 30000 },
        { name: "Tous niveaux", value: 10000 },
      ],
      revenueGrowth: roundTo(((90000 - 24000) / 24000) * 100),
      pendingGrowth: 100,
    });
  });

  it("sans période datée : tous les plans non annulés et tous les encaissements", async () => {
    actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
    const res = await callRoute(GET, { path: "/api/finance/stats?period=all" });

    expect(res.status).toBe(200);
    // Attendu : 100 000 + 60 000 + 80 000 + 30 000 + 15 000 ; dû : 60 000 + 50 000 + 80 000 + 30 000 + 0
    const revenue = 50000 + 30000 + 10000 + 20000 + 4000 + 7777;
    expect(res.body).toEqual({
      totalRevenue: revenue,
      totalPending: 220000,
      collectionRate: roundTo((revenue / 285000) * 100),
      revenueByMonth: [
        { month: "2025-06", amount: 7777 },
        { month: "2025-11", amount: 20000 },
        { month: "2025-12", amount: 4000 },
        { month: "2026-01", amount: 50000 },
        { month: "2026-02", amount: 30000 },
        { month: "2026-03", amount: 10000 },
      ],
      revenueByCycle: [
        { name: "6ème", value: 50000 + 20000 + 4000 + 7777 },
        { name: "5ème", value: 30000 },
        { name: "Tous niveaux", value: 10000 },
      ],
      revenueGrowth: 0,
      pendingGrowth: 0,
    });
  });

  it("établissement sans données : zéros, sans division par zéro", async () => {
    const empty = await createSchool("IT-FIN-EMPTY");
    actAs(sessionFor("ACCOUNTANT", empty.id));
    const res = await callRoute(GET, { path: `/api/finance/stats?${CURRENT}` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalRevenue: 0,
      totalPending: 0,
      collectionRate: 0,
      revenueByMonth: [],
      revenueByCycle: [],
      revenueGrowth: 0,
      pendingGrowth: 0,
    });
  });
});
