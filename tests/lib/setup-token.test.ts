import { describe, it, expect } from "vitest";
import { MIN_SETUP_TOKEN_LENGTH, setupTokenMatches, setupTokenPolicy } from "@/lib/auth/setup-token";

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

    it("comparaison exacte, espaces de saisie ignorés, refus de tout le reste", () => {
        expect(setupTokenMatches(strong, strong)).toBe(true);
        expect(setupTokenMatches(`  ${strong}\n`, strong)).toBe(true);
        expect(setupTokenMatches(`${strong}b`, strong)).toBe(false);
        expect(setupTokenMatches("", strong)).toBe(false);
        expect(setupTokenMatches(undefined, strong)).toBe(false);
        expect(setupTokenMatches({ toString: () => strong }, strong)).toBe(false);
    });
});
