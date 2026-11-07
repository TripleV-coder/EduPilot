/**
 * Service IA — 100 % local.
 *
 * Aucun appel à un modèle de langage externe ni à n8n : les analyses, risques,
 * prévisions, orientations, plans d'action et appréciations sont calculés sur
 * le serveur à partir des données de l'école (governance-service.ts). Le chat
 * passe par l'assistant local (src/lib/ai/assistant/engine.ts).
 */

import { governanceService } from "./governance-service";

export interface GovernanceRequest {
  action: string;
  userId: string;
  userRole: string;
  schoolId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  data?: Record<string, unknown>;
}

export interface OrientationRecommendation {
  series: string;
  /** Adéquation 0-100 calculée localement (absente si la série vient du modèle externe). */
  score?: number;
  justification: string;
  alternatives?: string[];
  synthesis?: string;
}

export interface GovernanceResponse<T = unknown> {
  success: boolean;
  action: string;
  data: T;
  confidence: number;
  executionTime: number;
  recommendations?: string[];
  alerts?: Alert[];
}

export interface Alert {
  id: string;
  type: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  targetRoles: string[];
  actionRequired: boolean;
}

export interface AIServiceStatus {
  operational: true;
  /** Tout est calculé sur le serveur, sans modèle de langage ni service externe. */
  runtimeMode: "local";
}

export class AIServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 400, code: string = "AI_SERVICE_ERROR") {
    super(message);
    this.name = "AIServiceError";
    this.status = status;
    this.code = code;
  }
}

class AIService {
  async executeGovernance<T = unknown>(request: GovernanceRequest): Promise<GovernanceResponse<T>> {
    return governanceService.execute(request, Date.now()) as unknown as Promise<GovernanceResponse<T>>;
  }

  getStatus(): AIServiceStatus {
    return { operational: true, runtimeMode: "local" };
  }
}

export const aiService = new AIService();
