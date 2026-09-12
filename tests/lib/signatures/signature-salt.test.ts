import { describe, expect, it } from "vitest";
import { getSignatureSalt } from "@/lib/signatures/signature";

/**
 * L4 — le hachage des adresses IP des signatures utilisait un sel codé en
 * dur (« edupilot ») quand SIGNATURE_SALT était absent : hachages prévisibles.
 */
describe("getSignatureSalt", () => {
    it("utilise SIGNATURE_SALT quand il est défini", () => {
        expect(getSignatureSalt({ NODE_ENV: "production", SIGNATURE_SALT: "sel-secret" })).toBe("sel-secret");
    });

    it("refuse de hacher en production sans SIGNATURE_SALT", () => {
        expect(() => getSignatureSalt({ NODE_ENV: "production" })).toThrow(/SIGNATURE_SALT/);
        expect(() => getSignatureSalt({ NODE_ENV: "production", SIGNATURE_SALT: "  " })).toThrow(/SIGNATURE_SALT/);
    });

    it("n'utilise plus le sel codé « edupilot », même hors production", () => {
        expect(getSignatureSalt({ NODE_ENV: "development" })).not.toBe("edupilot");
    });
});
