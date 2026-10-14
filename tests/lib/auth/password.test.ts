import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Capacité 2026-10-01 (G2) : hachage natif dans le pool libuv, borné pour
 * laisser des threads à `crypto.subtle` (sessions Auth.js), `fs` et `zlib`.
 */
const state = vi.hoisted(() => ({ active: 0, peak: 0, release: [] as Array<() => void> }));

vi.mock("bcrypt", () => {
    const track = <T>(value: T) =>
        new Promise<T>((resolve) => {
            state.active += 1;
            state.peak = Math.max(state.peak, state.active);
            state.release.push(() => {
                state.active -= 1;
                resolve(value);
            });
        });
    return {
        default: {
            compare: vi.fn((plain: string, hashed: string) => {
                if (hashed === "malformée") return Promise.reject(new Error("Invalid salt"));
                return track(plain === "bon");
            }),
            hash: vi.fn(() => track("$2b$12$empreinte")),
        },
    };
});

import { compare, hash, PASSWORD_HASH_ROUNDS } from "@/lib/auth/password";

async function drain() {
    while (state.release.length > 0 || state.active > 0) {
        state.release.shift()?.();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

afterEach(async () => {
    await drain();
    state.peak = 0;
    vi.unstubAllEnvs();
});

describe("lib/auth/password", () => {
    it("vérifie et hache via bcrypt natif, au coût 12 par défaut", async () => {
        const verdict = compare("bon", "$2b$12$x");
        const digest = hash("secret");
        await drain();
        expect(await verdict).toBe(true);
        expect(await digest).toBe("$2b$12$empreinte");
        expect(PASSWORD_HASH_ROUNDS).toBe(12);
    });

    it("une empreinte vide ou mal formée donne false, jamais une exception", async () => {
        expect(await compare("bon", "")).toBe(false);
        expect(await compare("bon", "malformée")).toBe(false);
    });

    it("laisse toujours deux threads du pool libres pendant une rafale de connexions", async () => {
        vi.stubEnv("UV_THREADPOOL_SIZE", "4");
        const results = Array.from({ length: 30 }, () => compare("bon", "$2b$12$x"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(state.active).toBe(2);

        await drain();
        expect((await Promise.all(results)).every(Boolean)).toBe(true);
        expect(state.peak).toBe(2);
    });
});
