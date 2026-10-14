import { describe, it, expect } from "vitest";
import { checkPeriodPlan, checkPeriodsCount, periodsCountFor } from "@/lib/academic/period-rules";

const year = { startDate: new Date("2025-09-15"), endDate: new Date("2026-07-15") };
const T = (sequence: number, start: string, end: string, id?: string) => ({
  id,
  type: "TRIMESTER" as const,
  sequence,
  startDate: new Date(start),
  endDate: new Date(end),
});

describe("découpage de l'année", () => {
  it("semestres = 2 périodes, trimestres = 3", () => {
    expect(periodsCountFor("SEMESTER")).toBe(2);
    expect(periodsCountFor("TRIMESTER")).toBe(3);
    expect(checkPeriodsCount("SEMESTER", 2)).toBeNull();
    expect(checkPeriodsCount("SEMESTER", 3)).toMatch(/2 périodes/);
    expect(checkPeriodsCount("TRIMESTER", 4)).toMatch(/3 périodes/);
    expect(checkPeriodsCount("HYBRID", 4)).toBeNull();
  });

  it("accepte un 3e trimestre cohérent", () => {
    const others = [T(1, "2025-09-15", "2025-12-20", "t1"), T(2, "2026-01-05", "2026-03-31", "t2")];
    expect(checkPeriodPlan(T(3, "2026-04-10", "2026-07-10"), others, year)).toBeNull();
  });

  it("refuse dates inversées, hors année, chevauchement, 4e trimestre et mélange des systèmes", () => {
    const others = [T(1, "2025-09-15", "2025-12-20", "t1")];
    expect(checkPeriodPlan(T(2, "2026-03-01", "2026-01-01"), others, year)).toMatch(/postérieure/);
    expect(checkPeriodPlan(T(2, "2026-01-05", "2026-08-01"), others, year)).toMatch(/comprise/);
    expect(checkPeriodPlan(T(2, "2025-12-01", "2026-03-01"), others, year)).toMatch(/chevauche/);
    expect(checkPeriodPlan(T(4, "2026-04-01", "2026-06-01"), others, year)).toMatch(/3 périodes/);
    expect(
      checkPeriodPlan({ ...T(2, "2026-01-05", "2026-06-30"), type: "SEMESTER" }, others, year)
    ).toMatch(/ne mélange pas/);
  });

  it("ignore la période elle-même lors d'une modification", () => {
    const self = T(1, "2025-09-15", "2025-12-20", "t1");
    expect(checkPeriodPlan({ ...self, endDate: new Date("2025-12-22") }, [self], year)).toBeNull();
  });
});
