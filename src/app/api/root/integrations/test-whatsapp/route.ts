import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prismaBase } from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { sendWhatsAppText, whatsAppConfig } from "@/lib/notifications/whatsapp-service";
import { toInternationalDigits } from "@/lib/notifications/phone";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ to: z.string().trim().min(8).max(20) });

/**
 * Console root › Intégrations › WhatsApp : envoie un message d'essai au
 * numéro saisi, avec le modèle par défaut et les réglages en vigueur.
 * « Accepté par Meta » ne prouve pas la remise : le statut (livré, échoué)
 * arrive ensuite par le webhook.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    const to = parsed.success ? toInternationalDigits(parsed.data.to) : null;
    if (!to) return NextResponse.json({ error: "Numéro invalide (ex. 0197000000 ou +229 01 97 00 00 00)." }, { status: 400 });
    if (!whatsAppConfig("CUSTOM").configured) {
        return NextResponse.json(
            { error: "WhatsApp n'est pas configuré : numéro (Phone ID), jeton d'accès et modèle par défaut sont requis." },
            { status: 409 },
        );
    }

    const result = await sendWhatsAppText(to, "Message d'essai EduPilot : l'envoi WhatsApp de la plateforme fonctionne.", "CUSTOM");
    await prismaBase.auditLog.create({
        data: {
            userId: session!.user.id,
            action: "INTEGRATION_WHATSAPP_TEST",
            entity: "system",
            newValues: { accepted: result.success, to: `${to.slice(0, 5)}…${to.slice(-2)}` },
        },
    });
    if (!result.success) {
        return NextResponse.json({ error: `${result.error ?? "Refus de Meta"}. Vérifiez le numéro, le jeton et le nom du modèle approuvé.` }, { status: 502 });
    }
    return NextResponse.json({ accepted: true, messageId: result.messageId ?? null });
}
