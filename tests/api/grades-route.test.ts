import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Grade } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    grade: { findMany: vi.fn(), groupBy: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/grades/route";

const classId = cuid("classe6a");
const periodId = cuid("periode1");

function gradeListRow(value: number) {
  return {
    id: cuid(`grade${value}`),
    value,
    isAbsent: false,
    isExcused: false,
    comment: null,
    evaluationId: cuid("eval1"),
    evaluation: {
      date: new Date("2026-02-01"),
      maxGrade: 20,
      coefficient: 1,
      classSubject: {
        subject: { id: cuid("subj1"), name: "Mathématiques" },
        class: { id: classId, name: "6e A" },
      },
      period: { id: periodId, name: "Trimestre 1" },
      type: { id: cuid("type1"), name: "Devoir" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.grade.groupBy).mockResolvedValue([
    { evaluationId: cuid("eval1"), _avg: { value: 12 } },
  ] as never);
});

describe("GET /api/grades", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades?studentId=${FIXTURES.studentA}`)
    );
    expect(response.status).toBe(401);
  });

  it("retourne 400 sans studentId ni classId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));

    const response = await GET(makeRequest("http://localhost:3000/api/grades"));
    expect(response.status).toBe(400);
  });

  it("refuse un compte sans établissement (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }));

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades?studentId=${FIXTURES.studentA}`)
    );
    expect(response.status).toBe(403);
  });

  it("filtre par école pour un TEACHER et retourne les notes formatées", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.grade.findMany).mockResolvedValue([gradeListRow(14)] as unknown as Grade[]);

    const response = await GET(
      makeRequest(
        `http://localhost:3000/api/grades?studentId=${FIXTURES.studentA}&periodId=${periodId}&classId=${classId}`
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].value).toBe(14);
    expect(body.data[0].subject.name).toBe("Mathématiques");
    expect(body.data[0].classAverage).toBe(12);

    const where = vi.mocked(prisma.grade.findMany).mock.calls[0][0]?.where;
    expect(where?.student).toMatchObject({ schoolId: FIXTURES.schoolA });
    expect(where?.studentId).toBe(FIXTURES.studentA);
    expect(where?.evaluation).toMatchObject({
      periodId,
      classSubject: { classId },
    });
  });

  it("un PARENT ne peut pas lire les notes d'un enfant non lié (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentB }],
    } as never);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades?studentId=${FIXTURES.studentA}`)
    );
    expect(response.status).toBe(403);
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("un PARENT lié peut lire les notes de son enfant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([gradeListRow(16)] as unknown as Grade[]);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades?studentId=${FIXTURES.studentA}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].value).toBe(16);
  });

  it("un PARENT sans studentId filtre sur tous ses enfants", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }, { studentId: FIXTURES.studentB }],
    } as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([] as unknown as Grade[]);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades?classId=${classId}`)
    );

    expect(response.status).toBe(200);
    const where = vi.mocked(prisma.grade.findMany).mock.calls[0][0]?.where;
    expect(where?.studentId).toEqual({ in: [FIXTURES.studentA, FIXTURES.studentB] });
  });
});
