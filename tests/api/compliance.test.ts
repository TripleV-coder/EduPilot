import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/rgpd", () => ({ exportUserData: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    dataAccessRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { exportUserData } from "@/lib/security/rgpd";
import {
  GET as GET_LIST,
  POST as POST_CREATE,
} from "@/app/api/compliance/data-requests/route";
import {
  GET as GET_BY_ID,
  PATCH as PATCH_BY_ID,
} from "@/app/api/compliance/data-requests/[id]/route";
import { POST as POST_FULFILL } from "@/app/api/compliance/data-requests/[id]/fulfill/route";

const requestId = cuid("dr1");

function requestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId,
    userId: "cuser1",
    requestType: "EXPORT",
    status: "PENDING",
    requestedAt: new Date("2026-01-01"),
    user: {
      id: "cuser1",
      firstName: "Awa",
      lastName: "Dossou",
      email: "a@b.bj",
      role: "STUDENT",
      schoolId: FIXTURES.schoolA,
    },
    processor: null,
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/compliance/data-requests", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_LIST(makeRequest("http://localhost:3000/api/compliance/data-requests"));
    expect(res.status).toBe(401);
  });

  it("liste les demandes d'un STUDENT (paginé, body.requests)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findMany).mockResolvedValue([requestRecord()]);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(1);

    const res = await GET_LIST(
      makeRequest("http://localhost:3000/api/compliance/data-requests?status=PENDING")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.requests).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    const where = vi.mocked(prisma.dataAccessRequest.findMany).mock.calls[0][0] as {
      where: { userId?: string; status?: string; user?: { schoolId: string } };
    };
    expect(where.where.userId).toBeDefined();
    expect(where.where.status).toBe("PENDING");
  });

  it("cloisonne un SCHOOL_ADMIN aux demandes de son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.dataAccessRequest.count).mockResolvedValue(0);

    const res = await GET_LIST(makeRequest("http://localhost:3000/api/compliance/data-requests"));
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.dataAccessRequest.findMany).mock.calls[0][0] as {
      where: { user: { schoolId: string } };
    };
    expect(where.where.user.schoolId).toBe(FIXTURES.schoolA);
  });

  it("refuse un SCHOOL_ADMIN sans établissement associé (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: null }));
    const res = await GET_LIST(makeRequest("http://localhost:3000/api/compliance/data-requests"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Compte orphelin : aucun établissement associé.");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findMany).mockRejectedValue(new Error("db down"));

    const res = await GET_LIST(makeRequest("http://localhost:3000/api/compliance/data-requests"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/compliance/data-requests", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "EXPORT" },
    }));
    expect(res.status).toBe(401);
  });

  it("rejette un requestType invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "BOGUS" },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).details).toBeDefined();
  });

  it("refuse une demande dupliquée en cours (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findFirst).mockResolvedValue(requestRecord());

    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "EXPORT" },
    }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Vous avez déjà une demande en cours de ce type");
    expect(prisma.dataAccessRequest.create).not.toHaveBeenCalled();
  });

  it("crée la demande, journalise l'audit et notifie les admins", async () => {
    const session = makeSession("STUDENT");
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(prisma.dataAccessRequest.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.dataAccessRequest.create).mockResolvedValue(
      requestRecord({ user: { firstName: "Awa", lastName: "Dossou", email: "a@b.bj" } })
    );
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: cuid("admin1") }] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "EXPORT", notes: "portabilité" },
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.requestType).toBe("EXPORT");
    const createArgs = vi.mocked(prisma.dataAccessRequest.create).mock.calls[0][0] as {
      data: { userId: string; requestType: string; notes?: string };
    };
    expect(createArgs.data.userId).toBe(session.user!.id);
    expect(createArgs.data.notes).toBe("portabilité");
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ userId: cuid("admin1"), type: "WARNING" })],
      })
    );
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0]).toMatchObject({
      data: { action: "CREATE_DATA_REQUEST", entity: "DataAccessRequest" },
    });
  });

  it("ne notifie pas si aucun admin n'existe", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.dataAccessRequest.create).mockResolvedValue(requestRecord());
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "DELETION" },
    }));

    expect(res.status).toBe(201);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findFirst).mockRejectedValue(new Error("db down"));

    const res = await POST_CREATE(makeRequest("http://localhost:3000/api/compliance/data-requests", {
      method: "POST",
      body: { requestType: "EXPORT" },
    }));

    expect(res.status).toBe(500);
  });
});

describe("GET /api/compliance/data-requests/[id]", () => {
  function params() {
    return { params: Promise.resolve({ id: requestId }) };
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la demande n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(null as never);

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Demande non trouvée");
  });

  it("refuse à un STUDENT une demande qui n'est pas la sienne (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(requestRecord());

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("autorise un STUDENT sur sa propre demande", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ userId: makeSession("STUDENT").user!.id })
    );

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(200);
  });

  it("cloisonne un SCHOOL_ADMIN à son école (403 sinon)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ user: { schoolId: FIXTURES.schoolB } })
    );

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(403);
  });

  it("autorise un SCHOOL_ADMIN sur une demande de son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(requestRecord());

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(200);
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET_BY_ID(makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`), params());
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/compliance/data-requests/[id]", () => {
  function params() {
    return { params: Promise.resolve({ id: requestId }) };
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      params()
    );
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      params()
    );
    expect(res.status).toBe(403);
  });

  it("rejette un statut invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "BOGUS" },
      }),
      params()
    );
    expect(res.status).toBe(400);
  });

  it("retourne 404 si la demande n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(null as never);

    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      params()
    );
    expect(res.status).toBe(404);
  });

  it("bloque un SCHOOL_ADMIN hors école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ user: { schoolId: FIXTURES.schoolB } })
    );

    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      params()
    );

    expect(res.status).toBe(403);
    expect(prisma.dataAccessRequest.update).not.toHaveBeenCalled();
  });

  it("met à jour la demande, notifie l'utilisateur et journalise l'audit", async () => {
    const session = makeSession("SCHOOL_ADMIN");
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ user: { id: "cuser1", firstName: "Awa", lastName: "Dossou" } })
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(prisma.dataAccessRequest.update).mockResolvedValue(requestRecord());
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "COMPLETED", notes: "fait" },
      }),
      params()
    );

    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.dataAccessRequest.update).mock.calls[0][0] as {
      data: { status: string; processor: { connect: { id: string } } };
    };
    expect(updateArgs.data.status).toBe("COMPLETED");
    expect(updateArgs.data.processor.connect.id).toBe(session.user!.id);
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0]).toMatchObject({
      data: { action: "UPDATE_DATA_REQUEST", entityId: requestId },
    });
  });

  it("un SUPER_ADMIN traite sans vérification d'école", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ user: { id: "cuser1", firstName: "Awa", lastName: "Dossou" } })
    );
    vi.mocked(prisma.dataAccessRequest.update).mockResolvedValue(requestRecord());
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "REJECTED" },
      }),
      params()
    );

    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockRejectedValue(new Error("db down"));

    const res = await PATCH_BY_ID(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}`, {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      params()
    );

    expect(res.status).toBe(500);
  });
});

describe("POST /api/compliance/data-requests/[id]/fulfill", () => {
  function params() {
    return { params: Promise.resolve({ id: requestId }) };
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );
    expect(res.status).toBe(401);
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );
    expect(res.status).toBe(403);
  });

  it("retourne 404 si la demande n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(null as never);

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );
    expect(res.status).toBe(404);
  });

  it("bloque un SCHOOL_ADMIN hors école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ user: { schoolId: FIXTURES.schoolB } })
    );

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );

    expect(res.status).toBe(403);
    expect(exportUserData).not.toHaveBeenCalled();
  });

  it("refuse de traiter une demande déjà complétée (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ status: "COMPLETED" })
    );

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Demande déjà complétée");
  });

  it("refuse les types non automatisables (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(
      requestRecord({ requestType: "RECTIFICATION" })
    );

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );

    expect(res.status).toBe(400);
    expect(exportUserData).not.toHaveBeenCalled();
  });

  it("exporte les données et complète la demande (EXPORT)", async () => {
    vi.mocked(auth).mockResolvedValue(
      makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" })
    );
    vi.mocked(prisma.dataAccessRequest.findUnique).mockResolvedValue(requestRecord());
    vi.mocked(exportUserData).mockResolvedValue({
      user: { id: "cuser1", email: "a@b.bj" },
      grades: [],
      payments: [],
    });
    vi.mocked(prisma.dataAccessRequest.update).mockResolvedValue(
      requestRecord({ status: "COMPLETED" })
    );

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("a@b.bj");
    expect(exportUserData).toHaveBeenCalledWith("cuser1");
    const updateArgs = vi.mocked(prisma.dataAccessRequest.update).mock.calls[0][0] as {
      data: { status: string; processedBy: string; completedAt: Date };
    };
    expect(updateArgs.data.status).toBe("COMPLETED");
    expect(updateArgs.data.processedBy).toBe("root1");
  });

  it("retourne 500 sur erreur de base de données", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.dataAccessRequest.findUnique).mockRejectedValue(new Error("db down"));

    const res = await POST_FULFILL(
      makeRequest(`http://localhost:3000/api/compliance/data-requests/${requestId}/fulfill`, {
        method: "POST",
      }),
      params()
    );

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du traitement de la demande");
  });
});