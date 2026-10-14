// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export type { AnalyticsWithDetails } from "./types";
export {
  buildPerformanceDistribution,
  buildRiskDistribution,
  buildSubjectSummary,
  buildAtRiskStudents,
} from "./builders";
import { memoizeAsync } from "@/lib/cache/memo";
import { getAdminDashboardData as computeAdmin, getGlobalDashboardData as computeGlobal } from "./admin";
import { getTeacherDashboardData as computeTeacher } from "./teacher";
import { getStudentDashboardData as computeStudent, getParentDashboardData as computeParent } from "./family";
import { getAccountantDashboardData as computeAccountant, getStaffDashboardData as computeStaff } from "./staff";

/*
 * Tableaux de bord mémoïsés par processus, calcul unique pour les demandes
 * simultanées (`lib/cache/memo`, analyse de capacité 2026-10-01, G4). La clé
 * reprend TOUS les arguments : même établissement, même année, mêmes filtres
 * → même résultat, quel que soit le compte qui l'a demandé (la page et l'API
 * ne passent que l'établissement actif de la session, déjà contrôlé).
 * Fenêtre d'une minute pour les indicateurs d'établissement — comme le cache
 * HTTP de /api/analytics/dashboard —, 30 s pour les vues personnelles.
 */
const SCHOOL_TTL_MS = 60_000;
const PERSONAL_TTL_MS = 30_000;
const part = (value: string | undefined) => value ?? "";

export const getAdminDashboardData = memoizeAsync(
  {
    ttlMs: SCHOOL_TTL_MS,
    key: (schoolId, yearId, classId, periodId, subjectId, comparisonSchoolIds) =>
      ["admin", schoolId, yearId, part(classId), part(periodId), part(subjectId), [...(comparisonSchoolIds ?? [])].sort().join(",")].join("|"),
  },
  computeAdmin,
);
export const getGlobalDashboardData = memoizeAsync(
  {
    ttlMs: SCHOOL_TTL_MS,
    key: (yearId, classId, periodId, subjectId) => ["global", part(yearId), part(classId), part(periodId), part(subjectId)].join("|"),
  },
  computeGlobal,
);
export const getTeacherDashboardData = memoizeAsync(
  { ttlMs: PERSONAL_TTL_MS, key: (userId, schoolId, yearId) => ["teacher", userId, schoolId, yearId].join("|") },
  computeTeacher,
);
export const getStudentDashboardData = memoizeAsync(
  { ttlMs: PERSONAL_TTL_MS, key: (userId, yearId) => ["student", userId, yearId].join("|") },
  computeStudent,
);
export const getParentDashboardData = memoizeAsync(
  { ttlMs: PERSONAL_TTL_MS, key: (userId, yearId) => ["parent", userId, yearId].join("|") },
  computeParent,
);
export const getAccountantDashboardData = memoizeAsync(
  { ttlMs: SCHOOL_TTL_MS, key: (schoolId) => ["accountant", schoolId].join("|") },
  computeAccountant,
);
export const getStaffDashboardData = memoizeAsync(
  { ttlMs: SCHOOL_TTL_MS, key: (schoolId, yearId) => ["staff", schoolId, yearId].join("|") },
  computeStaff,
);
