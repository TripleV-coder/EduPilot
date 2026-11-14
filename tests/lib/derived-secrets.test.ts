/**
 * .env minimal : secrets dérivés de NEXTAUTH_SECRET, adresse IP sur les
 * plateformes sans serveur, fournisseur d'e-mail déduit.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { derivedSecretHex, masterSecret, resolveSecret, secretSource } from "@/lib/security/derived-secrets";
import { getClientIp } from "@/lib/security/client-ip";
import { resolveEmailProvider } from "@/lib/email";
import { isServerlessPlatform, publicBaseUrl } from "@/lib/system/platform";

const MASTER = "un-secret-maitre-de-test-assez-long-0123456789";

describe("secrets dérivés", () => {
    it("une clé distincte et stable par usage, de 32 octets", () => {
        const env = { NEXTAUTH_SECRET: MASTER };
        const totp = derivedSecretHex("totp-encryption", env);
        expect(totp).toMatch(/^[0-9a-f]{64}$/);
        expect(derivedSecretHex("totp-encryption", env)).toBe(totp);
        const all = new Set(["totp-encryption", "signature-salt", "payment-secrets", "cron"].map((p) => derivedSecretHex(p as never, env)));
        expect(all.size).toBe(4);
    });

    it("la variable explicite reste prioritaire (installations existantes inchangées)", () => {
        const env = { NEXTAUTH_SECRET: MASTER, TOTP_ENCRYPTION_KEY: "ab".repeat(32) };
        expect(resolveSecret("totp-encryption", env)).toBe("ab".repeat(32));
        expect(secretSource("totp-encryption", env)).toBe("explicit");
        expect(secretSource("cron", env)).toBe("derived");
    });

    it("sans secret maître valable : rien n'est dérivé", () => {
        expect(masterSecret({ NEXTAUTH_SECRET: "court" })).toBeNull();
        expect(resolveSecret("cron", {})).toBeNull();
        expect(secretSource("cron", {})).toBe("missing");
    });

    it("le script de rotation calcule exactement les mêmes valeurs", () => {
        const output = execFileSync(process.execPath, ["scripts/secrets/print-derived.mjs"], {
            env: { PATH: process.env.PATH, NEXTAUTH_SECRET: MASTER, CRON_SECRET: "deja-defini" },
            encoding: "utf8",
        });
        expect(output).toContain(`TOTP_ENCRYPTION_KEY=${derivedSecretHex("totp-encryption", { NEXTAUTH_SECRET: MASTER })}`);
        expect(output).toContain(`PAYMENT_SECRETS_KEY=${derivedSecretHex("payment-secrets", { NEXTAUTH_SECRET: MASTER })}`);
        expect(output).not.toContain("CRON_SECRET="); // déjà définie : elle prime, rien à figer
    });
});

describe("adresse IP sans préchargement (plateformes sans serveur)", () => {
    const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

    it("Vercel : x-real-ip posé par la plateforme, jamais l'X-Forwarded-For du client", () => {
        const h = headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6" });
        expect(getClientIp(h, { VERCEL: "1" })).toBe("203.0.113.7");
        expect(getClientIp(headers({ "x-vercel-forwarded-for": "198.51.100.2, 10.0.0.1" }), { VERCEL: "1" })).toBe("198.51.100.2");
        expect(getClientIp(headers({}), { VERCEL: "1" })).toBe("unknown");
    });

    it("hors plateforme, sans jeton du préchargement : aucun en-tête n'est cru", () => {
        expect(getClientIp(headers({ "x-real-ip": "203.0.113.7" }), {})).toBe("unknown");
    });
});

describe("e-mail et plateforme", () => {
    it("déduit le fournisseur de la clé ou de SMTP_HOST", () => {
        expect(resolveEmailProvider({ EMAIL_API_KEY: "re_123" })).toBe("resend");
        expect(resolveEmailProvider({ EMAIL_API_KEY: "SG.abc" })).toBe("sendgrid");
        expect(resolveEmailProvider({ SMTP_HOST: "smtp.ecole.bj" })).toBe("smtp");
        expect(resolveEmailProvider({ EMAIL_PROVIDER: "smtp", EMAIL_API_KEY: "re_123" })).toBe("smtp");
        expect(resolveEmailProvider({})).toBeNull();
    });

    it("reconnaît la plateforme et son adresse publique", () => {
        expect(isServerlessPlatform({ VERCEL: "1" })).toBe(true);
        expect(isServerlessPlatform({})).toBe(false);
        expect(publicBaseUrl({ VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "ecole.vercel.app" })).toBe("https://ecole.vercel.app");
        expect(publicBaseUrl({ NEXTAUTH_URL: "https://app.ecole.bj/", VERCEL_URL: "x.vercel.app" })).toBe("https://app.ecole.bj");
        // Liens envoyés aux familles : l'adresse publique passe avant NEXTAUTH_URL (adresse parfois interne)
        expect(publicBaseUrl({ NEXTAUTH_URL: "http://localhost:3000", NEXT_PUBLIC_APP_URL: "https://ecole.bj" })).toBe("https://ecole.bj");
    });
});
