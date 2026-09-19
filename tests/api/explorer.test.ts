import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findMany: vi.fn(), count: vi.fn() },
    studentProfile: { count: vi.fn() },
    class: { count: vi.fn() },
    teacherProfile: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET as GET_SCHOOLS } from "@/app/api/explorer/schools/route";
import { GET as GET_OVERVIEW } from "@/app/api/explorer/overview/route";

const school = (id: string, city = "Cotonou") => ({
  id, name: `École ${id}`, code: id.toUpperCase(), city, address: null, level: "PRIMARY", type: "PUBLIC",
  _count: { users: 3, classes: 2, studentProfiles: 40, teacherProfiles: 5 },
});

describe("GET /api/explorer/schools — explorateur public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.school.findMany).mockResolvedValue([school("s1")] as never);
  });

  it("répond aux visiteurs anonymes, limité aux écoles publiées", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_SCHOOLS(makeRequest("http://localhost/api/explorer/schools"));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.school.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { isActive: true, isPublic: true } })
    );
    const body = await res.json();
    expect(body.schools[0]).toEqual(expect.objectContaining({ id: "s1", studentsCount: 40 }));
  });

  it("une session en attente du second facteur est traitée comme anonyme", async () => {
    const pending = makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA });
    (pending.user as { isTwoFactorEnabled: boolean }).isTwoFactorEnabled = true;
    vi.mocked(auth).mockResolvedValue(pending);
    await GET_SCHOOLS(makeRequest("http://localhost/api/explorer/schools"));
    expect(vi.mocked(prisma.school.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { isActive: true, isPublic: true } })
    );
  });

  it("un utilisateur rattaché ne voit que son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    await GET_SCHOOLS(makeRequest("http://localhost/api/explorer/schools"));
    expect(vi.mocked(prisma.school.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { isActive: true, id: FIXTURES.schoolA } })
    );
  });
});

describe("GET /api/explorer/overview — statistiques publiques", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.school.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(80 as never);
    vi.mocked(prisma.class.count).mockResolvedValue(6 as never);
    vi.mocked(prisma.teacherProfile.count).mockResolvedValue(9 as never);
  });

  it("répond aux anonymes en ne comptant que les écoles publiées", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_OVERVIEW(makeRequest("http://localhost/api/explorer/overview"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schools: 2, students: 80, classes: 6, teachers: 9 });
    expect(vi.mocked(prisma.school.count).mock.calls[0][0]).toEqual({ where: { isActive: true, isPublic: true } });
    expect(vi.mocked(prisma.studentProfile.count).mock.calls[0][0]).toEqual(
      { where: { deletedAt: null, school: { isActive: true, isPublic: true } } }
    );
  });
});
