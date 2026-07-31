// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export type { AnalyticsWithDetails } from "./types";
export {
  buildPerformanceDistribution,
  buildRiskDistribution,
  buildSubjectSummary,
  buildAtRiskStudents,
} from "./builders";
export { getAdminDashboardData, getGlobalDashboardData } from "./admin";
export { getTeacherDashboardData } from "./teacher";
export { getStudentDashboardData, getParentDashboardData } from "./family";
export { getAccountantDashboardData, getStaffDashboardData } from "./staff";
