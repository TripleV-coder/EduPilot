import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/analytics/students/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
  persistStudentAnalyticsSnapshot: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    classSubject: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
  },
}));

function makeAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("an1"),
    studentId: FIXTURES.studentA,
    periodId: cuid("p1"),
    academicYearId: cuid("ay1"),
    riskLevel: "LOW",
    generalAverage: 14.5,
    analyzedAt: new Date("2026-02-01"),
    period: { name: "Semestre 1", sequence: 1 },
    academicYear: { name: "2025-2026" },
    student: {
      user: { firstName: "Awa", lastName: "Diallo" },
    },
    subjectPerformances: [],
    ...overrides,
  } as never;
}

describe("GET /api/analytics/students", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return [] for STUDENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("should scope STUDENT to their own analytics", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_stu" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([makeAnalytics()]);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("STUDENT", { id: "u_stu" }) });
    expect(res.status).toBe(200);
    expect(prisma.studentAnalytics.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: { in: [FIXTURES.studentA] } }) }));
  });

  it("should scope TEACHER to students of their classes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "t1" } as never);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([{ classId: "cl1" }] as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{ studentId: FIXTURES.studentA }] as never);
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([makeAnalytics()]);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("TEACHER") });
    expect(res.status).toBe(200);
    expect(prisma.studentAnalytics.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: { in: [FIXTURES.studentA] } }) }));
  });

  it("should reject SCHOOL_ADMIN without school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("SCHOOL_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(403);
  });

  it("should apply school filter for admins", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([makeAnalytics()]);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    expect(prisma.studentAnalytics.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ student: { schoolId: FIXTURES.schoolA } }) }));
  });

  it("should deny access to a specific student outside scope", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_stu" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    const res = await GET(makeRequest(`http://localhost/api/analytics/students?studentId=${FIXTURES.studentB}`), { session: makeSession("STUDENT", { id: "u_stu" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("should dedupe by default and merge attendance", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([
      makeAnalytics({ id: cuid("an1"), periodId: cuid("p1"), period: { name: "S1", sequence: 1 } }),
      makeAnalytics({ id: cuid("an2"), periodId: cuid("p2"), period: { name: "S2", sequence: 2 } }),
    ]);
    vi.mocked(prisma.attendance.groupBy)
      .mockResolvedValueOnce([{ studentId: FIXTURES.studentA, _count: 3 }] as never)
      .mockResolvedValueOnce([
        { studentId: FIXTURES.studentA, status: "PRESENT", _count: 8 },
        { studentId: FIXTURES.studentA, status: "LATE", _count: 2 },
        { studentId: FIXTURES.studentA, status: "ABSENT", _count: 3 },
      ] as never);

    const res = await GET(makeRequest("http://localhost/api/analytics/students"), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentName).toBe("Awa Diallo");
    expect(body[0].absenceCount).toBe(3);
    expect(body[0].attendanceRate).toBe(76.92);
  });

  it("should apply explicit filters and limit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([
      makeAnalytics(),
      makeAnalytics({ studentId: FIXTURES.studentB, period: { name: "S1", sequence: 1 } }),
    ]);
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);
    const res = await GET(makeRequest(`http://localhost/api/analytics/students?studentId=${FIXTURES.studentA}&latestOnly=false&limit=1`), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentId).toBe(FIXTURES.studentA);
  });
});

describe("POST /api/analytics/students", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid STUDENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST(makeRequest("http://localhost/api/analytics/students", { method: "POST", body: {} }), { session: makeSession("STUDENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when params missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/analytics/students", { method: "POST", body: { studentId: FIXTURES.studentA } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should forbid cross-school generation", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      user: { schoolId: FIXTURES.schoolB },
    } as never);
    const res = await POST(makeRequest("http://localhost/api/analytics/students", { method: "POST", body: { studentId: FIXTURES.studentA, periodId: cuid("p1"), academicYearId: cuid("ay1") } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should generate analytics for an allowed school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      user: { schoolId: FIXTURES.schoolA },
    } as never);
    const res = await POST(makeRequest("http://localhost/api/analytics/students", { method: "POST", body: { studentId: FIXTURES.studentA, periodId: cuid("p1"), academicYearId: cuid("ay1") } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(201);
    const { persistStudentAnalyticsSnapshot } = await import("@/lib/services/analytics-sync");
    expect(persistStudentAnalyticsSnapshot).toHaveBeenCalledWith(FIXTURES.studentA, cuid("p1"), cuid("ay1"));
  });
});