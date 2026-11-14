/**
 * Couverture des routes de prédictions IA : /api/ai/predictions/student et /class.
 * Vérifie le contrôle d'accès par rôle et le cloisonnement par établissement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findFirst: vi.fn() },
    class: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/services/ai-predictive", () => ({
  getStudentPredictions: vi.fn(),
  getClassPredictions: vi.fn(),
}));
vi.mock("@/lib/teachers/taught-classes", () => ({ teacherTeachesStudent: vi.fn() }));

import prisma from "@/lib/prisma";
import { getStudentPredictions, getClassPredictions } from "@/lib/services/ai-predictive";
import { teacherTeachesStudent } from "@/lib/teachers/taught-classes";
import * as studentRoute from "@/app/api/ai/predictions/student/route";
import * as classRoute from "@/app/api/ai/predictions/class/route";

const studentUrl = "http://localhost/api/ai/predictions/student";
const classUrl = "http://localhost/api/ai/predictions/class";
const asRole = (role: string, id?: string) =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA, id }));
const postStudent = (body: unknown) => studentRoute.POST(makeRequest(studentUrl, { method: "POST", body }));
const getStudent = (qs = "") => studentRoute.GET(makeRequest(`${studentUrl}${qs}`));
/** Élève stu-1, compte u-stu, dans l'école donnée. */
const studentIn = (schoolId: string) =>
  vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "stu-1", userId: "u-stu", user: { schoolId } } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStudentPredictions).mockResolvedValue({ predictions: [{ subject: "Maths" }] } as never);
  vi.mocked(getClassPredictions).mockResolvedValue({ classId: "cls-1", students: [] } as never);
  vi.mocked(prisma.parentStudent.findFirst).mockResolvedValue(null as never);
  vi.mocked(teacherTeachesStudent).mockResolvedValue(false);
});

// Les deux verbes appliquent exactement le même contrôle.
const verbs = [
  ["POST", (id: string) => postStudent({ studentId: id })],
  ["GET", (id: string) => getStudent(`?studentId=${id}`)],
] as const;

describe.each(verbs)("%s /api/ai/predictions/student", (_verb, call) => {
  it("exige studentId (400)", async () => {
    asRole("SCHOOL_ADMIN");
    const res = _verb === "POST" ? await postStudent({}) : await getStudent();
    expect(res.status).toBe(400);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("un élève voit ses propres prédictions, pas celles d'un camarade", async () => {
    studentIn(FIXTURES.schoolA);
    asRole("STUDENT", "u-stu");
    expect((await call("stu-1")).status).toBe(200);
    asRole("STUDENT", "u-autre");
    expect((await call("stu-1")).status).toBe(403);
  });

  it("un parent voit son enfant, pas un autre élève", async () => {
    studentIn(FIXTURES.schoolA);
    asRole("PARENT", "u-par");
    vi.mocked(prisma.parentStudent.findFirst).mockResolvedValueOnce({ id: "ps-1" } as never);
    expect((await call("stu-1")).status).toBe(200);
    expect(vi.mocked(prisma.parentStudent.findFirst).mock.calls[0][0]).toEqual({
      where: { studentId: "stu-1", parent: { userId: "u-par" } },
      select: { id: true },
    });
    expect((await call("stu-1")).status).toBe(403);
  });

  it("enseignant : seulement un élève de ses classes (TD-020)", async () => {
    studentIn(FIXTURES.schoolA);
    asRole("TEACHER", "u-prof");
    expect((await call("stu-1")).status).toBe(403);
    vi.mocked(teacherTeachesStudent).mockResolvedValueOnce(true);
    expect((await call("stu-1")).status).toBe(200);
    expect(teacherTeachesStudent).toHaveBeenLastCalledWith("u-prof", "stu-1");
  });

  it("la direction voit tout élève de son école", async () => {
    studentIn(FIXTURES.schoolA);
    asRole("DIRECTOR");
    expect((await call("stu-1")).status).toBe(200);
  });

  it("refuse les rôles non pédagogiques (comptable, personnel)", async () => {
    studentIn(FIXTURES.schoolA);
    for (const role of ["ACCOUNTANT", "STAFF"]) {
      asRole(role);
      expect((await call("stu-1")).status).toBe(403);
    }
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("refuse un élève d'une autre école, même à la direction (403)", async () => {
    studentIn(FIXTURES.schoolB);
    asRole("SCHOOL_ADMIN");
    expect((await call("stu-1")).status).toBe(403);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("refuse un élève introuvable (403)", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null as never);
    asRole("SCHOOL_ADMIN");
    expect((await call("stu-x")).status).toBe(403);
  });

  it("le super-admin n'est pas soumis au contrôle d'école", async () => {
    studentIn(FIXTURES.schoolB);
    asRole("SUPER_ADMIN");
    expect((await call("stu-1")).status).toBe(200);
  });

  it("renvoie un 500 générique si le service échoue", async () => {
    studentIn(FIXTURES.schoolA);
    asRole("SCHOOL_ADMIN");
    vi.mocked(getStudentPredictions).mockRejectedValueOnce(new Error("détail interne"));
    const res = await call("stu-1");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("détail interne");
  });
});

describe("POST /api/ai/predictions/student — session", () => {
  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(401);
  });
});

describe("/api/ai/predictions/class", () => {
  const post = (body: unknown) => classRoute.POST(makeRequest(classUrl, { method: "POST", body }));
  const get = (qs = "") => classRoute.GET(makeRequest(`${classUrl}${qs}`));

  it("refuse parents et élèves (403) en POST et GET", async () => {
    asRole("PARENT");
    expect((await post({ classId: "cls-1" })).status).toBe(403);
    asRole("STUDENT");
    expect((await get("?classId=cls-1")).status).toBe(403);
    expect(getClassPredictions).not.toHaveBeenCalled();
  });

  it("exige classId (400)", async () => {
    asRole("TEACHER");
    expect((await post({})).status).toBe(400);
    expect((await get()).status).toBe(400);
  });

  it("génère les prédictions d'une classe de l'école (POST)", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.class.findUnique).mockResolvedValueOnce({ schoolId: FIXTURES.schoolA } as never);
    const res = await post({ classId: "cls-1" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.class.findUnique).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { id: "cls-1" } })
    );
    expect(getClassPredictions).toHaveBeenCalledWith("cls-1");
  });

  it("refuse une classe d'une autre école ou inexistante (403)", async () => {
    asRole("DIRECTOR");
    vi.mocked(prisma.class.findUnique).mockResolvedValueOnce({ schoolId: FIXTURES.schoolB } as never);
    expect((await post({ classId: "cls-b" })).status).toBe(403);
    vi.mocked(prisma.class.findUnique).mockResolvedValueOnce(null as never);
    expect((await get("?classId=cls-x")).status).toBe(403);
    expect(getClassPredictions).not.toHaveBeenCalled();
  });

  it("GET renvoie les prédictions d'une classe de l'école", async () => {
    asRole("SCHOOL_ADMIN");
    vi.mocked(prisma.class.findUnique).mockResolvedValueOnce({ schoolId: FIXTURES.schoolA } as never);
    const res = await get("?classId=cls-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ classId: "cls-1", students: [] });
  });

  it("le super-admin n'est pas soumis au contrôle d'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    expect((await post({ classId: "cls-1" })).status).toBe(200);
    expect((await get("?classId=cls-1")).status).toBe(200);
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it("renvoie des 500 génériques si le service échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    vi.mocked(getClassPredictions).mockRejectedValue(new Error("secret"));
    const r1 = await post({ classId: "cls-1" });
    const r2 = await get("?classId=cls-1");
    expect([r1.status, r2.status]).toEqual([500, 500]);
    expect(JSON.stringify(await r1.json())).not.toContain("secret");
  });
});
