import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";

/**
 * Lot 3b (audit paiements, P-02/P-03/P-04) — plafond du guichet calculé avant
 * la transaction sur l'agrégat `paidAmount`, sans verrou ; aucune limite sur
 * les deux autres routes de création ni sur les modifications ; recalcul
 * concurrent perdant des paiements ; paiement d'échéance non atomique.
 * Toutes les écritures passent désormais par le verrou élève/frais avec le
 * solde relu (dû − encaissé − réservé). Les opérations concurrentes sont
 * réellement lancées en parallèle contre PostgreSQL.
 */
const { initiatePayment } = vi.hoisted(() => ({ initiatePayment: vi.fn() }));
vi.mock("@/lib/finance/factory", () => ({
    PaymentProviderFactory: { getProvider: () => ({ initiatePayment }) },
}));
vi.mock("@/lib/finance/providers/momo", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/finance/providers/momo")>()),
    isMomoConfigured: () => true,
}));

import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { POST as createPayment } from "@/app/api/payments/route";
import { POST as financePayment } from "@/app/api/finance/payments/route";
import { PATCH as patchPayment, DELETE as cancelPayment } from "@/app/api/payments/[id]/route";
import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as payInstallment } from "@/app/api/payment-plans/[id]/installments/[installmentId]/pay/route";
import { ONLINE_PAYMENT_TTL_MS, confirmOnlinePayment, failOnlinePayment, getFeeBalance, reconcileStalePayments } from "@/lib/finance/online-payments";

let schoolId: string;
let accountant: Session;
let admin: Session;

const json = (path: string, body: unknown, method = "POST") => ({ method, path, body });

async function newStudent() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Plafond", role: "STUDENT", schoolId },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
}
async function newFee(amount = 50000) {
    return (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount } })).id;
}
/** Échéancier de deux échéances égales (bourse éventuelle déjà déduite du total). */
async function newPlan(studentId: string, feeId: string, total: number) {
    return prisma.paymentPlan.create({
        data: {
            studentId, feeId, totalAmount: total, installments: 2, paidAmount: 0, status: "ACTIVE",
            installmentPayments: {
                create: [
                    { amount: total / 2, dueDate: new Date(Date.now() + 10 * 86_400_000), status: "PENDING" },
                    { amount: total / 2, dueDate: new Date(Date.now() + 40 * 86_400_000), status: "PENDING" },
                ],
            },
        },
        include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
    });
}
const cash = (studentId: string, feeId: string, amount: number, extra: Record<string, unknown> = {}) =>
    callRoute(cashPayment, json("/api/payments/cash", { studentId, feeId, amount, method: "CASH", ...extra }));
const settledSum = async (studentId: string, feeId: string) =>
    (await prisma.payment.findMany({ where: { studentId, feeId, status: { in: ["VERIFIED", "RECONCILED"] } } }))
        .reduce((s, p) => s + Number(p.amount), 0);
const balanceOf = (studentId: string, feeId: string) => runAsSystem("test:3b", () => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId)));

/** Total payé = somme comptabilisable ; échéances = imputation chronologique de cette somme. */
async function expectLedgerConsistent(studentId: string, feeId: string) {
    const plan = await prisma.paymentPlan.findFirst({
        where: { studentId, feeId, status: { not: "CANCELLED" } },
        include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
    });
    const sum = await settledSum(studentId, feeId);
    if (!plan) return sum;
    expect(Number(plan.paidAmount)).toBe(sum);
    let left = sum;
    for (const installment of plan.installmentPayments) {
        const covered = left >= Number(installment.amount);
        expect(installment.status === "PAID").toBe(covered);
        left = Math.max(0, left - Number(installment.amount));
    }
    return sum;
}

beforeAll(async () => {
    schoolId = (await createSchool("IT-3B")).id;
    const mk = (role: "ACCOUNTANT" | "SCHOOL_ADMIN") =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "3b", role, schoolId } });
    accountant = sessionFor("ACCOUNTANT", schoolId, (await mk("ACCOUNTANT")).id);
    admin = sessionFor("SCHOOL_ADMIN", schoolId, (await mk("SCHOOL_ADMIN")).id);
});

beforeEach(() => {
    actAs(accountant);
    initiatePayment.mockReset();
    initiatePayment.mockImplementation(async () => ({ paymentUrl: "", transactionId: uniqueCode("momo-ref") }));
});

describe("A — Plafond : reste dû relu, avec ou sans échéancier", () => {
    it("sans échéancier : inférieur accepté, égal accepté, puis solde nul refusé", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        expect((await cash(s, f, 20000)).status).toBe(200);
        expect((await cash(s, f, 30000)).status).toBe(200);
        const refused = await cash(s, f, 1);
        expect(refused.status).toBe(400);
        expect(refused.body).toEqual({ error: "Le montant saisi (1 FCFA) dépasse le reste à payer disponible (0 FCFA)." });
        expect(await settledSum(s, f)).toBe(50000);
    });

    it("supérieur au reste dû : refusé, aucun paiement créé (sans échéancier, l'ancien code n'avait aucune limite)", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        expect((await cash(s, f, 50001)).status).toBe(400);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("avec échéancier (bourse déduite à sa création) : le total de l'échéancier fait foi", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 40000);
        expect((await cash(s, f, 45000)).status).toBe(400);
        expect((await cash(s, f, 40000)).status).toBe(200);
        expect(await expectLedgerConsistent(s, f)).toBe(40000);
        expect((await prisma.paymentPlan.findFirstOrThrow({ where: { studentId: s, feeId: f } })).status).toBe("COMPLETED");
    });

    it("bourse active sans échéancier : comportement actuel conservé (montant plein du frais)", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await prisma.scholarship.create({ data: { studentId: s, name: "Bourse 50 %", type: "PARTIAL", amount: 0, percentage: 50, startDate: new Date(Date.now() - 86_400_000) } });
        expect((await cash(s, f, 50000)).status).toBe(200);
    });

    it("les deux autres routes de création appliquent le même plafond", async () => {
        const s = await newStudent();
        const f = await newFee(10000);
        for (const [handler, path] of [[createPayment, "/api/payments"], [financePayment, "/api/finance/payments"]] as const) {
            const res = await callRoute(handler, json(path, { studentId: s, feeId: f, amount: 10001, method: "CASH" }));
            expect(res.status, path).toBe(400);
        }
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });
});

describe("B — Concurrence réelle contre PostgreSQL", () => {
    it("deux encaissements simultanés dépassant ensemble le reste dû : un seul passe", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 40000);
        const results = await Promise.all([cash(s, f, 30000), cash(s, f, 30000)]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await expectLedgerConsistent(s, f)).toBe(30000);
    });

    it("quatre encaissements simultanés tenant dans le reste dû : tous comptés, aucun recalcul perdu", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 40000);
        const results = await Promise.all([1, 2, 3, 4].map(() => cash(s, f, 10000)));
        expect(results.every((r) => r.status === 200)).toBe(true);
        expect(await expectLedgerConsistent(s, f)).toBe(40000);
        expect((await prisma.paymentPlan.findFirstOrThrow({ where: { studentId: s, feeId: f } })).status).toBe("COMPLETED");
    });

    it("guichet simultané à une initiation en ligne : le même solde n'est jamais promis deux fois", async () => {
        const s = await newStudent();
        const f = await newFee(40000);
        const [counter, online] = await Promise.all([
            cash(s, f, 30000),
            callRoute(initiate, json("/api/payments/initiate", { amount: 30000, feeId: f, studentId: s, provider: "MOMO", payerPhone: "0190000000" })),
        ]);
        expect([counter.status, online.status].filter((st) => st === 200)).toHaveLength(1);
        const balance = (await balanceOf(s, f))!;
        expect(balance.settled + balance.reserved).toBeLessThanOrEqual(40000);
    });

    it("deux modifications simultanées qui dépassent ensemble le reste dû : une seule passe", async () => {
        const s = await newStudent();
        const f = await newFee(40000);
        const p1 = (await cash(s, f, 10000)).body as { id: string };
        const p2 = (await cash(s, f, 10000)).body as { id: string };
        const patch = (id: string) => callRoute(patchPayment, { method: "PATCH", path: `/api/payments/${id}`, params: { id }, body: { amount: 25000 } });
        const results = await Promise.all([patch(p1.id), patch(p2.id)]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await settledSum(s, f)).toBe(35000);
    });

    it("modification simultanée à une annulation du même paiement : état final cohérent", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 40000);
        await cash(s, f, 5000);
        const p = (await cash(s, f, 10000)).body as { id: string };
        actAs(admin);
        await Promise.all([
            callRoute(patchPayment, { method: "PATCH", path: `/api/payments/${p.id}`, params: { id: p.id }, body: { amount: 15000 } }),
            callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${p.id}`, params: { id: p.id } }),
        ]);
        const final = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(final.status).toBe("CANCELLED");
        expect(await expectLedgerConsistent(s, f)).toBe(5000);
    });
});

describe("C — Réservations des paiements en ligne", () => {
    async function pendingOnline(s: string, f: string, amount: number, createdAt = new Date()) {
        return prisma.payment.create({
            data: { studentId: s, feeId: f, amount, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"), provider: "MOMO", createdAt },
        });
    }

    it("essai en attente réservé une fois ; sa confirmation le compte une seule fois", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await pendingOnline(s, f, 20000);
        expect((await cash(s, f, 30001)).status).toBe(400);
        expect((await cash(s, f, 30000)).status).toBe(200);
        expect(await runAsSystem("test:3b", () => confirmOnlinePayment({ reference: p.reference!, provider: "MOMO", receivedAmount: 20000, receivedCurrency: "XOF", source: "test" }))).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        const balance = (await balanceOf(s, f))!;
        expect(balance).toMatchObject({ billed: 50000, settled: 50000, reserved: 0, remaining: 0, available: 0 });
        expect((await cash(s, f, 1)).status).toBe(400);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("échec chez le fournisseur : la réservation est libérée", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await pendingOnline(s, f, 20000);
        expect((await cash(s, f, 50000)).status).toBe(400);
        await runAsSystem("test:3b", () => failOnlinePayment(p.reference!, "test"));
        expect((await cash(s, f, 50000)).status).toBe(200);
    });

    const confirmLate = (reference: string, amount: number) =>
        runAsSystem("test:3b", () => confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: amount, receivedCurrency: "XOF", source: "test" }));
    const aged = () => new Date(Date.now() - ONLINE_PAYMENT_TTL_MS - 60_000);

    it("essai en attente depuis plus de 24 h : toujours réservé, le guichet ne peut pas consommer ce montant", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await pendingOnline(s, f, 20000, aged());
        expect((await balanceOf(s, f))!).toMatchObject({ reserved: 20000, available: 30000 });
        expect((await cash(s, f, 30001)).status).toBe(400);
        expect((await cash(s, f, 30000)).status).toBe(200);
    });

    it("expiration réellement enregistrée (EXPIRED) : la réservation est libérée", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await pendingOnline(s, f, 20000, aged());
        await prisma.payment.update({ where: { id: p.id }, data: { status: "EXPIRED" } });
        expect((await cash(s, f, 50000)).status).toBe(200);
    });

    it("réconciliation en erreur pour ce paiement : il reste en attente et réservé", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const plan = await newPlan(s, f, 50000);
        const p = await prisma.payment.create({
            data: { studentId: s, feeId: f, amount: 20000, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"), provider: "MOMO", providerTransactionId: uniqueCode("MTN"), createdAt: aged() },
        });
        // Validation impossible (échec simulé du recalcul) : rien n'est libéré
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION it_fail_plan_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW."id" = '${plan.id}' THEN RAISE EXCEPTION 'échec simulé'; END IF;
              RETURN NEW;
            END $$;`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER it_fail_plan_update BEFORE UPDATE ON "payment_plans" FOR EACH ROW EXECUTE FUNCTION it_fail_plan_update()`);
        try {
            await runAsSystem("test:3b", () =>
                reconcileStalePayments(async (_provider, transactionId) => ({
                    status: transactionId === p.providerTransactionId ? "SUCCESS" : "PENDING",
                    rawData: { amount: 20000, currency: "XOF" },
                })),
            );
        } finally {
            await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fail_plan_update ON "payment_plans"`);
            await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS it_fail_plan_update()`);
        }
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
        expect((await balanceOf(s, f))!).toMatchObject({ reserved: 20000, available: 30000 });
        expect((await cash(s, f, 50000)).status).toBe(400);
    });

    it("confirmation d'un essai de plus de 24 h : comptée une fois, sans trop-perçu, échéancier cohérent", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await pendingOnline(s, f, 20000, aged());
        expect((await cash(s, f, 30000)).status).toBe(200);
        expect(await confirmLate(p.reference!, 20000)).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("confirmation tardive après encaissement du solde : enregistrée, trop-perçu signalé, total cohérent", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await pendingOnline(s, f, 20000);
        await prisma.payment.update({ where: { id: p.id }, data: { status: "EXPIRED" } });
        expect((await cash(s, f, 50000)).status).toBe(200);
        expect(await runAsSystem("test:3b", () => confirmOnlinePayment({ reference: p.reference!, provider: "MOMO", receivedAmount: 20000, receivedCurrency: "XOF", source: "test" }))).toMatchObject({ outcome: "CONFIRMED", overpaid: 20000 });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).notes).toContain("Trop-perçu de 20000 FCFA");
        expect(await expectLedgerConsistent(s, f)).toBe(70000);
    });
});

describe("C bis — Concurrence : guichet, confirmation tardive, réconciliation", () => {
    async function agedPending(s: string, f: string, amount: number) {
        return prisma.payment.create({
            data: {
                studentId: s, feeId: f, amount, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"),
                provider: "MOMO", providerTransactionId: uniqueCode("MTN"), createdAt: new Date(Date.now() - ONLINE_PAYMENT_TTL_MS - 60_000),
            },
        });
    }

    it("guichet du solde entier simultané à la confirmation tardive : guichet refusé, aucun trop-perçu", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await agedPending(s, f, 50000);
        const [counter, confirmation] = await Promise.all([
            cash(s, f, 50000),
            runAsSystem("test:3b", () => confirmOnlinePayment({ reference: p.reference!, provider: "MOMO", receivedAmount: 50000, receivedCurrency: "XOF", source: "test" })),
        ]);
        expect(counter.status).toBe(400);
        expect(confirmation).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("guichet simultané à la réconciliation qui confirme le paiement : guichet refusé, total cohérent", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await agedPending(s, f, 50000);
        const [counter] = await Promise.all([
            cash(s, f, 50000),
            runAsSystem("test:3b", () =>
                reconcileStalePayments(async (_provider, transactionId) => ({
                    status: transactionId === p.providerTransactionId ? "SUCCESS" : "PENDING",
                    rawData: { amount: 50000, currency: "XOF" },
                })),
            ),
        ]);
        expect(counter.status).toBe(400);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("VERIFIED");
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("guichet simultané à une réconciliation incertaine puis confirmation tardive : guichet refusé, aucun trop-perçu", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await agedPending(s, f, 50000);
        const [counter] = await Promise.all([
            cash(s, f, 50000),
            runAsSystem("test:3b", () => reconcileStalePayments(async () => ({ status: "PENDING", rawData: null }))),
        ]);
        // Réponse « toujours en attente » : l'essai reste réservé, quel que soit l'ordre
        expect(counter.status).toBe(400);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
        const late = await runAsSystem("test:3b", () =>
            confirmOnlinePayment({ reference: p.reference!, provider: "MOMO", receivedAmount: 50000, receivedCurrency: "XOF", source: "test" }),
        );
        expect(late).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("guichet simultané à une réconciliation qui ne joint pas le fournisseur : guichet refusé, essai toujours réservé", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await agedPending(s, f, 50000);
        const [counter] = await Promise.all([
            cash(s, f, 50000),
            runAsSystem("test:3b", () =>
                reconcileStalePayments(async () => {
                    throw new Error("ECONNRESET");
                }),
            ),
        ]);
        expect(counter.status).toBe(400);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
        expect((await balanceOf(s, f))!).toMatchObject({ reserved: 50000, available: 0 });
    });

    it("expiration définitive confirmée par le fournisseur : annulé, la réservation est libérée", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await agedPending(s, f, 50000);
        await runAsSystem("test:3b", () =>
            reconcileStalePayments(async (_provider, transactionId) => ({
                status: transactionId === p.providerTransactionId ? "FAILED" : "PENDING",
                rawData: { status: "expired" },
            })),
        );
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CANCELLED");
        expect((await cash(s, f, 50000)).status).toBe(200);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });
});

describe("D — Intégrité : aucune écriture partielle", () => {
    it("référence déjà utilisée au guichet : 409, aucun paiement, échéancier intact", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 40000);
        const reference = uniqueCode("MTN");
        expect((await cash(s, f, 10000, { method: "MOBILE_MONEY_MTN", reference })).status).toBe(200);
        const dup = await cash(s, f, 10000, { method: "MOBILE_MONEY_MTN", reference });
        expect(dup.status).toBe(409);
        expect(await expectLedgerConsistent(s, f)).toBe(10000);
    });

    it("paiement d'échéance avec une référence déjà utilisée : 409, échéance et plan intacts", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const plan = await newPlan(s, f, 40000);
        const reference = uniqueCode("CHQ");
        await cash(s, f, 5000, { method: "CHECK", reference });
        const installment = plan.installmentPayments[1];
        const res = await callRoute(payInstallment, {
            method: "POST", path: `/api/payment-plans/${plan.id}/installments/${installment.id}/pay`,
            params: { id: plan.id, installmentId: installment.id }, body: { method: "CHECK", reference },
        });
        expect(res.status).toBe(409);
        expect((await prisma.installmentPayment.findUniqueOrThrow({ where: { id: installment.id } })).status).toBe("PENDING");
        expect(await expectLedgerConsistent(s, f)).toBe(5000);
    });

    it("paiement d'échéance après un versement partiel : son reste seul est encaissé, jamais au-delà du dû (lot 3c)", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const plan = await newPlan(s, f, 50000);
        await cash(s, f, 10000);
        const pay = (index: number) => {
            const installment = plan.installmentPayments[index];
            return callRoute(payInstallment, {
                method: "POST", path: `/api/payment-plans/${plan.id}/installments/${installment.id}/pay`,
                params: { id: plan.id, installmentId: installment.id }, body: { method: "CASH" },
            });
        };
        // 10 000 déjà versés : l'échéance 1 ne règle que ses 15 000 restants
        expect((await pay(0)).status).toBe(200);
        expect(await expectLedgerConsistent(s, f)).toBe(25000);
        expect((await pay(1)).status).toBe(200);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
        // Plan soldé : plus rien à encaisser, le dû n'est jamais dépassé
        const over = await pay(1);
        expect(over.status).toBe(400);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("deux paiements simultanés de la même échéance : un seul encaissement", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const plan = await newPlan(s, f, 50000);
        const installment = plan.installmentPayments[0];
        const pay = () => callRoute(payInstallment, {
            method: "POST", path: `/api/payment-plans/${plan.id}/installments/${installment.id}/pay`,
            params: { id: plan.id, installmentId: installment.id }, body: { method: "CASH" },
        });
        const results = await Promise.all([pay(), pay()]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await expectLedgerConsistent(s, f)).toBe(25000);
    });
});

describe("E — Confirmation authentique après une annulation (lot 3b)", () => {
    const ALERT = "Paiement validé après une annulation";
    async function onlinePayment(s: string, f: string, amount: number) {
        return prisma.payment.create({
            data: { studentId: s, feeId: f, amount, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"), provider: "MOMO", providerTransactionId: uniqueCode("MTN") },
        });
    }
    const confirm = (reference: string, amount: number, currency = "XOF") =>
        runAsSystem("test:3b", () => confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: amount, receivedCurrency: currency, source: "webhook MOMO" }));
    const alertsFor = (userId: string) => prisma.notification.count({ where: { userId, title: ALERT } });

    it("après une annulation manuelle : comptabilisé, état antérieur noté, alerte au service financier", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await onlinePayment(s, f, 50000);
        actAs(admin);
        expect((await callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${p.id}`, params: { id: p.id } })).status).toBe(200);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).cancellationSource).toBe("MANUAL");
        const before = await alertsFor(accountant.user.id);

        expect(await confirm(p.reference!, 50000)).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(after.status).toBe("VERIFIED");
        expect(after.notes).toContain("état antérieur : annulé, annulation manuelle par l'école");
        expect(await alertsFor(accountant.user.id)).toBe(before + 1);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);

        // Webhook rejoué : rien ne bouge, pas de seconde alerte
        expect(await confirm(p.reference!, 50000)).toMatchObject({ outcome: "ALREADY_PROCESSED" });
        expect(await alertsFor(accountant.user.id)).toBe(before + 1);
        expect(await expectLedgerConsistent(s, f)).toBe(50000);
    });

    it("ancienne annulation d'origine inconnue : comptabilisée, alerte au service financier", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await onlinePayment(s, f, 50000);
        await prisma.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } }); // annulée avant la migration
        const before = await alertsFor(accountant.user.id);
        expect(await confirm(p.reference!, 50000)).toMatchObject({ outcome: "CONFIRMED" });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).notes).toContain("origine inconnue");
        expect(await alertsFor(accountant.user.id)).toBe(before + 1);
    });

    it("après un échec signalé par le fournisseur : comptabilisé sans alerte", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await onlinePayment(s, f, 50000);
        await runAsSystem("test:3b", () => failOnlinePayment(p.reference!, "test"));
        const before = await alertsFor(accountant.user.id);
        expect(await confirm(p.reference!, 50000)).toMatchObject({ outcome: "CONFIRMED" });
        expect(await alertsFor(accountant.user.id)).toBe(before);
    });

    it("montant ou devise incorrects : non validé, reste annulé, écart noté à rapprocher", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        const p = await onlinePayment(s, f, 50000);
        await runAsSystem("test:3b", () => failOnlinePayment(p.reference!, "test"));
        expect(await confirm(p.reference!, 40000)).toMatchObject({ outcome: "MISMATCH" });
        expect(await confirm(p.reference!, 50000, "EUR")).toMatchObject({ outcome: "MISMATCH" });
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(after.status).toBe("CANCELLED");
        expect(after.notes).toContain("À rapprocher");
        expect(await settledSum(s, f)).toBe(0);
    });

    it("guichet du solde entier simultané à la confirmation d'un paiement annulé : tout est compté, trop-perçu signalé, échéancier cohérent", async () => {
        const s = await newStudent();
        const f = await newFee(50000);
        await newPlan(s, f, 50000);
        const p = await onlinePayment(s, f, 50000);
        await runAsSystem("test:3b", () => failOnlinePayment(p.reference!, "test"));
        actAs(accountant);
        const [counter, confirmation] = await Promise.all([cash(s, f, 50000), confirm(p.reference!, 50000)]);
        // Le paiement annulé ne réservait rien : selon l'ordre, le guichet passe ou non
        expect(confirmation).toMatchObject({ outcome: "CONFIRMED" });
        if (counter.status === 200) {
            expect((confirmation as { overpaid: number }).overpaid).toBe(50000);
            expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).notes).toContain("Trop-perçu de 50000 FCFA");
            expect(await expectLedgerConsistent(s, f)).toBe(100000);
        } else {
            expect(counter.status).toBe(400);
            expect(await expectLedgerConsistent(s, f)).toBe(50000);
        }
    });
});

