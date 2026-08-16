import { describe, it, expect } from "vitest";
import { parseDateRangeParams, dateRangeQuerySchema } from "@/lib/validations/date-range";

describe("dateRangeQuerySchema", () => {
  it("accepte une plage ISO valide", () => {
    const result = dateRangeQuerySchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-01-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });

  it("rejette une date invalide", () => {
    expect(dateRangeQuerySchema.safeParse({ startDate: "pas-une-date" }).success).toBe(false);
  });

  it("rejette startDate > endDate", () => {
    expect(
      dateRangeQuerySchema.safeParse({ startDate: "2026-02-01", endDate: "2026-01-01" }).success
    ).toBe(false);
  });

  it("accepte une plage absente ou partielle", () => {
    expect(dateRangeQuerySchema.safeParse({}).success).toBe(true);
    expect(dateRangeQuerySchema.safeParse({ endDate: "2026-01-31" }).success).toBe(true);
  });
});

describe("parseDateRangeParams", () => {
  it("retourne les dates parsées depuis les searchParams", () => {
    const params = new URLSearchParams({ startDate: "2026-01-01", endDate: "2026-01-31" });
    const result = parseDateRangeParams(params);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.startDate).toEqual(new Date("2026-01-01"));
      expect(result.endDate).toEqual(new Date("2026-01-31"));
    }
  });

  it("retourne des dates absentes sans paramètres", () => {
    const result = parseDateRangeParams(new URLSearchParams());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    }
  });

  it("retourne une réponse 400 prête à renvoyer sur une date invalide", async () => {
    const result = parseDateRangeParams(new URLSearchParams({ startDate: "31/01/2026" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toContain("Plage de dates invalide");
    }
  });
});
