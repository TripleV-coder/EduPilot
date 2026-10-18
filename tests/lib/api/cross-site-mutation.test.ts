import { describe, expect, it } from "vitest";
import { isCrossSiteBrowserMutation } from "@/lib/api/api-helpers";

/** Garde CSRF de createApiHandler (sécurité HTTP, 2026-10-18). */
const req = (method: string, headers: Record<string, string> = {}, url = "http://app.edupilot.test/api/fees") =>
    ({ method, url, headers: new Headers(headers) });

describe("isCrossSiteBrowserMutation", () => {
    it("mutation depuis une origine étrangère : refusée", () => {
        expect(isCrossSiteBrowserMutation(req("POST", { origin: "https://evil.example" }))).toBe(true);
        expect(isCrossSiteBrowserMutation(req("DELETE", { origin: "https://app.edupilot.test.evil.example" }))).toBe(true);
    });

    it("Sec-Fetch-Site cross-site ou Origin « null » : refusée", () => {
        expect(isCrossSiteBrowserMutation(req("PATCH", { "sec-fetch-site": "cross-site" }))).toBe(true);
        expect(isCrossSiteBrowserMutation(req("POST", { origin: "null" }))).toBe(true);
    });

    it("même origine, ou derrière un proxy qui transmet l'hôte public : acceptée", () => {
        expect(isCrossSiteBrowserMutation(req("POST", { origin: "http://app.edupilot.test", "sec-fetch-site": "same-origin" }))).toBe(false);
        expect(isCrossSiteBrowserMutation(req("POST", { origin: "https://ecole.example", "x-forwarded-host": "ecole.example" }, "http://127.0.0.1:3000/api/fees"))).toBe(false);
    });

    it("client sans Origin (non navigateur) et lectures : non concernés", () => {
        expect(isCrossSiteBrowserMutation(req("POST"))).toBe(false);
        expect(isCrossSiteBrowserMutation(req("GET", { origin: "https://evil.example" }))).toBe(false);
    });
});
