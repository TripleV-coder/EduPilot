import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/incidents/statistics/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    behaviorIncident: { findMany: vi.fn(), count: vi.fn() },
  },
}));

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: "inc1",
    severity: "MEDIUM",
    incidentType: "bagarre",
    isResolved: true,
    createdAt: new Date("2026-01-01T08:00:00"),
    updatedAt: new Date("2026-01-01T14:00:00"),
    date: new Date("2026-01-02"),
    studentId: FIXTURES.studentA,
    student: {
      user: { firstName: "Awa", lastName: "Diallo" },
      enrollments: [{ class: { name: "6A" } }],
    },
    sanctions: [{ type: "PARENT_CONFERENCE" }],
    ...overrides,
  } as never;
}

describe("GET /api/incidents/statistics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 on invalid date range", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics?startDate=2026-06-01&endDate=2026-01-01"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should return 404 for STUDENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
  });

  it("should return 404 for PARENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics"), { session: makeSession("PARENT") });
    expect(res.status).toBe(404);
  });

  it("should compute full statistics and trends", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([
      makeIncident({
        id: "inc1",
        severity: "CRITICAL",
        incidentType: "bagarre",
        isResolved: false,
        sanctions: [],
      }),
      makeIncident({
        id: "inc2",
        severity: "HIGH",
        incidentType: "bagarre",
        isResolved: true,
        createdAt: new Date("2026-01-01T08:00:00"),
        updatedAt: new Date("2026-01-01T20:00:00"),
        sanctions: [{ type: "PARENT_CONFERENCE" }],
      }),
      makeIncident({ id: "inc3", severity: "LOW", incidentType: "retard", isResolved: false, sanctions: [] }),
    ]);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost/api/incidents/statistics?period=week"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    
    expect(body.statistics.totalIncidents).toBe(3);
    expect(body.statistics.bySeverity.CRITICAL).toBe(1);
    expect(body.statistics.bySeverity.HIGH).toBe(1);
    expect(body.statistics.bySeverity.LOW).toBe(1);
    expect(body.statistics.byType.bagarre).toBe(2);
    expect(body.statistics.resolvedCount).toBe(1);
    expect(body.statistics.unresolvedCount).toBe(2);
    expect(body.statistics.byStatus.escalated).toBe(1);
    expect(body.statistics.parentNotifiedCount).toBe(1);
    expect(body.statistics.averageResolutionTime).toBe(12);
    expect(body.trend).toBe("up");
    expect(body.topIncidentTypes[0]).toEqual(["bagarre", 2]);
    expect(body.topStudents).toHaveLength(1);
    expect(body.criticalIncidents).toHaveLength(1);
    expect(body.dailyTrend["2026-01-02"]).toBe(3);
    expect(body.period.previous.start).toBeDefined();
  });

  it("should use explicit date range when provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics?startDate=2026-01-01&endDate=2026-01-31"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trend).toBe("stable");
  });

  it("should scope PARENT to their children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: FIXTURES.studentA }] } as never);
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics"), { session: makeSession("PARENT") });
    expect(res.status).toBe(200);
    expect(prisma.behaviorIncident.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: { in: [FIXTURES.studentA] } }) }));
  });

  it("should combine classId with school scope for staff", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics?classId=cl1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.behaviorIncident.findMany).mock.calls[0][0];
    expect(arg.where.student.enrollments.some.classId).toBe("cl1");
    expect(arg.where.student.enrollments.some.class.schoolId).toBe(FIXTURES.schoolA);
  });

  it("should filter by explicit studentId for staff", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    const res = await GET(makeRequest(`http://localhost/api/incidents/statistics?studentId=${FIXTURES.studentA}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    expect(prisma.behaviorIncident.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: FIXTURES.studentA }) }));
  });

  it("should not scope SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);
    const res = await GET(makeRequest("http://localhost/api/incidents/statistics"), { session: makeSession("SUPER_ADMIN") });
    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.behaviorIncident.findMany).mock.calls[0][0];
    expect(arg.where.student).toBeUndefined();
  });
});