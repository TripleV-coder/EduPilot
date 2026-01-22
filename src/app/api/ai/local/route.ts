/**
 * Local AI API Route
 * Production-ready, no API keys, no rate limits
 */

import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/ai-service";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

// Chat schema
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

// Action schema
const actionSchema = z.object({
  action: z.enum([
    "analyze-student",
    "analyze-class",
    "analyze-school",
    "detect-at-risk",
    "predict-grades",
  ]),
  data: z.record(z.string(), z.unknown()).optional(),
});

// Analyze schema
const analyzeSchema = z.object({
  dataType: z.enum(["student", "class", "financial"]),
  data: z.record(z.string(), z.unknown()),
});

// Load model schema
const modelSchema = z.object({
  force: z.boolean().optional(),
});

/**
 * GET /api/ai/local
 * Get AI status and capabilities
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const status = aiService.getStatus();

    return NextResponse.json({
      success: true,
      status: {
        operational: status.operational,
        version: "2.0.0",
        localModel: status.modelLoaded,
        loadTime: status.loadTime,
        features: [
          "chat",
          "analysis",
          "predictions",
          "risk-detection",
          "reports",
        ],
      },
    });
  } catch (error) {
    logger.error("AI status error:", error as Error);
    return NextResponse.json(
      { error: "Failed to get AI status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/local
 * Handle AI requests
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    const query = request.nextUrl.searchParams.get("endpoint");
    let body;

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // Route based on query parameter
    switch (query) {
      case "chat":
        // Handle chat request
        const chatData = chatSchema.parse(body);
        const chatResult = await aiService.processChat({
          message: chatData.message,
          userId: session.user.id,
          userRole: session.user.role || "user",
          schoolId: session.user.schoolId,
        });
        return NextResponse.json(chatResult);

      case "action":
        // Handle action request
        const actionData = actionSchema.parse(body);
        const actionResult = await aiService.executeGovernance({
          action: actionData.action,
          userId: session.user.id,
          userRole: session.user.role || "user",
          schoolId: session.user.schoolId,
          data: actionData.data,
        });
        return NextResponse.json(actionResult);

      case "analyze":
        // Handle analysis request
        const analyzeData_ = analyzeSchema.parse(body);
        return NextResponse.json({
          success: true,
          result: await aiService.executeGovernance({
            action: `analyze-${analyzeData_.dataType}`,
            userId: session.user.id,
            userRole: session.user.role || "user",
            schoolId: session.user.schoolId,
            data: analyzeData_.data,
          }),
        });

      case "model":
        // Handle model loading
        modelSchema.parse(body);
        const status = aiService.getStatus();
        return NextResponse.json({
          success: true,
          loaded: status.modelLoaded,
          loadTime: status.loadTime,
        });

      case "history":
        // Return action history
        return NextResponse.json({
          success: true,
          actions: [],
        });

      default:
        // Default to unified handler
        const result = await aiService.processChat({
          message: body.message || "Hello",
          userId: session.user.id,
          userRole: session.user.role || "user",
          schoolId: session.user.schoolId,
        });
        return NextResponse.json(result);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("AI local API error:", error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
