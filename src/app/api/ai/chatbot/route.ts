import { NextRequest, NextResponse } from "next/server";
import { chatWithAI } from "@/lib/ai/n8n-client";
import { logger } from "@/lib/utils/logger";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const identifier = `${session.user.id}:${getClientIdentifier(request)}`;
        const rl = await checkRateLimit(strictLimiter, `ai:chatbot:${identifier}`);
        if (!rl.success) {
            const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
            return NextResponse.json(
                { error: "Trop de requêtes", code: "RATE_LIMITED", retryAfter },
                { status: 429, headers: { "Retry-After": retryAfter.toString() } }
            );
        }

        const body = await request.json();
        const { message, history } = body;

        if (!message) {
            return NextResponse.json({ error: "Message requis" }, { status: 400 });
        }

        // Context for AI
        const aiContext = {
            userId: session.user.id,
            schoolId: getActiveSchoolId(session),
            role: session.user.role,
            history: history || []
        };

        const result = await chatWithAI(message, aiContext);
        return NextResponse.json(result);

    
    } catch (error) {
        logger.error("Error in Chatbot API:", error as Error);
        return NextResponse.json({ error: "Erreur lors de la communication avec l'assistant" }, { status: 500 });
    }

});
