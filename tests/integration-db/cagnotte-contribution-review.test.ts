import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as contribute } from "@/app/api/cagnottes/[cagnotteId]/contributions/route";
import { PATCH as review } from "@/app/api/cagnottes/[cagnotteId]/contributions/[contributionId]/route";
import { GET as detail } from "@/app/api/cagnottes/[cagnotteId]/route";

/**
 * TD-019 : une contribution déclarée par une famille ne compte qu'après
 * vérification par le comptable ou la direction. Avant, elle était inscrite
 * « payée » au journal sans aucun contrôle.
 */
const ids: Record<string, string> = {};

async function makeUser(role: "PARENT" | "ACCOUNTANT" | "TEACHER", schoolId: string) {
    return prisma.user.create({
        data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "Test", role, schoolId },
    });
}

beforeAll(async () => {
    ids.school = (await createSchool("IT-CAG")).id;
    ids.other = (await createSchool("IT-CAG-B")).id;
    ids.parent = (await makeUser("PARENT", ids.school)).id;
    ids.accountant = (await makeUser("ACCOUNTANT", ids.school)).id;
    ids.otherAccountant = (await makeUser("ACCOUNTANT", ids.other)).id;
    ids.cagnotte = (
        await prisma.cagnotte.create({
            data: { schoolId: ids.school, title: "Sortie à Ouidah", targetFcfa: BigInt(150_000), deadline: new Date(Date.now() + 10 * 86_400_000) },
        })
    ).id;
});

const declare = (amountFcfa: number, paymentRef?: string) => {
    actAs(sessionFor("PARENT", ids.school, ids.parent));
    return callRoute(contribute, {
        method: "POST",
        path: `/api/cagnottes/${ids.cagnotte}/contributions`,
        params: { cagnotteId: ids.cagnotte },
        body: { amountFcfa, paymentRef },
    });
};

const decide = (contributionId: string, body: unknown, as: { role: "ACCOUNTANT" | "PARENT"; school: string; user: string }) => {
    actAs(sessionFor(as.role, as.school, as.user));
    return callRoute(review, {
        method: "PATCH",
        path: `/api/cagnottes/${ids.cagnotte}/contributions/${contributionId}`,
        params: { cagnotteId: ids.cagnotte, contributionId },
        body,
    });
};

const raised = async () => {
    actAs(sessionFor("ACCOUNTANT", ids.school, ids.accountant));
    const res = await callRoute(detail, { path: `/api/cagnottes/${ids.cagnotte}`, params: { cagnotteId: ids.cagnotte } });
    return res.body as { raisedFcfa: string; pendingCount: number; participantCount: number };
};

describe("Cagnotte : contributions validées par l'école (TD-019)", () => {
    it("une déclaration de parent est en attente et hors du total", async () => {
        const res = await declare(20_000, "MP-2611-001");
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ status: "PENDING" });
        ids.c1 = (res.body as { id: string }).id;
        const journal = await prisma.cagnotteJournalEntry.findMany({ where: { cagnotteId: ids.cagnotte } });
        expect(journal.map((j) => j.kind)).toEqual(["CONTRIBUTION_DECLARED"]);
        expect(await raised()).toMatchObject({ raisedFcfa: "0", pendingCount: 1, participantCount: 0 });
    });

    it("un parent ne peut pas valider (403) ; un comptable d'une autre école ne la trouve pas (404)", async () => {
        expect((await decide(ids.c1, { decision: "CONFIRM" }, { role: "PARENT", school: ids.school, user: ids.parent })).status).toBe(403);
        expect((await decide(ids.c1, { decision: "CONFIRM" }, { role: "ACCOUNTANT", school: ids.other, user: ids.otherAccountant })).status).toBe(404);
        expect((await prisma.cagnotteContribution.findUniqueOrThrow({ where: { id: ids.c1 } })).status).toBe("PENDING");
    });

    it("le comptable confirme : comptée, tracée, famille notifiée ; une seconde décision est refusée (409)", async () => {
        const accountant = { role: "ACCOUNTANT" as const, school: ids.school, user: ids.accountant };
        const [first, second] = await Promise.all([
            decide(ids.c1, { decision: "CONFIRM" }, accountant),
            decide(ids.c1, { decision: "CONFIRM" }, accountant),
        ]);
        expect([first.status, second.status].sort()).toEqual([200, 409]);

        const row = await prisma.cagnotteContribution.findUniqueOrThrow({ where: { id: ids.c1 } });
        expect(row).toMatchObject({ status: "CONFIRMED", reviewedById: ids.accountant });
        expect(await prisma.cagnotteJournalEntry.count({ where: { cagnotteId: ids.cagnotte, kind: "CONTRIBUTION_PAID" } })).toBe(1);
        expect(await prisma.notification.count({ where: { userId: ids.parent, title: "Contribution confirmée" } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { entityId: ids.c1, action: "CAGNOTTE_CONTRIBUTION_CONFIRM" } })).toBe(1);
        expect(await raised()).toMatchObject({ raisedFcfa: "20000", pendingCount: 0, participantCount: 1 });
    });

    it("un rejet exige un motif, ne compte pas et le motif parvient à la famille", async () => {
        const res = await declare(50_000);
        const id = (res.body as { id: string }).id;
        const accountant = { role: "ACCOUNTANT" as const, school: ids.school, user: ids.accountant };
        expect((await decide(id, { decision: "REJECT" }, accountant)).status).toBe(400);
        expect((await decide(id, { decision: "REJECT", note: "Aucune somme reçue à ce nom" }, accountant)).status).toBe(200);
        expect((await prisma.cagnotteContribution.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
        const notif = await prisma.notification.findFirstOrThrow({ where: { userId: ids.parent, title: "Contribution non validée" } });
        expect(notif.message).toContain("Aucune somme reçue à ce nom");
        expect(await raised()).toMatchObject({ raisedFcfa: "20000", pendingCount: 0 });
    });

    it("le comptable qui encaisse au guichet pour une famille enregistre une contribution confirmée", async () => {
        actAs(sessionFor("ACCOUNTANT", ids.school, ids.accountant));
        const missingParent = await callRoute(contribute, {
            method: "POST",
            path: `/api/cagnottes/${ids.cagnotte}/contributions`,
            params: { cagnotteId: ids.cagnotte },
            body: { amountFcfa: 5_000 },
        });
        expect(missingParent.status).toBe(400);

        const res = await callRoute(contribute, {
            method: "POST",
            path: `/api/cagnottes/${ids.cagnotte}/contributions`,
            params: { cagnotteId: ids.cagnotte },
            body: { amountFcfa: 5_000, parentUserId: ids.parent },
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ status: "CONFIRMED" });
        expect(await raised()).toMatchObject({ raisedFcfa: "25000" });
    });
});
