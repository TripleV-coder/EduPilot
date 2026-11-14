// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesures de performance : toujours actives (plus de variable
 * NEXT_PUBLIC_ANALYTICS_ENABLED ni de Sentry), regroupées en UN envoi par
 * page quand elle est masquée ou quittée.
 */
type Callback = (metric: { id: string; name: string; value: number; rating?: string }) => void;
const callbacks: Record<string, Callback> = {};

beforeEach(() => {
    vi.resetModules();
    for (const name of ["onCLS", "onFCP", "onLCP", "onTTFB", "onINP"]) delete callbacks[name];
    vi.doMock("web-vitals", () =>
        Object.fromEntries(["onCLS", "onFCP", "onLCP", "onTTFB", "onINP"].map((name) => [name, (cb: Callback) => (callbacks[name] = cb)])),
    );
});
afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

async function start() {
    const { reportWebVitals } = await import("@/lib/performance/web-vitals");
    reportWebVitals();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function hide() {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("reportWebVitals", () => {
    it("un seul envoi groupé à la sortie de page, avec la dernière valeur de chaque mesure", async () => {
        const beacon = vi.fn().mockReturnValue(true);
        vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });
        await start();
        callbacks.onLCP({ id: "l", name: "LCP", value: 900, rating: "good" });
        callbacks.onCLS({ id: "c", name: "CLS", value: 0.01, rating: "good" });
        callbacks.onCLS({ id: "c", name: "CLS", value: 0.05, rating: "good" });
        expect(beacon).not.toHaveBeenCalled();

        hide();
        expect(beacon).toHaveBeenCalledOnce();
        const [url, blob] = beacon.mock.calls[0] as [string, Blob];
        expect(url).toBe("/api/analytics/web-vitals");
        const body = JSON.parse(await blob.text());
        expect(body.path).toBe(window.location.pathname);
        expect(body.metrics).toEqual([
            { id: "l", name: "LCP", value: 900, rating: "good" },
            { id: "c", name: "CLS", value: 0.05, rating: "good" },
        ]);

        hide(); // rien de nouveau : aucun envoi vide
        expect(beacon).toHaveBeenCalledOnce();
    });

    it("sans sendBeacon : repli sur fetch keepalive", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });
        vi.stubGlobal("fetch", fetchMock);
        await start();
        callbacks.onTTFB({ id: "t", name: "TTFB", value: 120 });
        window.dispatchEvent(new Event("pagehide"));
        expect(fetchMock).toHaveBeenCalledWith("/api/analytics/web-vitals", expect.objectContaining({ method: "POST", keepalive: true }));
    });
});
