import { describe, it, expect, vi } from "vitest";
import {
  handlePerformanceBarClick,
  handleRiskPieClick,
  handleSubjectRadarClick,
  handlePerformanceLevelClick,
  resetFilters,
} from "@/lib/utils/drilldown";

describe("utils/drilldown", () => {
  it("handlePerformanceBarClick passes subjectId", () => {
    const cb = vi.fn();
    handlePerformanceBarClick("MATHS", cb);
    expect(cb).toHaveBeenCalledWith({ subjectId: "MATHS" });
  });

  it("handleRiskPieClick reads payload.name first", () => {
    const cb = vi.fn();
    handleRiskPieClick({ payload: { name: "HIGH" }, name: "ignored" }, cb);
    expect(cb).toHaveBeenCalledWith({ riskLevel: "HIGH" });
  });

  it("handleRiskPieClick falls back to segment.name", () => {
    const cb = vi.fn();
    handleRiskPieClick({ name: "MEDIUM" }, cb);
    expect(cb).toHaveBeenCalledWith({ riskLevel: "MEDIUM" });
  });

  it("handleSubjectRadarClick passes subjectId", () => {
    const cb = vi.fn();
    handleSubjectRadarClick("PHYSICS", cb);
    expect(cb).toHaveBeenCalledWith({ subjectId: "PHYSICS" });
  });

  it("handlePerformanceLevelClick passes performanceLevel", () => {
    const cb = vi.fn();
    handlePerformanceLevelClick("excellent", cb);
    expect(cb).toHaveBeenCalledWith({ performanceLevel: "excellent" });
  });

  it("resetFilters clears all", () => {
    const cb = vi.fn();
    resetFilters(cb);
    expect(cb).toHaveBeenCalledWith({});
  });
});
