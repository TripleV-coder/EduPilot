import { describe, it, expect } from "vitest";
import {
  EXAM_SUBMIT_GRACE_SECONDS,
  elapsedSeconds,
  examDeadline,
  isSubmissionTooLate,
} from "@/lib/exams/timing";

const start = new Date("2026-11-02T08:00:00.000Z");
const at = (ms: number) => new Date(start.getTime() + ms);

describe("durée d'examen côté serveur (TD-023)", () => {
  it("échéance = départ + durée", () => {
    expect(examDeadline(start, 45).toISOString()).toBe("2026-11-02T08:45:00.000Z");
  });

  it("accepte jusqu'à l'échéance + la marge, refuse au-delà", () => {
    const limit = 45 * 60_000 + EXAM_SUBMIT_GRACE_SECONDS * 1000;
    expect(isSubmissionTooLate(start, 45, at(45 * 60_000))).toBe(false);
    expect(isSubmissionTooLate(start, 45, at(limit))).toBe(false);
    expect(isSubmissionTooLate(start, 45, at(limit + 1))).toBe(true);
  });

  it("une durée négative ne recule pas l'échéance avant le départ", () => {
    expect(examDeadline(start, -10).getTime()).toBe(start.getTime());
  });

  it("temps écoulé jamais négatif (horloge en avance)", () => {
    expect(elapsedSeconds(start, at(-5000))).toBe(0);
    expect(elapsedSeconds(start, at(90_500))).toBe(90);
  });
});
