/**
 * POST /api/ai/v2/chat — Assistant EduPilot, 100 % local.
 *
 * Aucune donnée ne quitte le serveur : pas de modèle de langage externe, pas
 * de n8n. La réponse est calculée sur les données réelles du périmètre de la
 * personne connectée (voir src/lib/ai/assistant/engine.ts) et renvoyée en une
 * fois : elle est prête en quelques dizaines de millisecondes, un flux
 * simulé n'apporterait rien.
 *
 * Corps : { message, context? } — `context` est celui renvoyé par la réponse
 * précédente ; ses identifiants sont revérifiés contre le périmètre.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/ai/assistant/engine";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { checkRateLimit, getClientIdentifier, strictLimiter } from "@/lib/rate-limit";

const INTENT_IDS = [
    "greeting", "help", "thanks", "ack", "repeat", "more", "student.summary", "student.why", "risk.list", "student.overview", "student.forecast", "student.orientation",
    "student.action-plan", "student.comment", "student.grades", "class.overview", "school.overview",
    "attendance.summary", "schedule.day", "homework.upcoming", "finance.balance", "navigate",
] as const;

const bodySchema = z.object({
    message: z.string().trim().min(1, "Veuillez saisir un message").max(500, "Message trop long (500 caractères au plus)"),
    context: z
        .object({
            intent: z.enum(INTENT_IDS).optional(),
            studentId: z.string().max(64).optional(),
            classId: z.string().max(64).optional(),
            subjectId: z.string().max(64).optional(),
        })
        .optional(),
});

export const POST = createApiHandler(async (request, { session }) => {
    const rl = await checkRateLimit(strictLimiter, `ai:chat:${session.user.id}:${getClientIdentifier(request)}`);
    if (!rl.success) {
        const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000);
        return NextResponse.json(
            { error: "Trop de questions d'affilée. Patientez quelques instants.", code: "RATE_LIMITED", retryAfter },
            { status: 429, headers: { "Retry-After": retryAfter.toString() } },
        );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
    }

    const answer = await answerQuestion(
        parsed.data.message,
        {
            id: session.user.id,
            role: session.user.role,
            schoolId: getActiveSchoolId(session) ?? null,
            firstName: session.user.name?.split(" ")[0] ?? null,
        },
        parsed.data.context,
    );
    return NextResponse.json(answer);
});
