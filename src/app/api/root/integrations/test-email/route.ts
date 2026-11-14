import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaBase } from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { resolveEmailProvider, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Console root › Intégrations › E-mail : envoie un e-mail d'essai à l'adresse
 * du super-administrateur connecté, avec les réglages en vigueur. Seule preuve
 * fiable qu'une réinitialisation de mot de passe partira réellement.
 */
export async function POST() {
    const session = await auth();
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    const to = session!.user.email;
    if (!to) return NextResponse.json({ error: "Votre compte n'a pas d'adresse e-mail." }, { status: 400 });
    const provider = resolveEmailProvider();
    if (!provider) {
        return NextResponse.json({ error: "Aucun service e-mail configuré : renseignez une clé d'API ou un serveur SMTP." }, { status: 409 });
    }

    const sent = await sendEmail({
        to,
        subject: "EduPilot — e-mail d'essai",
        html: "<p>Cet e-mail d'essai confirme que l'envoi d'e-mails de la plateforme fonctionne.</p>",
        text: "Cet e-mail d'essai confirme que l'envoi d'e-mails de la plateforme fonctionne.",
    });

    await prismaBase.auditLog.create({
        data: { userId: session!.user.id, action: "INTEGRATION_EMAIL_TEST", entity: "system", newValues: { provider, sent } },
    });

    if (!sent) {
        return NextResponse.json(
            { error: "Le fournisseur a refusé l'envoi ou ne répond pas. Vérifiez la clé, le serveur SMTP et l'adresse d'expédition (détail dans le journal des erreurs)." },
            { status: 502 },
        );
    }
    return NextResponse.json({ sent: true, to, provider });
}
