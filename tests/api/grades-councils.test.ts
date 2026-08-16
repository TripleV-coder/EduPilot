import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/grades/councils/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/grades", () => ({
  calculateWeightedAverage: vi.fn((grades: { value: number; isAbsent?: boolean }[]) => {
    const present = grades.filter((g) => !g.isAbsent);
    if (present.length === 0) return null;
    return present.reduce((s, g) => s + g.value, 0) / present.length;
  }),
  getRank: vi.fn((avg: number | null, all: (number | null)[]) => {
    const vals = all.filter((a): a is number => a !== null);
    if (avg === null) return vals.length + 1;
    return vals.filter((v) => v > avg).length + 1;
  }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
    period: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    schoolCalendarEvent: { findFirst: vi.fn() },
  },
}));

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "6A",
    schoolId: FIXTURES.schoolA,
    classLevel: { id: "l1", name: "Sixième" },
    mainTeacher: { id: "t1", user: { firstName: "Paul", lastName: "Biya" } },
    classSubjects: [
      {
        id: "cs1",
        coefficient: 3,
        subject: { id: "s1", name: "Maths" },
        teacher: { id: "t2", user: { firstName: "Awa", lastName: "Diallo" } },
      },
      {
        id: "cs2",
        coefficient: 2,
        subject: { id: "s2", name: "Français" },
        teacher: null,
      },
    ],
    ...overrides,
  } as never;
}

function makeEnrollment(studentId: string, name: string, grades: unknown[], incidents: unknown[] = []) {
  return {
    id: `enr_${studentId}`,
    student: {
      id: studentId,
      user: { firstName: name.split(" ")[0], lastName: name.split(" ")[1] },
      grades,
      behaviorIncidents: incidents,
    },
  };
}

describe("GET /api/grades/councils", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("should return 400 when classId or periodId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/grades/councils"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when period not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });

  it("should compute decisions, ranks, metrics and pending decisions", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: "p1",
      name: "Semestre 1",
      sequence: 1,
      academicYearId: "ay1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      makeEnrollment("stu1", "Awa Diallo", [
        { id: "g1", value: 17, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", coefficient: 2, classSubjectId: "cs1" } },
        { id: "g2", value: 16, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", coefficient: 1, classSubjectId: "cs2" } },
      ]),
      makeEnrollment("stu2", "Jean Mensah", [
        { id: "g3", value: 8, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", coefficient: 2, classSubjectId: "cs1" } },
        { id: "g4", value: 9, isAbsent: false, isExcused: false, evaluation: { periodId: "p1", coefficient: 1, classSubjectId: "cs2" } },
      ]),
      makeEnrollment("stu3", "Koffi Yao", [], [{ id: "inc1", severity: "MAJOR" }, { id: "inc2", severity: "MAJOR" }, { id: "inc3", severity: "MAJOR" }]),
    ] as never);
    vi.mocked(prisma.schoolCalendarEvent.findFirst).mockResolvedValue({
      id: "ev1",
      name: "Conseil de classe",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-01"),
      description: "Réunion",
    } as never);

    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.class.name).toBe("6A");
    expect(body.metrics.bulletinsTotal).toBe(3);
    expect(body.metrics.honors).toBe(1);
    expect(body.metrics.warnings).toBe(2);
    expect(body.participants).toHaveLength(2);

    const awa = body.students.find((s: { name: string }) => s.name === "Awa Diallo");
    expect(awa.generalAverage).toBeCloseTo(16.6, 1);
    expect(awa.decision).toBe("Tableau d'honneur");
    expect(awa.rank).toBe(1);

    const jean = body.students.find((s: { name: string }) => s.name === "Jean Mensah");
    expect(jean.decision).toBe("Avertissement travail");
    expect(jean.rank).toBe(2);

    const koffi = body.students.find((s: { name: string }) => s.name === "Koffi Yao");
    expect(koffi.decision).toBe("Avertissement conduite");
    expect(koffi.generalAverage).toBeNull();
    expect(koffi.rank).toBe(3);

    expect(body.stats.average).toBeCloseTo(12.5, 1);
    expect(body.pendingDecisions.length).toBeGreaterThan(0);
    expect(body.nextCouncilEvent.name).toBe("Conseil de classe");
  });

  it("should mark rows as 'À saisir' when no grades exist", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      id: "p1",
      name: "Semestre 1",
      sequence: 1,
      academicYearId: "ay1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([makeEnrollment("stu1", "Awa Diallo", [])] as never);
    vi.mocked(prisma.schoolCalendarEvent.findFirst).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost/api/grades/councils?classId=cl1&periodId=p1"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.students[0].status).toBe("À saisir");
    expect(body.students[0].decision).toBe("Aucune");
    expect(body.metrics.bulletinsReady).toBe(0);
  });
});