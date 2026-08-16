/**
 * AI Service — Routeur 3 couches
 *
 * 1. Déterministe / gabarits (gratuit, illimité, toujours disponible)
 * 2. Cloud best-effort (Groq, Google, OpenAI, Anthropic, n8n) si configuré
 * 3. Bascule automatique sur gabarits — jamais de 503 bloquant
 */

import { logger } from "@/lib/utils/logger";
import { callExternalAI } from "./external-client";
import { analyticsService } from "@/lib/analytics/service";
import { governanceService, hasExternalAIConfigured } from "./governance-service";
import { chatWithAI } from "./n8n-client";
import { generateChatFallback } from "./templates";

export interface ChatRequest {
  message: string;
  userId: string;
  userRole: string;
  schoolId?: string | null;
  studentId?: string | null;
  stream?: boolean;
  onToken?: (token: string) => void;
  options?: {
    maxLength?: number;
    temperature?: number;
    useKnowledgeBase?: boolean;
    useContext?: boolean;
    language?: "fr" | "en";
  };
}

export type AIEngine = "template" | "external" | "n8n";

export interface ChatResponse {
  success: boolean;
  response: string;
  metadata?: {
    confidence: number;
    processingTime: number;
    sources?: string[];
    engine?: AIEngine;
    layer?: 1 | 2 | 3;
  };
}

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
  justification: string;
  alternatives?: string[];
  synthesis?: string;
  engine?: "external" | "template";
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
  operational: boolean;
  modelLoaded: boolean;
  loadTime: number;
  externalConfigured: boolean;
  n8nConfigured: boolean;
  templatesAvailable: boolean;
  runtimeMode: "autonomous" | "cloud_enhanced";
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
  private initialized = false;
  private modelLoaded = false;
  private modelLoadTime = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info("Initializing AI Service (3-layer router)...");
    const startedAt = Date.now();

    this.modelLoaded = true;
    this.modelLoadTime = Date.now() - startedAt;
    this.initialized = true;

    logger.info("AI Service initialized — templates + predictive always available");
  }

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    await this.initialize();

    const { response, engine, layer } = await this.generateResponse(request);

    if (request.stream && request.onToken) {
      const tokens = this.chunkResponse(response);
      for (const token of tokens) {
        request.onToken(token);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }

    const confidenceByEngine: Record<AIEngine, number> = {
      external: 0.9,
      n8n: 0.82,
      template: 0.72,
    };

    return {
      success: true,
      response,
      metadata: {
        confidence: confidenceByEngine[engine],
        processingTime: Date.now() - startTime,
        sources: engine === "template" ? ["templates", "knowledge_base"] : ["knowledge_base", "context"],
        engine,
        layer,
      },
    };
  }

  private chunkResponse(text: string): string[] {
    const tokens: string[] = [];
    const paragraphs = text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (paragraph.length > 50) {
        const words = paragraph.split(/(?=[\s])/);
        let currentChunk = "";

        for (const word of words) {
          if (currentChunk.length + word.length > 30) {
            if (currentChunk) tokens.push(currentChunk);
            currentChunk = word;
          } else {
            currentChunk += word;
          }
        }

        if (currentChunk) tokens.push(currentChunk);
      } else {
        tokens.push(paragraph);
      }
    }

    return tokens.length > 0 ? tokens : [text];
  }

  /**
   * Couche 3 (cloud) en best-effort, puis couche 2 (gabarits) en secours garanti.
   */
  private async generateResponse(
    request: ChatRequest
  ): Promise<{ response: string; engine: AIEngine; layer: 2 | 3 }> {
    const { message, userRole, options = {} } = request;

    if (hasExternalAIConfigured()) {
      try {
        const externalResponse = await callExternalAI({
          message,
          role: userRole,
          language: options.language,
          maxTokens: options.maxLength,
          temperature: options.temperature,
        });

        if (externalResponse.success && externalResponse.response) {
          return { response: externalResponse.response, engine: "external", layer: 3 };
        }
      } catch (error) {
        logger.warn("External AI failed, falling back to templates", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (process.env.N8N_HOST) {
      try {
        const n8nResponse = await this.callN8n(request);
        if (n8nResponse) {
          return { response: n8nResponse, engine: "n8n", layer: 3 };
        }
      } catch (error) {
        logger.warn("n8n failed, falling back to templates", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Couche 2 — gabarits : toujours disponible, jamais de 503
    return {
      response: generateChatFallback(message, userRole),
      engine: "template",
      layer: 2,
    };
  }

  private async callN8n(request: ChatRequest): Promise<string | null> {
    let contextData = {};
    if (request.schoolId) {
      try {
        contextData = await analyticsService.getSchoolStats(request.schoolId);
      } catch (err) {
        logger.warn("Failed to load context for AI", {
          module: "ai-service",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const data = await chatWithAI(request.message, {
      userRole: request.userRole,
      userId: request.userId,
      schoolId: request.schoolId,
      context: contextData,
    });

    return typeof data.response === "string" ? data.response : null;
  }

  async executeGovernance<T = unknown>(request: GovernanceRequest): Promise<GovernanceResponse<T>> {
    await this.initialize();
    return governanceService.execute(request, Date.now()) as unknown as Promise<GovernanceResponse<T>>;
  }

  getStatus(): AIServiceStatus {
    const cloudReady = hasExternalAIConfigured() || Boolean(process.env.N8N_HOST);
    return {
      operational: true,
      modelLoaded: this.modelLoaded,
      loadTime: this.modelLoadTime,
      externalConfigured: hasExternalAIConfigured(),
      n8nConfigured: Boolean(process.env.N8N_HOST),
      templatesAvailable: true,
      runtimeMode: cloudReady ? "cloud_enhanced" : "autonomous",
    };
  }
}

export const aiService = new AIService();
