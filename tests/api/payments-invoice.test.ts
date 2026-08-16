import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/payments/[id]/invoice/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
  },
}));

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay1",
    amount: 50000,
    method: "MOBILE_MONEY_MTN",
    paidAt: new Date("2026-01-15"),
    reference: "REF-001",
    receivedBy: "M. Comptable",
    notes: "Remise de 10%",
    studentId: FIXTURES.studentA,
    student: {
      matricule: "MAT001",
      user: { firstName: "Awa", lastName: "Diallo", phone: "0102030405", schoolId: FIXTURES.schoolA },
      enrollments: [
        {
          class: { name: "6A", classLevel: { name: "Sixième" }, school: {} },
        },
      ],
    },
    fee: {
      name: "Frais de scolarité",
      description: "Premier trimestre",
      amount: 50000,
      schoolId: FIXTURES.schoolA,
      school: { name: "École A", address: "Cotonou", phone: "0102030405", email: "contact@ecolea.bj" },
      academicYear: { name: "2025-2026" },
    },
    ...overrides,
  } as never;
}

describe("GET /api/payments/[id]/invoice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 404 when payment not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid a student viewing someone else's payment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_student" }));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "otherStudent" } as never);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(403);
  });

  it("should allow a student viewing their own payment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u_student" }));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: FIXTURES.studentA } as never);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(200);
  });

  it("should forbid a parent who is not linked to the student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: "other" }] } as never);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(403);
  });

  it("should allow a linked parent", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u_parent" }));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ parentStudents: [{ studentId: FIXTURES.studentA }] } as never);
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(200);
  });

  it("should forbid unknown roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(403);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT", { schoolId: FIXTURES.schoolB, accessibleSchoolIds: [FIXTURES.schoolB] }));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(403);
  });

  it("should generate a PDF receipt for an accountant", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(makePayment());
    const res = await GET(makeRequest("http://localhost/api/payments/pay1/invoice"), { params: Promise.resolve({ id: "pay1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pdf).toContain("data:application/pdf");
    expect(body.filename).toContain("facture_pay1");
  });
});