import { describe, expect, it } from "vitest";
import { canSaveAttendanceCall } from "@/lib/attendance/can-save-call";

describe("canSaveAttendanceCall", () => {
  it("autorise un appel « tous présents » tant qu'il n'est pas enregistré", () => {
    expect(canSaveAttendanceCall(0, false)).toBe(true);
  });

  it("autorise une correction après enregistrement", () => {
    expect(canSaveAttendanceCall(2, true)).toBe(true);
  });

  it("bloque un appel déjà enregistré sans modification", () => {
    expect(canSaveAttendanceCall(0, true)).toBe(false);
  });
});
