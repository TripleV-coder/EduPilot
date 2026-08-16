import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/academic-years/route";

describe("API /api/academic-years", () => {
  const schoolId = "school-1";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId }) as never);
  });

  describe("GET /api/academic-years", () => {
    it("should return academic years for current school", async () => {
      vi.mocked(prisma.academicYear.findMany).mockResolvedValue([
        { id: "ay-1", schoolId, name: "2025-2026", periods: [] },
      ] as never);

      const res = await GET(makeRequest("http://localhost/api/academic-years"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("2025-2026");
    });
  });

  describe("POST /api/academic-years", () => {
    it("should create a new academic year", async () => {
      vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.academicConfig.findFirst).mockResolvedValue({
        id: "cfg-1",
        schoolId,
        periodType: "TRIMESTER",
        periodsCount: 3,
      } as never);
      vi.mocked(prisma.academicYear.create).mockResolvedValue({
        id: "ay-new",
        schoolId,
        name: "2026-2027",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-06-30"),
        isCurrent: true,
      } as never);
      vi.mocked(prisma.period.create).mockResolvedValue({ id: "p-1" } as never);
      vi.mocked(prisma.academicYear.findUnique).mockResolvedValue({
        id: "ay-new",
        name: "2026-2027",
        periods: [],
      } as never);

      const res = await POST(makeRequest("http://localhost/api/academic-years", {
        method: "POST",
        body: {
          name: "2026-2027",
          startDate: "2026-09-01T00:00:00.000Z",
          endDate: "2027-06-30T00:00:00.000Z",
          isCurrent: true,
        },
      }));

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("2026-2027");
    });

    it("should return 409 if year name already exists", async () => {
      vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({
        id: "ay-exist",
        name: "2026-2027",
      } as never);

      const res = await POST(makeRequest("http://localhost/api/academic-years", {
        method: "POST",
        body: {
          name: "2026-2027",
          startDate: "2026-09-01T00:00:00.000Z",
          endDate: "2027-06-30T00:00:00.000Z",
          isCurrent: false,
        },
      }));

      expect(res.status).toBe(409);
    });
  });
});
