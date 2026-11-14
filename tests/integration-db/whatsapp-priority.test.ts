import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "./owner-db";
import { callRoute, createSchool } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { queueFamilyMessages } from "@/lib/notifications/family-channel";
import { JOB_HANDLERS } from "@/lib/jobs/handlers";
import { resolveSecret } from "@/lib/security/derived-secrets";
import * as webhook from "@/app/api/whatsapp/webhook/route";

/**
 * WhatsApp canal principal, SMS en secours (2026-11-14), sur PostgreSQL réel.
 * Meta et la passerelle SMS sont simulés (fetch) ; file d'envoi, journal des
 * communications, webhook signé et secours SMS sont les vrais.
 */
const APP_SECRET = "secret-app-meta-de-test";
const ENV: Record<string, string> = {
    NEXTAUTH_SECRET: "secret-maitre-de-test-whatsapp-0123456789",
    WHATSAPP_PHONE_ID: "123456",
    WHATSAPP_ACCESS_TOKEN: "jeton-meta",
    WHATSAPP_TEMPLATE_NAME: "annonce_ecole",
    WHATSAPP_TEMPLATE_ATTENDANCE: "absence_eleve",
    WHATSAPP_APP_SECRET: APP_SECRET,
    SMS_WEBHOOK_URL: "https://sms.fournisseur.example/send",
};
let schoolId: string;

const sign = (body: string) => `sha256=${createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")}`;
const statusEvent = (id: string, status: string, code?: number) =>
    JSON.stringify({
        entry: [{ changes: [{ value: { statuses: [{ id, status, ...(code ? { errors: [{ code, title: "Message undeliverable" }] } : {}) }] } }] }],
    });
const deliver = (raw: string, signature = sign(raw)) =>
    callRoute(webhook.POST, { method: "POST", path: "/api/whatsapp/webhook", rawBody: raw, headers: { "x-hub-signature-256": signature } });
const jobsOf = (type: string) => prisma.backgroundJob.findMany({ where: { schoolId, type }, orderBy: { createdAt: "asc" } });

/** Exécute les tâches WhatsApp en attente (Meta simulé par fetch). */
async function runWhatsAppJobs() {
    for (const job of await jobsOf("whatsapp.send")) {
        await runAsSystem("test", () => JOB_HANDLERS["whatsapp.send"](job.payload as never));
        await prisma.backgroundJob.delete({ where: { id: job.id } });
    }
}

beforeAll(async () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    schoolId = (await createSchool("wa")).id;
});
beforeEach(async () => {
    await prisma.backgroundJob.deleteMany({ where: { schoolId } });
    await prisma.communicationLog.deleteMany({ where: { schoolId } });
    let counter = 0;
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: `wamid.${++counter}` }] }), { status: 200 })),
    );
});
afterAll(async () => {
    await prisma.backgroundJob.deleteMany({ where: { schoolId } });
    await prisma.communicationLog.deleteMany({ where: { schoolId } });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("WhatsApp prioritaire, SMS en secours", () => {
    it("WhatsApp configuré : tout part par WhatsApp, avec le modèle du type, sans SMS", async () => {
        const result = await runAsSystem("test", () =>
            queueFamilyMessages([
                { phone: "0197000001", message: "Awa absente\nle 13/11", kind: "ATTENDANCE", schoolId, smsFallback: false },
                { phone: "+229 01 97 00 00 02", message: "Réunion jeudi", kind: "CUSTOM", schoolId, smsFallback: true },
            ]),
        );
        expect(result).toEqual({ whatsapp: 2, sms: 0, skipped: 0 });
        expect(await jobsOf("sms.send")).toHaveLength(0);
        const logs = await prisma.communicationLog.findMany({ where: { schoolId }, orderBy: { recipient: "asc" } });
        expect(logs.map((l) => [l.recipient, l.status, l.channel])).toEqual([
            ["2290197000001", "QUEUED", "WHATSAPP"],
            ["2290197000002", "QUEUED", "WHATSAPP"],
        ]);

        await runWhatsAppJobs();
        const calls = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
        const absence = calls.find((c) => c.to === "2290197000001");
        // Modèle propre aux absences ; paramètre sans retour à la ligne (règle Meta)
        expect(absence.template.name).toBe("absence_eleve");
        expect(absence.template.components[0].parameters[0].text).toBe("Awa absente · le 13/11");
        expect(calls.find((c) => c.to === "2290197000002").template.name).toBe("annonce_ecole");
        const sent = await prisma.communicationLog.findMany({ where: { schoolId } });
        expect(sent.every((l) => l.status === "SENT" && l.externalId?.startsWith("wamid."))).toBe(true);
        // Métadonnées conservées (texte et numéro nécessaires au secours)
        expect(sent.find((l) => l.recipient === "2290197000002")?.metadata).toMatchObject({ smsFallback: true, text: "Réunion jeudi" });
    });

    it("statuts signés : livré puis lu, jamais de recul ; échec sans secours permis → pas de SMS", async () => {
        await runAsSystem("test", () =>
            queueFamilyMessages([
                { phone: "0197000001", message: "A", kind: "CUSTOM", schoolId, smsFallback: true },
                { phone: "0197000002", message: "B", kind: "CUSTOM", schoolId, smsFallback: false },
            ]),
        );
        await runWhatsAppJobs();
        const [a, b] = await prisma.communicationLog.findMany({ where: { schoolId }, orderBy: { recipient: "asc" } });

        expect((await deliver(statusEvent(a.externalId!, "delivered"))).status).toBe(200);
        expect((await deliver(statusEvent(a.externalId!, "read"))).status).toBe(200);
        await deliver(statusEvent(a.externalId!, "delivered")); // arrivé en retard
        expect((await prisma.communicationLog.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("READ");

        // b n'a pas WhatsApp ; pas de secours (le parent a un compte EduPilot)
        const failed = await deliver(statusEvent(b.externalId!, "failed", 131026));
        expect(failed.body).toMatchObject({ updated: 1, fallbacks: 0 });
        const bAfter = await prisma.communicationLog.findUniqueOrThrow({ where: { id: b.id } });
        expect(bAfter.status).toBe("FAILED");
        expect(bAfter.error).toContain("131026");
        expect(await jobsOf("sms.send")).toHaveLength(0);
    });

    it("échec signalé pour un responsable sans compte → SMS de secours, une seule fois même si Meta rejoue", async () => {
        await runAsSystem("test", () =>
            queueFamilyMessages([{ phone: "0197000003", message: "Paiement dû", kind: "PAYMENT", schoolId, smsFallback: true }]),
        );
        await runWhatsAppJobs();
        const log = await prisma.communicationLog.findFirstOrThrow({ where: { schoolId } });
        const event = statusEvent(log.externalId!, "failed", 131026);
        expect((await deliver(event)).body).toMatchObject({ fallbacks: 1 });
        expect((await deliver(event)).body).toMatchObject({ fallbacks: 0 });
        const sms = await jobsOf("sms.send");
        expect(sms).toHaveLength(1);
        expect(sms[0].payload).toMatchObject({ phoneNumber: "0197000003", message: "Paiement dû", smsType: "PAYMENT", schoolId });
        expect((await prisma.communicationLog.findUniqueOrThrow({ where: { id: log.id } })).metadata).toMatchObject({ fallback: "SMS" });
    });

    it("refus immédiat de Meta (4xx) → SMS de secours tout de suite", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":132001}}', { status: 400 })));
        await runAsSystem("test", () =>
            queueFamilyMessages([{ phone: "0197000004", message: "Convocation", kind: "REMINDER", schoolId, smsFallback: true }]),
        );
        await runWhatsAppJobs();
        expect((await prisma.communicationLog.findFirstOrThrow({ where: { schoolId } })).status).toBe("FAILED");
        expect(await jobsOf("sms.send")).toHaveLength(1);
    });

    it("WhatsApp non configuré : SMS direct seulement là où il est permis", async () => {
        vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
        try {
            const result = await runAsSystem("test", () =>
                queueFamilyMessages([
                    { phone: "0197000005", message: "X", kind: "CUSTOM", schoolId, smsFallback: true },
                    { phone: "0197000006", message: "Y", kind: "CUSTOM", schoolId, smsFallback: false },
                ]),
            );
            expect(result).toEqual({ whatsapp: 0, sms: 1, skipped: 1 });
            expect(await prisma.communicationLog.count({ where: { schoolId } })).toBe(0);
        } finally {
            vi.stubEnv("WHATSAPP_ACCESS_TOKEN", ENV.WHATSAPP_ACCESS_TOKEN);
        }
    });

    it("webhook : signature fausse refusée, clé d'application absente refusée, validation par jeton", async () => {
        const raw = statusEvent("wamid.inconnu", "failed", 131026);
        expect((await deliver(raw, "sha256=" + "0".repeat(64))).status).toBe(401);
        expect((await deliver(raw, "")).status).toBe(401);

        vi.stubEnv("WHATSAPP_APP_SECRET", "");
        expect((await deliver(raw)).status).toBe(503);
        vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);

        const token = resolveSecret("whatsapp-verify")!;
        const ok = await callRoute(webhook.GET, { path: `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42` });
        expect(ok).toEqual({ status: 200, body: 42 });
        const ko = await callRoute(webhook.GET, { path: "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=42" });
        expect(ko.status).toBe(403);
    });
});
