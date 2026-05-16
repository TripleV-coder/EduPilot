import { describe, it, expect } from "vitest";
import {
  userSchema,
  teacherProfileSchema,
  studentProfileSchema,
  studentCreateSchema,
  teacherCreateSchema,
  teacherUpdateSchema,
  parentProfileSchema,
  enrollmentSchema,
  studentUpdateSchema,
} from "@/lib/validations/user";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/user", () => {
  const validUserBase = {
    email: "Test@Mail.Com",
    firstName: "Marie",
    lastName: "Dupont",
    role: "TEACHER" as const,
    password: "Secret12",
  };

  describe("userSchema", () => {
    it("accepts valid user and lowercases email", () => {
      const r = userSchema.safeParse(validUserBase);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.email).toBe("test@mail.com");
    });

    it("rejects unknown role", () => {
      const r = userSchema.safeParse({ ...validUserBase, role: "ROOT" as any });
      expect(r.success).toBe(false);
    });

    it("rejects bad email", () => {
      const r = userSchema.safeParse({ ...validUserBase, email: "bad" });
      expect(r.success).toBe(false);
    });

    it("accepts +229 Benin phone", () => {
      const r = userSchema.safeParse({ ...validUserBase, phone: "+22996123456" });
      expect(r.success).toBe(true);
    });

    it("accepts national format without +229", () => {
      const r = userSchema.safeParse({ ...validUserBase, phone: "96123456" });
      expect(r.success).toBe(true);
    });

    it("rejects phone with letters", () => {
      const r = userSchema.safeParse({ ...validUserBase, phone: "+229ABCDEFGH" });
      expect(r.success).toBe(false);
    });
  });

  describe("teacherProfileSchema and studentProfileSchema", () => {
    it("accepts a basic teacher profile", () => {
      const r = teacherProfileSchema.safeParse({ userId: cuid() });
      expect(r.success).toBe(true);
    });

    it("studentProfile requires matricule", () => {
      const r = studentProfileSchema.safeParse({ userId: cuid(), matricule: "" });
      expect(r.success).toBe(false);
    });

    it("studentProfile defaults nationality to Beninoise", () => {
      const r = studentProfileSchema.safeParse({ userId: cuid(), matricule: "MAT123" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.nationality).toBe("Beninoise");
    });
  });

  describe("studentCreateSchema", () => {
    it("requires classId cuid and academicYearId cuid", () => {
      const valid = {
        email: "kid@s.com",
        firstName: "Jean",
        lastName: "Kossou",
        password: "Secret12",
        matricule: "20250001",
        classId: cuid(),
        academicYearId: cuid(),
      };
      expect(studentCreateSchema.safeParse(valid).success).toBe(true);
      expect(studentCreateSchema.safeParse({ ...valid, classId: "x" }).success).toBe(false);
    });
  });

  describe("teacherCreateSchema and teacherUpdateSchema", () => {
    it("caps additionalSchoolIds at 20", () => {
      const arr = Array.from({ length: 21 }, () => cuid());
      const r = teacherCreateSchema.safeParse({
        email: "t@s.com",
        firstName: "X",
        lastName: "Y",
        password: "Strong12",
        additionalSchoolIds: arr,
      });
      expect(r.success).toBe(false);
    });

    it("teacherUpdateSchema allows partial updates", () => {
      const r = teacherUpdateSchema.safeParse({ specialization: "Maths" });
      expect(r.success).toBe(true);
    });
  });

  describe("parentProfileSchema", () => {
    it("accepts empty profile with userId", () => {
      const r = parentProfileSchema.safeParse({ userId: cuid() });
      expect(r.success).toBe(true);
    });
  });

  describe("enrollmentSchema", () => {
    it("defaults status to ACTIVE", () => {
      const r = enrollmentSchema.safeParse({
        studentId: cuid(),
        classId: cuid(),
        academicYearId: cuid(),
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.status).toBe("ACTIVE");
    });

    it("rejects unknown status", () => {
      const r = enrollmentSchema.safeParse({
        studentId: cuid(),
        classId: cuid(),
        academicYearId: cuid(),
        status: "WHATEVER",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("studentUpdateSchema", () => {
    it("accepts partial", () => {
      const r = studentUpdateSchema.safeParse({ isActive: false });
      expect(r.success).toBe(true);
    });

    it("rejects too-short firstName when provided", () => {
      const r = studentUpdateSchema.safeParse({ firstName: "A" });
      expect(r.success).toBe(false);
    });
  });
});
