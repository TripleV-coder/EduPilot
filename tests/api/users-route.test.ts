import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { makeRequest, makeSession, cuid } from "./test-helpers";

const {
  authMock,
  checkStudentQuotaMock,
  checkTeacherQuotaMock,
  createSchoolWithDefaultsMock,
  buildTeacherSchoolAssignmentsMock,
  canCreateRoleMock,
  roleSatisfiesMock,
  tx,
  prismaMock,
} = vi.hoisted(() => {
  const txInner = {
    user: { create: vi.fn() },
    teacherProfile: { create: vi.fn() },
    teacherSchoolAssignment: { createMany: vi.fn() },
  };
  const prismaInner = {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (trx: typeof txInner) => Promise<unknown>) => callback(txInner)),
    __tx: txInner,
  };
  return {
    authMock: vi.fn(),
    checkStudentQuotaMock: vi.fn(),
    checkTeacherQuotaMock: vi.fn(),
    createSchoolWithDefaultsMock: vi.fn(),
    buildTeacherSchoolAssignmentsMock: vi.fn(),
    canCreateRoleMock: vi.fn(),
    roleSatisfiesMock: vi.fn(),
    tx: txInner,
    prismaMock: prismaInner,
  };
});

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    SchoolType: {
      PRIMARY: "PRIMARY",
      SECONDARY: "SECONDARY",
      TECHNICAL: "TECHNICAL",
      UNIVERSITY: "UNIVERSITY",
    },
    SchoolLevel: {
      PRESCHOOL: "PRESCHOOL",
      PRIMARY: "PRIMARY",
      SECONDARY_FIRST_CYCLE: "SECONDARY_FIRST_CYCLE",
      SECONDARY_SECOND_CYCLE: "SECONDARY_SECOND_CYCLE",
      HIGHER_EDUCATION: "HIGHER_EDUCATION",
    },
  };
});
vi.mock("@/lib/saas/quotas", () => ({
  checkStudentQuota: checkStudentQuotaMock,
  checkTeacherQuota: checkTeacherQuotaMock,
}));
vi.mock("@/lib/schools/provisioning", () => ({
  createSchoolWithDefaults: createSchoolWithDefaultsMock,
}));
vi.mock("@/lib/teachers/school-assignments", () => ({
  buildTeacherSchoolAssignments: buildTeacherSchoolAssignmentsMock,
}));
vi.mock("@/lib/rbac/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac/permissions")>("@/lib/rbac/permissions");
  return {
    ...actual,
    canCreateRole: canCreateRoleMock,
    roleSatisfies: roleSatisfiesMock,
  };
});

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/users/route";

function user(overrides: Partial<User> = {}): User {
  return {
    id: cuid("usera"),
    email: "awa@example.com",
    firstName: "Awa",
    lastName: "Dossou",
    phone: null,
    role: "TEACHER",
    roles: ["TEACHER"],
    isActive: true,
    schoolId: cuid("schoola"),
    password: "hashed",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    emailVerified: null,
    image: null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    firstLoginRequired: false,
    hasAcceptedInvitation: true,
    resetToken: null,
    resetTokenExpiry: null,
    verificationToken: null,
    verificationTokenExpiry: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    isTwoFactorVerified: false,
    ...overrides,
  } as User;
}

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleSatisfiesMock.mockImplementation((role: string, allowed: string[]) => allowed.includes(role));
  });

  it("bloque les étudiants/parents", async () => {
    authMock.mockResolvedValue(makeSession("STUDENT"));

    const response = await GET(makeRequest("http://localhost:3000/api/users"));
    expect(response.status).toBe(403);
  });

  it("force une recherche minimale pour les enseignants", async () => {
    authMock.mockResolvedValue(makeSession("TEACHER"));

    const response = await GET(makeRequest("http://localhost:3000/api/users?search=a"));
    expect(response.status).toBe(400);
  });

  it("applique le scope tenant et la recherche pour un manager", async () => {
    authMock.mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: cuid("u1"),
        email: "awa@example.com",
        firstName: "Awa",
        lastName: "Dossou",
        phone: null,
        role: "TEACHER",
        roles: ["TEACHER"],
        isActive: true,
        schoolId: cuid("schoola"),
        createdAt: new Date(),
        school: { id: cuid("schoola"), name: "Saint Michel", code: "SM" },
        teacherProfile: null,
        studentProfile: null,
      },
    ] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const response = await GET(
      makeRequest("http://localhost:3000/api/users?search=awa&role=TEACHER&page=1&pageSize=20"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0].where).toMatchObject({
      schoolId: cuid("schoola"),
      role: "TEACHER",
      OR: expect.any(Array),
    });
  });
});

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canCreateRoleMock.mockReturnValue(true);
    checkStudentQuotaMock.mockResolvedValue({ allowed: true, limit: 1000 });
    checkTeacherQuotaMock.mockResolvedValue({ allowed: true, limit: 100 });
    buildTeacherSchoolAssignmentsMock.mockReturnValue([
      { teacherId: cuid("teacher1"), userId: cuid("usera"), schoolId: cuid("schoola"), isPrimary: true },
    ]);
  });

  it("refuse la création d'un SUPER_ADMIN", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null, accessibleSchoolIds: [] }));

    const response = await POST(
      makeRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: {
          email: "boss@example.com",
          firstName: "Boss",
          lastName: "Admin",
          role: "SUPER_ADMIN",
          password: "Password123!",
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("redirige la création d'élève vers /api/students", async () => {
    authMock.mockResolvedValue(makeSession("SCHOOL_ADMIN"));

    const response = await POST(
      makeRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: {
          email: "eleve@example.com",
          firstName: "Koffi",
          lastName: "Mensah",
          role: "STUDENT",
          password: "Password123!",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("USE_STUDENTS_ENDPOINT");
  });

  it("crée un enseignant et son rattachement école", async () => {
    authMock.mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    tx.user.create.mockResolvedValue({
      id: cuid("usera"),
      email: "teacher@example.com",
      firstName: "Mireille",
      lastName: "Agbossou",
      phone: null,
      role: "TEACHER",
      roles: ["TEACHER"],
      isActive: true,
      schoolId: cuid("schoola"),
      createdAt: new Date(),
    });
    tx.teacherProfile.create.mockResolvedValue({ id: cuid("teacher1") });
    tx.teacherSchoolAssignment.createMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      makeRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: {
          email: "teacher@example.com",
          firstName: "Mireille",
          lastName: "Agbossou",
          role: "TEACHER",
          password: "Password123!",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.role).toBe("TEACHER");
    expect(tx.teacherProfile.create).toHaveBeenCalled();
    expect(tx.teacherSchoolAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ schoolId: cuid("schoola"), isPrimary: true }),
        ]),
      }),
    );
  });

  it("mappe les erreurs métier de provisioning d'école", async () => {
    authMock.mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null, accessibleSchoolIds: [] }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    createSchoolWithDefaultsMock.mockRejectedValue(new Error("ORGANIZATION_NOT_FOUND"));

    const response = await POST(
      makeRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: {
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "Ecole",
          role: "SCHOOL_ADMIN",
          password: "Password123!",
          school: {
            name: "Nouvelle Ecole",
            organizationId: cuid("orga1"),
          },
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Organisation introuvable");
  });
});
