import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatWithAI } from "@/lib/ai/n8n-client";
import { logger } from "@/lib/utils/logger";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

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
        const context = {
            userId: session.user.id,
            schoolId: session.user.schoolId,
            role: session.user.role,
            history: history || []
        };

        const result = await chatWithAI(message, context);
        return NextResponse.json(result);

    } catch (error) {
        logger.error("Error in Chatbot API:", error as Error);
        return NextResponse.json({ error: "Erreur lors de la communication avec l'assistant" }, { status: 500 });
    }
}
