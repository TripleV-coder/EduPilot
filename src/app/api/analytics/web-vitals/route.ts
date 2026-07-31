import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { checkRateLimit, API_RATE_LIMIT } from "@/lib/auth/rate-limiter";

/**
 * POST /api/analytics/web-vitals
 *
 * Réception des Core Web Vitals émis par src/lib/performance/web-vitals.ts
 * (sendBeacon/fetch keepalive, y compris avant login : pas d'auth requise).
 * Les mesures alimentent le modèle PerformanceMetric, agrégé par
 * /api/performance/dashboard.
 */
const webVitalSchema = z.object({
  name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB", "FID"]),
  value: z.number().finite().min(0),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  id: z.string().max(120).optional(),
  navigationType: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    // Endpoint anonyme : rate limit IP pour éviter le flood
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rl = await checkRateLimit(`rl:web-vitals:${ip}`, API_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = webVitalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Métrique invalide" }, { status: 400 });
    }

    const pathname = request.headers.get("referer")
      ? (() => {
          try {
            return new URL(request.headers.get("referer")!).pathname.slice(0, 200);
          } catch {
            return null;
          }
        })()
      : null;

    await prisma.performanceMetric.create({
      data: {
        metric: parsed.data.name,
        value: parsed.data.value,
        rating: parsed.data.rating ?? null,
        pathname,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.warn("Web vitals ingestion failed", {
      module: "api/analytics/web-vitals",
      error: error instanceof Error ? error.message : String(error),
    });
    // Télémétrie best-effort : ne jamais faire échouer le client
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
