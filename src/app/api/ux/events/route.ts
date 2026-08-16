import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { checkRateLimit, API_RATE_LIMIT } from "@/lib/auth/rate-limiter";
import { createApiHandler } from "@/lib/api/api-helpers";

const uxEventSchema = z.object({
  event: z.string().min(1).max(120),
  pathname: z.string().min(1).max(200).optional(),
  timestamp: z.string().optional(),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

/**
 * POST /api/ux/events
 *
 * Télémétrie UX (src/lib/ux/telemetry.ts, sendBeacon best-effort).
 * Persistée dans TelemetryEvent ; le userId est attaché si une session
 * existe, sinon l'événement reste anonyme.
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rl = await checkRateLimit(`rl:ux-events:${ip}`, API_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = uxEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
    }

    // sendBeacon n'envoie pas toujours les cookies de session : auth best-effort
    await prisma.telemetryEvent.create({
      data: {
        event: parsed.data.event,
        pathname: parsed.data.pathname ?? null,
        userId: session?.user?.id ?? null,
        payload: (parsed.data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json({ ok: true });
  
    } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Malformed telemetry request" }, { status: 400 });
    }
    logger.warn("UX telemetry ingestion failed", {
      module: "api/ux/events",
      error: error instanceof Error ? error.message : String(error),
    });
    // Best-effort : le client n'attend pas de garantie de livraison
    return NextResponse.json({ ok: false }, { status: 202 });
  }

}, { requireAuth: false });
