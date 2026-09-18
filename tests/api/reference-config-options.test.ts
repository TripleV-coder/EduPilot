import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    configOption: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/reference/config-options/route";

const SCHOOL = cuid("schoola");

function create(body: Record<string, unknown>) {
  return POST(
    makeRequest("http://localhost:3000/api/reference/config-options", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const VALID = { category: "RELATIONSHIP_TYPE", code: "TUTEUR", label: "Tuteur", schoolId: SCHOOL };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/reference/config-options", () => {
  // Toute session authentifiée pouvait créer des options pour son école
  it.each(["STUDENT", "PARENT", "TEACHER", "ACCOUNTANT"])("refuse le rôle %s (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: SCHOOL }) as never);

    expect((await create(VALID)).status).toBe(403);
    expect(prisma.configOption.create).not.toHaveBeenCalled();
  });

  it("rejette un corps invalide (400) au lieu d'une erreur serveur", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);

    const res = await create({ category: "RELATIONSHIP_TYPE", code: { $gt: "" }, label: "x" });

    expect(res.status).toBe(400);
    expect(prisma.configOption.create).not.toHaveBeenCalled();
  });

  it("crée l'option pour l'école d'un administrateur (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.configOption.create).mockResolvedValue({ id: cuid("opt"), ...VALID } as never);

    const res = await create(VALID);

    expect(res.status).toBe(201);
    expect(prisma.configOption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "TUTEUR", schoolId: SCHOOL }),
    });
  });

  it("réserve les options globales au SUPER_ADMIN (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);

    const res = await create({ ...VALID, schoolId: undefined });

    expect(res.status).toBe(403);
  });
});
