import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "@/lib/env";

/**
 * M6 / L4 — la validation de production doit correspondre au fonctionnement réel :
 *  - EMAIL_API_KEY n'a de sens que pour Resend/SendGrid ; en SMTP, c'est
 *    SMTP_HOST qui est indispensable (.env.example disait déjà « not needed
 *    for smtp », mais le démarrage l'exigeait) ;
 *  - SIGNATURE_SALT est obligatoire (repli codé « edupilot » : hachage des IP
 *    des signatures prévisible).
 */
const BASE: Record<string, string> = {
    NODE_ENV: "production",
    SKIP_ENV_VALIDATION: "",
    DATABASE_URL: "postgresql://u:p@db:5432/edupilot",
    NEXTAUTH_SECRET: "s".repeat(44),
    NEXTAUTH_URL: "https://ecole.example",
    TOTP_ENCRYPTION_KEY: "0".repeat(64),
    EMAIL_FROM: "noreply@ecole.example",
    UPSTASH_REDIS_REST_URL: "https://redis.example",
    UPSTASH_REDIS_REST_TOKEN: "jeton",
    EDUPILOT_PEER_TOKEN: "a".repeat(64),
    SIGNATURE_SALT: "b".repeat(32),
};

describe("validateEnv — production", () => {
    beforeEach(() => {
        for (const [name, value] of Object.entries(BASE)) vi.stubEnv(name, value);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("accepte SMTP sans EMAIL_API_KEY quand SMTP_HOST est défini", () => {
        vi.stubEnv("EMAIL_PROVIDER", "smtp");
        vi.stubEnv("EMAIL_API_KEY", "");
        vi.stubEnv("SMTP_HOST", "smtp.ecole.example");
        expect(() => validateEnv()).not.toThrow();
    });

    it("exige SMTP_HOST en SMTP", () => {
        vi.stubEnv("EMAIL_PROVIDER", "smtp");
        vi.stubEnv("EMAIL_API_KEY", "");
        vi.stubEnv("SMTP_HOST", "");
        expect(() => validateEnv()).toThrow(/SMTP_HOST/);
    });

    it("exige EMAIL_API_KEY pour un fournisseur par API", () => {
        vi.stubEnv("EMAIL_PROVIDER", "resend");
        vi.stubEnv("EMAIL_API_KEY", "");
        expect(() => validateEnv()).toThrow(/EMAIL_API_KEY/);
    });

    it("démarre sans Upstash : instance unique, repli mémoire (décision du 2026-09-12)", () => {
        vi.stubEnv("EMAIL_PROVIDER", "resend");
        vi.stubEnv("EMAIL_API_KEY", "cle");
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
        expect(() => validateEnv()).not.toThrow();
    });

    it("exige SIGNATURE_SALT (L4)", () => {
        vi.stubEnv("EMAIL_PROVIDER", "resend");
        vi.stubEnv("EMAIL_API_KEY", "cle");
        vi.stubEnv("SIGNATURE_SALT", "");
        expect(() => validateEnv()).toThrow(/SIGNATURE_SALT/);
    });
});
