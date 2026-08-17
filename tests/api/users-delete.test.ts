import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
    message: { updateMany: vi.fn(), deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    homeworkSubmission: { deleteMany: vi.fn() },
    attendance: { deleteMany: vi.fn() },
    grade: { deleteMany: vi.fn() },
    payment: { deleteMany: vi.fn() },
    enrollment: { deleteMany: vi.fn() },
    parentStudent: { deleteMany: vi.fn() },
    studentProfile: { delete: vi.fn() },
    classSubject: { updateMany: vi.fn() },
    class: { updateMany: vi.fn() },
    teacherProfile: { delete: vi.fn() },
    parentProfile: { delete: vi.fn() },
    session: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/users/[id]/delete/route";

const TARGET_ID = cuid("usertarget");
const TARGET_EMAIL = "awa@school.bj";
const OWNER_ID = cuid("userowner");

function deleteRequest(id: string, body: Record<string, unknown>) {
  return POST(
    makeRequest(`http://localhost:3000/api/users/${id}/delete`, { method: "POST", body }),
    { params: Promise.resolve({ id }) }
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    confirmEmail: TARGET_EMAIL,
    deleteType: "SOFT",
    ...overrides,
  };
}

function targetUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    email: TARGET_EMAIL,
    firstName: "Awa",
    lastName: "Dossou",
    role: "PARENT",
    teacherProfile: null,
    studentProfile: null,
    parentProfile: null,
    ...overrides,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/users/[id]/delete", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await deleteRequest(TARGET_ID, validBody());
    expect(res.status).toBe(401);
  });

  it("retourne 400 sur un body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    const res = await deleteRequest(TARGET_ID, { confirmEmail: "pas-un-email" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("refuse la suppression du compte d'un autre user (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: OWNER_ID }));
    const res = await deleteRequest(TARGET_ID, validBody());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("propre compte");
  });

  it("retourne 404 si l'utilisateur cible n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await deleteRequest(TARGET_ID, validBody());
    expect(res.status).toBe(404);
  });

  it("retourne 400 si l'email de confirmation ne correspond pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser());

    const res = await deleteRequest(TARGET_ID, validBody({ confirmEmail: "autre@school.bj" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("ne correspond pas");
  });

  it("refuse la suppression HARD par un non-super-admin (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser());

    const res = await deleteRequest(TARGET_ID, validBody({ deleteType: "HARD" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("super administrateur");
  });

  it("anonymise le compte en suppression SOFT (RGPD)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser());
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);
    vi.mocked(prisma.user.update).mockResolvedValue(targetUser() as never);
    vi.mocked(prisma.message.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await deleteRequest(TARGET_ID, validBody({ reason: "Départ" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("SOFT");
    expect(body.message).toContain("anonymisé");
    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(updateArgs.data.email).toBe(`deleted_${TARGET_ID}@anonymized.local`);
    expect(updateArgs.data.firstName).toBe("Utilisateur Supprimé");
    expect(updateArgs.data.isActive).toBe(false);
    expect(vi.mocked(prisma.message.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedBySender: true }) })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "ACCOUNT_DELETE_SOFT" }) })
    );
  });

  it("supprime définitivement en HARD avec nettoyage en transaction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: OWNER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      targetUser({
        studentProfile: {
          id: cuid("studentp"),
          enrollments: [],
          grades: [],
          payments: [],
        },
      })
    );
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.message.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.homeworkSubmission.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.attendance.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.grade.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.payment.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.enrollment.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.parentStudent.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.studentProfile.delete).mockResolvedValue({ id: cuid("studentp") } as never);
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.account.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: TARGET_ID } as never);

    const res = await deleteRequest(TARGET_ID, validBody({ deleteType: "HARD" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("HARD");
    expect(body.message).toContain("définitivement");
    expect(vi.mocked(prisma.notification.deleteMany)).toHaveBeenCalledWith({ where: { userId: TARGET_ID } });
    expect(vi.mocked(prisma.user.delete)).toHaveBeenCalledWith({ where: { id: TARGET_ID } });
  });

  it("supprime en HARD sans profil étudiant ni enseignant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: OWNER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser());
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.message.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.account.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: TARGET_ID } as never);

    const res = await deleteRequest(TARGET_ID, validBody({ deleteType: "HARD" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.studentProfile.delete)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.teacherProfile.delete)).not.toHaveBeenCalled();
  });

  it("retourne 500 si la suppression échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: TARGET_ID }));
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));

    const res = await deleteRequest(TARGET_ID, validBody());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("suppression du compte");
  });
});