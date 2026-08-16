import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, POST } from "@/app/api/root/schools/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/schools/provisioning", () => ({
  createOrganization: vi.fn().mockResolvedValue({ id: "corg1", name: "Org A" }),
  createSchoolWithDefaults: vi.fn().mockResolvedValue({
    id: "csch1",
    name: "École Test",
    organizationId: "corg1",
  }),
  createSchoolAdminUser: vi.fn().mockResolvedValue({
    id: "cu1",
    email: "admin@test.bj",
    firstName: "Paul",
    lastName: "Biya",
  }),
  createOrganizationMembership: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    studentProfile: { groupBy: vi.fn() },
    user: { groupBy: vi.fn() },
    teacherSchoolAssignment: { groupBy: vi.fn() },
    teacherProfile: { groupBy: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const ROOT = makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" });

describe("GET /api/root/schools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should require root authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/root/schools"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid non-root users", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/root/schools"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(403);
  });

  it("should list schools with merged stats", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const school = {
      id: cuid("sch1"),
      name: "École A",
      code: "A-01",
      organizationId: cuid("org1"),
      organization: { id: cuid("org1"), name: "Org A", code: "ORG-A" },
      type: "PRIVATE",
      level: "PRIMARY",
      siteType: "MAIN",
      parentSchoolId: null,
      parentSchool: null,
      city: "Cotonou",
      email: "a@a.bj",
      phone: "01",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { classes: 10 },
    } as never;
    vi.mocked(prisma.school.findMany).mockResolvedValue([school]);
    vi.mocked(prisma.school.count).mockResolvedValue(1);
    vi.mocked(prisma.studentProfile.groupBy).mockResolvedValue([{ schoolId: cuid("sch1"), _count: 50 }] as never);
    vi.mocked(prisma.user.groupBy).mockResolvedValue([{ schoolId: cuid("sch1"), _count: 20 }] as never);
    vi.mocked(prisma.teacherSchoolAssignment.groupBy).mockResolvedValue([{ schoolId: cuid("sch1"), _count: { _all: 5 } }] as never);
    vi.mocked(prisma.teacherProfile.groupBy).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost/api/root/schools?search=ecole&type=PRIVATE"), { session: ROOT });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].stats.students).toBe(50);
    expect(body.data[0].stats.users).toBe(20);
    expect(body.data[0].stats.teachers).toBe(5);
    expect(body.data[0].stats.classes).toBe(10);
    expect(body.data[0]._count).toBeUndefined();
    expect(body.pagination.total).toBe(1);
  });
});

describe("PATCH /api/root/schools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update school quota fields", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.school.update).mockResolvedValue({ id: cuid("sch1"), name: "École A", code: "A-01", type: "PRIVATE", level: "PRIMARY", isActive: false, planId: cuid("plan1") } as never);
    const res = await PATCH(makeRequest("http://localhost/api/root/schools", { method: "PATCH", body: { id: cuid("sch1"), isActive: false, planId: cuid("plan1") } }), { session: ROOT });
    expect(res.status).toBe(200);
    expect(prisma.school.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await PATCH(makeRequest("http://localhost/api/root/schools", { method: "PATCH", body: { id: "bad-id" } }), { session: ROOT });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/root/schools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should deploy a new school with organization creation", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {};
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });
    const { createOrganization, createSchoolAdminUser, createOrganizationMembership } = await import("@/lib/schools/provisioning");
    const res = await POST(makeRequest("http://localhost/api/root/schools", {
      method: "POST",
      body: {
        name: "École Test",
        organizationMode: "CREATE",
        organizationName: "Org A",
        adminEmail: "admin@test.bj",
        adminPassword: "Passw0rd!123",
        adminFirstName: "Paul",
        adminLastName: "Biya",
        assignAdminAsOrganizationManager: true,
      },
    }), { session: ROOT });
    expect(res.status).toBe(201);
    expect(createOrganization).toHaveBeenCalled();
    expect(createSchoolAdminUser).toHaveBeenCalled();
    expect(createOrganizationMembership).toHaveBeenCalled();
    const body = await res.json();
    expect(body.admin.email).toBe("admin@test.bj");
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const res = await POST(makeRequest("http://localhost/api/root/schools", { method: "POST", body: { name: "X" } }), { session: ROOT });
    expect(res.status).toBe(400);
  });

  it("should return 400 on parent school not found", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("PARENT_SCHOOL_NOT_FOUND"));
    const res = await POST(makeRequest("http://localhost/api/root/schools", {
      method: "POST",
      body: {
        name: "École Test",
        organizationMode: "NONE",
        parentSchoolId: cuid("sch9"),
        adminEmail: "admin@test.bj",
        adminPassword: "Passw0rd!123",
        adminFirstName: "Paul",
        adminLastName: "Biya",
      },
    }), { session: ROOT });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Établissement parent introuvable");
  });

  it("should return 400 on duplicate admin email", async () => {
    vi.mocked(auth).mockResolvedValue(ROOT);
    const { Prisma } = await import("@prisma/client");
    vi.mocked(prisma.$transaction).mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002" }));
    const res = await POST(makeRequest("http://localhost/api/root/schools", {
      method: "POST",
      body: {
        name: "École Test",
        organizationMode: "NONE",
        adminEmail: "dup@test.bj",
        adminPassword: "Passw0rd!123",
        adminFirstName: "Paul",
        adminLastName: "Biya",
      },
    }), { session: ROOT });
    expect(res.status).toBe(400);
  });
});