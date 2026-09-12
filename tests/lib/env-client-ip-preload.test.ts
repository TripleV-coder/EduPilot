import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "@/lib/env";

/**
 * H3 — sans le préchargement `client-ip-preload.cjs`, toutes les requêtes
 * partagent l'IP `unknown` : un seul client peut alors épuiser la limite de
 * tout le monde. En production, le serveur refuse donc de démarrer sans lui.
 */
const PRODUCTION_ENV: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://edupilot:edupilot@db:5432/edupilot",
    NEXTAUTH_SECRET: "s".repeat(44),
    NEXTAUTH_URL: "https://ecole.example",
    TOTP_ENCRYPTION_KEY: "0".repeat(64),
    EMAIL_PROVIDER: "smtp",
    EMAIL_API_KEY: "cle",
    SMTP_HOST: "smtp.ecole.example",
    SIGNATURE_SALT: "b".repeat(32),
    EMAIL_FROM: "noreply@ecole.example",
    UPSTASH_REDIS_REST_URL: "https://redis.example",
    UPSTASH_REDIS_REST_TOKEN: "jeton",
    SKIP_ENV_VALIDATION: "",
};

describe("validateEnv — préchargement de l'IP client", () => {
    beforeEach(() => {
        for (const [name, value] of Object.entries(PRODUCTION_ENV)) vi.stubEnv(name, value);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("refuse de démarrer en production sans le préchargement", () => {
        vi.stubEnv("EDUPILOT_PEER_TOKEN", "");
        expect(() => validateEnv()).toThrow(/client-ip-preload/);
    });

    it("démarre en production avec le préchargement", () => {
        vi.stubEnv("EDUPILOT_PEER_TOKEN", "a".repeat(64));
        expect(() => validateEnv()).not.toThrow();
    });
});
