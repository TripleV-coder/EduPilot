import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * H4 — la connexion NextAuth (`/api/auth/callback/credentials`) n'avait
 * aucune limite par IP : 12 échecs → 12×302, 0×429.
 *
 * On limite les ÉCHECS par IP, pas les tentatives : une école derrière une
 * seule adresse publique (NAT) ou des mobiles derrière le NAT de l'opérateur
 * partagent la même IP, et des dizaines de connexions réussies à la rentrée
 * ne doivent jamais être refusées.
 */

const { authPostMock } = vi.hoisted(() => ({ authPostMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({
    GET: vi.fn(),
    POST: (...args: unknown[]) => authPostMock(...args),
}));

import { POST } from "@/app/api/auth/[...nextauth]/route";

const TOKEN = "f".repeat(64);
const LOGIN_URL = "http://localhost:3000/api/auth/callback/credentials";

let ipCounter = 0;
function freshIp(): string {
    ipCounter += 1;
    return `198.51.100.${ipCounter}`;
}

// tests/setup.ts remplace NextRequest par un vi.fn() : on passe une Request
// native, que le handler reçoit en production sous la même forme.
function loginRequest(ip: string): NextRequest {
    return new Request(LOGIN_URL, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-auth-return-redirect": "1",
            "x-forwarded-for": ip,
            "x-edupilot-peer-token": TOKEN,
        },
        body: "email=eleve%40ecole.bj&password=mauvais",
    }) as unknown as NextRequest;
}

function failedLogin(): Response {
    return Response.json({ url: "http://localhost:3000/login?error=CredentialsSignin&code=credentials" });
}

function successfulLogin(): Response {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", "authjs.session-token=eyJ; Path=/; HttpOnly; SameSite=Lax");
    return new Response(JSON.stringify({ url: "http://localhost:3000/dashboard" }), { headers });
}

async function statusesFor(ip: string, attempts: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < attempts; i++) {
        statuses.push((await POST(loginRequest(ip))).status);
    }
    return statuses;
}

describe("rate-limit des échecs de connexion", () => {
    beforeEach(() => {
        process.env.EDUPILOT_PEER_TOKEN = TOKEN;
        authPostMock.mockReset();
    });

    it("12 échecs depuis la même IP produisent au moins un 429", async () => {
        authPostMock.mockImplementation(async () => failedLogin());
        const statuses = await statusesFor(freshIp(), 12);

        expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
        expect(statuses).toContain(429);
    });

    it("une IP bloquée n'atteint plus la vérification des identifiants", async () => {
        authPostMock.mockImplementation(async () => failedLogin());
        const ip = freshIp();
        await statusesFor(ip, 10);
        authPostMock.mockClear();

        const blocked = await POST(loginRequest(ip));

        expect(blocked.status).toBe(429);
        expect(blocked.headers.get("Retry-After")).toMatch(/^\d+$/);
        expect(authPostMock).not.toHaveBeenCalled();
    });

    it("le refus reste lisible par next-auth/react (url porteuse de l'erreur)", async () => {
        authPostMock.mockImplementation(async () => failedLogin());
        const ip = freshIp();
        await statusesFor(ip, 10);

        const body = await (await POST(loginRequest(ip))).json();

        expect(new URL(body.url).searchParams.get("error")).toBe("RateLimited");
    });

    it("des connexions réussies depuis une IP partagée ne sont jamais refusées", async () => {
        authPostMock.mockImplementation(async () => successfulLogin());
        const statuses = await statusesFor(freshIp(), 30);

        expect(statuses.every((s) => s === 200)).toBe(true);
    });

    it("une panne technique ne consomme pas la limite (M10)", async () => {
        // Base injoignable : tout le monde échoue, mais personne ne doit rester
        // bloqué 15 min une fois la base revenue.
        authPostMock.mockImplementation(async () =>
            Response.json({ url: "http://localhost:3000/login?error=CredentialsSignin&code=service_unavailable" })
        );
        const statuses = await statusesFor(freshIp(), 15);

        expect(statuses.every((s) => s === 200)).toBe(true);
    });

    it("les échecs d'une IP ne bloquent pas une autre IP", async () => {
        authPostMock.mockImplementation(async () => failedLogin());
        await statusesFor(freshIp(), 12);

        expect((await POST(loginRequest(freshIp()))).status).toBe(200);
    });
});
