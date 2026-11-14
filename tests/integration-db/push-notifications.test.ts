import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { sendNotificationMock } = vi.hoisted(() => ({ sendNotificationMock: vi.fn() }));
// Aucun appel réseau : le service push des navigateurs est simulé
vi.mock("web-push", () => ({ default: { sendNotification: sendNotificationMock }, sendNotification: sendNotificationMock }));

import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import appDb from "@/lib/prisma";
import { runWithDbContext, tenantContext } from "@/lib/db/db-context";
import { registerPushDispatch } from "@/lib/push/dispatch";
import { JOB_HANDLERS } from "@/lib/jobs/handlers";
import * as subscriptionRoute from "@/app/api/push/subscription/route";
import * as testRoute from "@/app/api/push/test/route";

/**
 * Lot F — notifications push web, sur PostgreSQL réel : abonnement de
 * l'appareil, toute notification créée par l'application part en file vers
 * les appareils abonnés, envoi, nettoyage des abonnements expirés.
 */
const VAPID = {
    VAPID_PUBLIC_KEY: "test-public-key",
    VAPID_PRIVATE_KEY: "test-private-key",
    VAPID_SUBJECT: "mailto:support@edupilot.bj",
};
const saved: Record<string, string | undefined> = {};
let schoolId: string;
let parentId: string;
let otherId: string;
let release: () => void;

const endpoint = (suffix: string) => `https://fcm.googleapis.com/fcm/send/${suffix}`;
const subscription = (suffix: string) => ({ endpoint: endpoint(suffix), keys: { p256dh: `B${"x".repeat(86)}`, auth: "a".repeat(22) } });

async function waitForJob(userId: string) {
    for (let i = 0; i < 40; i += 1) {
        const jobs = await ownerDb.backgroundJob.findMany({ where: { type: "push.send", status: "PENDING" }, orderBy: { createdAt: "desc" } });
        const job = jobs.find((j) => (j.payload as { items: { userId: string }[] }).items.some((item) => item.userId === userId));
        if (job) return job;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
}

beforeAll(async () => {
    for (const [key, value] of Object.entries(VAPID)) {
        saved[key] = process.env[key];
        process.env[key] = value;
    }
    schoolId = (await createSchool("IT-PUSH")).id;
    const mk = (who: string) =>
        ownerDb.user.create({ data: { email: `${uniqueCode(who)}@integration.test`, password: "x", firstName: who, lastName: "Push", role: "PARENT", schoolId } });
    parentId = (await mk("parent")).id;
    otherId = (await mk("autre")).id;
    release = registerPushDispatch();
}, 120_000);

afterAll(() => {
    release?.();
    for (const key of Object.keys(VAPID)) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

describe("abonnement de l'appareil", () => {
    it("donne la clé publique, enregistre l'appareil, refuse une adresse hors services push", async () => {
        actAs(sessionFor("PARENT", schoolId, parentId));
        const state = await callRoute(subscriptionRoute.GET!, { path: "/api/push/subscription" });
        expect(state.body).toEqual({ configured: true, publicKey: VAPID.VAPID_PUBLIC_KEY, devices: 0 });

        const created = await callRoute(subscriptionRoute.POST!, { method: "POST", path: "/api/push/subscription", body: subscription("parent-phone") });
        expect(created.status).toBe(201);
        expect(await ownerDb.pushSubscription.count({ where: { userId: parentId } })).toBe(1);

        const ssrf = await callRoute(subscriptionRoute.POST!, {
            method: "POST",
            path: "/api/push/subscription",
            body: { ...subscription("x"), endpoint: "https://169.254.169.254/latest/meta-data" },
        });
        expect(ssrf.status).toBe(400);
    });

    it("un compte ne retire pas l'appareil d'un autre ; un navigateur sert le dernier compte qui l'active", async () => {
        actAs(sessionFor("PARENT", schoolId, otherId));
        const foreign = await callRoute(subscriptionRoute.DELETE!, { method: "DELETE", path: "/api/push/subscription", body: { endpoint: endpoint("parent-phone") } });
        expect((foreign.body as { removed: number }).removed).toBe(0);

        await callRoute(subscriptionRoute.POST!, { method: "POST", path: "/api/push/subscription", body: subscription("shared-pc") });
        actAs(sessionFor("PARENT", schoolId, parentId));
        await callRoute(subscriptionRoute.POST!, { method: "POST", path: "/api/push/subscription", body: subscription("shared-pc") });
        const shared = await ownerDb.pushSubscription.findUniqueOrThrow({ where: { endpoint: endpoint("shared-pc") } });
        expect(shared.userId).toBe(parentId);
    });
});

describe("toute notification de l'application part en push", () => {
    it("création par le client de l'application → tâche en file → envoi aux appareils du destinataire", async () => {
        sendNotificationMock.mockReset().mockResolvedValue({ statusCode: 201 });
        await runWithDbContext(tenantContext([schoolId]), () =>
            appDb.notification.create({
                data: { userId: parentId, type: "ATTENDANCE", title: "Absence", message: "Kofi est absent ce matin.", link: "/dashboard/attendance" },
            }),
        );

        const job = await waitForJob(parentId);
        expect(job).not.toBeNull();
        await JOB_HANDLERS["push.send"](job!.payload as never);

        // 2 appareils du parent (téléphone + ordinateur partagé)
        expect(sendNotificationMock).toHaveBeenCalledTimes(2);
        const payload = JSON.parse(sendNotificationMock.mock.calls[0][1]);
        expect(payload).toEqual({ title: "Absence", body: "Kofi est absent ce matin.", url: "/dashboard/attendance" });
        const phone = await ownerDb.pushSubscription.findUniqueOrThrow({ where: { endpoint: endpoint("parent-phone") } });
        expect(phone.lastSuccessAt).not.toBeNull();
    });

    it("pas d'appareil abonné : aucune tâche", async () => {
        const lonely = await ownerDb.user.create({
            data: { email: `${uniqueCode("seul")}@integration.test`, password: "x", firstName: "Seul", lastName: "Push", role: "PARENT", schoolId },
        });
        await runWithDbContext(tenantContext([schoolId]), () =>
            appDb.notification.createMany({ data: [{ userId: lonely.id, type: "INFO", title: "Info", message: "Texte" }] }),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(await waitForJob(lonely.id)).toBeNull();
    });

    it("appareil expiré (410) : abonnement supprimé ; compte désactivé : rien n'est envoyé", async () => {
        sendNotificationMock.mockReset().mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));
        await JOB_HANDLERS["push.send"]({ items: [{ userId: parentId, title: "T", body: "B", link: null, notificationId: null }] });
        expect(await ownerDb.pushSubscription.count({ where: { userId: parentId } })).toBe(0);

        actAs(sessionFor("PARENT", schoolId, otherId));
        await callRoute(subscriptionRoute.POST!, { method: "POST", path: "/api/push/subscription", body: subscription("other-phone") });
        await ownerDb.user.update({ where: { id: otherId }, data: { isActive: false } });
        sendNotificationMock.mockReset().mockResolvedValue({ statusCode: 201 });
        await JOB_HANDLERS["push.send"]({ items: [{ userId: otherId, title: "T", body: "B", link: null, notificationId: null }] });
        expect(sendNotificationMock).not.toHaveBeenCalled();
        await ownerDb.user.update({ where: { id: otherId }, data: { isActive: true } });
    });

    it("notification d'essai depuis les réglages", async () => {
        sendNotificationMock.mockReset().mockResolvedValue({ statusCode: 201 });
        actAs(sessionFor("PARENT", schoolId, otherId));
        const res = await callRoute(testRoute.POST!, { method: "POST", path: "/api/push/test" });
        expect(res.status).toBe(200);
        expect((res.body as { sent: number }).sent).toBe(1);

        const removed = await callRoute(subscriptionRoute.DELETE!, { method: "DELETE", path: "/api/push/subscription", body: { endpoint: endpoint("other-phone") } });
        expect((removed.body as { removed: number }).removed).toBe(1);
        const none = await callRoute(testRoute.POST!, { method: "POST", path: "/api/push/test" });
        expect(none.status).toBe(409);
    });
});
