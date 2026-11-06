import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toInternationalDigits } from "@/lib/notifications/phone";
import { sendWhatsAppText, whatsAppConfig } from "@/lib/notifications/whatsapp-service";
import { isVoiceGatewayConfigured, sendVoiceCall } from "@/lib/notifications/voice-service";

describe("toInternationalDigits — numéros du Bénin (10 chiffres depuis 2024)", () => {
    it("complète un ancien numéro à 8 chiffres par 01 et l'indicatif 229", () => {
        expect(toInternationalDigits("97 00 00 00")).toBe("2290197000000");
        expect(toInternationalDigits("+229 97000000")).toBe("2290197000000");
    });
    it("garde un numéro déjà au format 10 chiffres", () => {
        expect(toInternationalDigits("01 97 00 00 00")).toBe("2290197000000");
        expect(toInternationalDigits("+229 01 97 00 00 00")).toBe("2290197000000");
        expect(toInternationalDigits("00229 0197000000")).toBe("2290197000000");
    });
    it("accepte un numéro étranger complet, refuse l'illisible", () => {
        expect(toInternationalDigits("+33 6 12 34 56 78")).toBe("33612345678");
        expect(toInternationalDigits("97-ab-00")).toBeNull();
        expect(toInternationalDigits("1234")).toBeNull();
        expect(toInternationalDigits(null)).toBeNull();
    });
});

const ENV_KEYS = ["WHATSAPP_PHONE_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TEMPLATE_NAME", "WHATSAPP_TEMPLATE_LANG", "VOICE_WEBHOOK_URL", "VOICE_API_KEY"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
});
afterEach(() => {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
    vi.unstubAllGlobals();
});

describe("WhatsApp (API Meta Cloud)", () => {
    it("non configuré : échec définitif, aucun appel réseau", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        expect(whatsAppConfig().configured).toBe(false);
        const result = await sendWhatsAppText("2290197000000", "Bonjour");
        expect(result).toMatchObject({ success: false, permanent: true });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("envoie le texte comme paramètre {{1}} du modèle approuvé", async () => {
        process.env.WHATSAPP_PHONE_ID = "123";
        process.env.WHATSAPP_ACCESS_TOKEN = "tok";
        process.env.WHATSAPP_TEMPLATE_NAME = "annonce_ecole";
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await sendWhatsAppText("2290197000000", "Réunion jeudi 17 h");
        expect(result).toEqual({ success: true, messageId: "wamid.1" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://graph.facebook.com/v21.0/123/messages");
        expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
        const body = JSON.parse(String((init as RequestInit).body));
        expect(body).toMatchObject({
            messaging_product: "whatsapp",
            to: "2290197000000",
            type: "template",
            template: { name: "annonce_ecole", language: { code: "fr" } },
        });
        expect(body.template.components[0].parameters[0]).toEqual({ type: "text", text: "Réunion jeudi 17 h" });
    });

    it("refus 4xx (numéro non WhatsApp) : définitif ; 429 : nouvel essai", async () => {
        process.env.WHATSAPP_PHONE_ID = "123";
        process.env.WHATSAPP_ACCESS_TOKEN = "tok";
        process.env.WHATSAPP_TEMPLATE_NAME = "annonce_ecole";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("bad number", { status: 400 })).mockResolvedValueOnce(new Response("slow down", { status: 429 })));
        expect(await sendWhatsAppText("2290197000000", "x")).toMatchObject({ success: false, permanent: true });
        expect(await sendWhatsAppText("2290197000000", "x")).toMatchObject({ success: false, permanent: false });
    });
});

describe("passerelle vocale", () => {
    it("non configurée : échec définitif", async () => {
        expect(isVoiceGatewayConfigured()).toBe(false);
        expect(await sendVoiceCall({ to: "2290197000000", lang: "FON", text: "x", campaignId: "c1" })).toMatchObject({ success: false, permanent: true });
    });

    it("transmet l'appel à la passerelle avec la clé", async () => {
        process.env.VOICE_WEBHOOK_URL = "https://voix.example.bj/calls";
        process.env.VOICE_API_KEY = "cle";
        const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
        vi.stubGlobal("fetch", fetchMock);
        const result = await sendVoiceCall({ to: "2290197000000", lang: "FON", text: "Réunion", audioUrl: null, campaignId: "c1" });
        expect(result).toEqual({ success: true });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://voix.example.bj/calls");
        expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer cle" });
        expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ to: "2290197000000", lang: "FON", campaignId: "c1" });
    });
});
