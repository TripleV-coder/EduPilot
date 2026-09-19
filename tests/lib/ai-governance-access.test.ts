import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    class: { findUnique: vi.fn(), count: vi.fn() },
    studentAnalytics: { findFirst: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    period: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/env", () => ({ appEnv: { ai: { enabled: false, hasExternalKeys: false } } }));
vi.mock("@/lib/analytics/service", () => ({ analyticsService: {} }));
vi.mock("@/lib/services/analytics-sync", () => ({ persistStudentAnalyticsSnapshot: vi.fn() }));
vi.mock("@/lib/services/ai-predictive", () => ({ generateStudentPredictions: vi.fn() }));
vi.mock("@/lib/services/ai-predictive/predict-failure", () => ({ predictFailureRisk: vi.fn() }));
vi.mock("@/lib/ai/external-client", () => ({ callExternalAI: vi.fn() }));

import prisma from "@/lib/prisma";
import { governanceService } from "@/lib/ai/governance-service";

type Req = Parameters<typeof governanceService.execute>[0];
const SCHOOL = "school-a";
const OTHER = "school-b";
const student = { id: "stu-1", userId: "user-stu-1", schoolId: SCHOOL };

function req(overrides: Partial<Req>): Req {
  return { action: "draft-report-comment", userId: "u-1", userRole: "SCHOOL_ADMIN", schoolId: SCHOOL, ...overrides } as Req;
}

// Les règles d'accès sont privées : on les exerce directement.
const svc = governanceService as unknown as {
  ensureStudentScope(r: Req, s: typeof student): Promise<void>;
  ensureClassScope(r: Req, c: { id: string; schoolId: string }): Promise<void>;
  ensureSchoolWideScope(r: Req, schoolId: string): void;
};

async function code(p: Promise<unknown> | (() => unknown)) {
  try {
    await (typeof p === "function" ? p() : p);
    return "OK";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

describe("gouvernance IA — périmètre élève", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse tout accès inter-établissement (hors super-admin)", async () => {
    expect(await code(svc.ensureStudentScope(req({ schoolId: OTHER }), student))).toBe("FORBIDDEN");
    expect(await code(svc.ensureStudentScope(req({ userRole: "SUPER_ADMIN", schoolId: OTHER }), student))).toBe("OK");
  });

  it("un parent n'accède qu'à ses enfants", async () => {
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [{ studentId: "stu-9" }] } as never);
    expect(await code(svc.ensureStudentScope(req({ userRole: "PARENT" }), student))).toBe("FORBIDDEN");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [{ studentId: "stu-1" }] } as never);
    expect(await code(svc.ensureStudentScope(req({ userRole: "PARENT" }), student))).toBe("OK");
  });

  it("un parent sans profil n'accède à rien", async () => {
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect(await code(svc.ensureStudentScope(req({ userRole: "PARENT" }), student))).toBe("FORBIDDEN");
  });

  it("un élève ne consulte que ses propres analyses", async () => {
    expect(await code(svc.ensureStudentScope(req({ userRole: "STUDENT", userId: "user-other" }), student))).toBe("FORBIDDEN");
    expect(await code(svc.ensureStudentScope(req({ userRole: "STUDENT", userId: "user-stu-1" }), student))).toBe("OK");
  });

  it.each(["ACCOUNTANT", "STAFF"])("refuse le rôle %s", async (role) => {
    expect(await code(svc.ensureStudentScope(req({ userRole: role }), student))).toBe("FORBIDDEN");
  });

  it("l'administrateur de réseau hérite des droits d'administration d'école", async () => {
    expect(await code(svc.ensureStudentScope(req({ userRole: "NETWORK_ADMIN" }), student))).toBe("OK");
  });

  it("caractérisation : un enseignant est limité à son école, pas à ses classes", async () => {
    expect(await code(svc.ensureStudentScope(req({ userRole: "TEACHER" }), student))).toBe("OK");
  });
});

describe("gouvernance IA — périmètre classe", () => {
  beforeEach(() => vi.clearAllMocks());
  const klass = { id: "class-1", schoolId: SCHOOL };

  it("refuse parents et élèves", async () => {
    expect(await code(svc.ensureClassScope(req({ userRole: "PARENT" }), klass))).toBe("FORBIDDEN");
    expect(await code(svc.ensureClassScope(req({ userRole: "STUDENT" }), klass))).toBe("FORBIDDEN");
  });

  it("un enseignant n'analyse que les classes où il enseigne", async () => {
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp-1" } as never);
    vi.mocked(prisma.class.count).mockResolvedValueOnce(0 as never);
    expect(await code(svc.ensureClassScope(req({ userRole: "TEACHER" }), klass))).toBe("FORBIDDEN");
    vi.mocked(prisma.class.count).mockResolvedValueOnce(1 as never);
    expect(await code(svc.ensureClassScope(req({ userRole: "TEACHER" }), klass))).toBe("OK");
    expect(vi.mocked(prisma.class.count).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ id: "class-1" }) })
    );
  });

  it("un enseignant sans profil est refusé", async () => {
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce(null as never);
    expect(await code(svc.ensureClassScope(req({ userRole: "TEACHER" }), klass))).toBe("FORBIDDEN");
  });

  it("refuse une classe d'un autre établissement", async () => {
    expect(await code(svc.ensureClassScope(req({ userRole: "DIRECTOR", schoolId: OTHER }), klass))).toBe("FORBIDDEN");
  });
});

describe("gouvernance IA — périmètre établissement", () => {
  it("réservé à la direction et à l'administration", async () => {
    expect(await code(() => svc.ensureSchoolWideScope(req({ userRole: "TEACHER" }), SCHOOL))).toBe("FORBIDDEN");
    expect(await code(() => svc.ensureSchoolWideScope(req({ userRole: "DIRECTOR" }), SCHOOL))).toBe("OK");
    expect(await code(() => svc.ensureSchoolWideScope(req({ userRole: "DIRECTOR" }), OTHER))).toBe("FORBIDDEN");
    expect(await code(() => svc.ensureSchoolWideScope(req({ userRole: "NETWORK_ADMIN" }), SCHOOL))).toBe("OK");
  });
});

describe("gouvernance IA — exécution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejette une action inconnue (400)", async () => {
    await expect(governanceService.execute(req({ action: "hack" as Req["action"] }), Date.now())).rejects.toMatchObject({ code: "INVALID_ACTION", status: 400 });
  });

  it("exige un élève pour l'appréciation, et 404 s'il n'existe pas", async () => {
    await expect(governanceService.execute(req({}), Date.now())).rejects.toMatchObject({ code: "MISSING_STUDENT_ID" });
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    await expect(governanceService.execute(req({ studentId: "nope" }), Date.now())).rejects.toMatchObject({ code: "STUDENT_NOT_FOUND", status: 404 });
  });

  it("n'appelle jamais l'IA pour un élève hors périmètre", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...student, schoolId: OTHER, user: { firstName: "A", lastName: "B" } } as never);
    await expect(governanceService.execute(req({ studentId: "stu-1" }), Date.now())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prisma.studentAnalytics.findFirst).not.toHaveBeenCalled();
  });

  it("rédige une appréciation par gabarit sans IA externe configurée", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...student, user: { firstName: "Awa", lastName: "Dossou" } } as never);
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null as never);
    const res = await governanceService.execute(req({ studentId: "stu-1" }), Date.now());
    expect(res.success).toBe(true);
    expect(typeof (res.data as { comment: string }).comment).toBe("string");
    expect((res.data as { comment: string }).comment.length).toBeGreaterThan(10);
  });
});
