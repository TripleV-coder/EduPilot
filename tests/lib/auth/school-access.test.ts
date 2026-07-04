import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: { school: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/lib/auth/organization-access", () => ({
  getOrganizationAccessForUser: async () => ({ accessibleSchoolIds: [] }),
}));
vi.mock("@/lib/teachers/school-assignments", () => ({
  getTeacherSchoolIdsForUser: async () => [],
}));

import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";

describe("getAccessibleSchoolIdsForUser — NETWORK_ADMIN", () => {
  beforeEach(() => findUnique.mockReset());

  it("site MAIN avec annexes → toutes ses écoles", async () => {
    findUnique.mockResolvedValue({
      siteType: "MAIN",
      childSchools: [{ id: "annex-1" }, { id: "annex-2" }],
    });
    const ids = await getAccessibleSchoolIdsForUser({
      userId: "u1",
      role: "NETWORK_ADMIN",
      primarySchoolId: "main-1",
    });
    expect(new Set(ids)).toEqual(new Set(["main-1", "annex-1", "annex-2"]));
  });

  it("mono-école (pas d'annexe) → sa seule école", async () => {
    findUnique.mockResolvedValue({ siteType: "MAIN", childSchools: [] });
    const ids = await getAccessibleSchoolIdsForUser({
      userId: "u1",
      role: "NETWORK_ADMIN",
      primarySchoolId: "solo-1",
    });
    expect(ids).toEqual(["solo-1"]);
  });
});
