import { describe, it, expect } from "vitest";
import { incidentCreateSchema } from "@/lib/validations/incident";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/incident", () => {
  const base = {
    studentId: cuid(),
    incidentType: "DISRUPTION" as const,
    date: new Date().toISOString(),
    description: "Description suffisamment longue pour passer la validation",
  };

  it("accepts a valid incident", () => {
    const r = incidentCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.severity).toBe("MEDIUM");
  });

  it("rejects too-short description", () => {
    const r = incidentCreateSchema.safeParse({ ...base, description: "court" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown incident type", () => {
    const r = incidentCreateSchema.safeParse({ ...base, incidentType: "SOMETHING_ELSE" as any });
    expect(r.success).toBe(false);
  });

  it("accepts each severity level", () => {
    for (const severity of ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const) {
      const r = incidentCreateSchema.safeParse({ ...base, severity });
      expect(r.success).toBe(true);
    }
  });

  it("rejects non-ISO date", () => {
    const r = incidentCreateSchema.safeParse({ ...base, date: "12 mai 2026" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid studentId", () => {
    const r = incidentCreateSchema.safeParse({ ...base, studentId: "x" });
    expect(r.success).toBe(false);
  });
});
