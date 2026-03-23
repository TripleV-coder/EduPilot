/**
 * Drill-down utility for chart interactivity
 * Provides functions to handle chart click events and filter state
 */

export interface DrilldownFilter {
  subjectId?: string;
  riskLevel?: string;
  performanceLevel?: string;
}

/**
 * Handle performance bar chart click
 * Filters by subject when a bar is clicked
 */
export function handlePerformanceBarClick(
  dataKey: string,
  onFilterChange: (filter: DrilldownFilter) => void
) {
  // dataKey is usually the subject name or ID
  onFilterChange({ subjectId: dataKey });
}

/**
 * Handle risk pie chart click
 * Filters by risk level when a segment is clicked
 */
export function handleRiskPieClick(
  segment: any,
  onFilterChange: (filter: DrilldownFilter) => void
) {
  const riskLevel = segment.payload?.name || segment.name;
  onFilterChange({ riskLevel });
}

/**
 * Handle subject radar chart click
 * Filters by subject when an axis is clicked
 */
export function handleSubjectRadarClick(
  dataKey: string,
  onFilterChange: (filter: DrilldownFilter) => void
) {
  onFilterChange({ subjectId: dataKey });
}

/**
 * Handle performance level click
 * Filters by performance level
 */
export function handlePerformanceLevelClick(
  performanceLevel: string,
  onFilterChange: (filter: DrilldownFilter) => void
) {
  onFilterChange({ performanceLevel });
}

/**
 * Reset all filters
 */
export function resetFilters(
  onFilterChange: (filter: DrilldownFilter) => void
) {
  onFilterChange({});
}
