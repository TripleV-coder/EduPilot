import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotificationMock } = vi.hoisted(() => ({ sendNotificationMock: vi.fn() }));
vi.mock("web-push", () => ({ default: { sendNotification: sendNotificationMock }, sendNotification: sendNotificationMock }));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { isAllowedPushEndpoint, pushSubscriptionSchema } from "@/lib/push/endpoint";
import { buildPushMessage, itemsFromNotificationWrite, safeAppPath, NOTIFICATIONS_PAGE, type PushItem } from "@/lib/push/message";
import { derivedVapidKeys, pushConfig } from "@/lib/push/config";
import { sendPushToSubscription } from "@/lib/push/deliver";

const KEYS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.VAPID_PUBLIC_KEY = "BPub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:support@edupilot.bj";
    sendNotificationMock.mockReset();
});
afterEach(() => {
    for (const key of KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

describe("adresse d'abonnement : services push des navigateurs seulement (anti-SSRF)", () => {
    it.each([
        "https://fcm.googleapis.com/fcm/send/abc:def",
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
        "https://web.push.apple.com/QGuQ",
        "https://wns2-par02p.notify.windows.com/w/?token=x",
    ])("accepte %s", (endpoint) => {
        expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    });

    it.each([
        "http://fcm.googleapis.com/fcm/send/abc",
        "https://fcm.googleapis.com:8443/fcm/send/abc",
        "https://169.254.169.254/latest/meta-data",
        "https://localhost/api",
        "https://evil.example/fcm.googleapis.com",
        "https://fcm.googleapis.com.evil.example/x",
        "https://user:pass@fcm.googleapis.com/x",
        "pas une adresse",
    ])("refuse %s", (endpoint) => {
        expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    });

    it("valide la forme d'un abonnement de navigateur", () => {
        const ok = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };
        expect(pushSubscriptionSchema.safeParse(ok).success).toBe(true);
        expect(pushSubscriptionSchema.safeParse({ ...ok, endpoint: "https://10.0.0.1/x" }).success).toBe(false);
        expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: "x", auth: "y" } }).success).toBe(false);
    });
});

describe("contenu des notifications push", () => {
    const item = (over: Partial<PushItem> = {}): PushItem => ({ userId: "u1", title: "Absence", body: "Kofi absent ce matin", link: "/dashboard/attendance", notificationId: "n1", ...over });

    it("une notification : son titre, son texte et son lien", () => {
        expect(buildPushMessage([item()])).toEqual({ title: "Absence", body: "Kofi absent ce matin", url: "/dashboard/attendance" });
    });

    it("plusieurs à la fois : un seul résumé vers le centre de notifications", () => {
        const message = buildPushMessage([item({ title: "Note publiée" }), item(), item()]);
        expect(message).toMatchObject({ title: "EduPilot", url: NOTIFICATIONS_PAGE, tag: "edupilot-summary" });
        expect(message?.body).toContain("3 nouvelles notifications");
    });

    it("tronque les textes longs, n'ouvre jamais une adresse extérieure", () => {
        const long = buildPushMessage([item({ body: "x".repeat(500) })]);
        expect(long?.body.length).toBeLessThanOrEqual(200);
        expect(safeAppPath("https://phishing.example")).toBe(NOTIFICATIONS_PAGE);
        expect(safeAppPath("//phishing.example")).toBe(NOTIFICATIONS_PAGE);
        expect(safeAppPath(null)).toBe(NOTIFICATIONS_PAGE);
        expect(safeAppPath("/dashboard/grades")).toBe("/dashboard/grades");
    });

    it("extrait les notifications d'une création unitaire ou groupée", () => {
        expect(itemsFromNotificationWrite("create", { data: { userId: "u1", title: "T", message: "M", link: "/x" } }, { id: "n9" })).toEqual([
            { userId: "u1", title: "T", body: "M", link: "/x", notificationId: "n9" },
        ]);
        // relation « user: { connect } » plutôt que userId
        expect(itemsFromNotificationWrite("create", { data: { user: { connect: { id: "u2" } }, title: "T", message: "M" } }, { id: "n1" })[0].userId).toBe("u2");
        const many = itemsFromNotificationWrite("createMany", { data: [{ userId: "a", title: "T", message: "M" }, { userId: "b", title: "T", message: "M" }] }, { count: 2 });
        expect(many.map((i) => [i.userId, i.notificationId])).toEqual([["a", null], ["b", null]]);
        const returned = itemsFromNotificationWrite("createManyAndReturn", { data: [{ userId: "a", title: "T", message: "M" }] }, [{ id: "n5" }]);
        expect(returned[0].notificationId).toBe("n5");
        // données incomplètes : ignorées
        expect(itemsFromNotificationWrite("createMany", { data: [{ title: "sans destinataire" }] }, { count: 1 })).toEqual([]);
    });
});

describe("configuration et envoi", () => {
    it("exige les deux clés et un sujet mailto: ou https://", () => {
        expect(pushConfig().configured).toBe(true);
        process.env.VAPID_SUBJECT = "support@edupilot.bj";
        expect(pushConfig().configured).toBe(false);
        delete process.env.VAPID_PRIVATE_KEY;
        process.env.VAPID_SUBJECT = "mailto:support@edupilot.bj";
        expect(pushConfig().configured).toBe(false);
    });

    it("sans variable VAPID : paire dérivée du secret maître, contact = adresse publique HTTPS", () => {
        for (const key of KEYS) delete process.env[key];
        vi.stubEnv("NEXTAUTH_SECRET", "m".repeat(40));
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
        vi.stubEnv("NEXTAUTH_URL", "https://ecole.example");
        const cfg = pushConfig();
        expect(cfg).toMatchObject({ configured: true, subject: "https://ecole.example", ...derivedVapidKeys("m".repeat(40)) });
        // Adresse non HTTPS (développement) : push désactivé, jamais un contact invalide
        vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
        expect(pushConfig().configured).toBe(false);
        // Paire explicite : toujours prioritaire (abonnements existants)
        process.env.VAPID_PUBLIC_KEY = "BPub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:support@edupilot.bj";
        expect(pushConfig()).toMatchObject({ configured: true, publicKey: "BPub", privateKey: "priv" });
        vi.unstubAllEnvs();
    });

    const sub = { id: "s1", userId: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "p", auth: "a" };
    const message = { title: "T", body: "B", url: "/dashboard" };

    it("envoie le message chiffré avec les clés VAPID", async () => {
        sendNotificationMock.mockResolvedValue({ statusCode: 201 });
        expect(await sendPushToSubscription(sub, message)).toBe("sent");
        const [target, payload, options] = sendNotificationMock.mock.calls[0];
        expect(target).toEqual({ endpoint: sub.endpoint, keys: { p256dh: "p", auth: "a" } });
        expect(JSON.parse(payload)).toEqual(message);
        expect(options.vapidDetails).toEqual({ subject: "mailto:support@edupilot.bj", publicKey: "BPub", privateKey: "priv" });
    });

    it("abonnement expiré (410/404) : à supprimer ; autre refus : échec compté", async () => {
        sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
        expect(await sendPushToSubscription(sub, message)).toBe("gone");
        sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Server"), { statusCode: 500 }));
        expect(await sendPushToSubscription(sub, message)).toBe("failed");
    });

    it("n'appelle jamais une adresse hors services push", async () => {
        expect(await sendPushToSubscription({ ...sub, endpoint: "https://10.0.0.1/x" }, message)).toBe("gone");
        expect(sendNotificationMock).not.toHaveBeenCalled();
    });
});
