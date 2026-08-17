import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/import/schedules/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
    classSubject: { findMany: vi.fn() },
    schedule: { deleteMany: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const ADMIN = makeSession("SCHOOL_ADMIN");
const CLASS_ID = cuid("class1");

function mockTransaction() {
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
    const tx = prisma;
    return (fn as (t: typeof tx) => Promise<unknown>)(tx);
  });
}

const VALID_ROW = {
  jour: "Lundi",
  heure_debut: "08:00",
  heure_fin: "09:00",
  matiere: "Maths",
  salle: "Salle 1",
};

function makeBody(classId: string, data: unknown[], replaceExisting = false) {
  return { classId, data, replaceExisting };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction();
  vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: CLASS_ID, schoolId: FIXTURES.schoolA } as never);
  vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
    { id: cuid("cs1"), subject: { code: "maths" } },
    { id: cuid("cs2"), subject: { code: "français" } },
  ] as never);
  vi.mocked(prisma.schedule.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.schedule.create).mockResolvedValue({ id: cuid("sched1") } as never);
  vi.mocked(prisma.schedule.update).mockResolvedValue({ id: cuid("sched1") } as never);
  vi.mocked(prisma.schedule.deleteMany).mockResolvedValue({ count: 3 } as never);
  vi.mocked(prisma.schedule.createMany).mockResolvedValue({ count: 2 } as never);
});

describe("POST /api/import/schedules", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: makeBody(CLASS_ID, []) }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-authorized roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: makeBody(CLASS_ID, []) }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when classId or data is missing", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: { data: [] } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("classId et data (tableau) sont requis");
  });

  it("should return 404 when class does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: makeBody(CLASS_ID, []) }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Classe introuvable");
  });

  it("should return 403 for another school's class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolB }));
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: makeBody(CLASS_ID, []) }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès non autorisé");
  });

  it("should create new schedule rows matching subjects by code", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue(null);
    const body = makeBody(CLASS_ID, [
      VALID_ROW,
      { jour: "mardi", heure_debut: "10:00", heure_fin: "11:00", matiere: "Français" },
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.replaced).toBe(false);
    expect(prisma.schedule.create).toHaveBeenCalledTimes(2);
    expect(prisma.schedule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ classId: CLASS_ID, classSubjectId: cuid("cs1"), dayOfWeek: 1, room: "Salle 1" }),
    }));
  });

  it("should update existing rows instead of duplicating", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue({ id: cuid("sched1") } as never);
    const body = makeBody(CLASS_ID, [VALID_ROW]);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.imported).toBe(1);
    expect(prisma.schedule.create).not.toHaveBeenCalled();
    expect(prisma.schedule.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: cuid("sched1") },
      data: expect.objectContaining({ classSubjectId: cuid("cs1"), room: "Salle 1" }),
    }));
  });

  it("should replace the whole schedule when replaceExisting is true", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody(CLASS_ID, [VALID_ROW, { jour: "mercredi", heure_debut: "14:00", heure_fin: "15:00" }], true);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.replaced).toBe(true);
    expect(result.imported).toBe(2);
    expect(prisma.schedule.deleteMany).toHaveBeenCalledWith({ where: { classId: CLASS_ID } });
    expect(prisma.schedule.createMany).toHaveBeenCalledWith({ data: expect.any(Array) });
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });

  it("should report invalid days and missing hours as row errors", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody(CLASS_ID, [
      { jour: "dimanche", heure_debut: "08:00", heure_fin: "09:00" },
      { jour: "lundi", heure_debut: "", heure_fin: "" },
      VALID_ROW,
    ]);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('Jour invalide: "dimanche"');
    expect(result.errors[1].message).toBe("Heures de début et fin requises");
    expect(prisma.schedule.create).toHaveBeenCalledTimes(1);
  });

  it("should map unknown subjects to null classSubjectId", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const body = makeBody(CLASS_ID, [{ jour: "jeudi", heure_debut: "09:00", heure_fin: "10:00", matiere: "Inconnue" }]);
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body }));
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.imported).toBe(1);
    expect(prisma.schedule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ classSubjectId: null }),
    }));
  });

  it("should return 500 on unexpected database failure", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.class.findUnique).mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("http://localhost/api/import/schedules", { method: "POST", body: makeBody(CLASS_ID, []) }));
    expect(res.status).toBe(500);
  });
});