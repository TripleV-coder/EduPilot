/**
 * AI Governance API v2
 * Executes governance actions on real platform data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AIServiceError, aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/utils/logger';
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";

// Available governance actions
const ACTIONS = [
  'analyze-student',
  'analyze-class',
  'analyze-school',
  'detect-at-risk',
  'predict-grades',
];

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Rate limiting (AI is considered sensitive)
    const identifier = `${session.user.id}:${getClientIdentifier(request)}`;
    const rl = await checkRateLimit(strictLimiter, `ai:gov:${identifier}`);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter.", code: "RATE_LIMITED", retryAfter },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'Action invalide ou non spécifiée' },
        { status: 400 }
      );
    }

    logger.info(`Governance action ${action} requested by ${session.user.id}`);

    // Execute governance action
    const result = await aiService.executeGovernance({
      action,
      userId: session.user.id,
      userRole: session.user.role || 'user',
      schoolId: session.user.schoolId,
      classId: data?.classId,
      data,
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof AIServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    logger.error('Governance API error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'status';

    if (endpoint === 'actions') {
      // List available actions
      return NextResponse.json({
        success: true,
        actions: ACTIONS.map(action => ({
          id: action,
          description: getActionDescription(action),
        })),
      });
    }

    if (endpoint === 'alerts') {
      // Get alerts
      const result = await aiService.executeGovernance({
        action: 'detect-at-risk',
        userId: session.user.id,
        userRole: session.user.role || 'user',
        schoolId: session.user.schoolId,
      });

      return NextResponse.json({
        success: true,
        alerts: result.alerts || [],
      });
    }

    // Default status
    const status = aiService.getStatus();
    return NextResponse.json({
      success: true,
      status: {
        operational: status.operational,
        version: '2.0.0',
        capabilities: ACTIONS,
        providers: {
          externalConfigured: status.externalConfigured,
          n8nConfigured: status.n8nConfigured,
          runtimeMode: status.runtimeMode,
        },
      },
    });

  } catch (error) {
    if (error instanceof AIServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    logger.error('Governance GET error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'analyze-student': 'Analyser le profil et les performances d\'un élève',
    'analyze-class': 'Analyser les performances d\'une classe',
    'analyze-school': 'Analyser les performances globales de l\'école',
    'detect-at-risk': 'Détecter tous les élèves à risque',
    'predict-grades': 'Prédire les prochaines notes d\'un élève',
  };
  return descriptions[action] || action;
}
