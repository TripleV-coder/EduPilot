import { describe, it, expect } from "vitest";
import { schoolDeploymentSchema, schoolQuotaUpdateSchema } from "@/lib/validations/root";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/root", () => {
  const baseValid = {
    name: "École Test",
    type: "PRIVATE" as const,
    level: "PRIMARY" as const,
    organizationMode: "NONE" as const,
    adminFirstName: "Alice",
    adminLastName: "Dupont",
    adminEmail: "admin@example.com",
    adminPassword: "Admin123!Strong",
  };

  describe("schoolDeploymentSchema", () => {
    it("accepts default deployment without organization", () => {
      const r = schoolDeploymentSchema.safeParse(baseValid);
      expect(r.success).toBe(true);
    });

    it("requires admin password to be very strong (with special char)", () => {
      const r = schoolDeploymentSchema.safeParse({
        ...baseValid,
        adminPassword: "WeakPass1", // no special char
      });
      expect(r.success).toBe(false);
    });

    it("requires organizationName when CREATE mode", () => {
      const r = schoolDeploymentSchema.safeParse({
        ...baseValid,
        organizationMode: "CREATE",
      });
      expect(r.success).toBe(false);
    });

    it("requires organizationId when EXISTING mode", () => {
      const r = schoolDeploymentSchema.safeParse({
        ...baseValid,
        organizationMode: "EXISTING",
      });
      expect(r.success).toBe(false);
    });

    it("accepts CREATE mode with organizationName", () => {
      const r = schoolDeploymentSchema.safeParse({
        ...baseValid,
        organizationMode: "CREATE",
        organizationName: "Réseau Educ Plus",
      });
      expect(r.success).toBe(true);
    });

    it("rejects bad admin email", () => {
      const r = schoolDeploymentSchema.safeParse({
        ...baseValid,
        adminEmail: "not-an-email",
      });
      expect(r.success).toBe(false);
    });

    it("rejects too-short establishment name", () => {
      const r = schoolDeploymentSchema.safeParse({ ...baseValid, name: "AB" });
      expect(r.success).toBe(false);
    });
  });

  describe("schoolQuotaUpdateSchema", () => {
    it("accepts a valid update", () => {
      const r = schoolQuotaUpdateSchema.safeParse({
        id: cuid(),
        planId: cuid(),
        isActive: true,
      });
      expect(r.success).toBe(true);
    });

    it("rejects invalid id", () => {
      const r = schoolQuotaUpdateSchema.safeParse({ id: "bad" });
      expect(r.success).toBe(false);
    });
  });
});
