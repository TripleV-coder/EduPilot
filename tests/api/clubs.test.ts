import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/clubs/route";
import { POST as JOIN } from "@/app/api/clubs/[id]/members/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    club: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    clubMembership: { findUnique: vi.fn(), create: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
    teacherProfile: { findFirst: vi.fn() },
  },
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/clubs", () => {
  it("renvoie les clubs réels avec l'effectif et l'adhésion de l'élève", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u1" }));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.club.findMany).mockResolvedValue([
      {
        id: "c1", name: "Robotique", category: "Sciences", description: null, schedule: "Mercredi 15 h", capacity: 20,
        supervisor: { id: "t1", user: { firstName: "Koffi", lastName: "Sossou" } },
        _count: { memberships: 3 },
        memberships: [{ id: "m1" }],
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/clubs"), params(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(false);
    expect(body.clubs[0]).toMatchObject({ name: "Robotique", memberCount: 3, joined: true, supervisor: { name: "Koffi Sossou" } });
  });
});

describe("POST /api/clubs", () => {
  it("refuse la création à un enseignant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/clubs", { method: "POST", body: { name: "Échecs", category: "Stratégie" } }), params(""));
    expect(res.status).toBe(403);
    expect(prisma.club.create).not.toHaveBeenCalled();
  });

  it("crée le club pour la direction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.club.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.club.create).mockResolvedValue({ id: "c2", name: "Échecs" } as never);
    const res = await POST(makeRequest("http://localhost/api/clubs", { method: "POST", body: { name: "Échecs", category: "Stratégie" } }), params(""));
    expect(res.status).toBe(201);
    expect(prisma.club.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Échecs", category: "Stratégie" }) });
  });
});

describe("POST /api/clubs/[id]/members", () => {
  it("l'élève rejoint un club qui a de la place", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u1" }));
    vi.mocked(prisma.club.findFirst).mockResolvedValue({ id: "c1", capacity: 20, _count: { memberships: 3 } } as never);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.clubMembership.findUnique).mockResolvedValue(null);
    const res = await JOIN(makeRequest("http://localhost/api/clubs/c1/members", { method: "POST", body: {} }), params("c1"));
    expect(res.status).toBe(201);
    expect(prisma.clubMembership.create).toHaveBeenCalledWith({ data: { clubId: "c1", studentId: "s1" } });
  });

  it("refuse un club complet", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u1" }));
    vi.mocked(prisma.club.findFirst).mockResolvedValue({ id: "c1", capacity: 3, _count: { memberships: 3 } } as never);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.clubMembership.findUnique).mockResolvedValue(null);
    const res = await JOIN(makeRequest("http://localhost/api/clubs/c1/members", { method: "POST", body: {} }), params("c1"));
    expect(res.status).toBe(409);
    expect(prisma.clubMembership.create).not.toHaveBeenCalled();
  });
});
