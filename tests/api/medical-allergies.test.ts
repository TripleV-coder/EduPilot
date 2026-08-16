import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    medicalRecord: { findUnique: vi.fn() },
    allergy: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST, DELETE } from "@/app/api/medical-records/[id]/allergies/route";

const schoolId = FIXTURES.schoolA;
const recordId = cuid("medrecord0001");
const allergyId = cuid("allergy000001");
const studentId = FIXTURES.studentA;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/medical-records/[id]/allergies", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(
      makeRequest(`http://localhost/api/medical-records/${recordId}/allergies`, {
        method: "POST",
        body: { allergen: "Arachide", severity: "HIGH" },
      }) as never,
      { params: Promise.resolve({ id: recordId }) }
    );
    expect(res.status).toBe(401);
  });

  it("crée une allergie pour le staff autorisé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId }));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({
      id: recordId,
      studentId,
      student: { id: studentId, schoolId, userId: cuid("studentuser01") },
    } as never);
    vi.mocked(prisma.allergy.create).mockResolvedValue({
      id: allergyId,
      medicalRecordId: recordId,
      allergen: "Arachide",
      severity: "HIGH",
      reaction: null,
      treatment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await POST(
      makeRequest(`http://localhost/api/medical-records/${recordId}/allergies`, {
        method: "POST",
        body: { allergen: "Arachide", severity: "HIGH" },
      }) as never,
      { params: Promise.resolve({ id: recordId }) }
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.allergen).toBe("Arachide");
    expect(prisma.allergy.create).toHaveBeenCalledOnce();
  });

  it("refuse un TEACHER hors rôles santé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId }));
    const res = await POST(
      makeRequest(`http://localhost/api/medical-records/${recordId}/allergies`, {
        method: "POST",
        body: { allergen: "Arachide", severity: "HIGH" },
      }) as never,
      { params: Promise.resolve({ id: recordId }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/medical-records/[id]/allergies", () => {
  it("supprime une allergie du dossier", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId }));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({
      id: recordId,
      studentId,
      student: { id: studentId, schoolId, userId: cuid("studentuser01") },
    } as never);
    vi.mocked(prisma.allergy.findUnique).mockResolvedValue({
      id: allergyId,
      medicalRecordId: recordId,
    } as never);
    vi.mocked(prisma.allergy.delete).mockResolvedValue({ id: allergyId } as never);

    const res = await DELETE(
      makeRequest(
        `http://localhost/api/medical-records/${recordId}/allergies?allergyId=${allergyId}`,
        { method: "DELETE" }
      ) as never,
      { params: Promise.resolve({ id: recordId }) }
    );

    expect(res.status).toBe(200);
    expect(prisma.allergy.delete).toHaveBeenCalledWith({ where: { id: allergyId } });
  });
});
