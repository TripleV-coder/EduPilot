import { describe, expect, it } from "vitest";
import {
    LONG_SESSION_SECONDS,
    SHORT_SESSION_SECONDS,
    isSessionExpiredByInactivity,
    parseRememberFlag,
    rememberAllowed,
} from "@/lib/auth/session-lifetime";

describe("durée des sessions", () => {
    const now = 1_800_000_000;

    it("24 h sans activité sans la case, 30 jours avec", () => {
        expect(SHORT_SESSION_SECONDS).toBe(86_400);
        expect(LONG_SESSION_SECONDS).toBe(2_592_000);
        expect(isSessionExpiredByInactivity({ remember: false, lastSeenAt: now - SHORT_SESSION_SECONDS }, now)).toBe(false);
        expect(isSessionExpiredByInactivity({ remember: false, lastSeenAt: now - SHORT_SESSION_SECONDS - 1 }, now)).toBe(true);
        expect(isSessionExpiredByInactivity({ remember: true, lastSeenAt: now - 20 * 86_400 }, now)).toBe(false);
    });

    it("jeton émis avant la règle (sans lastSeenAt) : borné par son ancienne expiration", () => {
        expect(isSessionExpiredByInactivity({}, now)).toBe(false);
    });

    it("lit la case telle que l'envoie le formulaire", () => {
        expect(parseRememberFlag("true")).toBe(true);
        expect(parseRememberFlag("on")).toBe(true);
        expect(parseRememberFlag(true)).toBe(true);
        expect(parseRememberFlag("false")).toBe(false);
        expect(parseRememberFlag(undefined)).toBe(false);
    });

    it("jamais de session longue pour le super-administrateur", () => {
        expect(rememberAllowed("SUPER_ADMIN")).toBe(false);
        expect(rememberAllowed("PARENT")).toBe(true);
        expect(rememberAllowed("SCHOOL_ADMIN")).toBe(true);
    });
});
