import prisma from "@/lib/prisma";
import { toInternationalDigits } from "./phone";

export const MAX_BROADCAST_RECIPIENTS = 3000;

/**
 * Parents joignables d'une école (ou d'une classe) : comptes actifs avec un
 * numéro valide, dédoublonnés par numéro. `withoutPhone` compte les familles
 * qui ne recevront rien faute de numéro.
 *
 * Un parent est retenu par l'inscription ACTIVE d'un de ses enfants dans
 * l'école (ou la classe), pas par l'école portée par son compte : un parent
 * rattaché par code d'enfant n'en porte aucune.
 */
export async function familyRecipients(schoolId: string, classId?: string | null) {
    const enrollment = {
        status: "ACTIVE" as const,
        deletedAt: null,
        class: { schoolId },
        ...(classId ? { classId } : {}),
    };
    const parents = await prisma.user.findMany({
        where: {
            role: "PARENT",
            isActive: true,
            parentProfile: { parentStudents: { some: { student: { enrollments: { some: enrollment } } } } },
        },
        select: { id: true, phone: true },
        take: MAX_BROADCAST_RECIPIENTS + 1,
    });
    const seen = new Set<string>();
    const recipients: { userId: string; phone: string }[] = [];
    let withoutPhone = 0;
    for (const p of parents.slice(0, MAX_BROADCAST_RECIPIENTS)) {
        const phone = toInternationalDigits(p.phone);
        if (!phone) {
            withoutPhone += 1;
            continue;
        }
        if (seen.has(phone)) continue;
        seen.add(phone);
        recipients.push({ userId: p.id, phone });
    }
    return { recipients, withoutPhone, truncated: parents.length > MAX_BROADCAST_RECIPIENTS };
}
