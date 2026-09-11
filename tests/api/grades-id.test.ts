import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Grade } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({
  assertModelAccess: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAnalyticsAfterGradeChange: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return {
    ...actual,
    invalidateByPath: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("@/lib/prisma", () => ({
  default: {
    grade: { findUnique: vi.fn(), update: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { GET, PATCH, DELETE } from "@/app/api/grades/[id]/route";

const gradeId = cuid("grade000001");
const teacherProfileId = cuid("teacherprof1");
const teacherUserId = cuid("userteacher1");
const evaluationId = cuid("eval000001");

function existingGrade(overrides: Record<string, unknown> = {}) {
  return {
    id: gradeId,
    studentId: FIXTURES.studentA,
    evaluationId,
    value: 12,
    isAbsent: false,
    isExcused: false,
    comment: null,
    evaluation: {
      maxGrade: 20,
      classSubject: { teacherId: teacherProfileId },
    },
    student: { user: { firstName: "Awa", lastName: "Dossou" } },
    ...overrides,
  };
}

const params = { params: Promise.resolve({ id: gradeId }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/grades/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`),
      params
    );
    expect(response.status).toBe(401);
  });

  it("retourne 404 si la note n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(null);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`),
      params
    );
    expect(response.status).toBe(404);
  });

  it("retourne la note pour un DIRECTOR", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);

    const response = await GET(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`),
      params
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe(gradeId);
    expect(body.value).toBe(12);
  });
});

describe("PATCH /api/grades/[id]", () => {
  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));

    const response = await PATCH(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`, {
        method: "PATCH",
        body: { value: 15 },
      }),
      params
    );
    expect(response.status).toBe(403);
  });

  it("un TEACHER ne peut modifier que ses propres matières (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: cuid("autreteacherprofile"),
    } as never);

    const response = await PATCH(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`, {
        method: "PATCH",
        body: { value: 15 },
      }),
      params
    );
    expect(response.status).toBe(403);
    expect(prisma.grade.update).not.toHaveBeenCalled();
  });

  it("rejette une note supérieure au barème (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: teacherProfileId } as never);

    const response = await PATCH(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`, {
        method: "PATCH",
        body: { value: 25 },
      }),
      params
    );
    expect(response.status).toBe(400);
    expect(prisma.grade.update).not.toHaveBeenCalled();
  });

  it("met à jour la note, synchronise analytics et invalide le cache", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: teacherProfileId } as never);
    vi.mocked(prisma.grade.update).mockResolvedValue(
      existingGrade({ value: 17, comment: "Très bien" }) as unknown as Grade
    );

    const response = await PATCH(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`, {
        method: "PATCH",
        body: { value: 17, comment: "Très bien" },
      }),
      params
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.value).toBe(17);
    expect(body.comment).toBe("Très bien");
    expect(syncAnalyticsAfterGradeChange).toHaveBeenCalledWith(evaluationId, [FIXTURES.studentA]);
    expect(invalidateByPath).toHaveBeenCalled();
  });
});

describe("DELETE /api/grades/[id]", () => {
  it("effectue un soft-delete et synchronise les dépendances", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.grade.findUnique).mockResolvedValue(existingGrade() as unknown as Grade);
    vi.mocked(prisma.grade.update).mockResolvedValue(existingGrade() as unknown as Grade);

    const response = await DELETE(
      makeRequest(`http://localhost:3000/api/grades/${gradeId}`, { method: "DELETE" }),
      params
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, softDeleted: true });
    expect(prisma.grade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: gradeId },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
    expect(syncAnalyticsAfterGradeChange).toHaveBeenCalledWith(evaluationId, [FIXTURES.studentA]);
  });
});
