import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { count: vi.fn() },
    studentProfile: { count: vi.fn(), findFirst: vi.fn() },
    payment: { count: vi.fn() },
    teacherProfile: { findFirst: vi.fn() },
    classSubject: { findMany: vi.fn() },
    enrollment: { count: vi.fn() },
    message: { count: vi.fn() },
    evaluation: { count: vi.fn() },
    parentProfile: { findFirst: vi.fn() },
    homework: { count: vi.fn() },
    school: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/dashboard/nav-counts/route";

const USER_ID = cuid("user1");
const SCHOOL_ID = FIXTURES.schoolA;

beforeEach(() => vi.clearAllMocks());

describe("GET /api/dashboard/nav-counts", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(401);
  });

  it("calcule les compteurs SUPER_ADMIN (réseau)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: USER_ID }));
    vi.mocked(prisma.school.count).mockResolvedValue(12);
    vi.mocked(prisma.user.count).mockResolvedValue(340);
    vi.mocked(prisma.notification.count).mockResolvedValue(4);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      networkSchools: 12,
      networkUsers: 340,
      networkAlerts: 4,
    });
  });

  it("calcule les compteurs DIRECTOR (école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.studentProfile.count).mockResolvedValue(250);
    vi.mocked(prisma.payment.count).mockResolvedValue(18);
    vi.mocked(prisma.notification.count).mockResolvedValue(3);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      students: 250,
      finance: 18,
      notifications: 3,
    });
    expect(vi.mocked(prisma.studentProfile.count)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ schoolId: SCHOOL_ID }) })
    );
  });

  it("calcule les compteurs TEACHER avec profil", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.teacherProfile.findFirst).mockResolvedValue({ id: cuid("teacher1") } as never);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
      { id: cuid("cs1"), classId: cuid("class1") },
      { id: cuid("cs2"), classId: cuid("class1") },
      { id: cuid("cs3"), classId: cuid("class2") },
    ] as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(45);
    vi.mocked(prisma.message.count).mockResolvedValue(6);
    vi.mocked(prisma.evaluation.count).mockResolvedValue(2);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      teacherStudents: 45,
      teacherMessages: 6,
      teacherGradeEntry: 2,
    });
    expect(vi.mocked(prisma.enrollment.count)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classId: { in: [cuid("class1"), cuid("class2")] } }),
      })
    );
  });

  it("retourne un objet vide pour un TEACHER sans profil", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.teacherProfile.findFirst).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("calcule les compteurs PARENT avec enfants", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({
      parentStudents: [{ studentId: cuid("student1") }, { studentId: cuid("student2") }],
    } as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(2);
    vi.mocked(prisma.payment.count).mockResolvedValue(3);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      children: 2,
      notifications: 2,
      pendingPayments: 3,
    });
  });

  it("ne calcule pas pendingPayments si le parent n'a pas d'enfants", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.parentProfile.findFirst).mockResolvedValue({ parentStudents: [] } as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    const body = await res.json();
    expect(body.children).toBe(0);
    expect(body.pendingPayments).toBeUndefined();
    expect(prisma.payment.count).not.toHaveBeenCalled();
  });

  it("calcule les compteurs STUDENT avec devoirs à rendre", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: cuid("studentp") } as never);
    vi.mocked(prisma.homework.count).mockResolvedValue(4);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ homework: 4 });
  });

  it("retourne un objet vide pour un STUDENT sans profil", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: USER_ID, schoolId: SCHOOL_ID }));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("tolère l'échec du compteur de notifications (dégradé à 0)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: USER_ID }));
    vi.mocked(prisma.school.count).mockResolvedValue(1);
    vi.mocked(prisma.user.count).mockResolvedValue(2);
    vi.mocked(prisma.notification.count).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/dashboard/nav-counts"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      networkSchools: 1,
      networkUsers: 2,
      networkAlerts: 0,
    });
  });
});