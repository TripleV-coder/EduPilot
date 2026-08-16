import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";
import prisma from "@/lib/prisma";
import * as redisModule from "@/lib/cache/redis";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return status ok when DB is connected", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);
    vi.spyOn(redisModule, "getRedisClient").mockReturnValueOnce(null);

    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
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
