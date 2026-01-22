/**
 * AI Chat API v2 - Public Access
 * Handles chat requests with streaming support for all users (authenticated or not)
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/utils/logger';

// Rate limiting - IP based for public access
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_REQUESTS_PER_DAY = 100;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;


  const limit = rateLimits.get(ip);

  if (!limit || limit.resetAt < now) {
    // Reset counters every hour
    rateLimits.set(ip, { count: 1, resetAt: now + hourInMs });
    return true;
  }

  // Check daily limit
  if (limit.count >= MAX_REQUESTS_PER_DAY) {
    return false;
  }

  // Check per-minute limit (burst protection)
  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const ipClean = ip.split(',')[0].trim();

    // Rate limiting
    if (!checkRateLimit(ipClean)) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez patienter quelques instants.' },
        { status: 429 }
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
              userId: `public_${ipClean}`,
              userRole: 'PUBLIC',
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
      userId: `public_${ipClean}`,
      userRole: 'PUBLIC',
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
}

// Get service status (public endpoint)
export async function GET(_request: NextRequest) {
  try {
    const status = aiService.getStatus();

    return NextResponse.json({
      success: true,
      status: {
        operational: status.operational,
        version: '2.0.0',
        model: status.modelLoaded,
        uptime: status.loadTime,
      },
    });

  } catch (error) {
    logger.error('Chat status error:', error as Error);

    return NextResponse.json(
      { error: 'Erreur lors de la vérification du service' },
      { status: 500 }
    );
  }
}
