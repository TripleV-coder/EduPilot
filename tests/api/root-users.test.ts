import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/root/users/route";

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });
const userId = cuid("u1");

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    email: "admin@a.bj",
    firstName: "Awa",
    lastName: "Dossou",
    role: "SCHOOL_ADMIN",
    roles: [],
    isActive: true,
    schoolId: FIXTURES.schoolA,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    school: { id: FIXTURES.schoolA, name: "École A", code: "A-01" },
    _count: { sessions: 3 },
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/root/users", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/root/users"));
    expect(res.status).toBe(401);
  });

  it("refuse un compte non-root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost:3000/api/root/users"));
    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("liste les admins avec sessionCount (paginé)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findMany).mockResolvedValue([userRecord()]);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/root/users"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].sessionCount).toBe(3);
    expect(body.data[0]._count).toBeUndefined();
    expect(body.pagination.total).toBe(1);
    expect(body.pagination.limit).toBe(20);
    const where = vi.mocked(prisma.user.findMany).mock.calls[0][0] as {
      where: { role: { in: string[] } };
    };
    expect(where.where.role.in).toEqual(["SUPER_ADMIN", "SCHOOL_ADMIN"]);
  });

  it("applique les filtres search / role / isActive / schoolId", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/root/users?search=ecole&role=SCHOOL_ADMIN&isActive=true&schoolId=" +
          FIXTURES.schoolA
      )
    );

    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.user.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(where.where.role).toBe("SCHOOL_ADMIN");
    expect(where.where.schoolId).toBe(FIXTURES.schoolA);
    expect(where.where.isActive).toBe(true);
    expect(where.where.OR).toBeDefined();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/root/users"));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération des utilisateurs");
  });
});

describe("PATCH /api/root/users", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/users", {
      method: "PATCH",
      body: { id: userId, isActive: false },
    }));
    expect(res.status).toBe(401);
  });

  it("exige un id (400)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await PATCH(makeRequest("http://localhost:3000/api/root/users", {
      method: "PATCH",
      body: { isActive: false },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ID requis");
  });

  it("interdit la modification de l'utilisateur root (403)", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "root1",
      email: "root@edupilot.app",
    } as never);

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/users", {
      method: "PATCH",
      body: { id: "root1", isActive: false },
    }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Modification de l'utilisateur root non autorisée");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("met à jour un utilisateur non-root", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userId,
      email: "admin@a.bj",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: userId,
      email: "admin@a.bj",
      firstName: "Awa",
      lastName: "Dossou",
      role: "SCHOOL_ADMIN",
      isActive: false,
    } as never);

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/users", {
      method: "PATCH",
      body: { id: userId, isActive: false },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.isActive).toBe(false);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data).toMatchObject({
      isActive: false,
    });
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userId,
      email: "admin@a.bj",
    } as never);
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest("http://localhost:3000/api/root/users", {
      method: "PATCH",
      body: { id: userId, isActive: false },
    }));

    expect(res.status).toBe(500);
  });
});