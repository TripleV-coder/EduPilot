import { prismaBase } from "@/lib/prisma";

/**
 * Adresse de contact de la plateforme (pages légales /privacy et /terms) —
 * remplace NEXT_PUBLIC_SUPPORT_EMAIL (2026-11-08), dont la valeur par défaut
 * « privacy@edupilot.app » n'appartenait pas à l'exploitant d'une
 * installation autonome.
 *
 * C'est l'adresse réelle de l'exploitant : la première de ROOT_USER_EMAILS si
 * la liste est définie, sinon celle du premier super-administrateur actif
 * (celui qui a installé la plateforme). `null` avant l'installation.
 * Relue au plus toutes les 5 minutes.
 */
const TTL_MS = 5 * 60_000;
let cached: { value: string | null; at: number } | null = null;

export async function platformContactEmail(now = Date.now()): Promise<string | null> {
    if (cached && now - cached.at < TTL_MS) return cached.value;
    let value: string | null = null;
    const listed = (process.env.ROOT_USER_EMAILS ?? "").split(",").map((email) => email.trim()).find(Boolean);
    if (listed) {
        value = listed.toLowerCase();
    } else {
        try {
            const admin = await prismaBase.user.findFirst({
                where: { role: "SUPER_ADMIN", isActive: true },
                orderBy: { createdAt: "asc" },
                select: { email: true },
            });
            value = admin?.email ?? null;
        } catch {
            value = cached?.value ?? null; // base indisponible : dernière valeur connue
        }
    }
    cached = { value, at: now };
    return value;
}

/** Pour les tests. */
export function resetPlatformContactCache(): void {
    cached = null;
}
