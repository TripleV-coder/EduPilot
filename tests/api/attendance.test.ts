import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_STATS } from "@/app/api/attendance/stats/route";
import { GET, POST as POST_JUST } from "@/app/api/attendance/justifications/route";
import { auth } from "@/lib/auth";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { createNotification } from "@/lib/services/notification.service";
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
vi.mock("@/lib/services/notification.service", () => ({ createNotification: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth/family-scope", () => ({ getOwnStudentIds: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/security/tenant", () => ({
  assertModelAccess: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    academicYear: { findFirst: vi.fn() },
  },
}));

describe("GET /api/attendance/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats"));
    expect(res.status).toBe(401);
  });

  // Audit M5 : la route ne charge plus chaque présence (findMany) pour les
  // compter en mémoire ; PostgreSQL les compte par élève et par statut
  // (groupBy). Mêmes données (s1 : 2 PRESENT, 1 ABSENT, 1 LATE), mêmes
  // assertions ; le calcul réel est vérifié sur PostgreSQL :
  // tests/integration-db/attendance-stats.test.ts.
  it("should compute stats for a teacher", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([
      { studentId: "s1", status: "PRESENT", _count: { _all: 2 } },
      { studentId: "s1", status: "ABSENT", _count: { _all: 1 } },
      { studentId: "s1", status: "LATE", _count: { _all: 1 } },
    ] as never);

    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats?startDate=2026-09-01&endDate=2026-09-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(4);
    expect(body.present).toBe(2);
    expect(body.absent).toBe(1);
    expect(body.late).toBe(1);
    expect(body.byStudent).not.toBeNull();
    expect(body.byStudent.s1).toEqual({ total: 4, present: 2, absent: 1, late: 1, excused: 0, presentRate: "75.00" });
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
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
    vi.mocked(prisma.attendance.groupBy).mockResolvedValue([] as never);

    const res = await GET_STATS(makeRequest("http://localhost/api/attendance/stats"));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.attendance.groupBy).mock.calls[0][0] as unknown as {
      where: { studentId?: object };
    };
    expect(call.where.studentId).toEqual({ in: [FIXTURES.studentA, FIXTURES.studentB] });
  });
});

describe("GET /api/attendance/justifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnStudentIds).mockResolvedValue(null);
  });

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

  it("un élève ne lit que ses propres absences, même avec ?classId= (recette : toute l'école lisible)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(getOwnStudentIds).mockResolvedValue(["s-moi"]);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    await GET(makeRequest("http://localhost/api/attendance/justifications?classId=c1"));
    const call = vi.mocked(prisma.attendance.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.studentId).toEqual({ in: ["s-moi"] });
    expect(call.where.classId).toBeUndefined();
  });

  it("un parent ne peut pas demander les absences d'un autre élève", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(getOwnStudentIds).mockResolvedValue(["s-enfant"]);
    const res = await GET(makeRequest("http://localhost/api/attendance/justifications?studentId=s-autre"));
    expect(res.status).toBe(403);
  });

  it("should use default absence statuses", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);

    await GET(makeRequest("http://localhost/api/attendance/justifications"));
    const call = vi.mocked(prisma.attendance.findMany).mock.calls[0][0] as { where: { status: object } };
    expect(call.where.status).toEqual({ in: ["ABSENT", "EXCUSED", "LATE"] });
  });
});

function absence(overrides: Record<string, unknown> = {}) {
  return {
    status: "ABSENT",
    studentId: "s1",
    date: new Date("2026-09-25T00:00:00.000Z"),
    justificationSubmittedAt: null,
    justificationSubmittedById: null,
    class: { schoolId: "school-1" },
    student: { user: { firstName: "Divine", lastName: "Zinsou" } },
    ...overrides,
  };
}

describe("POST /api/attendance/justifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnStudentIds).mockResolvedValue(null);
  });

  it("le parent envoie un justificatif : l'absence reste en attente de validation (recette : pas de « Justifier »)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u-parent" }));
    vi.mocked(getOwnStudentIds).mockResolvedValue(["s1"]);
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(absence() as never);
    vi.mocked(prisma.attendance.update).mockResolvedValue({ id: "a1", status: "ABSENT" } as never);

    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "Fièvre, certificat médical" } }));
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.attendance.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ reason: "Fièvre, certificat médical", justificationSubmittedById: "u-parent" });
    expect(data.status).toBeUndefined();
  });

  it("refuse au parent l'absence d'un enfant qui n'est pas le sien", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(getOwnStudentIds).mockResolvedValue(["s-autre"]);
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(absence() as never);
    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "x" } }));
    expect(res.status).toBe(403);
    expect(prisma.attendance.update).not.toHaveBeenCalled();
  });

  it("la direction refuse un justificatif : il est retiré et la famille prévenue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(absence({ justificationSubmittedAt: new Date(), justificationSubmittedById: "u-parent" }) as never);
    vi.mocked(prisma.attendance.update).mockResolvedValue({ id: "a1" } as never);
    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", decision: "REJECT" } }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.attendance.update).mock.calls[0][0].data).toEqual({ justificationSubmittedAt: null, justificationSubmittedById: null });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-parent", title: "Justificatif refusé" }));
  });

  it("should return 400 when attendanceId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("should reject justifying a PRESENT student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(absence({ status: "PRESENT" }) as never);

    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "Malade" } }));
    expect(res.status).toBe(400);
  });

  it("should update attendance to EXCUSED and sync analytics", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.attendance.findUnique).mockResolvedValue(absence() as never);
    vi.mocked(prisma.attendance.update).mockResolvedValue({ id: "a1", status: "EXCUSED" } as never);

    const res = await POST_JUST(makeRequest("http://localhost/api/attendance/justifications", { method: "POST", body: { attendanceId: "a1", reason: "Malade", justificationDocument: "https://doc.fr/justif.pdf" } }));
    expect(res.status).toBe(200);
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXCUSED" }) })
    );
  });
});