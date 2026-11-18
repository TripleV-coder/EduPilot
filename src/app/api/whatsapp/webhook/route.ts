import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getIntegrationSetting } from "@/lib/system/integration-settings";
import { resolveSecret } from "@/lib/security/derived-secrets";
import { markFailedAndFallback } from "@/lib/notifications/family-channel";
import { verifyMetaSignature } from "@/lib/notifications/whatsapp-service";

export const dynamic = "force-dynamic";

/**
 * Statuts des messages WhatsApp envoyés par EduPilot (Meta Cloud API).
 *
 * GET  : validation de l'adresse par Meta (hub.mode=subscribe,
 *        hub.verify_token = jeton affiché dans la console root, dérivé du
 *        secret maître) → renvoie hub.challenge.
 * POST : événements signés (X-Hub-Signature-256 = HMAC-SHA256 du corps brut
 *        avec la clé secrète de l'application Meta, WHATSAPP_APP_SECRET).
 *        Sans cette clé, rien n'est accepté (503) : un statut non signé
 *        pourrait déclencher des SMS facturés.
 *
 * sent → SENT, delivered → DELIVERED, read → READ (jamais de recul) ;
 * failed → FAILED + SMS de secours si permis, une seule fois (TD-027).
 * Les messages entrants des familles sont acquittés sans traitement.
 */
const RANK: Record<string, number> = { QUEUED: 0, RETRYING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
const META_STATUS: Record<string, "SENT" | "DELIVERED" | "READ"> = { sent: "SENT", delivered: "DELIVERED", read: "READ" };

type MetaStatus = { id?: string; status?: string; errors?: { code?: number; title?: string }[] };

export const GET = createApiHandler(async (request) => {
    const url = new URL(request.url);
    const token = resolveSecret("whatsapp-verify");
    if (
        token &&
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === token
    ) {
        return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return NextResponse.json({ error: "Jeton de vérification invalide" }, { status: 403 });
}, { requireAuth: false });

export const POST = createApiHandler(async (request) => {
    const appSecret = getIntegrationSetting("WHATSAPP_APP_SECRET");
    if (!appSecret) {
        logger.warn("Webhook WhatsApp reçu sans clé secrète d'application configurée", { module: "whatsapp-webhook" });
        return NextResponse.json({ error: "Intégration indisponible" }, { status: 503 });
    }
    const rawBody = await request.text();
    if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    let body: { entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[] };
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
    }
    const statuses = (body.entry ?? []).flatMap((entry) => (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []));
    if (statuses.length === 0) return NextResponse.json({ received: true, updated: 0, fallbacks: 0 });

    // Meta n'a pas de session : lecture et écritures en contexte système déclaré
    return runAsSystem("webhook:whatsapp", async () => {
        const ids = [...new Set(statuses.map((status) => status.id).filter((id): id is string => typeof id === "string" && id.length <= 128))];
        const logs = await prisma.communicationLog.findMany({
            where: { externalId: { in: ids }, channel: "WHATSAPP" },
            select: { id: true, externalId: true, status: true },
        });
        const byExternal = new Map(logs.map((log) => [log.externalId, log]));
        let updated = 0;
        let fallbacks = 0;
        for (const event of statuses) {
            const log = event.id ? byExternal.get(event.id) : undefined;
            if (!log || log.status === "FAILED") continue;
            if (event.status === "failed") {
                const error = event.errors?.[0];
                const reason = `WhatsApp : ${error?.title ?? "échec de remise"}${error?.code ? ` (code ${error.code})` : ""}`;
                if (await markFailedAndFallback(log.id, reason)) fallbacks += 1;
                log.status = "FAILED";
                updated += 1;
                continue;
            }
            const next = event.status ? META_STATUS[event.status] : undefined;
            if (!next || (RANK[log.status] ?? 0) >= RANK[next]) continue;
            await prisma.communicationLog.update({ where: { id: log.id }, data: { status: next } });
            log.status = next;
            updated += 1;
        }
        return NextResponse.json({ received: true, updated, fallbacks });
    });
}, { requireAuth: false });
