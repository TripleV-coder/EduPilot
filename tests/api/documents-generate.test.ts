import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    behaviorIncident: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/schools/school-parameters-store", async () => {
  const { DEFAULT_SCHOOL_PARAMETERS } = await import("@/lib/schools/school-parameters");
  return { getSchoolParameters: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS) };
});

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/documents/generate/route";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { DEFAULT_SCHOOL_PARAMETERS } from "@/lib/schools/school-parameters";

const url = "http://localhost/api/documents/generate";
const post = (body: unknown) => POST(makeRequest(url, { method: "POST", body }));
const student = (over: Record<string, unknown> = {}) => ({
  id: "stu-1", schoolId: FIXTURES.schoolA, matricule: "M-001",
  user: { firstName: "Awa", lastName: "Dossou" },
  enrollments: [{
    class: { name: "6e A", classLevel: { name: "6e" } },
    academicYear: { id: "y-1", name: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31") },
  }],
  ...over,
});

describe("POST /api/documents/generate — documents officiels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ name: "CEG Akpakpa" } as never);
  });

  it("réservé à la direction : un enseignant ne signe pas pour le directeur (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    expect((await post({ documentType: "CERTIFICATE_ENROLLMENT", studentId: "stu-1" })).status).toBe(403);
  });

  it("rejette un type inconnu ou un élève manquant (400)", async () => {
    expect((await post({ documentType: "DIPLOMA", studentId: "stu-1" })).status).toBe(400);
    expect((await post({ documentType: "CERTIFICATE_ENROLLMENT" })).status).toBe(400);
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un élève d'une autre école (403)", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student({ schoolId: FIXTURES.schoolB }) as never);
    expect((await post({ documentType: "CERTIFICATE_ENROLLMENT", studentId: "stu-1" })).status).toBe(403);
  });

  it("ne certifie pas la scolarité d'un élève sans inscription (409)", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student({ enrollments: [] }) as never);
    const res = await post({ documentType: "CERTIFICATE_ENROLLMENT", studentId: "stu-1" });
    expect(res.status).toBe(409);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("produit le PDF et journalise l'émission avec l'école", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student() as never);
    const res = await post({ documentType: "CERTIFICATE_ENROLLMENT", studentId: "stu-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^data:application\/pdf/);
    expect(body.filename).toBe("CERTIFICATE_ENROLLMENT_M-001.pdf");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "GENERATE", entityId: "stu-1", schoolId: FIXTURES.schoolA }) })
    );
  });

  describe("attestation de bonne conduite (TD-021)", () => {
    const conduct = () => post({ documentType: "BEHAVIOR_REPORT", studentId: "stu-1" });

    it("refusée en présence d'un incident grave sur l'année (409), sans PDF ni journal", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student() as never);
      vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValueOnce([{ severity: "HIGH" }] as never);
      const res = await conduct();
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("CONDUCT_INCIDENTS");
      expect(body.error).toContain("2025-2026");
      // Seuil par défaut : grave (HIGH) et critique, sur les dates de l'année
      expect(vi.mocked(prisma.behaviorIncident.findMany).mock.calls[0][0]).toMatchObject({
        where: {
          studentId: "stu-1",
          severity: { in: ["HIGH", "CRITICAL"] },
          date: { gte: new Date("2025-09-01"), lte: new Date("2026-07-31") },
        },
      });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("délivrée sans incident bloquant", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student() as never);
      vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValueOnce([] as never);
      const res = await conduct();
      expect(res.status).toBe(200);
      expect((await res.json()).filename).toBe("BEHAVIOR_REPORT_M-001.pdf");
    });

    it("suit le seuil de l'école ; 5 = jamais bloquée (aucune recherche d'incident)", async () => {
      vi.mocked(getSchoolParameters).mockResolvedValueOnce({
        ...DEFAULT_SCHOOL_PARAMETERS,
        discipline: { conductCertificateBlockingSeverity: 1 },
      });
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student() as never);
      vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValueOnce([] as never);
      await conduct();
      expect(vi.mocked(prisma.behaviorIncident.findMany).mock.calls[0][0]).toMatchObject({
        where: { severity: { in: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] } },
      });

      vi.mocked(getSchoolParameters).mockResolvedValueOnce({
        ...DEFAULT_SCHOOL_PARAMETERS,
        discipline: { conductCertificateBlockingSeverity: 5 },
      });
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student() as never);
      vi.mocked(prisma.behaviorIncident.findMany).mockClear();
      expect((await conduct()).status).toBe(200);
      expect(prisma.behaviorIncident.findMany).not.toHaveBeenCalled();
    });

    it("refusée sans inscription sur l'année (409)", async () => {
      vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(student({ enrollments: [] }) as never);
      expect((await conduct()).status).toBe(409);
    });
  });
});
