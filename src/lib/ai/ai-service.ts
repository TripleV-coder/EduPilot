/**
 * AI Service
 *
 * Chat uses a cascading strategy:
 * 1. External AI providers, if configured
 * 2. n8n webhook, if configured
 * 3. Fail with explicit 503 (no local simulation fallback)
 *
 * Governance actions are grounded in real EduPilot data and never return
 * hard-coded analytics payloads.
 */

import { logger } from "@/lib/utils/logger";
import { callExternalAI } from "./external-client";
import { appEnv } from "@/lib/config/env";
import { analyticsService } from "@/lib/analytics/service";
import { governanceService, hasExternalAIConfigured } from "./governance-service";

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

export interface ChatResponse {
  success: boolean;
  response: string;
  metadata?: {
    confidence: number;
    processingTime: number;
    sources?: string[];
    engine?: "n8n" | "external";
  };
}

export interface GovernanceRequest {
  action: string;
  userId: string;
  userRole: string;
  schoolId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  data?: Record<string, any>;
}

export interface GovernanceResponse {
  success: boolean;
  action: string;
  data: any;
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
  runtimeMode: "cloud_only" | "degraded";
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

    logger.info("Initializing AI Service...");
    const startedAt = Date.now();

    try {
      logger.info("Cloud AI runtime enabled (external providers + n8n)");
      this.modelLoaded = true;
      this.modelLoadTime = Date.now() - startedAt;
      this.initialized = true;

      logger.info("AI Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize AI Service:", error as Error);
      throw error;
    }
  }

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    await this.initialize();

    const { response, engine } = await this.generateResponse(request);

    if (request.stream && request.onToken) {
      const tokens = this.chunkResponse(response);
      for (const token of tokens) {
        request.onToken(token);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }

    const confidenceByEngine: Record<"external" | "n8n", number> = {
      external: 0.9,
      n8n: 0.82,
    };

    return {
      success: true,
      response,
      metadata: {
        confidence: confidenceByEngine[engine] ?? 0.8,
        processingTime: Date.now() - startTime,
        sources: ["knowledge_base", "context"],
        engine,
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

  private async generateResponse(
    request: ChatRequest
  ): Promise<{ response: string; engine: "external" | "n8n" }> {
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
          return { response: externalResponse.response, engine: "external" };
        }
      } catch (error) {
        logger.warn("External AI APIs failed, trying n8n fallback", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (process.env.N8N_HOST) {
      try {
        const n8nResponse = await this.callN8n(request);
        if (n8nResponse) {
          return { response: n8nResponse, engine: "n8n" };
        }
      } catch (error) {
        logger.warn("n8n failed, no automatic local fallback in production mode", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    throw new AIServiceError(
      "Aucun moteur IA disponible. Vérifiez la configuration des providers externes ou n8n.",
      503,
      "AI_PROVIDER_UNAVAILABLE"
    );
  }

  private async callN8n(request: ChatRequest): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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

    const n8nResponse = await fetch(`${process.env.N8N_HOST}/webhook/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: request.message,
        userRole: request.userRole,
        userId: request.userId,
        schoolId: request.schoolId,
        context: contextData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!n8nResponse.ok) {
      return null;
    }

    const data = await n8nResponse.json();
    return typeof data.response === "string" ? data.response : null;
  }

  async executeGovernance(request: GovernanceRequest): Promise<GovernanceResponse> {
    await this.initialize();
    return governanceService.execute(request, Date.now());
  }

  getStatus(): AIServiceStatus {
    const cloudReady = hasExternalAIConfigured() || Boolean(process.env.N8N_HOST);
    return {
      operational: this.initialized,
      modelLoaded: this.modelLoaded,
      loadTime: this.modelLoadTime,
      externalConfigured: hasExternalAIConfigured(),
      n8nConfigured: Boolean(process.env.N8N_HOST),
      runtimeMode: cloudReady ? "cloud_only" : "degraded",
    };
  }
}

export const aiService = new AIService();
