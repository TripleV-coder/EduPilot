import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teacherProfile: { create: vi.fn() },
    studentProfile: { create: vi.fn() },
    parentProfile: { create: vi.fn() },
    teacherSchoolAssignment: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
// bcryptjs : hash réel coûteux (12 rounds) → mock au niveau module.
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn(),
}));
// @/lib/email charge nodemailer → mock au niveau module.
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return {
    ...actual,
    invalidateByPath: vi.fn().mockResolvedValue(undefined),
  };
});

import prisma from "@/lib/prisma";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { sendWelcomeEmail } from "@/lib/email";
import { POST } from "@/app/api/users/invite/route";

const INVITER_ID = cuid("userdirector");

function inviteRequest(body: Record<string, unknown>) {
  return POST(
    makeRequest("http://localhost:3000/api/users/invite", { method: "POST", body })
  );
}

const VALID_BODY = {
  firstName: "Kofi",
  lastName: "Ade",
  email: "kofi@school.bj",
  role: "TEACHER",
  schoolId: FIXTURES.schoolA,
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/users/invite", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("retourne 404 si l'inviteur n'existe pas en base", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Utilisateur non trouvé.");
  });

  it("refuse un TEACHER qui veut inviter (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("userteacher") }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: cuid("userteacher"),
      role: "TEACHER",
      schoolId: FIXTURES.schoolA,
    } as never);

    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("permission");
  });

  it("retourne 400 sur un body invalide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: INVITER_ID,
      role: "DIRECTOR",
      schoolId: FIXTURES.schoolA,
    } as never);

    const res = await inviteRequest({ ...VALID_BODY, firstName: "X" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("refuse un DIRECTOR qui invite un SCHOOL_ADMIN (403 canCreateRole)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: INVITER_ID,
      role: "DIRECTOR",
      schoolId: FIXTURES.schoolA,
    } as never);

    const res = await inviteRequest({ ...VALID_BODY, role: "SCHOOL_ADMIN" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("pas autorisé");
  });

  it("retourne 400 si un SUPER_ADMIN invite sans établissement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: cuid("userroot"), schoolId: null }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: cuid("userroot"),
      role: "SUPER_ADMIN",
      schoolId: null,
    } as never);

    const res = await inviteRequest({ ...VALID_BODY, schoolId: undefined });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("établissement");
  });

  it("permet à un SUPER_ADMIN d'inviter un SCHOOL_ADMIN avec établissement (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: cuid("userroot"), schoolId: null }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: cuid("userroot"), role: "SUPER_ADMIN", schoolId: null } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("usernew"),
      email: "kofi@school.bj",
      firstName: "Kofi",
      lastName: "Ade",
      role: "SCHOOL_ADMIN",
    } as never);

    const res = await inviteRequest({ ...VALID_BODY, role: "SCHOOL_ADMIN" });
    expect(res.status).toBe(201);
    const createdUser = vi.mocked(prisma.user.create).mock.calls[0][0].data;
    expect(createdUser.schoolId).toBe(FIXTURES.schoolA);
  });

  it("retourne 400 si l'email existe déjà", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: INVITER_ID,
        role: "DIRECTOR",
        schoolId: FIXTURES.schoolA,
      } as never)
      .mockResolvedValueOnce({ id: cuid("userkofi"), email: "kofi@school.bj" } as never);

    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("existe déjà");
  });

  it("force l'école de l'inviteur pour un DIRECTOR (pas de cross-tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID, schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: INVITER_ID,
        role: "DIRECTOR",
        schoolId: FIXTURES.schoolA,
      } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("usernew"),
      email: "kofi@school.bj",
      firstName: "Kofi",
      lastName: "Ade",
      role: "TEACHER",
    } as never);
    vi.mocked(prisma.teacherProfile.create).mockResolvedValue({ id: cuid("teachernew") } as never);
    vi.mocked(prisma.teacherSchoolAssignment.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await inviteRequest({ ...VALID_BODY, schoolId: FIXTURES.schoolB });
    expect(res.status).toBe(201);
    const createdUser = vi.mocked(prisma.user.create).mock.calls[0][0].data;
    expect(createdUser.schoolId).toBe(FIXTURES.schoolA);
  });

  it("invite un TEACHER avec profil et affectation d'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: cuid("userroot"), schoolId: null }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: cuid("userroot"), role: "SUPER_ADMIN", schoolId: null } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("usernew"),
      email: "kofi@school.bj",
      firstName: "Kofi",
      lastName: "Ade",
      role: "TEACHER",
    } as never);
    vi.mocked(prisma.teacherProfile.create).mockResolvedValue({ id: cuid("teachernew") } as never);
    vi.mocked(prisma.teacherSchoolAssignment.createMany).mockResolvedValue({ count: 1 } as never);

    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("invité avec succès");
    expect(body.user.role).toBe("TEACHER");
    expect(prisma.teacherProfile.create).toHaveBeenCalled();
    expect(prisma.teacherSchoolAssignment.createMany).toHaveBeenCalled();
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "kofi@school.bj", tempPassword: expect.any(String) })
    );
    expect(invalidateByPath).toHaveBeenCalledWith("/api/users");
    expect(invalidateByPath).toHaveBeenCalledWith("/api/teachers");
  });

  it("invite un STUDENT avec matricule généré", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: cuid("userroot"), schoolId: null }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: cuid("userroot"), role: "SUPER_ADMIN", schoolId: null } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("usernew"),
      email: "kofi@school.bj",
      firstName: "Kofi",
      lastName: "Ade",
      role: "STUDENT",
    } as never);
    vi.mocked(prisma.studentProfile.create).mockResolvedValue({ id: cuid("studentnew") } as never);

    const res = await inviteRequest({ ...VALID_BODY, role: "STUDENT" });
    expect(res.status).toBe(201);
    expect(prisma.studentProfile.create).toHaveBeenCalled();
    const createdArgs = vi.mocked(prisma.studentProfile.create).mock.calls[0][0];
    expect(createdArgs.data.matricule).toContain("STU-");
    expect(invalidateByPath).toHaveBeenCalledWith("/api/students");
  });

  it("invite un PARENT avec profil parent", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: cuid("userroot"), schoolId: null }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: cuid("userroot"), role: "SUPER_ADMIN", schoolId: null } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("usernew"),
      email: "kofi@school.bj",
      firstName: "Kofi",
      lastName: "Ade",
      role: "PARENT",
    } as never);
    vi.mocked(prisma.parentProfile.create).mockResolvedValue({ id: cuid("parentnew") } as never);

    const res = await inviteRequest({ ...VALID_BODY, role: "PARENT" });
    expect(res.status).toBe(201);
    expect(prisma.parentProfile.create).toHaveBeenCalled();
  });

  it("retourne 500 si la transaction échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: INVITER_ID }));
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: INVITER_ID,
        role: "DIRECTOR",
        schoolId: FIXTURES.schoolA,
      } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db down"));

    const res = await inviteRequest(VALID_BODY);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("invitation");
  });
});