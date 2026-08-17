import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/students/[id]/profile-360/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    studentAnalytics: { findFirst: vi.fn(), findMany: vi.fn() },
    subject: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn(), findMany: vi.fn() },
    paymentPlan: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    payment: { findFirst: vi.fn() },
  },
}));

const STUDENT_ID = cuid("studenta");
const DIRECTOR = makeSession("DIRECTOR");

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: STUDENT_ID,
    matricule: "E00001",
    user: {
      id: cuid("user1"),
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean@school.bj",
      phone: "01",
      schoolId: FIXTURES.schoolA,
      isActive: true,
      avatar: "/api/uploads/avatar/jean.png",
    },
    enrollments: [
      {
        class: { id: cuid("class1"), name: "Terminale A1", _count: { enrollments: 30 } },
        academicYear: { id: cuid("year1"), name: "2025-2026", isCurrent: true },
      },
    ],
    parentStudents: [
      {
        relationship: "PARENT",
        isPrimary: true,
        parent: {
          user: { firstName: "Paul", lastName: "Biya", email: "paul@school.bj", phone: "02" },
        },
      },
    ],
    medicalRecord: {
      bloodType: "O+",
      conditions: "Aucune",
      medications: "Aucune",
      allergies: [{ allergen: "Arachide", severity: "HIGH" }],
      notes: "Suivi régulier",
      updatedAt: new Date("2026-01-01"),
    },
    ...overrides,
  };
}

function makeAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("analytics1"),
    generalAverage: 14.567,
    classRank: 3,
    classSize: 30,
    riskLevel: "LOW",
    createdAt: new Date("2026-01-10"),
    period: { name: "Trimestre 1" },
    academicYear: { name: "2025-2026" },
    subjectPerformances: [
      {
        subjectId: cuid("subj1"),
        subject: { id: cuid("subj1"), name: "Mathématiques" },
        average: 15.125,
        minGrade: 10,
        maxGrade: 18,
        isStrength: true,
        isWeakness: false,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent() as never);
  vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue(makeAnalytics() as never);
  vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([
    makeAnalytics({ id: cuid("analytics2"), generalAverage: 12.5 }),
    makeAnalytics({ id: cuid("analytics3"), generalAverage: 11.25, createdAt: new Date("2025-12-01") }),
  ] as never);
  vi.mocked(prisma.subject.findMany).mockResolvedValue([{ id: cuid("subj1"), coefficient: 3 }] as never);
  vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
    { status: "PRESENT", _count: { _all: 18 } },
    { status: "LATE", _count: { _all: 2 } },
    { status: "ABSENT", _count: { _all: 2 } },
  ] as never);
  vi.mocked(prisma.attendance.findMany).mockResolvedValue([
    { date: new Date("2026-02-01"), status: "PRESENT" },
  ] as never);
  vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([]);
  vi.mocked(prisma.grade.findMany).mockResolvedValue([
    {
      value: 16,
      createdAt: new Date("2026-02-02"),
      evaluation: {
        title: "Devoir 1",
        maxGrade: 20,
        classSubject: { subject: { name: "Mathématiques" } },
      },
    },
  ] as never);
  vi.mocked(prisma.payment.findFirst).mockResolvedValue({
    amount: 50000,
    paidAt: new Date("2026-02-03"),
    createdAt: new Date("2026-02-03"),
  } as never);
});

describe("GET /api/students/[id]/profile-360", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when student does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Élève introuvable");
  });

  it("should return 403 for a student from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolB }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent() as never);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("should aggregate the full 360 profile", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.student).toMatchObject({
      id: STUDENT_ID,
      firstName: "Jean",
      lastName: "Dupont",
      matricule: "E00001",
      className: "Terminale A1",
      academicYearName: "2025-2026",
    });
    expect(body.stats).toMatchObject({
      averageGrade: 14.57,
      rank: 3,
      classSize: 30,
      attendanceRate: 90.9,
      paymentStatus: "ok",
      riskLevel: "LOW",
      currentPeriod: "Trimestre 1",
    });
    expect(body.subjects).toEqual([
      expect.objectContaining({
        name: "Mathématiques",
        coefficient: 3,
        average: 15.13,
        min: 10,
        max: 18,
        isStrength: true,
        isWeakness: false,
      }),
    ]);
    expect(body.evolution).toEqual([
      { label: "Trimestre 1", average: 11.25 },
      { label: "Trimestre 1", average: 12.5 },
    ]);
    expect(body.parents).toEqual([
      expect.objectContaining({
        firstName: "Paul",
        lastName: "Biya",
        email: "paul@school.bj",
        isPrimary: true,
      }),
    ]);
    expect(body.medical).toMatchObject({
      bloodType: "O+",
      allergies: [{ allergen: "Arachide", severity: "HIGH" }],
    });
    const kinds = body.recentActivity.map((a: { kind: string }) => a.kind);
    expect(kinds).toContain("attendance");
    expect(kinds).toContain("grade");
    expect(kinds).toContain("payment");
    expect(body.recentActivity[0].at >= body.recentActivity[body.recentActivity.length - 1].at).toBe(true);
  });

  it("should mark payment status as late when overdue plans exist", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([{ id: cuid("plan1") }] as never);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.paymentStatus).toBe("late");
  });

  it("should handle a student without active enrollment", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ enrollments: [], medicalRecord: null }) as never);
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.student.className).toBeNull();
    expect(body.stats).toMatchObject({ attendanceRate: null, paymentStatus: "ok" });
    expect(body.subjects).toHaveLength(0);
    expect(body.evolution).toHaveLength(0);
    expect(body.medical).toBeNull();
    expect(prisma.studentAnalytics.findFirst).not.toHaveBeenCalled();
    expect(prisma.attendance.groupBy).not.toHaveBeenCalled();
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    expect(prisma.grade.findMany).toHaveBeenCalled();
    expect(prisma.payment.findFirst).toHaveBeenCalled();
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(DIRECTOR);
    vi.mocked(prisma.studentProfile.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest(`http://localhost/api/students/${STUDENT_ID}/profile-360`), { params: Promise.resolve({ id: STUDENT_ID }) });
    expect(res.status).toBe(500);
  });
});