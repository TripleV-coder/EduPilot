import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/analytics/route";
import { auth } from "@/lib/auth";
import { analyticsService } from "@/lib/analytics/service";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/analytics/service", () => ({
  analyticsService: {
    getSchoolStats: vi.fn(),
    getUserStats: vi.fn(),
    getGradeDistribution: vi.fn(),
    getRecentActivity: vi.fn(),
  },
}));

describe("GET /api/analytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/analytics"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost/api/analytics"), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("should return 400 when no school is available", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost/api/analytics"), { session: makeSession("SUPER_ADMIN", { schoolId: null }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("École introuvable");
  });

  it("should return overview stats with user stats", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "u_an_overview" }));
    vi.mocked(analyticsService.getSchoolStats).mockResolvedValue({
      studentsCount: 120,
      teachersCount: 15,
      classesCount: 10,
    });
    vi.mocked(analyticsService.getUserStats).mockResolvedValue({
      notificationsCount: 3,
      unreadNotifications: 1,
      lastActivityAt: null,
      lastActivityAction: null,
      lastActivityEntity: null,
    });
    const res = await GET(makeRequest("http://localhost/api/analytics"), { session: makeSession("SUPER_ADMIN", { id: "u_an_overview" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.studentsCount).toBe(120);
    expect(body.userStats.notificationsCount).toBe(3);
    expect(analyticsService.getSchoolStats).toHaveBeenCalledWith(FIXTURES.schoolA);
    expect(analyticsService.getUserStats).toHaveBeenCalledWith("u_an_overview");
  });

  it("should return grade distribution when type=grades", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "u_an_grades" }));
    vi.mocked(analyticsService.getGradeDistribution).mockResolvedValue({
      labels: ["16-20", "14-15.99", "12-13.99", "10-11.99", "<10"],
      datasets: [{ data: [1, 2, 3, 4, 5] }],
    });
    const classId = "cclass1";
    const res = await GET(makeRequest(`http://localhost/api/analytics?type=grades&classId=${classId}`), { session: makeSession("SUPER_ADMIN", { id: "u_an_grades" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.datasets[0].data).toEqual([1, 2, 3, 4, 5]);
    expect(analyticsService.getGradeDistribution).toHaveBeenCalledWith(FIXTURES.schoolA, classId);
  });

  it("should return recent activity when type=activity", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "u_an_activity" }));
    vi.mocked(analyticsService.getRecentActivity).mockResolvedValue([{ id: "a1", action: "CREATE" }] as never);
    const res = await GET(makeRequest("http://localhost/api/analytics?type=activity"), { session: makeSession("SUPER_ADMIN", { id: "u_an_activity" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].action).toBe("CREATE");
    expect(analyticsService.getRecentActivity).toHaveBeenCalledWith(FIXTURES.schoolA);
  });

  it("should return 400 for an unknown type", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "u_an_unknown" }));
    const res = await GET(makeRequest("http://localhost/api/analytics?type=bogus"), { session: makeSession("SUPER_ADMIN", { id: "u_an_unknown" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Unknown type");
  });

  it("should return 500 when the service fails", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "u_an_err" }));
    vi.mocked(analyticsService.getSchoolStats).mockRejectedValue(new Error("boom"));
    const res = await GET(makeRequest("http://localhost/api/analytics"), { session: makeSession("SUPER_ADMIN", { id: "u_an_err" }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Analytics failed");
  });
});