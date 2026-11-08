import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { checkRateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security/client-ip";
import { recordError } from "@/lib/monitoring/error-journal";

/**
 * POST /api/monitoring/client-error — erreur affichée dans le navigateur
 * (écran « Une erreur inattendue est survenue »), inscrite au journal des
 * erreurs (remplace Sentry côté client, 2026-11-08).
 *
 * Sans session exigée : une erreur peut survenir avant la connexion. Abus
 * bornés : 10 rapports par minute et par adresse IP, et quota global du
 * journal (60 par minute et par processus). Toujours 202 : le navigateur
 * n'attend rien et ne réessaie pas.
 */
const CLIENT_ERROR_LIMIT = { maxAttempts: 10, windowMs: 60_000 };

const reportSchema = z.object({
    message: z.string().trim().min(1).max(500),
    stack: z.string().max(4000).optional(),
    digest: z.string().max(100).optional(),
    path: z.string().max(300).optional(),
});

export const POST = createApiHandler(
    async (request, context) => {
        const accepted = NextResponse.json({ ok: true }, { status: 202 });
        const ip = getClientIp(request.headers);
        if (!(await checkRateLimitKey(`rl:client-error:${ip}`, CLIENT_ERROR_LIMIT)).success) return accepted;

        const parsed = reportSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return accepted;

        await recordError({
            source: "client",
            message: parsed.data.message,
            stack: parsed.data.stack,
            digest: parsed.data.digest,
            path: parsed.data.path,
            userId: context.session?.user?.id ?? null,
        });
        return accepted;
    },
    { requireAuth: false },
);
