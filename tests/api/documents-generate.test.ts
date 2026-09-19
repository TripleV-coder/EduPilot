import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/documents/generate/route";

const url = "http://localhost/api/documents/generate";
const post = (body: unknown) => POST(makeRequest(url, { method: "POST", body }));
const student = (over: Record<string, unknown> = {}) => ({
  id: "stu-1", schoolId: FIXTURES.schoolA, matricule: "M-001",
  user: { firstName: "Awa", lastName: "Dossou" },
  enrollments: [{ class: { name: "6e A", classLevel: { name: "6e" } } }],
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
});
