import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as paymentStatus } from "@/app/api/payments/status/route";

/**
 * S4 (2026-10-18) — le retour du navigateur après paiement aboutissait sur une
 * API protégée du personnel. La page de retour lit désormais /api/payments/status,
 * qui ne fait foi que de l'état en base et ne sert que la famille de l'élève
 * ou le personnel de son école.
 */
const ids: Record<string, string> = {};

beforeAll(async () => {
    const schoolId = (await createSchool("IT-S4")).id;
    const otherSchoolId = (await createSchool("IT-S4-X")).id;
    const fee = await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 50000 } });
    const mk = async (key: string, role: "STUDENT" | "PARENT" | "ACCOUNTANT", school = schoolId) => {
        const u = await prisma.user.create({ data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "S4", role, schoolId: school } });
        ids[`${key}User`] = u.id; ids[`${key}School`] = school;
        return u.id;
    };
    for (const key of ["child", "stranger"]) {
        const sp = await prisma.studentProfile.create({ data: { userId: await mk(key, "STUDENT"), matricule: uniqueCode("MAT"), schoolId } });
        ids[key] = sp.id;
    }
    const parent = await prisma.parentProfile.create({ data: { userId: await mk("parent", "PARENT") } });
    await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: ids.child, relationship: "PARENT" } });
    await mk("accountant", "ACCOUNTANT");
    await mk("foreignAccountant", "ACCOUNTANT", otherSchoolId);
    for (const [key, status] of [["pending", "PENDING"], ["verified", "VERIFIED"], ["cancelled", "CANCELLED"]] as const) {
        ids[key] = uniqueCode("PAY");
        await prisma.payment.create({ data: { studentId: ids.child, feeId: fee.id, amount: 10000, method: "MOBILE_MONEY_MTN", status, reference: ids[key], provider: "FEDAPAY" } });
    }
});
const as = (key: string, role: "STUDENT" | "PARENT" | "ACCOUNTANT") => actAs(sessionFor(role, ids[`${key}School`], ids[`${key}User`]));
const get = (ref: string, extra = "") => callRoute(paymentStatus, { path: `/api/payments/status?ref=${encodeURIComponent(ref)}${extra}` });

describe("statut d'un paiement au retour", () => {
    it("parent de l'élève : en attente, confirmé, non abouti — lus en base", async () => {
        as("parent", "PARENT");
        expect((await get(ids.pending)).body).toMatchObject({ status: "PENDING", amount: 10000, feeName: "Scolarité" });
        expect((await get(ids.verified)).body).toMatchObject({ status: "CONFIRMED" });
        expect((await get(ids.cancelled)).body).toMatchObject({ status: "FAILED" });
    });

    it("un statut « success » ajouté dans l'adresse est ignoré", async () => {
        as("parent", "PARENT");
        expect((await get(ids.pending, "&status=success")).body).toMatchObject({ status: "PENDING" });
    });

    it("autre élève, personnel d'une autre école : 404, rien révélé ; référence inexistante : 404", async () => {
        as("stranger", "STUDENT");
        const res = await get(ids.verified);
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain("Scolarité");
        as("foreignAccountant", "ACCOUNTANT");
        expect((await get(ids.verified)).status).toBe(404);
        as("parent", "PARENT");
        expect((await get("PAY-INEXISTANT")).status).toBe(404);
    });

    it("personnel financier de l'école : lisible", async () => {
        as("accountant", "ACCOUNTANT");
        expect((await get(ids.verified)).status).toBe(200);
    });

    it("anonyme : 401", async () => {
        actAs(null);
        expect((await get(ids.verified)).status).toBe(401);
    });
});
