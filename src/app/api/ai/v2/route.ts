/**
 * AI Unified API v2 - Production Ready
 * Central API for all AI operations
 * Uses local AI service for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/utils/logger';

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 50;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(userId);

  if (!limit || limit.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Trop de requêtes', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { endpoint = 'chat' } = body;

    logger.info(`AI API v2 - ${endpoint} request from ${session.user.id}`);

    // Route to appropriate handler
    switch (endpoint) {
      case 'chat':
        return handleChat(session, body);
      case 'governance':
        return handleGovernance(session, body);
      default:
        return NextResponse.json(
          { error: 'Point de terminaison non reconnu', code: 'INVALID_ENDPOINT' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('AI API v2 error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

async function handleChat(session: any, body: any) {
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
    schoolId: session.user.schoolId,
    stream,
    options: {
      maxLength: options.maxLength || 1024,
      temperature: options.temperature || 0.7,
      useKnowledgeBase: options.useKnowledgeBase !== false,
      useContext: options.useContext !== false,
      language: options.language || 'fr',
    },
  });

  return NextResponse.json(result);
}

async function handleGovernance(session: any, body: any) {
  const { action, data } = body;

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
    schoolId: session.user.schoolId,
    classId: data?.classId,
    data,
  });

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

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
          },
        });

      case 'alerts':
        // Get alerts from governance
        const governanceResult = await aiService.executeGovernance({
          action: 'detect-at-risk',
          userId: session.user.id,
          userRole: session.user.role || 'user',
          schoolId: session.user.schoolId,
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
    logger.error('AI API v2 GET error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
