import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/orientation/cep/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: "cl1",
    name: "CM2",
    schoolId: FIXTURES.schoolA,
    classLevel: { name: "Cours moyen 2" },
    classSubjects: [
      { id: "cs1", subject: { id: "s1", name: "Français" } },
      { id: "cs2", subject: { id: "s2", name: "Calcul" } },
      { id: "cs3", subject: { id: "s3", name: "Dictée" } },
    ],
    ...overrides,
  } as never;
}

function makeEnrollment(studentId: string, name: string, grades: unknown[]) {
  return {
    id: `enr_${studentId}`,
    student: {
      id: studentId,
      user: { firstName: name.split(" ")[0], lastName: name.split(" ")[1] },
      grades,
    },
  };
}

describe("GET /api/orientation/cep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/cep"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/orientation/cep?classId=cl1&academicYearId=ay1"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when params missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/orientation/cep"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/orientation/cep?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/orientation/cep?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should compute pronostics per student and class metrics", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(makeClass());
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      makeEnrollment("stu1", "Awa Diallo", [
        { id: cuid("g1"), value: 17, isAbsent: false, isExcused: false, evaluation: { coefficient: 2, classSubjectId: "cs1" } },
        { id: cuid("g2"), value: 16, isAbsent: false, isExcused: false, evaluation: { coefficient: 1, classSubjectId: "cs2" } },
        { id: cuid("g3"), value: 15, isAbsent: false, isExcused: false, evaluation: { coefficient: 1, classSubjectId: "cs3" } },
      ]),
      makeEnrollment("stu2", "Jean Mensah", [
        { id: cuid("g4"), value: 8, isAbsent: false, isExcused: false, evaluation: { coefficient: 2, classSubjectId: "cs1" } },
      ]),
      makeEnrollment("stu3", "Koffi Yao", []),
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/orientation/cep?classId=cl1&academicYearId=ay1"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.class.name).toBe("CM2");
    expect(body.class.size).toBe(3);
    expect(body.metrics.candidatesCount).toBe(3);
    expect(body.metrics.successRateEstimate).toBe(33);
    expect(body.metrics.mentionBienProjected).toBe(1);
    expect(body.metrics.toReinforce).toBe(2);
    expect(body.cyclesInfo).toHaveLength(3);

    const awa = body.students.find((s: { name: string }) => s.name === "Awa Diallo");
    expect(awa.generalAverage).toBeCloseTo(16.25, 2);
    expect(awa.lecture).toBe(17);
    expect(awa.calcul).toBe(16);
    expect(awa.dictee).toBe(15);
    expect(awa.pronostic.label).toBe("Très Bien");
    expect(awa.pronostic.aptForGrade6).toBe(true);
    expect(awa.recommendation).toBe("Apte 6ᵉ");

    const jean = body.students.find((s: { name: string }) => s.name === "Jean Mensah");
    expect(jean.pronostic.label).toBe("Échec probable");
    expect(jean.pronostic.needsReinforcement).toBe(true);
    expect(jean.recommendation).toBe("Soutien intensif");

    const koffi = body.students.find((s: { name: string }) => s.name === "Koffi Yao");
    expect(koffi.generalAverage).toBeNull();
    expect(koffi.pronostic.label).toBe("À évaluer");
    expect(koffi.recommendation).toBe("Évaluation à compléter");

    expect(body.students[0].name).toBe("Awa Diallo");
  });
});