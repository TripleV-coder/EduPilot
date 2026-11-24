import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { PATCH as patchPayment } from "@/app/api/payments/[id]/route";
import { PUT as putFinancePayment } from "@/app/api/finance/payments/[id]/route";

/**
 * Audit UX/rôles (2026-10-19) — un paiement confié à FedaPay pouvait voir son
 * montant ou sa référence modifiés à la main : le webhook (qui retrouve le
 * paiement par sa référence et compare le montant) ne pouvait plus le valider.
 */
let schoolId: string;
let accountantId: string;
let studentId: string;
let feeId: string;

const payment = (extra: Record<string, unknown>) =>
    prisma.payment.create({
        data: { studentId, feeId, amount: 10000, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"), ...extra },
    });
const patch = (id: string, body: unknown) => callRoute(patchPayment, { method: "PATCH", path: `/api/payments/${id}`, params: { id }, body });
const put = (id: string, body: unknown) => callRoute(putFinancePayment, { method: "PUT", path: `/api/finance/payments/${id}`, params: { id }, body });

beforeAll(async () => {
    schoolId = (await createSchool("IT-PBE")).id;
    const mk = (role: "ACCOUNTANT" | "STUDENT") =>
        prisma.user.create({ data: { email: `${uniqueCode(role)}@integration.test`, password: "x", firstName: role, lastName: "PBE", role, schoolId } });
    accountantId = (await mk("ACCOUNTANT")).id;
    studentId = (await prisma.studentProfile.create({ data: { userId: (await mk("STUDENT")).id, schoolId, matricule: uniqueCode("MAT") } })).id;
    feeId = (await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 100000 } })).id;
});

describe("Paiement confié à un fournisseur : montant, référence et moyen figés", () => {
    it("PATCH /api/payments/<id> : montant ou référence refusés (409), rien ne change", async () => {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
        const p = await payment({ provider: "FEDAPAY", providerTransactionId: "123" });
        for (const body of [{ amount: 9000 }, { reference: "AUTRE-REF" }, { method: "CASH" }]) {
            const res = await patch(p.id, body);
            expect(res.status).toBe(409);
            expect(res.body).toMatchObject({ code: "PROVIDER_BOUND_PAYMENT" });
        }
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect([Number(after.amount), after.reference, after.method]).toEqual([10000, p.reference, "MOBILE_MONEY_MTN"]);
    });

    it("PUT /api/finance/payments/<id> : même refus ; une note reste possible", async () => {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
        const p = await payment({ provider: "FEDAPAY", providerTransactionId: "124" });
        expect((await put(p.id, { reference: "AUTRE-REF" })).status).toBe(409);
        expect((await put(p.id, { amount: 1 })).status).toBe(409);
        expect((await put(p.id, { notes: "Vérifié par téléphone avec la famille" })).status).toBe(200);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).reference).toBe(p.reference);
    });

    // FIN-03 (2026-11-24) : seul le fournisseur (webhook signé, réconciliation,
    // « Interroger le fournisseur ») confirme un paiement en ligne. Le valider
    // à la main encaissait un argent dont rien ne prouvait la réception.
    it("PUT : valider ou rapprocher à la main un paiement en ligne non confirmé est refusé (409)", async () => {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
        for (const status of ["VERIFIED", "RECONCILED"]) {
            const p = await payment({ provider: "FEDAPAY", providerTransactionId: uniqueCode("TX") });
            const res = await put(p.id, { status });
            expect(res.status, status).toBe(409);
            expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
        }
        for (const from of ["EXPIRED", "CANCELLED"] as const) {
            const p = await payment({ provider: "FEDAPAY", providerTransactionId: uniqueCode("TX"), status: from });
            expect((await put(p.id, { status: "VERIFIED" })).status, from).toBe(409);
        }
    });

    it("PUT : aucun paiement ne revient « en attente » ; statut inconnu de la base → 400 (pas 500)", async () => {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
        const cancelled = await payment({ status: "CANCELLED", method: "CASH" });
        expect((await put(cancelled.id, { status: "PENDING" })).status).toBe(409);
        const cash = await payment({ method: "CASH" });
        expect((await put(cash.id, { status: "COMPLETED" })).status).toBe(400);
    });

    it("garde-fou en base : même une écriture directe ne remet pas un paiement « en attente »", async () => {
        const verified = await payment({ status: "VERIFIED", method: "CASH" });
        await expect(prisma.payment.update({ where: { id: verified.id }, data: { status: "PENDING" } })).rejects.toThrow(/PENDING/);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: verified.id } })).status).toBe("VERIFIED");
    });

    it("paiement sans fournisseur (déclaré au guichet) : toujours modifiable", async () => {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
        const p = await payment({ method: "BANK_TRANSFER" });
        expect((await patch(p.id, { amount: 9000 })).status).toBe(200);
        expect(Number((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).amount)).toBe(9000);
    });
});
