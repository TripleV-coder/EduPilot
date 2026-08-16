import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/attendance/bulk/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api/cache-helpers", () => ({ invalidateByPath: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAnalyticsAfterStudentActivityChange: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    enrollment: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const BASE_BODY = {
  records: [{ studentId: "s1", status: "PRESENT" }],
  classId: "cl1",
  date: "2026-09-10",
};

describe("POST /api/attendance/bulk", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(401);
  });

  it("should forbid non-teacher roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should return 400 when records is empty", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: { ...BASE_BODY, records: [] } }));
    expect(res.status).toBe(400);
  });

  it("should return 400 when classId or date missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: { records: [{ studentId: "s1" }] } }));
    expect(res.status).toBe(400);
  });

  it("should return 404 when class not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school classes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1", schoolId: FIXTURES.schoolB } as never);
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should block a teacher who does not teach the class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: "cl1",
      schoolId: FIXTURES.schoolA,
      mainTeacher: { userId: "other" },
      classSubjects: [{ teacherId: "other" }],
    } as never);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "tp1" } as never);
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(403);
  });

  it("should block unenrolled students (anti-fraud)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u1" }));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: "cl1",
      schoolId: FIXTURES.schoolA,
      mainTeacher: { userId: "u1" },
      classSubjects: [],
    } as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(0);
    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", { method: "POST", body: BASE_BODY }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({ error: expect.stringContaining("bloquée") }));
  });

  it("should record attendance, updating existing records", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u1" }));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({
      id: "cl1",
      schoolId: FIXTURES.schoolA,
      mainTeacher: { userId: "u1" },
      classSubjects: [],
    } as never);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(1);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        attendance: {
          findFirst: vi.fn().mockResolvedValue({ id: "a1" }),
          update: vi.fn().mockResolvedValue({ id: "a1" }),
          create: vi.fn().mockResolvedValue({ id: "a2" }),
        },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await POST(makeRequest("http://localhost/api/attendance/bulk", {
      method: "POST",
      body: {
        records: [{ studentId: "s1", status: "ABSENT", notes: "Malade" }],
        classId: "cl1",
        date: "2026-09-10",
      },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
  });
});