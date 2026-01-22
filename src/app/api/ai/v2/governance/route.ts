/**
 * AI Governance API v2 - Production Ready
 * Executes AI governance actions across the application
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/utils/logger';

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 20;

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

    // Rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez patienter.' },
        { status: 429 }
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
      },
    });

  } catch (error) {
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
