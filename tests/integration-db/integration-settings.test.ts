import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import prisma from "./owner-db";
import { actAs, sessionFor, uniqueCode } from "./helpers";
import { GET, PUT } from "@/app/api/root/integrations/route";
import { getIntegrationSetting, loadIntegrationSettings, resetIntegrationSettingsForTests } from "@/lib/system/integration-settings";
import { isSmsProviderConfigured } from "@/lib/notifications/sms-service";
import { whatsAppConfig } from "@/lib/notifications/whatsapp-service";
import { emailEnv, resolveEmailProvider, smtpSettings } from "@/lib/email";
import { POST as testEmail } from "@/app/api/root/integrations/test-email/route";

/**
 * Réglages SMS / voix / WhatsApp saisis dans la console root (2026-11-08),
 * sur une vraie base : chiffrés au repos, lus par les services sans
 * redémarrage, jamais réaffichés, variable d'environnement prioritaire.
 */
let rootId: string;
// Liste root lue au chargement des modules : la session root porte une adresse de cette liste
const ROOT_EMAIL = (process.env.ROOT_USER_EMAILS ?? "").split(",")[0]?.trim() || "root@integration.test";
const NAMES = ["EMAIL_PROVIDER", "EMAIL_API_KEY", "SMTP_URL", "SMTP_HOST", "EMAIL_FROM", "SMS_WEBHOOK_URL", "SMS_API_KEY", "VOICE_WEBHOOK_URL", "VOICE_API_KEY", "WHATSAPP_PHONE_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TEMPLATE_NAME"];

const put = (values: Record<string, string>) =>
    PUT(new NextRequest(new URL("/api/root/integrations", "http://localhost:3000"), { method: "PUT", body: JSON.stringify({ values }), headers: { "content-type": "application/json" } }));

beforeAll(async () => {
    vi.stubEnv("ROOT_USER_EMAILS", "");
    vi.stubEnv("NEXTAUTH_SECRET", "secret-maitre-de-test-integration-0123456789");
    vi.stubEnv("TOTP_ENCRYPTION_KEY", ""); // clé dérivée du secret maître
    for (const name of NAMES) vi.stubEnv(name, "");
    resetIntegrationSettingsForTests();
    const root = await prisma.user.create({ data: { email: `${uniqueCode("root")}@integration.test`, password: "x", firstName: "Root", lastName: "Integ", role: "SUPER_ADMIN" } });
    rootId = root.id;
    const session = sessionFor("SUPER_ADMIN", null, rootId);
    actAs({ ...session, user: { ...session.user, email: ROOT_EMAIL } });
});
afterAll(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: { startsWith: "integration:" } } });
    resetIntegrationSettingsForTests();
    vi.unstubAllEnvs();
});

describe("console root › intégrations", () => {
    it("enregistrés : services configurés aussitôt, secrets chiffrés en base et jamais réaffichés", async () => {
        expect(isSmsProviderConfigured()).toBe(false);

        const res = await put({
            SMS_WEBHOOK_URL: "https://sms.fournisseur.example/send",
            SMS_API_KEY: "cle-sms-tres-secrete-1234",
            WHATSAPP_PHONE_ID: "123456",
            WHATSAPP_ACCESS_TOKEN: "jeton-meta-secret-9876",
            WHATSAPP_TEMPLATE_NAME: "rappel_ecole",
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { settings: { name: string; display: string | null; source: string }[] };
        const shown = Object.fromEntries(body.settings.map((s) => [s.name, s]));
        expect(shown.SMS_API_KEY).toMatchObject({ source: "console", display: "•••• 1234" });
        expect(JSON.stringify(body)).not.toContain("cle-sms-tres-secrete");

        // Services : configurés sans redémarrage
        expect(isSmsProviderConfigured()).toBe(true);
        expect(whatsAppConfig()).toMatchObject({ configured: true, phoneId: "123456", token: "jeton-meta-secret-9876", template: "rappel_ecole", lang: "fr" });

        // Au repos : secret chiffré, adresse en clair
        const stored = await prisma.systemSetting.findUniqueOrThrow({ where: { key: "integration:SMS_API_KEY" } });
        expect(stored.isSecret).toBe(true);
        expect(stored.value).not.toContain("cle-sms");
        expect((await prisma.systemSetting.findUniqueOrThrow({ where: { key: "integration:SMS_WEBHOOK_URL" } })).value).toBe("https://sms.fournisseur.example/send");

        // Un autre processus (instantané relu depuis la base) voit la même chose
        resetIntegrationSettingsForTests();
        await loadIntegrationSettings();
        expect(getIntegrationSetting("SMS_API_KEY")).toBe("cle-sms-tres-secrete-1234");

        // Trace : noms des réglages, jamais les valeurs
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { userId: rootId, action: "INTEGRATION_SETTINGS_UPDATED" } });
        expect(JSON.stringify(audit.newValues)).toContain("SMS_API_KEY");
        expect(JSON.stringify(audit.newValues)).not.toContain("secrete");
    });

    it("variable d'environnement prioritaire ; effacement ; adresse non HTTPS refusée", async () => {
        vi.stubEnv("SMS_WEBHOOK_URL", "https://depuis-env.example/send");
        expect(getIntegrationSetting("SMS_WEBHOOK_URL")).toBe("https://depuis-env.example/send");
        vi.stubEnv("SMS_WEBHOOK_URL", "");

        expect((await put({ SMS_API_KEY: "" })).status).toBe(200);
        expect(getIntegrationSetting("SMS_API_KEY")).toBeUndefined();
        expect(await prisma.systemSetting.count({ where: { key: "integration:SMS_API_KEY" } })).toBe(0);

        const refused = await put({ VOICE_WEBHOOK_URL: "http://passerelle.example/call" });
        expect(refused.status).toBe(400);
        expect(getIntegrationSetting("VOICE_WEBHOOK_URL")).toBeUndefined();
    });

    it("sans clé de chiffrement : 503 explicite, rien d'enregistré", async () => {
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("AUTH_SECRET", "");
        const res = await put({ VOICE_API_KEY: "cle-voix-xyz" });
        expect(res.status).toBe(503);
        expect(await prisma.systemSetting.count({ where: { key: "integration:VOICE_API_KEY" } })).toBe(0);
        vi.stubEnv("NEXTAUTH_SECRET", "secret-maitre-de-test-integration-0123456789");
    });

    it("e-mail réglé dans la console : SMTP_URL chiffrée (mot de passe), utilisée aussitôt, formes contrôlées", async () => {
        expect(resolveEmailProvider()).toBeNull();
        // Sans service : l'essai le dit, sans rien envoyer
        expect((await testEmail()).status).toBe(409);

        expect((await put({ SMTP_URL: "smtps://direction%40ecole.bj:mot%40passe@smtp.ecole.bj", EMAIL_FROM: "EduPilot <noreply@ecole.bj>" })).status).toBe(200);
        expect(resolveEmailProvider()).toBe("smtp");
        expect(smtpSettings()).toEqual({ host: "smtp.ecole.bj", port: 465, secure: true, user: "direction@ecole.bj", pass: "mot@passe" });
        expect(emailEnv().EMAIL_FROM).toBe("EduPilot <noreply@ecole.bj>");
        const stored = await prisma.systemSetting.findUniqueOrThrow({ where: { key: "integration:SMTP_URL" } });
        expect(stored.isSecret).toBe(true);
        expect(stored.value).not.toContain("passe");

        // Clé d'API : fournisseur déduit (re_ → Resend), toujours sans redémarrage
        expect((await put({ SMTP_URL: "", EMAIL_API_KEY: "re_cle_resend_abcd" })).status).toBe(200);
        expect(resolveEmailProvider()).toBe("resend");

        expect((await put({ SMTP_URL: "https://smtp.ecole.bj" })).status).toBe(400);
        expect((await put({ EMAIL_FROM: "pas-une-adresse" })).status).toBe(400);
        expect(emailEnv().EMAIL_FROM).toBe("EduPilot <noreply@ecole.bj>");
        await put({ EMAIL_API_KEY: "", EMAIL_FROM: "" });
    });

    it("réservé au root : direction d'école refusée", async () => {
        const director = await prisma.user.create({ data: { email: `${uniqueCode("dir")}@integration.test`, password: "x", firstName: "Dir", lastName: "X", role: "DIRECTOR" } });
        const session = sessionFor("DIRECTOR", null, director.id);
        actAs({ ...session, user: { ...session.user, email: director.email } });
        expect((await GET()).status).toBe(403);
        expect((await put({ SMS_API_KEY: "intrus" })).status).toBe(403);
        expect((await testEmail()).status).toBe(403);
    });
});
