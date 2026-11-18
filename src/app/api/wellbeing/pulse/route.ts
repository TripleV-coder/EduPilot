import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import {
    PULSE_QUESTIONS,
    PulseAlreadyAnsweredError,
    hasAnsweredPulse,
    pulseAnswerSchema,
    pulseWeekOf,
    recordPulseResponse,
} from "@/lib/wellbeing/pulse";

/**
 * Pulse climat de la semaine, côté élève (voir lib/wellbeing/pulse).
 * GET : questions + « déjà répondu ? » ; POST : réponse anonyme, une par semaine.
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const { weekLabel, weekStart } = pulseWeekOf();
        return NextResponse.json({
            weekLabel,
            weekStart: weekStart.toISOString(),
            answered: await hasAnsweredPulse(session.user.id),
            questions: PULSE_QUESTIONS,
        });
    },
    { requireAuth: true, allowedRoles: ["STUDENT"] },
);

export const POST = createApiHandler(
    async (request, { session }) => {
        const answer = pulseAnswerSchema.parse(await request.json());
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Aucun établissement associé à ton compte." }, { status: 400 });
        }
        try {
            const { weekLabel } = await recordPulseResponse(schoolId, session.user.id, answer);
            return NextResponse.json({ success: true, weekLabel }, { status: 201 });
        } catch (error) {
            if (error instanceof PulseAlreadyAnsweredError) {
                return NextResponse.json({ error: error.message }, { status: 409 });
            }
            throw error;
        }
    },
    { requireAuth: true, allowedRoles: ["STUDENT"] },
);
