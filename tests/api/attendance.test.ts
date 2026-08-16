import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_STATS } from "@/app/api/attendance/stats/route";
import { GET, POST as POST_JUST } from "@/app/api/attendance/justifications/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", () => ({
  generateCacheKey: () => "attendance:stats:test",
  withCache: (handler: () => unknown) => handler(),
  invalidateByPath: vi.fn(),
  CACHE_TTL_SHORT: 60,
}));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAnalyticsAfterStudentActivityChange: vi.fn(),
}));
vi.mock("@/lib/security/tenant", () => ({
  assertModelAccess: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("GET /api/attendance/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats"));
    expect(res.status).toBe(401);
  });

  it("should compute stats for a teacher", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { status: "PRESENT", studentId: "s1" },
      { status: "PRESENT", studentId: "s1" },
      { status: "ABSENT", studentId: "s1" },
      { status: "LATE", studentId: "s1" },
    ] as never);

    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats?startDate=2026-09-01&endDate=2026-09-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(4);
    expect(body.present).toBe(2);
    expect(body.absent).toBe(1);
    expect(body.late).toBe(1);
    expect(body.byStudent).not.toBeNull();
  });

  it("should return zeroed stats when student has no profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);

    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.byStudent).toBeNull();
  });

  it("should filter parent stats by linked students", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }, { studentId: FIXTURES.studentB }],
    } as never);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats"));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.attendance.findMany).mock.calls[0][0] as {
      where: { studentId?: object };
    };
    expect(call.where.studentId).toEqual({ in: [FIXTURES.studentA, FIXTURES.studentB] });
  });
});

describe("GET /api/attendance/justifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should list absences for a class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      {
        id: "a1",
        studentId: FIXTURES.studentA,
        student: { user: { firstName: "Jean", lastName: "Dupont" } },
        class: { name: "6A" },
        date: new Date("2026-09-10"),
        status: "ABSENT",
        reason: "Malade",
        justificationDocument: null,
        recordedBy: { firstName: "Marie", lastName: "Martin" },
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/attendance/justifications?classId=c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.justifications).toHaveLength(1);
    expect(body.justifications[0].studentName).toBe("Dupont Jean");
    expect(body.justifications[0].hasJustification).toBe(false);
  });

  it("should use default absence statuses", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

    await GET(makeRequest("http://localhost/api/attendance/justifications"));
    const call = vi.mocked(prisma.attendance.findMany).mock.calls[0][0] as { where: { status: object } };
    expect(call.where.status).toEqual({ in: ["ABSENT", "EXCUSED", "LATE"] });
  });
});

describe("POST /api/attendance/justifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when attendanceId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("should reject justifying a PRESENT student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue({ status: "PRESENT", studentId: "s1", date: new Date() } as never);

    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "Malade" } }));
    expect(res.status).toBe(400);
  });

  it("should update attendance to EXCUSED and sync analytics", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue({ status: "ABSENT", studentId: "s1", date: new Date() } as never);
    vi.mocked(prisma.attendance.update).mockResolvedValue({ id: "a1", status: "EXCUSED" } as never);

    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "Malade", justificationDocument: "https://doc.fr/justif.pdf" } }));
    expect(res.status).toBe(200);
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXCUSED" }) })
    );
  });
});