import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import {
  pickTargetClass,
  planPromotion,
  type PromotionPlanContext,
} from "@/lib/students/promotion";

describe("pickTargetClass", () => {
  it("préfère la même section (même nom) si elle existe", () => {
    const chosen = pickTargetClass(
      [{ name: "B" }, { name: "A" }, { name: "C" }],
      "B"
    );
    expect(chosen).toEqual({ name: "B" });
  });

  it("retombe sur la première classe par ordre alphabétique sinon", () => {
    const chosen = pickTargetClass([{ name: "C" }, { name: "A" }, { name: "B" }], "Z");
    expect(chosen).toEqual({ name: "A" });
  });

  it("renvoie null quand aucune classe n'est disponible", () => {
    expect(pickTargetClass([], "A")).toBeNull();
  });
});

describe("planPromotion", () => {
  function ctx(overrides: Partial<PromotionPlanContext> = {}): PromotionPlanContext {
    return {
      sourceClassId: "class-src",
      targetClassId: "class-next",
      hasNextLevel: true,
      students: new Map([
        [
          "stu-1",
          {
            sourceEnrollmentId: "enr-1",
            alreadyInTargetYear: false,
            graduationYear: 2027,
            firstName: "Awa",
            lastName: "Diallo",
          },
        ],
      ]),
      ...overrides,
    };
  }

  it("SKIP si l'élève n'a pas d'inscription source active", () => {
    const [op] = planPromotion(ctx(), [{ studentId: "inconnu", decision: "PROMOTE" }]);
    expect(op).toMatchObject({ type: "SKIP" });
  });

  it("LEAVE → DROP de l'inscription source", () => {
    const [op] = planPromotion(ctx(), [{ studentId: "stu-1", decision: "LEAVE" }]);
    expect(op).toEqual({ type: "DROP", studentId: "stu-1", enrollmentId: "enr-1" });
  });

  it("PROMOTE au niveau terminal → GRADUATE", () => {
    const [op] = planPromotion(ctx({ hasNextLevel: false }), [
      { studentId: "stu-1", decision: "PROMOTE" },
    ]);
    expect(op).toMatchObject({
      type: "GRADUATE",
      enrollmentId: "enr-1",
      graduationYear: 2027,
      firstName: "Awa",
      lastName: "Diallo",
    });
  });

  it("PROMOTE crée l'inscription cible avec l'id de l'inscription source", () => {
    const [op] = planPromotion(ctx(), [{ studentId: "stu-1", decision: "PROMOTE" }]);
    expect(op).toEqual({
      type: "CREATE_ENROLLMENT",
      studentId: "stu-1",
      classId: "class-next",
      sourceEnrollmentId: "enr-1",
    });
  });

  it("PROMOTE sans classe au niveau supérieur → SKIP", () => {
    const [op] = planPromotion(ctx({ targetClassId: null }), [
      { studentId: "stu-1", decision: "PROMOTE" },
    ]);
    expect(op).toMatchObject({ type: "SKIP" });
  });

  it("REPEAT réinscrit dans la classe source", () => {
    const [op] = planPromotion(ctx(), [{ studentId: "stu-1", decision: "REPEAT" }]);
    expect(op).toEqual({
      type: "CREATE_ENROLLMENT",
      studentId: "stu-1",
      classId: "class-src",
      sourceEnrollmentId: "enr-1",
    });
  });

  it("SKIP si déjà inscrit sur l'année cible (idempotence)", () => {
    const students = ctx().students;
    students.get("stu-1")!.alreadyInTargetYear = true;
    const [op] = planPromotion(ctx({ students }), [{ studentId: "stu-1", decision: "PROMOTE" }]);
    expect(op).toMatchObject({ type: "SKIP", reason: expect.stringContaining("Déjà inscrit") });
  });
});
