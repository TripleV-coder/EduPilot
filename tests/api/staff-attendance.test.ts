import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/staff/attendance/route";
import { POST as POST_BULK } from "@/app/api/staff/attendance/bulk/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findMany: vi.fn(), findFirst: vi.fn() },
    staffAttendance: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("GET /api/staff/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/staff/attendance"));
    expect(res.status).toBe(401);
  });

  it("should forbid roles outside staff members", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/staff/attendance"));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/staff/attendance"));
    expect(res.status).toBe(403);
  });

  it("should return the full roster for an HR manager with summary", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: cuid("staff1"), firstName: "Paul", lastName: "Biya", role: "TEACHER" },
      { id: cuid("staff2"), firstName: "Awa", lastName: "Sossa", role: "STAFF" },
    ] as never);
    vi.mocked(prisma.staffAttendance.findMany).mockResolvedValue([
      { userId: cuid("staff1"), status: "PRESENT", checkIn: "08:00", checkOut: "16:00", note: null },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/staff/attendance?date=2026-09-10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-09-10");
    expect(body.canManage).toBe(true);
    expect(body.roster).toHaveLength(2);
    expect(body.roster[0].status).toBe("PRESENT");
    expect(body.roster[1].status).toBeNull();
    expect(body.summary).toEqual({ present: 1, absent: 0, late: 0, onLeave: 0, total: 1 });
  });

  it("should only return the employee's own line for non-managers", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: cuid("userteacher"), firstName: "Paul", lastName: "Biya", role: "TEACHER" },
    ] as never);
    vi.mocked(prisma.staffAttendance.findMany).mockResolvedValue([] as never);

    const res = await GET(makeRequest("http://localhost/api/staff/attendance"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(false);
    expect(body.roster).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: cuid("userteacher") } }));
  });
});

describe("POST /api/staff/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  const body = { userId: cuid("staff1"), date: "2026-09-10", status: "PRESENT", checkIn: "08:00", checkOut: "16:00", note: "OK" };

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-HR roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid payload", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body: { ...body, date: "10/09/2026" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("should return 404 when the target staff member is not in the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body }));
    expect(res.status).toBe(404);
  });

  it("should upsert the attendance record", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: cuid("staff1") } as never);
    vi.mocked(prisma.staffAttendance.upsert).mockResolvedValue({ id: "rec1" } as never);

    const res = await POST(makeRequest("http://localhost/api/staff/attendance", { method: "POST", body }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.id).toBe("rec1");
    const upsertCall = vi.mocked(prisma.staffAttendance.upsert).mock.calls[0][0] as { where: { userId_date: { userId: string } } };
    expect(upsertCall.where.userId_date.userId).toBe(cuid("staff1"));
  });
});

describe("POST /api/staff/attendance/bulk", () => {
  beforeEach(() => vi.clearAllMocks());

  const entries = [
    { userId: cuid("staff1"), status: "PRESENT" },
    { userId: cuid("staff2"), status: "ABSENT" },
  ];

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries } }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-HR roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries } }));
    expect(res.status).toBe(403);
  });

  it("should return 403 when the account has no active school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries } }));
    expect(res.status).toBe(403);
  });

  it("should return 400 on empty entries", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries: [] } }));
    expect(res.status).toBe(400);
  });

  it("should save valid entries and skip out-of-scope ones", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: cuid("staff1") }] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries } }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ saved: 1, skipped: 1 });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]));
  });

  it("should save all entries when every agent belongs to the school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: cuid("staff1") }, { id: cuid("staff2") }] as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    const res = await POST_BULK(makeRequest("http://localhost/api/staff/attendance/bulk", { method: "POST", body: { date: "2026-09-10", entries } }));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ saved: 2, skipped: 0 });
  });
});