import { describe, it, expect, vi } from "vitest";
import { MIN_SETUP_TOKEN_LENGTH, logPendingSetup, setupTokenMatches, setupTokenPolicy } from "@/lib/auth/setup-token";
import { derivedSecretHex } from "@/lib/security/derived-secrets";

const strong = "a".repeat(MIN_SETUP_TOKEN_LENGTH);

describe("jeton d'installation", () => {
    it("production sans jeton : installation verrouillée (jamais ouverte par défaut)", () => {
        expect(setupTokenPolicy({ NODE_ENV: "production" })).toMatchObject({ mode: "locked" });
        expect(setupTokenPolicy({ NODE_ENV: "production", INITIAL_SETUP_TOKEN: "court" })).toMatchObject({ mode: "locked" });
    });

    it("production avec un jeton suffisant : exigé", () => {
        expect(setupTokenPolicy({ NODE_ENV: "production", INITIAL_SETUP_TOKEN: ` ${strong} ` })).toEqual({ mode: "required", expected: strong });
    });

    it("développement : facultatif, sauf s'il est défini", () => {
        expect(setupTokenPolicy({ NODE_ENV: "development" })).toEqual({ mode: "optional" });
        expect(setupTokenPolicy({ NODE_ENV: "test", INITIAL_SETUP_TOKEN: "dev" })).toEqual({ mode: "required", expected: "dev" });
    });

    it("production sans variable : jeton dérivé du secret maître (plus de variable à définir)", () => {
        const env = { NODE_ENV: "production", NEXTAUTH_SECRET: "m".repeat(40) };
        const derived = derivedSecretHex("setup", env);
        expect(setupTokenPolicy(env)).toEqual({ mode: "required", expected: derived });
        // une variable explicite reste prioritaire
        expect(setupTokenPolicy({ ...env, INITIAL_SETUP_TOKEN: strong })).toEqual({ mode: "required", expected: strong });
    });

    it("journal de démarrage : jeton donné seulement si la base n'a aucun compte et sans variable explicite", async () => {
        const env = { NODE_ENV: "production", NEXTAUTH_SECRET: "m".repeat(40) };
        const log = vi.fn();
        await logPendingSetup(async () => 0, log, env);
        expect(log).toHaveBeenCalledWith(expect.stringContaining(derivedSecretHex("setup", env)!));
        log.mockClear();
        await logPendingSetup(async () => 1, log, env);
        await logPendingSetup(async () => 0, log, { ...env, INITIAL_SETUP_TOKEN: strong });
        await logPendingSetup(async () => 0, log, { NODE_ENV: "development" });
        expect(log).not.toHaveBeenCalled();
    });

    it("comparaison exacte, espaces de saisie ignorés, refus de tout le reste", () => {
        expect(setupTokenMatches(strong, strong)).toBe(true);
        expect(setupTokenMatches(`  ${strong}\n`, strong)).toBe(true);
        expect(setupTokenMatches(`${strong}b`, strong)).toBe(false);
        expect(setupTokenMatches("", strong)).toBe(false);
        expect(setupTokenMatches(undefined, strong)).toBe(false);
        expect(setupTokenMatches({ toString: () => strong }, strong)).toBe(false);
    });
});
