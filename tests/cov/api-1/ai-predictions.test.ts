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
    class: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/services/ai-predictive", () => ({
  getStudentPredictions: vi.fn(),
  getClassPredictions: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getStudentPredictions, getClassPredictions } from "@/lib/services/ai-predictive";
import * as studentRoute from "@/app/api/ai/predictions/student/route";
import * as classRoute from "@/app/api/ai/predictions/class/route";

const studentUrl = "http://localhost/api/ai/predictions/student";
const classUrl = "http://localhost/api/ai/predictions/class";
const asRole = (role: string, id?: string) =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA, id }));
const postStudent = (body: unknown) => studentRoute.POST(makeRequest(studentUrl, { method: "POST", body }));
const getStudent = (qs = "") => studentRoute.GET(makeRequest(`${studentUrl}${qs}`));
const studentInSchool = (schoolId: string) => ({ id: "stu-1", user: { schoolId } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStudentPredictions).mockResolvedValue({ predictions: [{ subject: "Maths" }] } as never);
  vi.mocked(getClassPredictions).mockResolvedValue({ classId: "cls-1", students: [] } as never);
});

describe("POST /api/ai/predictions/student", () => {
  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(401);
  });

  it("exige studentId (400)", async () => {
    asRole("TEACHER");
    const res = await postStudent({});
    expect(res.status).toBe(400);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("un élève ne voit que ses propres prédictions", async () => {
    asRole("STUDENT", "u-stu");
    vi.mocked(prisma.studentProfile.findUnique)
      .mockResolvedValueOnce({ id: "stu-1" } as never)
      .mockResolvedValueOnce(studentInSchool(FIXTURES.schoolA) as never);
    const res = await postStudent({ studentId: "stu-1" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.studentProfile.findUnique).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { userId: "u-stu" } })
    );
    expect(getStudentPredictions).toHaveBeenCalledWith("stu-1");
  });

  it("refuse à un élève les prédictions d'un camarade (403)", async () => {
    asRole("STUDENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: "stu-moi" } as never);
    expect((await postStudent({ studentId: "stu-autre" })).status).toBe(403);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("refuse à un élève sans profil (403)", async () => {
    asRole("STUDENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
  });

  it("un parent accède aux prédictions de son enfant", async () => {
    asRole("PARENT", "u-par");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [{ studentId: "stu-1" }] } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentInSchool(FIXTURES.schoolA) as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(200);
    expect(vi.mocked(prisma.parentProfile.findUnique).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { userId: "u-par" } })
    );
  });

  it("refuse à un parent un élève qui n'est pas son enfant (403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [{ studentId: "stu-2" }] } as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
  });

  it("refuse à un parent sans profil (403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
  });

  it("refuse les rôles non pédagogiques (comptable, 403)", async () => {
    asRole("ACCOUNTANT");
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un élève d'une autre école (403)", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentInSchool(FIXTURES.schoolB) as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it("refuse un élève introuvable (403)", async () => {
    asRole("DIRECTOR");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await postStudent({ studentId: "stu-1" })).status).toBe(403);
  });

  it("le super-admin n'est pas soumis au contrôle d'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await postStudent({ studentId: "stu-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictions: [{ subject: "Maths" }] });
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("renvoie un 500 générique si le service échoue", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentInSchool(FIXTURES.schoolA) as never);
    vi.mocked(getStudentPredictions).mockRejectedValueOnce(new Error("pg: connexion secrète"));
    const res = await postStudent({ studentId: "stu-1" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secrète");
  });
});

describe("GET /api/ai/predictions/student", () => {
  it("exige studentId (400)", async () => {
    asRole("TEACHER");
    expect((await getStudent()).status).toBe(400);
  });

  it("un élève lit ses propres prédictions", async () => {
    asRole("STUDENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: "stu-1" } as never);
    expect((await getStudent("?studentId=stu-1")).status).toBe(200);
  });

  it("refuse à un élève les prédictions d'un autre (403)", async () => {
    asRole("STUDENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await getStudent("?studentId=stu-1")).status).toBe(403);
  });

  it("un parent lit les prédictions de son enfant", async () => {
    asRole("PARENT");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [{ studentId: "stu-1" }] } as never);
    expect((await getStudent("?studentId=stu-1")).status).toBe(200);
  });

  it("refuse à un parent un élève étranger (403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await getStudent("?studentId=stu-1")).status).toBe(403);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ parentStudents: [] } as never);
    expect((await getStudent("?studentId=stu-1")).status).toBe(403);
  });

  it("le super-admin obtient les prédictions calculées", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await getStudent("?studentId=stu-1");
    expect(res.status).toBe(200);
    expect(getStudentPredictions).toHaveBeenCalledWith("stu-1");
  });

  it.skip("BUG: un enseignant ne doit pas lire les prédictions d'un élève d'une autre école (403)", async () => {
    // GET ne vérifie ni le rôle ni l'école de l'élève, contrairement à POST.
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(studentInSchool(FIXTURES.schoolB) as never);
    expect((await getStudent("?studentId=stu-ecole-b")).status).toBe(403);
    expect(getStudentPredictions).not.toHaveBeenCalled();
  });

  it.skip("BUG: un comptable ne doit pas lire les prédictions IA d'un élève (403)", async () => {
    asRole("ACCOUNTANT");
    expect((await getStudent("?studentId=stu-1")).status).toBe(403);
  });

  it("renvoie un 500 générique si le service échoue", async () => {
    asRole("TEACHER");
    vi.mocked(getStudentPredictions).mockRejectedValueOnce(new Error("détail interne"));
    const res = await getStudent("?studentId=stu-1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
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
