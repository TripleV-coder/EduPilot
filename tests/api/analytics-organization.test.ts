import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/analytics/organization/overview/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { getOrganizationDashboardData } from "@/lib/services/organization-dashboard";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/organization-access", () => ({
  getOrganizationAccessForUser: vi.fn(),
}));
vi.mock("@/lib/services/organization-dashboard", () => ({
  getOrganizationDashboardData: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    organization: { findFirst: vi.fn() },
  },
}));

const ORG_A = cuid("orga");
const ORG_B = cuid("orgb");

describe("GET /api/analytics/organization/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/organization/overview"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid a non-root user without manageable organizations", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(getOrganizationAccessForUser).mockResolvedValue({
      memberships: [],
      organizationIds: [],
      primaryOrganizationId: null,
      accessibleSchoolIds: [],
      isOrganizationManager: false,
    } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/organization/overview"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès organisation refusé");
  });

  it("should forbid an organization outside the allowed perimeter", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(getOrganizationAccessForUser).mockResolvedValue({
      memberships: [{ organizationId: ORG_A, isOwner: true, canManageSites: true }],
      organizationIds: [ORG_A],
      primaryOrganizationId: ORG_A,
      accessibleSchoolIds: [],
      isOrganizationManager: true,
    } as never);
    const res = await GET(makeRequest(`http://localhost/api/analytics/organization/overview?organizationId=${ORG_B}`), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Organisation hors périmètre autorisé");
  });

  it("should return 404 when no organization exists for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics/organization/overview"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Aucune organisation disponible");
  });

  it("should serve the organization dashboard for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(getOrganizationDashboardData).mockResolvedValue({
      organization: { id: ORG_A, name: "Org A" },
    } as never);
    const res = await GET(makeRequest(`http://localhost/api/analytics/organization/overview?organizationId=${ORG_A}`), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization.id).toBe(ORG_A);
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
    expect(getOrganizationDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A })
    );
  });

  it("should fall back to the first organization for SUPER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: ORG_A } as never);
    vi.mocked(getOrganizationDashboardData).mockResolvedValue({ organization: { id: ORG_A } } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/organization/overview"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(200);
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: "asc" } }));
    expect(getOrganizationDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A })
    );
  });

  it("should use the first manageable organization for non-root users", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(getOrganizationAccessForUser).mockResolvedValue({
      memberships: [{ organizationId: ORG_A, isOwner: true, canManageSites: true }],
      organizationIds: [ORG_A],
      primaryOrganizationId: ORG_A,
      accessibleSchoolIds: [],
      isOrganizationManager: true,
    } as never);
    vi.mocked(getOrganizationDashboardData).mockResolvedValue({ organization: { id: ORG_A } } as never);
    const res = await GET(makeRequest("http://localhost/api/analytics/organization/overview"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    expect(getOrganizationDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A })
    );
  });

  it("should forward academicYearId and periodId filters", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(getOrganizationDashboardData).mockResolvedValue({} as never);
    const ay = cuid("ay1");
    const period = cuid("p2");
    const res = await GET(makeRequest(`http://localhost/api/analytics/organization/overview?organizationId=${ORG_A}&academicYearId=${ay}&periodId=${period}`), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(200);
    expect(getOrganizationDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A, academicYearId: ay, periodId: period })
    );
  });

  it("should return 500 when the service fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(getOrganizationDashboardData).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest(`http://localhost/api/analytics/organization/overview?organizationId=${ORG_A}`), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("boom");
  });
});