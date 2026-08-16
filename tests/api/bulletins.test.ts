import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/bulletins/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findUnique: vi.fn() },
    period: { findUnique: vi.fn(), findFirst: vi.fn() },
    school: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { count: vi.fn() },
    behaviorIncident: { count: vi.fn() },
  },
}));

const PERIOD = {
  id: cuid("p1"),
  name: "Semestre 1",
  sequence: 1,
  academicYearId: cuid("ay1"),
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-06-30"),
};

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.studentA,
    userId: "u_stu",
    schoolId: FIXTURES.schoolA,
    matricule: "202500123",
    dateOfBirth: new Date("2012-05-01"),
    user: { firstName: "Awa", lastName: "Diallo" },
    enrollments: [
      {
        classId: "cl1",
        academicYearId: cuid("ay1"),
        status: "ACTIVE",
        class: {
          id: "cl1",
          name: "6A",
          classLevel: { name: "Sixième" },
          classSubjects: [
            {
              id: "cs1",
              coefficient: 3,
              subject: { id: "s1", name: "Maths" },
              evaluations: [
                {
                  id: cuid("e1"),
                  title: "Contrôle 1",
                  date: new Date("2026-02-10"),
                  maxGrade: 20,
                  coefficient: 2,
                  type: { name: "Devoir" },
                  grades: [{ value: 15, isAbsent: false, isExcused: false }],
                },
              ],
            },
            {
              id: "cs2",
              coefficient: 2,
              subject: { id: "s2", name: "Français" },
              evaluations: [],
            },
          ],
        },
        academicYear: { name: "2025-2026" },
      },
    ],
    ...overrides,
  } as never;
}

describe("GET /api/bulletins", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/bulletins"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when params missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/bulletins"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should forbid a student viewing another's bulletin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_other" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("STUDENT", { id: "u_other" }) });
    expect(res.status).toBe(403);
  });

  it("should forbid a parent not linked to the student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: cuid("pp1") } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("PARENT", { id: "u_parent" }) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when student has no active enrollment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ enrollments: [] }));
    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
  });

  it("should generate the full bulletin for a linked parent", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: cuid("pp1") } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue({ id: cuid("ps1") } as never);
    vi.mocked(prisma.period.findUnique).mockResolvedValue(PERIOD as never);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({
      id: cuid("p0"),
      name: "Trimestre 2",
      sequence: 0,
    } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({
      name: "École A",
      address: "Cotonou",
      city: "Cotonou",
      phone: "0102030405",
      email: "contact@a.bj",
      logo: "logo.png",
      motto: "Savoir",
      mempCode: "MEMP-1",
      code: "A-01",
    } as never);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      {
        student: {
          grades: [
            {
              value: 15,
              isAbsent: false,
              isExcused: false,
              evaluation: { periodId: PERIOD.id, coefficient: 2, classSubjectId: "cs1" },
            },
          ],
        },
      },
      {
        student: {
          grades: [
            {
              value: 10,
              isAbsent: false,
              isExcused: false,
              evaluation: { periodId: PERIOD.id, coefficient: 2, classSubjectId: "cs1" },
            },
          ],
        },
      },
    ] as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendance.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(1);

    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=${PERIOD.id}`), { session: makeSession("PARENT", { id: "u_parent" }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student.matricule).toBe("202500123");
    expect(body.class.name).toBe("6A");
    expect(body.academicYear).toBe("2025-2026");
    expect(body.periodSequence).toBe(1);
    expect(body.previousPeriod.name).toBe("Trimestre 2");

    const maths = body.subjects.find((s: { subjectName: string }) => s.subjectName === "Maths");
    expect(maths.average).toBe(15);
    expect(maths.evaluationsCount).toBe(1);
    expect(maths.grades[0].value).toBe(15);

    expect(body.generalAverage).toBe(15);
    expect(body.previousGeneralAverage).toBeNull();
    expect(body.classGeneralAverage).toBeCloseTo(12.5, 1);
    expect(body.rank).toBe(1);
    expect(body.classSize).toBe(2);
    expect(body.appreciation).toBeDefined();

    expect(body.vieScolaire.absences).toBe(2);
    expect(body.vieScolaire.lates).toBe(1);
    expect(body.vieScolaire.excused).toBe(3);
    expect(body.vieScolaire.incidents).toBe(1);

    expect(body.referenceNumber).toContain("BJ-2025-T1-00123");
    expect(body.generatedAt).toBeDefined();
  });

  it("should allow a teacher and handle period without sequence", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({
      enrollments: [{
        classId: "cl1",
        academicYearId: cuid("ay1"),
        status: "ACTIVE",
        class: {
          id: "cl1",
          name: "6A",
          classLevel: { name: "Sixième" },
          classSubjects: [
            {
              id: "cs1",
              coefficient: 3,
              subject: { id: "s1", name: "Maths" },
              evaluations: [],
            },
          ],
        },
        academicYear: { name: "2025-2026" },
      }],
    }));
    vi.mocked(prisma.period.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendance.count).mockResolvedValue(0);
    vi.mocked(prisma.behaviorIncident.count).mockResolvedValue(0);

    const res = await GET(makeRequest(`http://localhost/api/bulletins?studentId=${FIXTURES.studentA}&periodId=p1`), { session: makeSession("TEACHER") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe("Période");
    expect(body.periodSequence).toBeNull();
    expect(body.previousPeriod).toBeNull();
    expect(body.generalAverage).toBeNull();
    expect(body.school).toBeNull();
    expect(body.referenceNumber).toContain("BJ-2025-00123");
    expect(body.vieScolaire.absences).toBe(0);
  });
});