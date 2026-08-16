import { Session } from "next-auth";
/**
 * AI Unified API v2
 * Central API for chat and governance actions with explicit engine status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIServiceError, aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/utils/logger';
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
    // Authentication

    // Rate limiting (AI is considered sensitive)
    const identifier = `${session.user.id}:${getClientIdentifier(request)}`;
    const rl = await checkRateLimit(strictLimiter, `ai:v2:${identifier}`);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Trop de requêtes", code: "RATE_LIMITED", retryAfter },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      );
    }

    const body = await request.json();
    const { endpoint = 'chat' } = body;

    logger.info(`AI API v2 - ${endpoint} request from ${session.user.id}`);

    // Route to appropriate handler
    switch (endpoint) {
      case 'chat':
        return handleChat(session as Session, body);
      case 'governance':
        return handleGovernance(session as Session, body);
      default:
        return NextResponse.json(
          { error: 'Point de terminaison non reconnu', code: 'INVALID_ENDPOINT' },
          { status: 400 }
        );
    }

  
    } catch (error) {
    if (error instanceof AIServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    logger.error('AI API v2 error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }

});

interface ChatRequestBody {
  message: string;
  stream?: boolean;
  options?: {
    maxLength?: number;
    temperature?: number;
    useKnowledgeBase?: boolean;
    useContext?: boolean;
    language?: string;
  };
}

interface GovernanceRequestBody {
  action: string;
  studentId?: string;
  data?: Record<string, unknown>;
}

async function handleChat(session: Session, body: ChatRequestBody) {
  const { message, stream = false, options = {} } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'Message requis', code: 'MISSING_MESSAGE' },
      { status: 400 }
    );
  }

  const result = await aiService.processChat({
    message,
    userId: session.user.id,
    userRole: session.user.role || 'user',
    schoolId: getActiveSchoolId(session),
    stream,
    options: {
      maxLength: options.maxLength || 1024,
      temperature: options.temperature || 0.7,
      useKnowledgeBase: options.useKnowledgeBase !== false,
      useContext: options.useContext !== false,
      language: (options.language as "fr" | "en") || 'fr',
    },
  });

  return NextResponse.json(result);
}

async function handleGovernance(session: Session, body: GovernanceRequestBody) {
  const { action, data, studentId } = body;

  if (!action) {
    return NextResponse.json(
      { error: 'Action requise', code: 'MISSING_ACTION' },
      { status: 400 }
    );
  }

  const result = await aiService.executeGovernance({
    action,
    userId: session.user.id,
    userRole: session.user.role || 'user',
    schoolId: getActiveSchoolId(session),
    studentId: studentId ?? (typeof data?.studentId === "string" ? data.studentId : undefined),
    classId: typeof data?.classId === "string" ? data.classId : undefined,
    data,
  });

  return NextResponse.json(result);
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'status';

    switch (endpoint) {
      case 'status':
        // System status
        const status = aiService.getStatus();

        return NextResponse.json({
          success: true,
          status: {
            operational: status.operational,
            version: '2.0.0',
            model: {
              loaded: status.modelLoaded,
              loadTime: status.loadTime,
            },
            providers: {
              externalConfigured: status.externalConfigured,
              n8nConfigured: status.n8nConfigured,
              runtimeMode: status.runtimeMode,
            },
          },
        });

      case 'alerts':
        // Get alerts from governance
        const governanceResult = await aiService.executeGovernance({
          action: 'detect-at-risk',
          userId: session.user.id,
          userRole: session.user.role || 'user',
          schoolId: getActiveSchoolId(session),
        });

        return NextResponse.json({
          success: true,
          alerts: governanceResult.alerts || [],
        });

      default:
        return NextResponse.json(
          { error: 'Point de terminaison non reconnu', code: 'INVALID_ENDPOINT' },
          { status: 400 }
        );
    }

  
    } catch (error) {
    if (error instanceof AIServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    logger.error('AI API v2 GET error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }

});
