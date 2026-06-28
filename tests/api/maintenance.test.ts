import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/require-root", () => ({ requireRoot: vi.fn(() => null) }));
vi.mock("@/lib/prisma", () => ({
    default: { systemSetting: { findMany: vi.fn(), upsert: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/root/system/maintenance/route";
import { createApiHandler } from "@/lib/api/api-helpers";
import {
    invalidateMaintenanceCache,
    DEFAULT_MAINTENANCE_MESSAGE,
    MAINTENANCE_ENABLED_KEY,
    MAINTENANCE_MESSAGE_KEY,
} from "@/lib/system/maintenance";

beforeEach(() => {
    vi.clearAllMocks();
    invalidateMaintenanceCache();
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }) as never);
    vi.mocked(prisma.systemSetting.upsert).mockResolvedValue({} as never);
});

describe("GET /api/root/system/maintenance", () => {
    it("retourne l'état et le message par défaut", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toEqual({ enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE });
    });
});

describe("POST /api/root/system/maintenance", () => {
    it("active la maintenance et persiste le message personnalisé", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
            { key: MAINTENANCE_MESSAGE_KEY, value: "Migration en cours" },
        ] as never);
        const res = await POST(
            makeRequest("http://localhost:3000/api/root/system/maintenance", {
                method: "POST",
                body: { enabled: true, message: "Migration en cours" },
            })
        );
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.enabled).toBe(true);
        expect(body.message).toBe("Migration en cours");
        // upsert appelé pour le flag ET le message.
        expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(2);
        const messageCall = vi.mocked(prisma.systemSetting.upsert).mock.calls.find(
            ([arg]) => (arg as { where: { key: string } }).where.key === MAINTENANCE_MESSAGE_KEY
        );
        expect(messageCall).toBeTruthy();
    });

    it("ne touche pas au message quand il n'est pas fourni", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
        await POST(
            makeRequest("http://localhost:3000/api/root/system/maintenance", {
                method: "POST",
                body: { enabled: false },
            })
        );
        expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1);
    });
});

describe("createApiHandler — enforcement maintenance", () => {
    const handler = createApiHandler(
        async () => Response.json({ ok: true }),
        { allowedRoles: ["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN"] }
    );

    it("renvoie 503 MAINTENANCE pour un rôle non-SUPER_ADMIN", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
            { key: MAINTENANCE_MESSAGE_KEY, value: "Indisponible temporairement" },
        ] as never);
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as never);

        const res = await handler(makeRequest("http://localhost:3000/api/x"));
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.code).toBe("MAINTENANCE");
        expect(body.error).toBe("Indisponible temporairement");
        expect(res.headers.get("Retry-After")).toBe("120");
    });

    it("laisse passer SUPER_ADMIN même en maintenance", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
        ] as never);
        vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }) as never);

        const res = await handler(makeRequest("http://localhost:3000/api/x"));
        expect(res.status).toBe(200);
    });

    it("laisse passer les rôles normaux quand la maintenance est inactive", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as never);

        const res = await handler(makeRequest("http://localhost:3000/api/x"));
        expect(res.status).toBe(200);
    });
});
