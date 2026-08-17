import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/orientation/me/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeIndicativeRecommendations } from "@/lib/services/orientation";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/orientation", () => ({
  computeIndicativeRecommendations: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findFirst: vi.fn() },
    academicYear: { findUnique: vi.fn(), findFirst: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    studentOrientation: { findFirst: vi.fn() },
    grade: { findMany: vi.fn() },
  },
}));

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.studentA,
    schoolId: FIXTURES.schoolA,
    userId: "u1",
    user: { firstName: "Awa", lastName: "Diallo" },
    ...overrides,
  } as never;
}

function makeAcademicYear() {
  return { id: "ay1", name: "2025-2026", schoolId: FIXTURES.schoolA, isCurrent: true } as never;
}

function makeOrientation(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    studentId: FIXTURES.studentA,
    academicYearId: "ay1",
    status: "ANALYZED",
    recommendations: [
      { id: "r1", rank: 1, recommendedSeries: "SERIE_C", score: 85.5, justification: "Profil scientifique", strengths: ["Maths"], warnings: [], isValidated: false },
      { id: "r2", rank: 2, recommendedSeries: "SERIE_A1", score: 70, justification: "j2", strengths: [], warnings: [], isValidated: false },
      { id: "r3", rank: 3, recommendedSeries: "SERIE_D", score: 65, justification: "j3", strengths: [], warnings: [], isValidated: true },
    ],
    ...overrides,
  } as never;
}

describe("GET /api/orientation/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid non-STUDENT roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should return 404 when student profile not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
  });

  it("should return 404 when academic year not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(makeStudent());
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Année académique introuvable");
  });

  it("should resolve the requested academic year by id", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(makeStudent());
    vi.mocked(prisma.academicYear.findUnique).mockResolvedValue(makeAcademicYear());
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation());
    vi.mocked(prisma.grade.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/orientation/me?academicYearId=ay1"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(200);
    expect(prisma.academicYear.findUnique).toHaveBeenCalledWith({ where: { id: "ay1" } });
  });

  it("should return indicative recommendations when no orientation exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(makeStudent());
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeAcademicYear());
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(null);
    vi.mocked(computeIndicativeRecommendations).mockResolvedValue({
      generalAverage: 12.5,
      recommendations: [
        { series: "SERIE_C", name: "Série C", description: "Maths-Physique", score: 80, strengths: ["a", "b", "c", "d"], warnings: ["w1", "w2", "w3"] },
      ],
    });

    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student.firstName).toBe("Awa");
    expect(body.academicYear.name).toBe("2025-2026");
    expect(body.hasOrientation).toBe(false);
    expect(body.recommendations).toEqual([]);
    expect(body.aiTop).toBeNull();
    expect(body.wishes).toEqual([]);
    expect(body.subjectAverages).toEqual([]);
    expect(body.indicative.generalAverage).toBe(12.5);
    expect(body.indicative.recommendations[0].series).toBe("C");
    expect(body.indicative.recommendations[0].name).toBe("Série C");
    expect(body.indicative.recommendations[0].score).toBe(80);
    expect(body.indicative.recommendations[0].strengths).toHaveLength(3);
    expect(body.indicative.recommendations[0].warnings).toHaveLength(2);
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("should return the dossier with subject averages when orientation exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(makeStudent());
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeAcademicYear());
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
      id: "enr1",
      class: {
        id: "cl1",
        name: "3ème A",
        classLevel: { name: "Troisième" },
        classSubjects: [{ id: "cs1", subject: { id: "s1", name: "Maths" } }],
      },
    } as never);
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation());
    vi.mocked(prisma.grade.findMany).mockResolvedValue([
      { id: "g1", value: 16, isAbsent: false, isExcused: false, evaluation: { coefficient: 2, classSubject: { subject: { id: "s1", name: "Maths" } } } },
      { id: "g2", value: 12, isAbsent: false, isExcused: false, evaluation: { coefficient: 1, classSubject: { subject: { id: "s1", name: "Maths" } } } },
      { id: "g3", value: 10, isAbsent: false, isExcused: false, evaluation: { coefficient: 1, classSubject: { subject: { id: "s2", name: "Français" } } } },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.hasOrientation).toBe(true);
    expect(body.orientationId).toBe("o1");
    expect(body.status).toBe("ANALYZED");
    expect(body.enrollment).toEqual({ classId: "cl1", className: "3ème A", levelName: "Troisième" });
    expect(body.aiTop.series).toBe("C");
    expect(body.aiTop.seriesEnum).toBe("SERIE_C");
    expect(body.aiTop.score).toBe(85.5);
    expect(body.wishes).toHaveLength(3);
    expect(body.recommendations).toHaveLength(3);
    expect(body.recommendations[2].isValidated).toBe(true);
    expect(body.subjectAverages[0].name).toBe("Maths");
    expect(body.subjectAverages[0].average).toBeCloseTo(14.67, 2);
    expect(body.subjectAverages[1].name).toBe("Français");
    expect(body.subjectAverages[1].average).toBe(10);
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(makeStudent());
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(makeAcademicYear());
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation());
    vi.mocked(prisma.grade.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/orientation/me"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du chargement de l'orientation");
  });
});