// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchError, defaultHttpErrorMessage, httpStatusOf, isPermanentHttpError } from "@/lib/http-error";
import { fetcher } from "@/lib/fetcher";
import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY, persistTheme, readStoredTheme } from "@/lib/theme";

beforeEach(() => {
    // jsdom n'implémente pas matchMedia : préférence système « clair »
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
});

describe("FetchError et code HTTP", () => {
    it("garde le code et distingue les erreurs définitives", () => {
        const denied = new FetchError(403, "Accès refusé");
        expect(httpStatusOf(denied)).toBe(403);
        expect(isPermanentHttpError(denied)).toBe(true);
        expect(isPermanentHttpError(new FetchError(404, "x"))).toBe(true);
        // Délai dépassé, trop de demandes, panne : un nouvel essai a un sens
        expect(isPermanentHttpError(new FetchError(408, "x"))).toBe(false);
        expect(isPermanentHttpError(new FetchError(429, "x"))).toBe(false);
        expect(isPermanentHttpError(new FetchError(503, "x"))).toBe(false);
        expect(isPermanentHttpError(new Error("réseau"))).toBe(false);
        expect(httpStatusOf("texte")).toBeNull();
    });

    it("donne un message français par défaut", () => {
        expect(defaultHttpErrorMessage(403)).toMatch(/pas accès/);
        expect(defaultHttpErrorMessage(404)).toMatch(/introuvable/i);
        expect(defaultHttpErrorMessage(401)).toMatch(/session/i);
    });
});

describe("fetcher", () => {
    it("lève une FetchError portant le code et le message du serveur", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Élève non rattaché" }), { status: 403 })));
        const err = await fetcher("/api/students/x").catch((e: unknown) => e);
        expect(err).toBeInstanceOf(FetchError);
        expect((err as FetchError).status).toBe(403);
        expect((err as FetchError).message).toBe("Élève non rattaché");
    });

    it("réponse non JSON : message français du code HTTP", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 404 })));
        const err = (await fetcher("/api/x").catch((e: unknown) => e)) as FetchError;
        expect(err.status).toBe(404);
        expect(err.message).toBe(defaultHttpErrorMessage(404));
    });
});

describe("thème", () => {
    function runBootScript() {
        // Exécuté tel qu'injecté dans le <head> du layout racine
        new Function(THEME_BOOT_SCRIPT)();
    }

    it("le script de démarrage applique le thème sombre mémorisé", () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
        runBootScript();
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("le script de démarrage laisse le thème clair mémorisé", () => {
        document.documentElement.classList.add("dark");
        window.localStorage.setItem(THEME_STORAGE_KEY, "light");
        runBootScript();
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("persistTheme mémorise le choix pour le prochain chargement", () => {
        persistTheme("dark");
        expect(readStoredTheme()).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        window.localStorage.setItem(THEME_STORAGE_KEY, "n'importe quoi");
        expect(readStoredTheme()).toBeNull();
    });
});

describe("THEME_BOOT_SCRIPT — clé écrite en littéral", () => {
    it("utilise exactement THEME_STORAGE_KEY, sans interpolation", () => {
        expect(THEME_BOOT_SCRIPT).toContain(`var k="${THEME_STORAGE_KEY}";`);
    });
});
