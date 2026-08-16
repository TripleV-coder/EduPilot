/**
 * AI Chat API v2 - Authenticated Access
 * Handles chat requests with streaming support for authenticated users only
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { checkN8nHealth } from '@/lib/ai/n8n-client';
import { logger } from '@/lib/utils/logger';
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    // Rate limiting harmonisé (même logique que strictLimiter / autres routes sensibles)
    const ipClean = getClientIdentifier(request);
    const rl = await checkRateLimit(strictLimiter, `ai:chat:${session.user.id}:${ipClean}`);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez patienter quelques instants.', code: 'RATE_LIMITED', retryAfter },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      );
    }

    const body = await request.json();
    const { message, stream = false, options = {} } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Veuillez saisir un message' },
        { status: 400 }
      );
    }


    // const isTechnicalQuery = technicalPatterns.some(pattern => lowerMessage.includes(pattern));

    logger.info(`Chat request from IP ${ipClean}: ${message.slice(0, 50)}...`);

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder();

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send initial connection message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

            // Process chat and stream the response
            const result = await aiService.processChat({
              message: message.trim(),
              userId: session.user.id,
              userRole: session.user.role,
              schoolId: getActiveSchoolId(session),
              stream: true,
              options: {
                maxLength: options.maxLength || 1024,
                temperature: options.temperature || 0.7,
                useKnowledgeBase: options.useKnowledgeBase !== false,
                useContext: options.useContext !== false,
                language: options.language || 'fr',
              },
              onToken: (token: string) => {
                try {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`));
                } catch (_e) {
                  // Stream closed by client
                }
              },
            });

            // Send completion message with full content
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: result.response })}\n\n`));
            controller.close();
          } catch (error) {
            logger.error('Streaming error:', error as Error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Une erreur est survenue. Veuillez réessayer.' })}\n\n`));
            controller.error(error);
          }
        },
      });

      return new NextResponse(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response
    const result = await aiService.processChat({
      message: message.trim(),
      userId: session.user.id,
      userRole: session.user.role,
      schoolId: getActiveSchoolId(session),
      stream: false,
      options: {
        maxLength: options.maxLength || 1024,
        temperature: options.temperature || 0.7,
        useKnowledgeBase: options.useKnowledgeBase !== false,
        useContext: options.useContext !== false,
        language: options.language || 'fr',
      },
    });

    return NextResponse.json({
      success: true,
      response: result.response,
      metadata: {
        confidence: result.metadata?.confidence || 0.85,
        processingTime: result.metadata?.processingTime || 100,
      },
    });

  
    } catch (error) {
    logger.error('Chat API error:', error as Error);

    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer plus tard.' },
      { status: 500 }
    );
  }

});

// Get service status (authenticated endpoint)
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const status = aiService.getStatus();
    const n8nHealth = await checkN8nHealth();

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
          n8nReachable: n8nHealth.reachable,
          n8nLatencyMs: n8nHealth.latencyMs,
          runtimeMode: status.runtimeMode,
        },
      },
    });

  
    } catch (error) {
    logger.error('Chat status error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur lors de la vérification du service' },
      { status: 500 }
    );
  }

});
