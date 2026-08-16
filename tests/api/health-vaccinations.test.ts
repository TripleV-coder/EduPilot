import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "@/app/api/health/vaccinations/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    vaccination: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    medicalRecord: { findMany: vi.fn(), findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const STUDENT = { id: FIXTURES.studentA, schoolId: FIXTURES.schoolA, userId: "u_stu" };
const MR_ID = cuid("mr1");

function makeVaccination(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("vac1"),
    medicalRecordId: MR_ID,
    vaccineName: "DT-Polio",
    dateGiven: new Date("2026-01-10"),
    nextDueDate: null,
    medicalRecord: { student: { user: { firstName: "Awa", lastName: "Diallo" } } },
    ...overrides,
  } as never;
}

describe("GET /api/health/vaccinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/vaccinations"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/health/vaccinations"), { session: makeSession("TEACHER") });
    expect(res.status).toBe(403);
  });

  it("should return 404 when medical record missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/health/vaccinations?medicalRecordId=${MR_ID}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should return 200 with vaccinations and stats", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({ id: MR_ID, studentId: FIXTURES.studentA, student: STUDENT } as never);
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([makeVaccination()]);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([
      {
        id: MR_ID,
        vaccinations: [{ vaccineName: "DT-Polio" }, { vaccineName: "ROR" }],
        student: { user: { firstName: "Awa", lastName: "Diallo" } },
      },
    ] as never);

    const res = await GET(makeRequest(`http://localhost/api/health/vaccinations?medicalRecordId=${MR_ID}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vaccinations).toHaveLength(1);
    expect(body.stats.totalStudents).toBe(1);
    expect(body.stats.fullyVaccinated).toBe(0);
    expect(body.stats.coveragePercentage).toBe(0);
  });

  it("should include overdue vaccinations when requested", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(STUDENT as never);
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([makeVaccination()]);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest(`http://localhost/api/health/vaccinations?studentId=stu1&includeOverdue=true`), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.vaccination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [expect.anything(), { nextDueDate: { lt: expect.any(Date) } }] } })
    );
  });

  it("should scope PARENT to their children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: FIXTURES.studentA }] } as never);
    vi.mocked(prisma.vaccination.findMany).mockResolvedValue([makeVaccination()]);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([] as never);
    const res = await GET(makeRequest("http://localhost/api/health/vaccinations"), { session: makeSession("PARENT") });
    expect(res.status).toBe(200);
  });

  it("should return 404 for STUDENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/vaccinations"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/health/vaccinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid PARENT (staff only)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/health/vaccinations", { method: "POST", body: {} }), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await POST(makeRequest("http://localhost/api/health/vaccinations", { method: "POST", body: { medicalRecordId: MR_ID, vaccineName: "ROR" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when medical record missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/health/vaccinations", { method: "POST", body: { medicalRecordId: MR_ID, vaccineName: "ROR", dateGiven: "2026-01-10" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should create the vaccination and log the audit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({ id: MR_ID, studentId: FIXTURES.studentA, student: STUDENT } as never);
    vi.mocked(prisma.vaccination.create).mockResolvedValue(makeVaccination());
    const res = await POST(makeRequest("http://localhost/api/health/vaccinations", { method: "POST", body: { medicalRecordId: MR_ID, vaccineName: "ROR", dateGiven: "2026-01-10", nextDueDate: "2027-01-10", batchNumber: "B123" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(201);
    expect(prisma.vaccination.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dateGiven: expect.any(Date) }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: "Vaccination" }) }));
  });
});

describe("PUT /api/health/vaccinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await PUT(makeRequest("http://localhost/api/health/vaccinations", { method: "PUT", body: { vaccineName: "ROR" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when vaccination missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.vaccination.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/health/vaccinations", { method: "PUT", body: { id: cuid("vac1"), vaccineName: "ROR" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should update the vaccination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.vaccination.findUnique).mockResolvedValue(makeVaccination({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.vaccination.update).mockResolvedValue(makeVaccination({ vaccineName: "ROR" }));
    const res = await PUT(makeRequest("http://localhost/api/health/vaccinations", { method: "PUT", body: { id: cuid("vac1"), vaccineName: "ROR", dateGiven: "2026-02-01" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("DELETE /api/health/vaccinations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await DELETE(makeRequest("http://localhost/api/health/vaccinations"), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should delete the vaccination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.vaccination.findUnique).mockResolvedValue(makeVaccination({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.vaccination.delete).mockResolvedValue(makeVaccination());
    const res = await DELETE(makeRequest(`http://localhost/api/health/vaccinations?id=${cuid("vac1")}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "DELETE" }) }));
  });
});