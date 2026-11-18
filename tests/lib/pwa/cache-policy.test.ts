import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeCaching } from "serwist";
import { PRIVATE_CACHE_NAMES, purgePrivateCaches, type CacheStorageLike } from "@/lib/pwa/cache-policy";

/**
 * Audit MS-03 : le service worker ne doit conserver que des ressources
 * statiques. `defaultCache` de Serwist est évalué selon NODE_ENV au chargement :
 * on le charge ici en mode production, comme dans le worker compilé.
 */
async function productionRules(): Promise<RuntimeCaching[]> {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const { defaultCache } = await import("@serwist/turbopack/worker");
    const { buildRuntimeCaching } = await import("@/lib/pwa/cache-policy");
    expect(defaultCache.some((r) => (r.handler as { cacheName?: string }).cacheName === "apis")).toBe(true);
    return buildRuntimeCaching(defaultCache);
}

afterEach(() => {
    vi.unstubAllEnvs();
});

const ORIGIN = "https://edupilot.example";

type FakeRequest = { url: string; method: string; mode: string; headers: Headers; destination: string };
function req(path: string, init: Partial<Omit<FakeRequest, "url">> = {}): FakeRequest {
    const url = path.startsWith("http") ? path : ORIGIN + path;
    return { url, method: init.method ?? "GET", mode: init.mode ?? "cors", headers: init.headers ?? new Headers(), destination: init.destination ?? "" };
}

/** Première règle applicable, comme le routeur de Serwist. */
function route(rules: RuntimeCaching[], request: FakeRequest): RuntimeCaching | undefined {
    const url = new URL(request.url);
    const sameOrigin = url.origin === ORIGIN;
    return rules.find((rule) => {
        if ((rule.method ?? "GET") !== request.method) return false;
        const m = rule.matcher;
        if (m instanceof RegExp) return m.test(url.href) && (sameOrigin || url.href.search(m) === 0);
        if (typeof m === "function") return Boolean(m({ url, request: request as unknown as Request, sameOrigin, event: {} as never }));
        return false;
    });
}
const cacheName = (rule: RuntimeCaching | undefined) => (rule?.handler as { cacheName?: string } | undefined)?.cacheName;
const isNetworkOnly = (rule: RuntimeCaching | undefined) => rule?.handler?.constructor?.name === "NetworkOnly";

describe("buildRuntimeCaching (production)", () => {
    it.each([
        ["GET /api/classes", req("/api/classes")],
        ["GET /api/grades?classId=x", req("/api/grades?classId=x")],
        ["pièce jointe /api/uploads/.../photo.png", req("/api/uploads/students/photo.png")],
        ["export /api/finance/export.csv", req("/api/finance/export.csv")],
        ["POST /api/grades/batch", req("/api/grades/batch", { method: "POST" })],
        ["navigation /dashboard", req("/dashboard", { mode: "navigate" })],
        ["flux RSC", req("/dashboard/grades", { headers: new Headers({ RSC: "1" }) })],
        ["prefetch RSC", req("/dashboard/finance", { headers: new Headers({ RSC: "1", "Next-Router-Prefetch": "1" }) })],
        ["image optimisée /_next/image", req("/_next/image?url=%2Fapi%2Fuploads%2Fa.png&w=64&q=75")],
        ["autre origine", req("https://cdn.tiers.example/data.json")],
    ])("%s : réseau seul, jamais en cache", async (_label, request) => {
        const rule = route(await productionRules(), request);
        expect(isNetworkOnly(rule)).toBe(true);
    });

    it.each([
        ["/_next/static/chunks/app.js", "next-static-js-assets"],
        ["/_next/static/css/app.css", "static-style-assets"],
        ["/icons/icon-192.png", "static-image-assets"],
        ["/fonts/inter.woff2", "static-font-assets"],
    ])("ressource statique %s : conservée (%s)", async (path, expected) => {
        expect(cacheName(route(await productionRules(), req(path)))).toBe(expected);
    });

    it("aucune règle conservée ne porte un nom de cache privé", async () => {
        const names = (await productionRules()).map(cacheName).filter(Boolean) as string[];
        for (const privateName of PRIVATE_CACHE_NAMES) expect(names).not.toContain(privateName);
    });
});

describe("purgePrivateCaches", () => {
    function fakeStorage(content: Record<string, string[]>) {
        const store = new Map(Object.entries(content).map(([name, urls]) => [name, new Set(urls)]));
        const storage: CacheStorageLike = {
            keys: async () => [...store.keys()],
            delete: async (name) => store.delete(name),
            open: async (name) => ({
                keys: async () => [...(store.get(name) ?? [])].map((url) => ({ url }) as Request),
                delete: async (request) => store.get(name)?.delete(request.url) ?? false,
            }),
        };
        return { storage, store };
    }

    it("supprime les caches privés hérités et les entrées privées des caches statiques", async () => {
        const { storage, store } = fakeStorage({
            apis: [`${ORIGIN}/api/grades?classId=a`],
            pages: [`${ORIGIN}/dashboard`],
            "pages-rsc": [`${ORIGIN}/dashboard/finance`],
            "static-image-assets": [`${ORIGIN}/icons/icon.png`, `${ORIGIN}/api/uploads/students/photo.png`],
            "next-static-js-assets": [`${ORIGIN}/_next/static/chunks/a.js`],
        });

        const result = await purgePrivateCaches(storage);

        expect(result).toEqual({ caches: 3, entries: 1 });
        expect([...store.keys()].sort()).toEqual(["next-static-js-assets", "static-image-assets"]);
        expect([...store.get("static-image-assets")!]).toEqual([`${ORIGIN}/icons/icon.png`]);
    });

    it("ne touche à rien sans cache privé", async () => {
        const { storage, store } = fakeStorage({ "static-style-assets": [`${ORIGIN}/_next/static/css/a.css`] });
        expect(await purgePrivateCaches(storage)).toEqual({ caches: 0, entries: 0 });
        expect(store.size).toBe(1);
    });
});
