import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prismaBase } from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import {
    IntegrationEncryptionUnavailableError,
    IntegrationSettingError,
    integrationSettingsView,
    saveIntegrationSettings,
    type IntegrationSettingName,
} from "@/lib/system/integration-settings";

export const dynamic = "force-dynamic";

/**
 * Console root › Intégrations : réglages SMS, appels vocaux et WhatsApp de la
 * plateforme, sans fichier .env ni redéploiement (2026-11-08).
 *
 * GET : valeurs non secrètes, secrets masqués (4 derniers caractères),
 *       origine (variable d'environnement prioritaire, console, absent).
 * PUT : { values: { NOM: "valeur" | "" } } — chaîne vide = effacement ; un
 *       nom absent n'est pas modifié. Action tracée (noms, jamais les valeurs).
 */
export async function GET() {
    const session = await auth();
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;
    return NextResponse.json({ settings: integrationSettingsView() });
}

// Clés libres ici (zod 4 : un record à clés énumérées les exige toutes) ;
// les noms inconnus sont refusés par saveIntegrationSettings (400).
const bodySchema = z.object({
    values: z.record(z.string(), z.string().max(2000).nullable()),
});

export async function PUT(request: NextRequest) {
    const session = await auth();
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "Réglages invalides." }, { status: 400 });
    }
    const userId = session!.user.id;
    try {
        await saveIntegrationSettings(parsed.data.values as Partial<Record<IntegrationSettingName, string | null>>, userId);
    } catch (error) {
        if (error instanceof IntegrationSettingError) return NextResponse.json({ error: error.message }, { status: 400 });
        if (error instanceof IntegrationEncryptionUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
        throw error;
    }
    await prismaBase.auditLog.create({
        data: {
            userId,
            action: "INTEGRATION_SETTINGS_UPDATED",
            entity: "system",
            newValues: { changed: Object.keys(parsed.data.values) },
        },
    });
    return NextResponse.json({ settings: integrationSettingsView() });
}
