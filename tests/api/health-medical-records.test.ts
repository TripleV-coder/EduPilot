import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT } from "@/app/api/health/medical-records/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    medicalRecord: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const STUDENT = { id: FIXTURES.studentA, schoolId: FIXTURES.schoolA, userId: "u_stu" };
const MR_ID = cuid("mr1");

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: MR_ID,
    studentId: FIXTURES.studentA,
    bloodType: "O+",
    student: { user: { firstName: "Awa", lastName: "Diallo" } },
    allergies: [],
    vaccinations: [],
    emergencyContacts: [],
    ...overrides,
  } as never;
}

describe("GET /api/health/medical-records", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/medical-records"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/health/medical-records"), { session: makeSession("TEACHER") });
    expect(res.status).toBe(403);
  });

  it("should return 404 when record missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost/api/health/medical-records?id=${MR_ID}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should return the record by id", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({ id: MR_ID, studentId: FIXTURES.studentA, student: STUDENT } as never);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([makeRecord()]);
    const res = await GET(makeRequest(`http://localhost/api/health/medical-records?id=${MR_ID}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medicalRecords).toHaveLength(1);
  });

  it("should list records for a student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(STUDENT as never);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([makeRecord()]);
    const res = await GET(makeRequest(`http://localhost/api/health/medical-records?studentId=${FIXTURES.studentA}`), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
  });

  it("should scope PARENT to their children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: FIXTURES.studentA }] } as never);
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([makeRecord()]);
    const res = await GET(makeRequest("http://localhost/api/health/medical-records"), { session: makeSession("PARENT") });
    expect(res.status).toBe(200);
    expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: { in: [FIXTURES.studentA] } } }));
  });

  it("should return 404 for STUDENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/medical-records"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
  });

  it("should scope SCHOOL_ADMIN to their school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.medicalRecord.findMany).mockResolvedValue([makeRecord()]);
    const res = await GET(makeRequest("http://localhost/api/health/medical-records"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(200);
    expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { student: { schoolId: FIXTURES.schoolA } } }));
  });
});

describe("POST /api/health/medical-records", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid PARENT (staff only)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/health/medical-records", { method: "POST", body: {} }), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await POST(makeRequest("http://localhost/api/health/medical-records", { method: "POST", body: { bloodType: "O+" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when student missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/health/medical-records", { method: "POST", body: { studentId: FIXTURES.studentA } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should return 409 when a record already exists", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(STUDENT as never);
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(makeRecord());
    const res = await POST(makeRequest("http://localhost/api/health/medical-records", { method: "POST", body: { studentId: FIXTURES.studentA } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(409);
  });

  it("should create the record with allergies", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(STUDENT as never);
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.medicalRecord.create).mockResolvedValue(makeRecord());
    const res = await POST(makeRequest("http://localhost/api/health/medical-records", { method: "POST", body: { studentId: FIXTURES.studentA, bloodType: "O+", allergies: ["Pollen"] } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(201);
    expect(prisma.medicalRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allergies: { create: [{ allergen: "Pollen", severity: "moderate" }] } }) }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("PUT /api/health/medical-records", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await PUT(makeRequest("http://localhost/api/health/medical-records", { method: "PUT", body: { bloodType: "A+" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when record missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/health/medical-records", { method: "PUT", body: { id: MR_ID } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should update the record with allergies replacement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({ id: MR_ID, studentId: FIXTURES.studentA, student: STUDENT } as never);
    vi.mocked(prisma.medicalRecord.update).mockResolvedValue(makeRecord());
    const res = await PUT(makeRequest("http://localhost/api/health/medical-records", { method: "PUT", body: { id: MR_ID, bloodType: "B+", allergies: ["Arachide"] } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.medicalRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allergies: { deleteMany: {}, create: [{ allergen: "Arachide", severity: "moderate" }] } }) }));
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("should update without touching allergies when not provided", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue({ id: MR_ID, studentId: FIXTURES.studentA, student: STUDENT } as never);
    vi.mocked(prisma.medicalRecord.update).mockResolvedValue(makeRecord());
    const res = await PUT(makeRequest("http://localhost/api/health/medical-records", { method: "PUT", body: { id: MR_ID, notes: "Suivi trimestriel" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.medicalRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: { notes: "Suivi trimestriel" } }));
  });
});