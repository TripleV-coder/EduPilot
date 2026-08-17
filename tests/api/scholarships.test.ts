import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/scholarships/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "@/app/api/scholarships/[id]/route";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Modèles lus : studentProfile + parentProfile (filtrage par rôle du GET),
// scholarship (list/detail/CRUD), auditLog + notification (journal & alertes).
// assertModelAccess (tenant.ts) lit aussi scholarship pour résoudre l'école.
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    scholarship: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}));

const SCHOOL_ADMIN = makeSession("SCHOOL_ADMIN");
const scholarshipId = cuid("schol1");

function scholarshipRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: scholarshipId,
    studentId: FIXTURES.studentA,
    name: "Bourse Excellence",
    type: "MERIT",
    amount: 50000,
    percentage: null,
    startDate: new Date("2026-01-01"),
    endDate: null,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    student: {
      id: FIXTURES.studentA,
      user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
      enrollments: [{ status: "ACTIVE", class: { classLevel: { code: "6E", name: "6ème" } } }],
    },
    ...overrides,
  };
}

/** Mock des deux lectures de scholarship.findUnique (guard assertModelAccess puis lecture principale). */
function mockScholarshipReads(record: Record<string, unknown>, resolverSchoolId = FIXTURES.schoolA) {
  vi.mocked(prisma.scholarship.findUnique)
    .mockResolvedValueOnce({ student: { schoolId: resolverSchoolId } } as never)
    .mockResolvedValue(record as never);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/scholarships", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle sans accès (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
    expect(prisma.scholarship.findMany).not.toHaveBeenCalled();
  });

  it("restreint un STUDENT à son propre profil (404 sans profil)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null as never);
    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Profil non trouvé");
  });

  it("filtre pour un STUDENT sur son studentId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([scholarshipRecord()] as never);

    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(vi.mocked(prisma.scholarship.findMany).mock.calls[0][0].where.studentId).toBe(FIXTURES.studentA);
  });

  it("filtre pour un PARENT sur les étudiants liés", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ student: { id: FIXTURES.studentA } }],
    } as never);
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.scholarship.findMany).mock.calls[0][0].where.studentId).toEqual({
      in: [FIXTURES.studentA],
    });
  });

  it("borne un SCHOOL_ADMIN aux bourses de son école (avec filtre isActive)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([scholarshipRecord()] as never);

    const res = await GET(makeRequest("http://localhost/api/scholarships?isActive=true"));
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.scholarship.findMany).mock.calls[0][0].where as Record<string, unknown>;
    expect(where.student).toEqual({ schoolId: FIXTURES.schoolA });
    expect(where.isActive).toBe(true);
  });

  it("filtre par studentId pour un SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([] as never);

    await GET(makeRequest(`http://localhost/api/scholarships?studentId=${FIXTURES.studentB}`));
    expect(vi.mocked(prisma.scholarship.findMany).mock.calls[0][0].where.studentId).toBe(FIXTURES.studentB);
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findMany).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/scholarships"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur");
  });
});

describe("POST /api/scholarships", () => {
  const validBody = {
    studentId: FIXTURES.studentA,
    name: "Bourse Excellence",
    type: "MERIT",
    amount: 50000,
    startDate: "2026-01-01T00:00:00.000Z",
  };

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
  });

  it("rejette un body sans montant ni pourcentage (400)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    const res = await POST(
      makeRequest("http://localhost/api/scholarships", {
        method: "POST",
        body: { studentId: FIXTURES.studentA, name: "Bourse Excellence", type: "MERIT", startDate: "2026-01-01T00:00:00.000Z" },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Données invalides");
    expect(body.details).toBeDefined();
  });

  it("retourne 404 si l'étudiant n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null as never);
    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Étudiant non trouvé");
  });

  it("bloque une bourse pour un étudiant d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolB,
      user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
      parentStudents: [],
    } as never);
    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
    expect(prisma.scholarship.create).not.toHaveBeenCalled();
  });

  it("crée la bourse, journalise et notifie l'étudiant et les parents (201)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
      parentStudents: [{ parent: { user: { id: cuid("parent1") } } }],
    } as never);
    vi.mocked(prisma.scholarship.create).mockResolvedValue(scholarshipRecord() as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(scholarshipId);
    expect(vi.mocked(prisma.scholarship.create).mock.calls[0][0].data).toMatchObject({
      studentId: FIXTURES.studentA,
      name: "Bourse Excellence",
      type: "MERIT",
      amount: 50000,
      isActive: true,
    });
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data).toMatchObject({
      action: "CREATE",
      entity: "Scholarship",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ userId: cuid("parent1") })]) })
    );
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
      parentStudents: [],
    } as never);
    vi.mocked(prisma.scholarship.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/scholarships", { method: "POST", body: validBody }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur");
  });
});

describe("GET /api/scholarships/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la bourse n'existe pas ou hors périmètre", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findUnique).mockResolvedValueOnce(null as never);
    const res = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Bourse non trouvée");
  });

  it("bloque l'accès à une bourse d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findUnique).mockResolvedValueOnce({
      student: { schoolId: FIXTURES.schoolB },
    } as never);
    const res = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(403);
  });

  it("refuse un rôle sans accès (TEACHER, 403) après le guard tenant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    mockScholarshipReads(scholarshipRecord());
    const res = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("permet à un STUDENT de lire sa propre bourse (403 sinon)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    mockScholarshipReads(scholarshipRecord());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);

    const ok = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).id).toBe(scholarshipId);

    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentB } as never);
    // Re-mocker le guard tenant : le mockResolvedValueOnce précédent est déjà consommé
    vi.mocked(prisma.scholarship.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never);
    const ko = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(ko.status).toBe(403);
    expect((await ko.json()).error).toBe("Accès refusé");
  });

  it("permet à un PARENT lié de lire la bourse (403 sinon)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "parent-user-1" }));
    mockScholarshipReads(
      scholarshipRecord({
        student: {
          id: FIXTURES.studentA,
          user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
          parentStudents: [{ parent: { user: { id: "parent-user-1" } } }],
        },
      })
    );

    const ok = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(ok.status).toBe(200);

    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "other-parent" }));
    mockScholarshipReads(
      scholarshipRecord({
        student: {
          id: FIXTURES.studentA,
          user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
          parentStudents: [{ parent: { user: { id: "parent-user-1" } } }],
        },
      })
    );
    const ko = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(ko.status).toBe(403);
    expect((await ko.json()).error).toBe("Accès refusé");
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockRejectedValue(new Error("db down"));
    const res = await GET_BY_ID(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur");
  });
});

describe("PATCH /api/scholarships/[id]", () => {
  it("refuse un SUPER_ADMIN (rôle hors allowedRoles, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await PATCH(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "PATCH", body: { name: "Bourse Révisée" } }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(403);
  });

  it("rejette un body invalide avec 400 + détails Zod", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    mockScholarshipReads(scholarshipRecord());
    const res = await PATCH(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "PATCH", body: { name: "x" } }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Données invalides");
    expect(body.details).toBeDefined();
  });

  it("met à jour la bourse et journalise (200)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    mockScholarshipReads(scholarshipRecord());
    vi.mocked(prisma.scholarship.update).mockResolvedValue(
      scholarshipRecord({ name: "Bourse Révisée", percentage: 25 }) as never
    );
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await PATCH(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "PATCH", body: { name: "Bourse Révisée", percentage: 25 } }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Bourse Révisée");
    expect(vi.mocked(prisma.scholarship.update).mock.calls[0][0].data).toEqual({
      name: "Bourse Révisée",
      percentage: 25,
    });
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data).toMatchObject({
      action: "UPDATE",
      entity: "Scholarship",
    });
  });

  it("notifie étudiant et parents quand le statut change", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    mockScholarshipReads(
      scholarshipRecord({
        student: {
          id: FIXTURES.studentA,
          user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
          parentStudents: [{ parent: { user: { id: cuid("parent1") } } }],
        },
      })
    );
    vi.mocked(prisma.scholarship.update).mockResolvedValue(
      scholarshipRecord({ isActive: false }) as never
    );
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await PATCH(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "PATCH", body: { isActive: false } }), {
      params: Promise.resolve({ id: scholarshipId }),
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.notification.create).mock.calls[0][0].data).toMatchObject({
      type: "WARNING",
      title: "Bourse désactivée",
    });
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findUnique)
      .mockResolvedValueOnce({ student: { schoolId: FIXTURES.schoolA } } as never)
      .mockResolvedValue(scholarshipRecord() as never);
    vi.mocked(prisma.scholarship.update).mockRejectedValue(new Error("db down"));
    const res = await PATCH(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "PATCH", body: { name: "Bourse Révisée" } }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur");
  });
});

describe("DELETE /api/scholarships/[id]", () => {
  it("refuse un SUPER_ADMIN (rôle hors allowedRoles, 403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await DELETE(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la bourse n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    vi.mocked(prisma.scholarship.findUnique).mockResolvedValueOnce(null as never);
    const res = await DELETE(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(404);
  });

  it("supprime la bourse, journalise et notifie (200)", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    mockScholarshipReads(
      scholarshipRecord({
        student: {
          id: FIXTURES.studentA,
          user: { id: cuid("studuser1"), firstName: "Awa", lastName: "Dossou" },
          parentStudents: [{ parent: { user: { id: cuid("parent1") } } }],
        },
      })
    );
    vi.mocked(prisma.scholarship.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await DELETE(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.scholarship.delete).toHaveBeenCalledWith({ where: { id: scholarshipId } });
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data).toMatchObject({
      action: "DELETE",
      entity: "Scholarship",
    });
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("retourne 500 sur erreur prisma", async () => {
    vi.mocked(auth).mockResolvedValue(SCHOOL_ADMIN);
    mockScholarshipReads(scholarshipRecord());
    vi.mocked(prisma.scholarship.delete).mockRejectedValue(new Error("db down"));
    const res = await DELETE(makeRequest(`http://localhost/api/scholarships/${scholarshipId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: scholarshipId }),
    });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur");
  });
});