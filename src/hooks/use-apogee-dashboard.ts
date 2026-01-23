"use client";

import { useMemo } from "react";
import {
  useGradeDistribution,
  useRecentActivity,
  useSchoolStats,
  GradeDistribution,
} from "@/hooks/use-analytics";
import { composeApogeeDashboard } from "@/application/apogee/dashboard-composer";
import { ApogeeDashboardModel } from "@/domain/apogee/model";

const EMPTY_GRADES: GradeDistribution = {
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  F: 0,
};

export interface ApogeeDashboardState {
  readonly model: ApogeeDashboardModel | null;
  readonly isLoading: boolean;
  readonly errors: Error[];
}

export const useApogeeDashboard = (): ApogeeDashboardState => {
  const statsQuery = useSchoolStats();
  const gradeQuery = useGradeDistribution();
  const activityQuery = useRecentActivity();

  const model = useMemo(() => {
    if (!statsQuery.data) return null;
    return composeApogeeDashboard({
      stats: statsQuery.data,
      grades: gradeQuery.data ?? EMPTY_GRADES,
      activity: activityQuery.data ?? [],
    });
  }, [statsQuery.data, gradeQuery.data, activityQuery.data]);

  const errors = [statsQuery.error, gradeQuery.error, activityQuery.error].filter(
    (error): error is Error => Boolean(error)
  );

  return {
    model,
    isLoading: statsQuery.isLoading || gradeQuery.isLoading || activityQuery.isLoading,
    errors,
  };
};
