import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { whatsAppConfig } from "@/lib/notifications/whatsapp-service";

/**
 * GET /api/integrations/whatsapp — statut de l'intégration WhatsApp Business.
 *
 * Variables requises pour une connexion active :
 *   WHATSAPP_PHONE_ID      — Phone Number ID Meta Cloud API
 *   WHATSAPP_ACCESS_TOKEN  — Bearer token (jamais exposé côté client)
 *   WHATSAPP_VERIFY_TOKEN  — Jeton de vérification webhook
 */
export const GET = createApiHandler(
    async (_request, { session }) => {
        // Envoi réel : numéro, jeton ET modèle de message approuvé par Meta
        const cfg = whatsAppConfig();
        const phoneId = cfg.phoneId;
        const connected = cfg.configured;

        const schoolId = getActiveSchoolId(session);

        let phoneNumber: string | null = null;
        let verifiedAt: string | null = null;
        let subscribers: number | null = null;
        let weeklyMessages: number | null = null;

        if (schoolId && connected) {
            // Read per-school overrides stored in ConfigOption (category="whatsapp")
            // code="phone_number" → label contains the display phone number
            // code="verified_at"  → label contains the ISO date string
            const configs = await prisma.configOption.findMany({
                where: { schoolId, category: "whatsapp" },
                select: { code: true, label: true },
            });
            const cfg = Object.fromEntries(configs.map((c) => [c.code, c.label]));
            phoneNumber = cfg["phone_number"] ?? null;
            verifiedAt = cfg["verified_at"] ?? null;
            subscribers = await prisma.user.count({
                where: { schoolId, role: "PARENT", isActive: true },
            });
            // Messages réellement partis cette semaine (journal des envois)
            weeklyMessages = await prisma.communicationLog.count({
                where: { schoolId, channel: "WHATSAPP", status: "SENT", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            });
        }

        return NextResponse.json({
            connected,
            phoneNumber: connected ? (phoneNumber ?? phoneId ?? null) : null,
            verifiedAt,
            subscribers: connected ? subscribers : null,
            // Taux de lecture et coût : aucune source (pas de webhook de statut
            // Meta branché) — null assumé, aucune valeur inventée.
            weeklyMessages,
            readRate: null,
            costPerMessage: null,
        });
    },
    // Configuration et nombre d'abonnés : direction seulement (la route était
    // ouverte à tout compte connecté, parents et élèves compris).
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }
);
