import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildReportSections,
  type ReportFilters,
  type ReportBlocks,
} from "@/lib/analytics/report-builder";

const filters: ReportFilters = {
  schoolId: "school-1",
  academicYearId: "year-1",
  periodId: "ALL",
  classIds: [],
  subjectIds: [],
};

const blocks: ReportBlocks = {
  overview: true,
  performances: true,
  attendance: false,
  risks: false,
  finance: false,
};

const dashboardResponse = {
  totalStudents: 120,
  averageGrade: 12.4,
  attendanceRate: 0.94,
  passRate: 0.81,
  subjectPerformance: [
    { subject: "Maths", average: 11.2 },
    { subject: "Français", average: 13.5 },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/analytics/dashboard")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(dashboardResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  );
});

describe("buildReportSections", () => {
  it("returns sections in the requested order, skipping disabled blocks", async () => {
    const sections = await buildReportSections({
      filters,
      blocks,
      order: ["overview", "performances", "attendance", "risks", "finance"],
    });

    expect(sections.map((s) => s.key)).toEqual(["overview", "performances"]);
  });

  it("overview section exposes KPI rows", async () => {
    const sections = await buildReportSections({
      filters,
      blocks: { ...blocks, performances: false },
      order: ["overview"],
    });

    expect(sections[0].title).toBe("Synthèse Globale");
    expect(sections[0].headers).toEqual(["Indicateur", "Valeur"]);
    expect(sections[0].rows).toContainEqual(["Élèves", "120"]);
    expect(sections[0].rows).toContainEqual(["Moyenne générale", "12,40"]);
    expect(sections[0].rows).toContainEqual(["Taux d'assiduité", "94,0 %"]);
    expect(sections[0].rows).toContainEqual(["Taux de réussite", "81,0 %"]);
  });

  it("performances section lists subjects with their average", async () => {
    const sections = await buildReportSections({
      filters,
      blocks: { ...blocks, overview: false },
      order: ["performances"],
    });

    expect(sections[0].title).toBe("Performances Académiques");
    expect(sections[0].headers).toEqual(["Matière", "Moyenne"]);
    expect(sections[0].rows).toEqual([
      ["Maths", "11,20"],
      ["Français", "13,50"],
    ]);
  });

  it("returns empty array when all blocks disabled", async () => {
    const sections = await buildReportSections({
      filters,
      blocks: {
        overview: false,
        performances: false,
        attendance: false,
        risks: false,
        finance: false,
      },
      order: ["overview", "performances", "attendance", "risks", "finance"],
    });

    expect(sections).toEqual([]);
  });
});
