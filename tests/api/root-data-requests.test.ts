import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    dataAccessRequest: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/root/data-requests/route";

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });
const requestId = cuid("dr1");

function requestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId,
    status: "PENDING",
    requestType: "EXPORT",
    requestedAt: new Date("2026-01-01"),
    user: { id: cuid("u1"), firstName: "Awa", lastName: "Dossou", role: "STUDENT", email: "a@b.bj" },
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/root/data-requests", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/root/data-requests"));
    expect(res.status).toBe(401);
  });

  it("refuse un compte non-root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost:3000/api/root/data-requests"));
    expect(res.status).toBe(403);
    expect(prisma.dataAccessRequest.findMany).not.toHaveBeenCalled();
  });

  it("liste uniquement les demandes PENDING", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.dataAccessRequest.findMany).mockResolvedValue([requestRecord()]);

    const res = await GET(makeRequest("http://localhost:3000/api/root/data-requests"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    const where = vi.mocked(prisma.dataAccessRequest.findMany).mock.calls[0][0] as {
      where: { status: string };
    };
    expect(where.where.status).toBe("PENDING");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.dataAccessRequest.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/root/data-requests"));

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/root/data-requests", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/data-requests", {
      method: "PATCH",
      body: { id: requestId, action: "APPROVE" },
    }));
    expect(res.status).toBe(401);
  });

  it("exige id et action valide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/data-requests", {
      method: "PATCH",
      body: { id: requestId, action: "BOGUS" },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("id et action (APPROVE|REJECT) requis");
  });

  it("approuve une demande (APPROVE → COMPLETED)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.dataAccessRequest.update).mockResolvedValue(
      requestRecord({ status: "COMPLETED" })
    );

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/data-requests", {
      method: "PATCH",
      body: { id: requestId, action: "APPROVE" },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("COMPLETED");
    const updateArgs = vi.mocked(prisma.dataAccessRequest.update).mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; completedAt: Date; processedBy: string };
    };
    expect(updateArgs.where.id).toBe(requestId);
    expect(updateArgs.data.status).toBe("COMPLETED");
    expect(updateArgs.data.processedBy).toBe("root1");
  });

  it("rejette une demande (REJECT → REJECTED)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.dataAccessRequest.update).mockResolvedValue(
      requestRecord({ status: "REJECTED" })
    );

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/data-requests", {
      method: "PATCH",
      body: { id: requestId, action: "REJECT" },
    }));

    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.dataAccessRequest.update).mock.calls[0][0] as {
      data: { status: string };
    };
    expect(updateArgs.data.status).toBe("REJECTED");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.dataAccessRequest.update).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/data-requests", {
      method: "PATCH",
      body: { id: requestId, action: "APPROVE" },
    }));

    expect(res.status).toBe(500);
  });
});