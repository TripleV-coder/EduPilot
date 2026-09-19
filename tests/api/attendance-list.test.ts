import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { attendance: { findMany: vi.fn() }, parentProfile: { findUnique: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/attendance/route";

const base = "http://localhost/api/attendance";

describe("GET /api/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { id: "a1", status: "ABSENT", date: new Date("2026-09-10T00:00:00Z"), reason: null, class: { id: "c1", name: "6e A" }, student: { id: "s1", matricule: "M1", user: { id: "u1", firstName: "A", lastName: "B" } } },
    ] as never);
  });

  it.each(["PARENT", "STUDENT"])("refuse %s : pas de lecture des présences d'autrui (403)", async (role) => {
    vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(`${base}?classId=c1`))).status).toBe(403);
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
  });

  it("exige un élève ou une classe (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(base))).status).toBe(400);
  });

  it("limite la lecture à l'école active et borne le volume", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    const res = await GET(makeRequest(`${base}?classId=c1&from=2026-09-01&to=2026-09-30&limit=99999`));
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.attendance.findMany).mock.calls[0][0]!;
    expect(args.where).toEqual(expect.objectContaining({ classId: "c1", student: { user: { schoolId: FIXTURES.schoolA } } }));
    expect(args.take).toBe(1000);
    expect((await res.json()).data[0].date).toBe("2026-09-10T00:00:00.000Z");
  });

  it("sans école active, refuse (403) sauf super-admin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }));
    expect((await GET(makeRequest(`${base}?classId=c1`))).status).toBe(403);
  });
});
