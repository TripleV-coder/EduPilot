import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

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
        const phoneId = process.env.WHATSAPP_PHONE_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const connected = Boolean(phoneId && accessToken);

        const schoolId = getActiveSchoolId(session);

        let phoneNumber: string | null = null;
        let verifiedAt: string | null = null;
        let subscribers: number | null = null;

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
        }

        return NextResponse.json({
            connected,
            phoneNumber: connected ? (phoneNumber ?? phoneId ?? null) : null,
            verifiedAt,
            subscribers: connected ? subscribers : null,
            // Métriques d'usage : null tant que l'envoi réel (webhook Meta) n'est
            // pas branché — aucune valeur inventée (cf. règle zéro fake).
            weeklyMessages: null,
            readRate: null,
            costPerMessage: null,
        });
    },
    { requireAuth: true }
);
