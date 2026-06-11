import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    period: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findFirst: vi.fn() },
    grade: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/grades/report-cards/route";

const classId = cuid("classe6a");

function setupNominalStudent(periodId: string) {
  vi.mocked(prisma.period.findUnique).mockResolvedValue({
    id: periodId,
    name: "Trimestre 1",
    academicYearId: cuid("annee2026"),
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-03-31"),
  } as any);

  // 1er appel (contrôle d'accès) : forme simple — 2e (bulletin) : include complet
  vi.mocked(prisma.studentProfile.findUnique).mockImplementation(async (args: any) => {
    if (!args?.include && !args?.select) {
      return { id: FIXTURES.studentA, schoolId: FIXTURES.schoolA, userId: cuid("userawa") } as any;
    }
    if (args?.select) {
      return { schoolId: FIXTURES.schoolA } as any;
    }
    return {
      id: FIXTURES.studentA,
      user: { firstName: "Awa", lastName: "Dossou" },
      enrollments: [
        {
          classId,
          academicYearId: cuid("annee2026"),
          class: { id: classId, name: "6e A", classLevel: { name: "Sixième" } },
          academicYear: { name: "2025-2026" },
        },
      ],
    } as any;
  });

  function gradeRow(subject: string, code: string, subjectCoeff: number, value: number, coeff: number) {
    return {
      studentId: FIXTURES.studentA,
      value,
      comment: subject === "Mathématiques" ? "Bon trimestre" : null,
      evaluation: {
        date: new Date("2026-02-01"),
        maxGrade: 20,
        coefficient: coeff,
        classSubjectId: cuid(`cs${code}`),
        classSubject: {
          coefficient: subjectCoeff,
          subject: { name: subject, code },
          teacher: { user: { firstName: "Prof", lastName: code } },
        },
        type: { name: "Devoir" },
      },
    };
  }

  vi.mocked(prisma.grade.findMany).mockImplementation(async (args: any) => {
    if (args?.include) {
      // Notes du bulletin : Maths coeff 3 (15 coeff 2, 10 coeff 1), Français coeff 2 (8)
      return [
        gradeRow("Mathématiques", "math", 3, 15, 2),
        gradeRow("Mathématiques", "math", 3, 10, 1),
        gradeRow("Français", "fr", 2, 8, 1),
      ] as any;
    }
    // Notes du classement : notre élève (moyenne ~11.2) et un meilleur élève
    return [
      {
        studentId: FIXTURES.studentA,
        value: 11.2,
        evaluation: {
          maxGrade: 20,
          coefficient: 1,
          classSubjectId: cuid("csmath"),
          classSubject: { coefficient: 1 },
        },
      },
      {
        studentId: FIXTURES.studentB,
        value: 14,
        evaluation: {
          maxGrade: 20,
          coefficient: 1,
          classSubjectId: cuid("csmath"),
          classSubject: { coefficient: 1 },
        },
      },
    ] as any;
  });

  vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
    { studentId: FIXTURES.studentA },
    { studentId: FIXTURES.studentB },
  ] as any);
  vi.mocked(prisma.attendance.findMany).mockResolvedValue([
    { status: "PRESENT" },
    { status: "PRESENT" },
    { status: "ABSENT" },
    { status: "LATE" },
  ] as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/grades/report-cards", () => {
  it("retourne 401 sans session et 400 sans paramètres", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    expect((await GET(makeRequest("http://localhost:3000/api/grades/report-cards"))).status).toBe(401);

    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    expect((await GET(makeRequest("http://localhost:3000/api/grades/report-cards"))).status).toBe(400);
  });

  it("bloque l'accès cross-tenant au bulletin (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentB,
      schoolId: FIXTURES.schoolB,
      userId: cuid("userautre"),
    } as any);

    const response = await GET(
      makeRequest(
        `http://localhost:3000/api/grades/report-cards?studentId=${FIXTURES.studentB}&periodId=${cuid("p1")}`
      )
    );
    expect(response.status).toBe(403);
  });

  it("un STUDENT ne peut pas lire le bulletin d'un autre élève (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      userId: cuid("unautreuser"),
    } as any);

    const response = await GET(
      makeRequest(
        `http://localhost:3000/api/grades/report-cards?studentId=${FIXTURES.studentA}&periodId=${cuid("p1")}`
      )
    );
    expect(response.status).toBe(403);
  });

  it("un PARENT non lié à l'élève est refusé (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      userId: cuid("userawa"),
    } as any);
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue(null);

    const response = await GET(
      makeRequest(
        `http://localhost:3000/api/grades/report-cards?studentId=${FIXTURES.studentA}&periodId=${cuid("p1")}`
      )
    );
    expect(response.status).toBe(403);
  });

  it("calcule le bulletin : moyennes pondérées par coefficients, rang, assiduité, commentaires", async () => {
    const periodId = cuid("periodeget");
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    setupNominalStudent(periodId);

    const response = await GET(
      makeRequest(
        `http://localhost:3000/api/grades/report-cards?studentId=${FIXTURES.studentA}&periodId=${periodId}`
      )
    );
    const bulletin = await response.json();

    expect(response.status).toBe(200);
    expect(bulletin.studentName).toBe("Awa Dossou");
    expect(bulletin.className).toContain("6e A");

    // Maths : (15×2 + 10×1) / 3 = 13.33 — Français : 8
    const maths = bulletin.subjects.find((s: any) => s.subject === "Mathématiques");
    const francais = bulletin.subjects.find((s: any) => s.subject === "Français");
    expect(maths.average20).toBe(13.33);
    expect(maths.passed).toBe(true);
    expect(francais.average20).toBe(8);
    expect(francais.passed).toBe(false);

    // Générale : (13.33×3 + 8×2) / 5 = 11.2
    expect(bulletin.overallAverage20).toBe(11.2);

    // Classement : 11.2 < 14 → 2e sur 2
    expect(bulletin.classRank).toBe(2);
    expect(bulletin.classSize).toBe(2);

    expect(bulletin.attendance).toEqual({ present: 2, absent: 1, late: 1 });
    expect(bulletin.comments).toContain("Mathématiques: Bon trimestre");
  });
});

describe("POST /api/grades/report-cards", () => {
  it("refuse un PARENT (génération réservée aux équipes pédagogiques)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      schoolId: FIXTURES.schoolA,
    } as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/grades/report-cards", {
        method: "POST",
        body: { studentId: FIXTURES.studentA, periodId: cuid("p1") },
      })
    );
    expect(response.status).toBe(403);
  });

  it("génère le bulletin PDF : succès + downloadUrl + traçabilité", async () => {
    const periodId = cuid("periodepost");
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR") as any);
    setupNominalStudent(periodId);

    const response = await POST(
      makeRequest("http://localhost:3000/api/grades/report-cards", {
        method: "POST",
        body: { studentId: FIXTURES.studentA, periodId },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.downloadUrl).toContain(`studentId=${FIXTURES.studentA}`);
    expect(body.data.generatedBy).toBeDefined();
    expect(body.data.overallAverage20).toBe(11.2);
  });

  it("format=json renvoie les données brutes du bulletin", async () => {
    const periodId = cuid("periodejson");
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    setupNominalStudent(periodId);

    const response = await POST(
      makeRequest("http://localhost:3000/api/grades/report-cards", {
        method: "POST",
        body: { studentId: FIXTURES.studentA, periodId, format: "json" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subjects).toHaveLength(2);
    expect(body.downloadUrl).toBeUndefined();
  });
});
