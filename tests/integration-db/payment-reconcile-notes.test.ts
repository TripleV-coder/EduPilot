import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as reconcile } from "@/app/api/payments/reconcile/route";

/**
 * Lot 3e (audit paiements, P-09) — le rapprochement REMPLAÇAIT les notes du
 * paiement : la trace « Trop-perçu de … FCFA à traiter » ou « À rapprocher »
 * écrite par la confirmation en ligne disparaissait. La note de
 * rapprochement s'ajoute désormais aux précédentes.
 */
let schoolId: string;
let studentId: string;
let feeId: string;
let accountant: Session;

const TROP_PERCU = "Confirmé par webhook MOMO. Trop-perçu de 5000 FCFA à traiter.";
async function verifiedPayment(notes: string | null = TROP_PERCU, amount = 25000) {
    return prisma.payment.create({
        data: { studentId, feeId, amount, method: "MOBILE_MONEY_MTN", status: "VERIFIED", paidAt: new Date(), notes, reference: uniqueCode("PAY") },
    });
}
const post = (body: Record<string, unknown>) => callRoute(reconcile, { method: "POST", path: "/api/payments/reconcile", body });
const occurrences = (text: string, part: string) => text.split(part).length - 1;

beforeAll(async () => {
    schoolId = (await createSchool("IT-RECO")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Reco", role: "STUDENT", schoolId },
    });
    studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    feeId = (await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 100000 } })).id;
    const acc = await prisma.user.create({
        data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "Reco", role: "ACCOUNTANT", schoolId },
    });
    accountant = sessionFor("ACCOUNTANT", schoolId, acc.id);
});

describe("Rapprochement : notes conservées", () => {
    it("par identifiant : la note de trop-perçu subsiste, la note de rapprochement s'ajoute après", async () => {
        actAs(accountant);
        const p = await verifiedPayment();
        const res = await post({ paymentIds: [p.id], notes: "Relevé bancaire n° 12" });
        expect(res.status).toBe(200);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(after.status).toBe("RECONCILED");
        expect(after.notes).toBe(`${TROP_PERCU}\nRelevé bancaire n° 12`);
        // Autres champs : auteur et date posés, montant inchangé
        expect(after.reconciledBy).toBe(accountant.user.id);
        expect(after.reconciledAt).not.toBeNull();
        expect(Number(after.amount)).toBe(25000);
    });

    it("sans note fournie : mention datée ajoutée ; paiement sans note : seule la mention", async () => {
        actAs(accountant);
        const withNote = await verifiedPayment("À rapprocher (webhook MOMO) : montant reçu 24000.");
        const without = await verifiedPayment(null);
        expect((await post({ paymentIds: [withNote.id, without.id] })).status).toBe(200);
        const a = (await prisma.payment.findUniqueOrThrow({ where: { id: withNote.id } })).notes!;
        const b = (await prisma.payment.findUniqueOrThrow({ where: { id: without.id } })).notes!;
        expect(a.startsWith("À rapprocher (webhook MOMO) : montant reçu 24000.\nRéconcilié le ")).toBe(true);
        expect(b.startsWith("Réconcilié le ")).toBe(true);
    });

    it("en masse : chaque paiement garde ses notes", async () => {
        actAs(accountant);
        const p1 = await verifiedPayment(TROP_PERCU);
        const p2 = await verifiedPayment("Encaissé au guichet.");
        const res = await post({ reconcileAllVerified: true });
        expect(res.status).toBe(200);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p1.id } })).notes).toBe(`${TROP_PERCU}\nRéconciliation en masse`);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p2.id } })).notes).toBe("Encaissé au guichet.\nRéconciliation en masse");
    });

    it("répétition : refusée par identifiant, sans effet en masse, aucune note en double", async () => {
        actAs(accountant);
        const p = await verifiedPayment();
        await post({ paymentIds: [p.id], notes: "Relevé n° 13" });
        const again = await post({ paymentIds: [p.id], notes: "Relevé n° 13" });
        expect(again.status).toBe(400);
        const mass = await post({ reconcileAllVerified: true });
        expect(mass.status).toBe(200);
        const notes = (await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).notes!;
        expect(occurrences(notes, "Relevé n° 13")).toBe(1);
        expect(notes).not.toContain("Réconciliation en masse");
    });

    it("deux rapprochements simultanés du même paiement : traité une seule fois, une seule note", async () => {
        actAs(accountant);
        const p = await verifiedPayment();
        const results = await Promise.all([
            post({ paymentIds: [p.id], notes: "Relevé simultané" }),
            post({ paymentIds: [p.id], notes: "Relevé simultané" }),
        ]);
        expect(results.every((r) => r.status === 200 || r.status === 400)).toBe(true);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(after.status).toBe("RECONCILED");
        expect(occurrences(after.notes!, "Relevé simultané")).toBe(1);
        expect(after.notes!.startsWith(TROP_PERCU)).toBe(true);
    });

    it("identifiant inconnu : refus explicite, aucun paiement modifié", async () => {
        actAs(accountant);
        const p = await verifiedPayment();
        const res = await post({ paymentIds: [p.id, "cpaiementinexistant000000"] });
        expect(res.status).toBe(404);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        expect(after.status).toBe("VERIFIED");
        expect(after.notes).toBe(TROP_PERCU);
    });
});
