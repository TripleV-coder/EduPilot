import { describe, it, expect } from "vitest";
import {
  strongPasswordSchema,
  veryStrongPasswordSchema,
  loginSchema,
  registerSchema,
} from "@/lib/validations/auth";

describe("validations/auth", () => {
  describe("strongPasswordSchema", () => {
    it("accepts a valid password", () => {
      const r = strongPasswordSchema.safeParse("Strong123");
      expect(r.success).toBe(true);
    });

    it("rejects passwords shorter than 8", () => {
      const r = strongPasswordSchema.safeParse("Aa1");
      expect(r.success).toBe(false);
    });

    it("requires uppercase", () => {
      const r = strongPasswordSchema.safeParse("alllower1");
      expect(r.success).toBe(false);
    });

    it("requires lowercase", () => {
      const r = strongPasswordSchema.safeParse("ALLUPPER1");
      expect(r.success).toBe(false);
    });

    it("requires a digit", () => {
      const r = strongPasswordSchema.safeParse("NoDigitsHere");
      expect(r.success).toBe(false);
    });
  });

  describe("veryStrongPasswordSchema", () => {
    it("requires special char on top of strong rules", () => {
      expect(veryStrongPasswordSchema.safeParse("Strong123").success).toBe(false);
      expect(veryStrongPasswordSchema.safeParse("Strong123!").success).toBe(true);
    });
  });

  describe("loginSchema", () => {
    it("lowercases the email", () => {
      const r = loginSchema.safeParse({ email: "TEST@Foo.COM", password: "x" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.email).toBe("test@foo.com");
    });

    it("rejects invalid email", () => {
      expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
    });

    it("rejects empty password", () => {
      expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    const valid = {
      firstName: "Marie",
      lastName: "Dupont",
      email: "marie@example.com",
      password: "Secret12",
      confirmPassword: "Secret12",
    };

    it("accepts default STUDENT role", () => {
      const r = registerSchema.safeParse(valid);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.role).toBe("STUDENT");
    });

    it("rejects mismatched passwords", () => {
      const r = registerSchema.safeParse({ ...valid, confirmPassword: "Wrong123" });
      expect(r.success).toBe(false);
    });

    it("rejects unknown role", () => {
      const r = registerSchema.safeParse({ ...valid, role: "ROOT" as never });
      expect(r.success).toBe(false);
    });

    it("rejects names too short", () => {
      const r = registerSchema.safeParse({ ...valid, firstName: "A" });
      expect(r.success).toBe(false);
    });
  });
});
