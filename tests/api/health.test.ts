import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";
import prisma from "@/lib/prisma";
import { storeCircuit } from "@/lib/shared-state/pg";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return status ok when DB is connected", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);

    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(body.cache).toBe("memory");
    expect(body.sharedState).toBe("connected");
  });

  it("signale l'état partagé dégradé quand son coupe-circuit est ouvert (repli mémoire)", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);
    vi.spyOn(storeCircuit, "isOpen").mockReturnValueOnce(true);

    const res = await GET(new Request("http://localhost:3000/api/health"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sharedState).toBe("degraded");
    expect(body.checks.sharedState).toBe("warning");
  });

  it("should return 503 degraded status when DB query fails", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("DB Down"));

    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.database).toBe("disconnected");
  });
});
