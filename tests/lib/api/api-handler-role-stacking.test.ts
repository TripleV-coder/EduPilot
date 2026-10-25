import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { Permission } from "@/lib/rbac/permissions";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/system/maintenance", () => ({
  getMaintenanceState: vi.fn().mockResolvedValue({ enabled: false, message: "" }),
  maintenanceBlocksRole: vi.fn().mockReturnValue(false),
}));

import { createApiHandler } from "@/lib/api/api-helpers";

const SCHOOL_A = "cschoola000000000000000001";
const SCHOOL_B = "cschoolb000000000000000001";

function session(over: Record<string, unknown> = {}) {
  return {
    user: {
      id: "cuser000000000000000000001",
      role: "TEACHER",
      roles: ["TEACHER"],
      schoolId: SCHOOL_A,
      accessibleSchoolIds: [SCHOOL_A],
      isTwoFactorEnabled: false,
      isTwoFactorAuthenticated: false,
      ...over,
    },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

const get = (path = "/api/finance/summary") =>
  new Request(`http://localhost:3000${path}`) as unknown as NextRequest;

beforeEach(() => {
  authMock.mockReset();
});

describe("createApiHandler — cumul des rôles", () => {
  const finance = createApiHandler(async () => NextResponse.json({ ok: true }), {
    allowedRoles: ["ACCOUNTANT", "DIRECTOR", "SCHOOL_ADMIN"],
    requiredPermissions: [Permission.FINANCE_READ],
  });
  const grades = createApiHandler(async () => NextResponse.json({ ok: true }), {
    allowedRoles: ["TEACHER", "DIRECTOR", "SCHOOL_ADMIN"],
  });

  it("TEACHER seul : finance refusée, notes autorisées", async () => {
    authMock.mockResolvedValue(session());
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("ACCOUNTANT seul : finance autorisée, notes refusées", async () => {
    authMock.mockResolvedValue(session({ role: "ACCOUNTANT", roles: ["ACCOUNTANT"] }));
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(200);
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it("TEACHER principal + ACCOUNTANT secondaire : cumul désactivé, seul le rôle principal compte", async () => {
    authMock.mockResolvedValue(
      session({
        roles: ["TEACHER", "ACCOUNTANT"],
        accessibleSchoolIds: [SCHOOL_A, SCHOOL_B],
        schoolIdsByRole: { TEACHER: [SCHOOL_A, SCHOOL_B], ACCOUNTANT: [SCHOOL_A] },
      }),
    );
    // Les routes décident d'après session.user.role : un rôle secondaire
    // accepté à l'entrée donnait plus que chacun des rôles (audit 2026-10-24)
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("escalade STAFF principal + TEACHER secondaire : route réservée aux enseignants refusée", async () => {
    authMock.mockResolvedValue(session({ role: "STAFF", roles: ["STAFF", "TEACHER"] }));
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it("TEACHER + ACCOUNTANT à l'école d'affectation seulement : finance refusée", async () => {
    authMock.mockResolvedValue(
      session({
        roles: ["TEACHER", "ACCOUNTANT"],
        schoolId: SCHOOL_B,
        accessibleSchoolIds: [SCHOOL_A, SCHOOL_B],
        schoolIdsByRole: { TEACHER: [SCHOOL_A, SCHOOL_B], ACCOUNTANT: [SCHOOL_A] },
      }),
    );
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("rôle secondaire retiré : l'ancien jeton relu refuse la finance", async () => {
    authMock.mockResolvedValue(
      session({
        role: "TEACHER",
        roles: ["TEACHER"],
        permissions: [],
      }),
    );
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(403);
  });

  it("NETWORK_ADMIN : admise là où SCHOOL_ADMIN l'est", async () => {
    authMock.mockResolvedValue(
      session({ role: "NETWORK_ADMIN", roles: ["NETWORK_ADMIN"], schoolId: SCHOOL_A }),
    );
    const admin = createApiHandler(async () => NextResponse.json({ ok: true }), {
      allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR"],
    });
    expect((await admin(get("/api/students"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("école hors périmètre : refus même avec les bons rôles", async () => {
    authMock.mockResolvedValue(
      session({
        role: "NETWORK_ADMIN",
        roles: ["NETWORK_ADMIN"],
        schoolId: SCHOOL_A,
        accessibleSchoolIds: [SCHOOL_A],
      }),
    );
    const admin = createApiHandler(async () => NextResponse.json({ ok: true }), {
      allowedRoles: ["SCHOOL_ADMIN"],
    });
    const res = await admin(get(`/api/students?schoolId=${SCHOOL_B}`), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("SCHOOL_ADMIN principal + TEACHER : droits d'administration (rôle principal), notes aussi", async () => {
    authMock.mockResolvedValue(session({ role: "SCHOOL_ADMIN", roles: ["SCHOOL_ADMIN", "TEACHER"] }));
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(200);
    expect((await grades(get("/api/grades"), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("NETWORK_ADMIN sur deux écoles du réseau : admis à l'école active (héritage SCHOOL_ADMIN)", async () => {
    authMock.mockResolvedValue(session({ role: "NETWORK_ADMIN", roles: ["NETWORK_ADMIN"], accessibleSchoolIds: [SCHOOL_A, SCHOOL_B], schoolId: SCHOOL_B }));
    expect((await finance(get(), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("multi-rôles visant une école hors de son périmètre (?schoolId) : refusé", async () => {
    authMock.mockResolvedValue(session({ role: "ACCOUNTANT", roles: ["ACCOUNTANT", "TEACHER"], accessibleSchoolIds: [SCHOOL_A] }));
    expect((await finance(get(`/api/finance/summary?schoolId=${SCHOOL_B}`), { params: Promise.resolve({}) })).status).toBe(403);
  });
});
