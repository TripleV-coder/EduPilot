import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE, PATCH } from "@/app/api/health/emergency-contacts/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    emergencyContact: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    medicalRecord: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const STUDENT = {
  id: FIXTURES.studentA,
  schoolId: FIXTURES.schoolA,
  userId: "u_stu",
};

function makeMedicalRecord() {
  return {
    id: cuid("mr1"),
    studentId: FIXTURES.studentA,
    student: STUDENT,
  } as never;
}

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("ec1"),
    medicalRecordId: cuid("mr1"),
    name: "Maman",
    relationship: "Mère",
    phone: "0102030405",
    isPrimary: true,
    medicalRecord: { student: { user: { firstName: "Awa", lastName: "Diallo" } } },
    ...overrides,
  } as never;
}

describe("GET /api/health/emergency-contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside HEALTH_READ_ROLES", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: makeSession("TEACHER") });
    expect(res.status).toBe(403);
  });

  it("should forbid staff without schoolId", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: makeSession("NURSE", { schoolId: null }) });
    expect(res.status).toBe(403);
  });

  it("should return 404 when medicalRecord not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts?medicalRecordId=mr1"), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE", { schoolId: FIXTURES.schoolB }));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(makeMedicalRecord());
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts?medicalRecordId=mr1"), { session: makeSession("NURSE", { schoolId: FIXTURES.schoolB }) });
    expect(res.status).toBe(403);
  });

  it("should list contacts for a given medicalRecord", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(makeMedicalRecord());
    vi.mocked(prisma.emergencyContact.findMany).mockResolvedValue([makeContact()]);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts?medicalRecordId=mr1"), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emergencyContacts).toHaveLength(1);
  });

  it("should list contacts for a given student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(STUDENT as never);
    vi.mocked(prisma.emergencyContact.findMany).mockResolvedValue([makeContact()]);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts?studentId=stu1"), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
  });

  it("should scope PARENT to their children", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: FIXTURES.studentA }] } as never);
    vi.mocked(prisma.emergencyContact.findMany).mockResolvedValue([makeContact()]);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: makeSession("PARENT") });
    expect(res.status).toBe(200);
    expect(prisma.emergencyContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { medicalRecord: { studentId: { in: [FIXTURES.studentA] } } } })
    );
  });

  it("should return 404 for STUDENT without profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: makeSession("STUDENT") });
    expect(res.status).toBe(404);
  });

  it("should scope SCHOOL_ADMIN to their school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.emergencyContact.findMany).mockResolvedValue([makeContact()]);
    const res = await GET(makeRequest("http://localhost/api/health/emergency-contacts"), { session: makeSession("SCHOOL_ADMIN") });
    expect(res.status).toBe(200);
    expect(prisma.emergencyContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { medicalRecord: { student: { schoolId: FIXTURES.schoolA } } } })
    );
  });
});

describe("POST /api/health/emergency-contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/health/emergency-contacts", { method: "POST", body: { medicalRecordId: cuid("mr1"), name: "Maman", relationship: "Mère", phone: "01" } }), { session: makeSession("TEACHER") });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await POST(makeRequest("http://localhost/api/health/emergency-contacts", { method: "POST", body: { name: "X" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when medical record missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/health/emergency-contacts", { method: "POST", body: { medicalRecordId: cuid("mr1"), name: "Maman", relationship: "Mère", phone: "0102030405" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should return 409 on duplicate contact", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(makeMedicalRecord());
    vi.mocked(prisma.emergencyContact.findFirst).mockResolvedValue(makeContact());
    const res = await POST(makeRequest("http://localhost/api/health/emergency-contacts", { method: "POST", body: { medicalRecordId: cuid("mr1"), name: "Maman", relationship: "Mère", phone: "0102030405" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(409);
  });

  it("should create the contact and log the audit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(makeMedicalRecord());
    vi.mocked(prisma.emergencyContact.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.emergencyContact.create).mockResolvedValue(makeContact({ isPrimary: true }));
    const res = await POST(makeRequest("http://localhost/api/health/emergency-contacts", { method: "POST", body: { medicalRecordId: cuid("mr1"), name: "Maman", relationship: "Mère", phone: "0102030405", isPrimary: true } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(201);
    expect(prisma.emergencyContact.updateMany).toHaveBeenCalledWith({ where: { medicalRecordId: cuid("mr1") }, data: { isPrimary: false } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: "EmergencyContact", action: "CREATE" }) }));
  });
});

describe("PUT /api/health/emergency-contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await PUT(makeRequest("http://localhost/api/health/emergency-contacts", { method: "PUT", body: { name: "Papa" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should return 404 when contact missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/health/emergency-contacts", { method: "PUT", body: { id: cuid("ec1"), name: "Papa" } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(404);
  });

  it("should update the contact", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue(makeContact({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.emergencyContact.update).mockResolvedValue(makeContact({ name: "Papa" }));
    const res = await PUT(makeRequest("http://localhost/api/health/emergency-contacts", { method: "PUT", body: { id: cuid("ec1"), name: "Papa", isPrimary: true } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.emergencyContact.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("DELETE /api/health/emergency-contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await DELETE(makeRequest("http://localhost/api/health/emergency-contacts?foo=bar"), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should forbid deleting the only primary contact", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue(makeContact({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.emergencyContact.count).mockResolvedValue(1);
    const res = await DELETE(makeRequest("http://localhost/api/health/emergency-contacts?id=ec1"), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should delete the contact when another remains", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue(makeContact({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.emergencyContact.count).mockResolvedValue(2);
    vi.mocked(prisma.emergencyContact.delete).mockResolvedValue(makeContact() as never);
    const res = await DELETE(makeRequest("http://localhost/api/health/emergency-contacts?id=ec1"), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

describe("PATCH /api/health/emergency-contacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when id missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    const res = await PATCH(makeRequest("http://localhost/api/health/emergency-contacts", { method: "PATCH", body: {} }), { session: makeSession("NURSE") });
    expect(res.status).toBe(400);
  });

  it("should set the contact as primary via transaction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("NURSE"));
    vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue(makeContact({ medicalRecord: { studentId: FIXTURES.studentA, student: STUDENT } }));
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
    const res = await PATCH(makeRequest("http://localhost/api/health/emergency-contacts", { method: "PATCH", body: { id: cuid("ec1") } }), { session: makeSession("NURSE") });
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});