import { describe, expect, it } from "vitest";
import { resolveActiveSchoolId } from "@/lib/auth/school-access";
import { canAccessSchool, getAccessibleSchoolIds } from "@/lib/api/tenant-isolation";

describe("school access helpers", () => {
  describe("resolveActiveSchoolId", () => {
    it("prefers a requested school when it is accessible", () => {
      expect(
        resolveActiveSchoolId({
          primarySchoolId: "school-1",
          accessibleSchoolIds: ["school-1", "school-2"],
          requestedSchoolId: "school-2",
        })
      ).toBe("school-2");
    });

    it("falls back to the primary school when the requested school is not accessible", () => {
      expect(
        resolveActiveSchoolId({
          primarySchoolId: "school-1",
          accessibleSchoolIds: ["school-1", "school-2"],
          requestedSchoolId: "school-3",
        })
      ).toBe("school-1");
    });

    it("falls back to the first accessible school when there is no primary school", () => {
      expect(
        resolveActiveSchoolId({
          primarySchoolId: null,
          accessibleSchoolIds: ["school-2", "school-3"],
        })
      ).toBe("school-2");
    });
  });

  describe("getAccessibleSchoolIdsForUser", () => {
    it("returns all child schools for a MAIN site SCHOOL_ADMIN", async () => {
      const { getAccessibleSchoolIdsForUser } = await import("@/lib/auth/school-access");
      const { prisma } = await import("@/lib/prisma");

      // Mock school response
      (prisma.school.findUnique as any).mockResolvedValueOnce({
        id: "main-school",
        siteType: "MAIN",
        childSchools: [{ id: "annexe-1" }, { id: "annexe-2" }],
      });

      const result = await getAccessibleSchoolIdsForUser({
        userId: "admin-1",
        role: "SCHOOL_ADMIN",
        primarySchoolId: "main-school",
      });

      expect(result).toContain("main-school");
      expect(result).toContain("annexe-1");
      expect(result).toContain("annexe-2");
      expect(result).toHaveLength(3);
    });

    it("returns only primary school for an ANNEXE site SCHOOL_ADMIN", async () => {
      const { getAccessibleSchoolIdsForUser } = await import("@/lib/auth/school-access");
      const { prisma } = await import("@/lib/prisma");

      (prisma.school.findUnique as any).mockResolvedValueOnce({
        id: "annexe-school",
        siteType: "ANNEXE",
        childSchools: [],
      });

      const result = await getAccessibleSchoolIdsForUser({
        userId: "admin-2",
        role: "SCHOOL_ADMIN",
        primarySchoolId: "annexe-school",
      });

      expect(result).toEqual(["annexe-school"]);
    });

    it("returns multiple schools for a TEACHER based on assignments", async () => {
      const { getAccessibleSchoolIdsForUser } = await import("@/lib/auth/school-access");
      const { prisma } = await import("@/lib/prisma");

      // Mock assignments
      (prisma.classSubject.findMany as any).mockResolvedValueOnce([
        { class: { schoolId: "school-a" } }
      ]);
      (prisma.class.findMany as any).mockResolvedValueOnce([
        { schoolId: "school-b" }
      ]);

      const result = await getAccessibleSchoolIdsForUser({
        userId: "teacher-1",
        role: "TEACHER",
        primarySchoolId: "school-primary",
      });

      expect(result).toContain("school-primary");
      expect(result).toContain("school-a");
      expect(result).toContain("school-b");
    });
  });

  describe("tenant isolation helpers", () => {
    const session = {
      user: {
        id: "user-1",
        role: "TEACHER",
        schoolId: "school-1",
        accessibleSchoolIds: ["school-1", "school-2"],
      },
    } as any;

    it("returns accessible school ids from session when available", () => {
      expect(getAccessibleSchoolIds(session)).toEqual(["school-1", "school-2"]);
    });

    it("authorizes an explicitly accessible school", () => {
      expect(canAccessSchool(session, "school-2")).toBe(true);
    });

    it("rejects a school outside the accessible scope", () => {
      expect(canAccessSchool(session, "school-3")).toBe(false);
    });
  });
});
