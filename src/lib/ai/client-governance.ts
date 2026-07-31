/**
 * Client-side helpers for AI governance actions (couches 1–2, cloud optionnel).
 */

export type GovernanceAction =
  | "draft-report-comment"
  | "recommend-orientation"
  | "analyze-risk"
  | "generate-action-plan";

export type GovernanceResponse<T = unknown> = {
  success: boolean;
  action?: string;
  data?: T;
  error?: string;
  confidence?: number;
  recommendations?: string[];
};

export async function callGovernanceAction<T = unknown>(
  action: GovernanceAction,
  payload: { studentId?: string; data?: Record<string, unknown> } = {}
): Promise<GovernanceResponse<T>> {
  const { studentId, data = {} } = payload;
  const mergedData = studentId ? { ...data, studentId } : data;

  const res = await fetch("/api/ai/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: "governance",
      action,
      ...(studentId ? { studentId } : {}),
      data: mergedData,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as GovernanceResponse<T> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error || "Erreur lors de l'action IA");
  }

  return json;
}

export type InterventionPlan = {
  riskLevel: string;
  riskScore: number;
  factors: string[];
  recommendations: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary?: string;
  suggestedActions: {
    title: string;
    description: string;
    type: string;
  }[];
};

export type OrientationResult = {
  series: string;
  justification: string;
  alternatives?: string[];
  synthesis?: string;
};

export type ActionPlanResult = {
  title: string;
  description: string;
  priority: string;
  steps: string[];
  suggestedBy?: string;
};
