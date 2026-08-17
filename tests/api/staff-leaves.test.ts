import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/staff/leaves/route";
import { PATCH } from "@/app/api/staff/leaves/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    leaveRequest: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

function makeLeave(overrides: Record<string, unknown> = {}) {
  return {
    id: "lv1",
    userId: cuid("staff1"),
    schoolId: FIXTURES.schoolA,
    type: "ANNUAL",
    startDate: new Date("2026-08-10T00:00:00.000Z"),
    endDate: new Date("2026-08-12T00:00:00.000Z"),
    reason: "Vacances",
    status: "PENDING",
    user: { firstName: "Paul", lastName: "Biya", role: "TEACHER" },
    decidedBy: null,
    decisionNote: null,
    ...overrides,
  } as never;
}

const LEAVE_BODY = { type: "ANNUAL", startDate: "2026-08-10", endDate: "2026-08-12", reason: "Vacances" };

describe("GET /api/staff/leaves", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/staff/leaves"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside staff members", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/staff/leaves"));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/staff/leaves"));
    expect(res.status).toBe(403);
  });

  it("should list all requests of the school for an HR manager with status filter", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([makeLeave()]);

    const res = await GET(makeRequest("http://localhost/api/staff/leaves?status=PENDING"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(true);
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).toEqual(expect.objectContaining({ id: "lv1", days: 3, status: "PENDING", decidedBy: null }));
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, status: "PENDING" } }),
    );
  });

  it("should only list the employee's own requests for non-managers", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([makeLeave({ userId: cuid("userteacher") })]);

    const res = await GET(makeRequest("http://localhost/api/staff/leaves"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(false);
    expect(body.requests[0].isMine).toBe(true);
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, userId: cuid("userteacher") } }),
    );
  });
});

describe("POST /api/staff/leaves", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/staff/leaves", { method: "POST", body: LEAVE_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside staff members", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/staff/leaves", { method: "POST", body: LEAVE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/staff/leaves", { method: "POST", body: LEAVE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when the end date precedes the start date", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/staff/leaves", {
      method: "POST",
      body: { ...LEAVE_BODY, startDate: "2026-08-15", endDate: "2026-08-10" },
    }));
    expect(res.status).toBe(400);
  });

  it("should create the leave request as PENDING", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.leaveRequest.create).mockResolvedValue({ id: "lv1" } as never);

    const res = await POST(makeRequest("http://localhost/api/staff/leaves", { method: "POST", body: LEAVE_BODY }));
    expect(res.status).toBe(201);
    const resBody = await res.json();
    expect(resBody.id).toBe("lv1");
    const createCall = vi.mocked(prisma.leaveRequest.create).mock.calls[0][0] as { data: { userId: string; status: string; schoolId: string } };
    expect(createCall.data).toEqual(expect.objectContaining({ userId: cuid("userteacher"), status: "PENDING", schoolId: FIXTURES.schoolA }));
  });
});

describe("PATCH /api/staff/leaves/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside staff members", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: null }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid action", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "ignore" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(400);
  });

  it("should return 404 when the request is not in the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(404);
  });

  it("should reject action on an already processed request", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave({ status: "APPROVED" }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "cancel" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Cette demande a déjà été traitée.");
  });

  it("should forbid cancel by a non-owner non-manager", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave({ userId: "someone-else" }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "cancel" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(403);
  });

  it("should allow the owner to cancel their own pending request", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave({ userId: cuid("userteacher") }));
    vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ status: "CANCELLED" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "cancel" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.status).toBe("CANCELLED");
  });

  it("should forbid approve by a non-manager", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave({ userId: "someone-else" }));
    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(403);
  });

  it("should approve the request as an HR manager", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave());
    vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ status: "APPROVED" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "approve", note: "OK" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.status).toBe("APPROVED");
    const updateCall = vi.mocked(prisma.leaveRequest.update).mock.calls[0][0] as { data: { status: string; decidedById: string; decisionNote: string } };
    expect(updateCall.data).toEqual(expect.objectContaining({ status: "APPROVED", decidedById: cuid("userdirector"), decisionNote: "OK" }));
  });

  it("should reject the request as an HR manager", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(makeLeave());
    vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ status: "REJECTED" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/staff/leaves/lv1", { method: "PATCH", body: { action: "reject" } }), { params: Promise.resolve({ id: "lv1" }) });
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.status).toBe("REJECTED");
  });
});