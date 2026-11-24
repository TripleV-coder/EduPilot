import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { POST as refundRoute } from "@/app/api/payments/[id]/refund/route";
import { DELETE as cancelPayment } from "@/app/api/payments/[id]/route";
import { POST as syncPayments } from "@/app/api/accounting/sync-payments/route";

/**
 * FIN-04 (2026-11-24) — la scolarité relève de la comptabilité : chaque
 * encaissement de frais est passé au journal dans la même transaction, par
 * écart (idempotent). Annulation = contre-passation, remboursement = écriture
 * inverse ; rien n'est modifié ni supprimé dans le journal.
 */
let schoolId: string;
let accountant: Session;
let admin: Session;

async function student() {
    const user = await prisma.user.create({ data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Compta", role: "STUDENT", schoolId } });
    return (await prisma.studentProfile.create({ data: { userId: user.id, schoolId, matricule: uniqueCode("MAT") } })).id;
}
const fee = async () => (await prisma.fee.create({ data: { schoolId, name: `Scolarité ${uniqueCode("F")}`, amount: 100000 } })).id;
const cash = async (studentId: string, feeId: string, amount: number, extra: Record<string, unknown> = {}) => {
    actAs(accountant);
    const res = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount, method: "CASH", ...extra } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return (await prisma.payment.findFirstOrThrow({ where: { studentId, feeId }, orderBy: { createdAt: "desc" } })).id;
};
const entriesOf = (paymentId: string) =>
    prisma.journalEntry.findMany({
        where: { sourcePaymentId: paymentId },
        orderBy: { createdAt: "asc" },
        include: { lines: { include: { debitAccount: true, creditAccount: true } } },
    });
const net = async (paymentId: string) =>
    (await prisma.journalEntry.findMany({ where: { sourcePaymentId: paymentId } })).reduce((s, e) => s + Number(e.sourceAmountFcfa), 0);
const balance = async (code: string) => Number((await prisma.ohadaAccount.findFirstOrThrow({ where: { schoolId, syscohadaCode: code } })).balanceFcfa);

beforeAll(async () => {
    schoolId = (await createSchool("IT-FIN04")).id;
    const acc = await prisma.user.create({ data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "FIN04", role: "ACCOUNTANT", schoolId } });
    accountant = sessionFor("ACCOUNTANT", schoolId, acc.id);
    const dir = await prisma.user.create({ data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "FIN04", role: "SCHOOL_ADMIN", schoolId } });
    admin = sessionFor("SCHOOL_ADMIN", schoolId, dir.id);
});

describe("FIN-04 — encaissements de scolarité au journal", () => {
    it("encaissement en espèces : Débit 57100 Caisse / Crédit 70100 Scolarité, dans la même opération", async () => {
        const s = await student();
        const f = await fee();
        const caisseAvant = (await prisma.ohadaAccount.findFirst({ where: { schoolId, syscohadaCode: "57100" } }))?.balanceFcfa ?? BigInt(0);
        const p = await cash(s, f, 30000);

        const entries = await entriesOf(p);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ status: "POSTED", label: expect.stringContaining("Encaissement") });
        expect(Number(entries[0].sourceAmountFcfa)).toBe(30000);
        expect(entries[0].lines).toHaveLength(1);
        expect(entries[0].lines[0].debitAccount?.syscohadaCode).toBe("57100");
        expect(entries[0].lines[0].creditAccount?.syscohadaCode).toBe("70100");
        expect(await balance("57100")).toBe(Number(caisseAvant) + 30000);
    });

    it("Mobile Money : trésorerie 52200", async () => {
        const s = await student();
        const f = await fee();
        const p = await cash(s, f, 20000, { method: "MOBILE_MONEY_MTN", reference: uniqueCode("MTN") });
        expect((await entriesOf(p))[0].lines[0].debitAccount?.syscohadaCode).toBe("52200");
    });

    it("remboursement : écriture inverse ; annulation d'un paiement validé : contre-passation ; rien n'est supprimé", async () => {
        const s = await student();
        const f = await fee();
        const p = await cash(s, f, 50000);

        actAs(accountant);
        const r = await callRoute(refundRoute, { method: "POST", path: `/api/payments/${p}/refund`, params: { id: p }, body: { amount: 10000, reason: "Départ de l'élève", method: "CASH" } });
        expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
        const refundId = (await prisma.payment.findFirstOrThrow({ where: { refundOfId: p } })).id;
        const refundEntries = await entriesOf(refundId);
        expect(refundEntries).toHaveLength(1);
        expect(refundEntries[0].label).toContain("Remboursement");
        expect(refundEntries[0].lines[0].debitAccount?.syscohadaCode).toBe("70100");
        expect(refundEntries[0].lines[0].creditAccount?.syscohadaCode).toBe("57100");
        expect(await net(refundId)).toBe(-10000);

        // Annuler (direction) le remboursement, puis le paiement : contre-passations, journal net à 0
        actAs(admin);
        expect((await callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${refundId}`, params: { id: refundId } })).status).toBe(200);
        actAs(admin);
        expect((await callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${p}`, params: { id: p } })).status).toBe(200);
        expect(await net(p)).toBe(0);
        expect(await net(refundId)).toBe(0);
        const all = await entriesOf(p);
        expect(all.map((e) => e.label.split(" — ")[0])).toEqual(["Encaissement", "Contre-passation"]);
    });

    it("rattrapage de l'historique : passe les anciens paiements, puis n'écrit plus rien (idempotent)", async () => {
        const s = await student();
        const f = await fee();
        // Paiement antérieur au 2026-11-24 : validé sans écriture
        const old = await prisma.payment.create({ data: { studentId: s, feeId: f, amount: 15000, method: "BANK_TRANSFER", status: "VERIFIED", paidAt: new Date("2026-10-05") } });
        expect(await entriesOf(old.id)).toHaveLength(0);

        actAs(accountant);
        const first = await callRoute(syncPayments, { method: "POST", path: "/api/accounting/sync-payments" });
        expect(first.status).toBe(200);
        expect((first.body as { entries: number }).entries).toBeGreaterThanOrEqual(1);
        const posted = await entriesOf(old.id);
        expect(posted).toHaveLength(1);
        expect(posted[0].lines[0].debitAccount?.syscohadaCode).toBe("52100");
        expect(posted[0].entryDate.toISOString().slice(0, 10)).toBe("2026-10-05");

        actAs(accountant);
        const second = await callRoute(syncPayments, { method: "POST", path: "/api/accounting/sync-payments" });
        expect((second.body as { entries: number }).entries).toBe(0);
    });

    it("équilibre : pour chaque compte, le solde égale débits − crédits des écritures", async () => {
        const accounts = await prisma.ohadaAccount.findMany({ where: { schoolId } });
        for (const account of accounts) {
            const [deb, cred] = await Promise.all([
                prisma.journalEntryLine.aggregate({ where: { debitAccountId: account.id }, _sum: { amountFcfa: true } }),
                prisma.journalEntryLine.aggregate({ where: { creditAccountId: account.id }, _sum: { amountFcfa: true } }),
            ]);
            expect(Number(account.balanceFcfa), account.syscohadaCode).toBe(Number(deb._sum.amountFcfa ?? 0) - Number(cred._sum.amountFcfa ?? 0));
        }
    });

    it("la comptabilité d'une autre école ne peut pas lancer le rattrapage chez celle-ci (école active seulement)", async () => {
        const other = await createSchool("IT-FIN04-B");
        const acc = await prisma.user.create({ data: { email: `${uniqueCode("compta-b")}@integration.test`, password: "x", firstName: "B", lastName: "B", role: "ACCOUNTANT", schoolId: other.id } });
        const before = await prisma.journalEntry.count({ where: { schoolId } });
        actAs(sessionFor("ACCOUNTANT", other.id, acc.id));
        await callRoute(syncPayments, { method: "POST", path: "/api/accounting/sync-payments" });
        expect(await prisma.journalEntry.count({ where: { schoolId } })).toBe(before);
    });
});
