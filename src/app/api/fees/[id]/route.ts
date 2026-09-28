import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { feeSchema } from "@/lib/validations/finance";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

const FINANCE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const;
// Sans valeur par défaut : un PATCH du seul montant ne doit pas remettre
// `isRequired` à vrai (un frais facultatif deviendrait obligatoire).
const updateFeeSchema = feeSchema.extend({ isRequired: z.boolean() }).partial();

async function loadFee(id: string) {
    return prisma.fee.findFirst({
        where: { id, isActive: true },
        select: { id: true, schoolId: true, amount: true, _count: { select: { payments: true } } },
    });
}

/**
 * PATCH /api/fees/[id] — modifie une ligne de la grille tarifaire.
 * Le montant d'un frais déjà encaissé ne change plus : les reçus et plans de
 * paiement émis reposent dessus (créer une nouvelle ligne à la place).
 */
export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const fee = await loadFee(id);
        if (!fee || !canAccessSchool(context.session, fee.schoolId)) {
            return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
        }

        const parsed = updateFeeSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
        }
        const data = parsed.data;

        if (data.amount !== undefined && data.amount !== Number(fee.amount) && fee._count.payments > 0) {
            return NextResponse.json(
                { error: "Des paiements ont déjà été encaissés sur ce frais : son montant ne peut plus changer. Créez une nouvelle ligne tarifaire." },
                { status: 409 },
            );
        }

        const updated = await prisma.fee.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.amount !== undefined && { amount: data.amount }),
                ...(data.academicYearId !== undefined && { academicYearId: data.academicYearId }),
                ...(data.classLevelCode !== undefined && { classLevelCode: data.classLevelCode }),
                ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
                ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
            },
        });
        return NextResponse.json(updated);
    },
    { allowedRoles: [...FINANCE_ROLES] },
);

/**
 * DELETE /api/fees/[id] — retire une ligne de la grille (suppression douce).
 * Refusé si des paiements existent : l'historique financier doit rester intact.
 */
export const DELETE = createApiHandler(
    async (_request, context) => {
        const { id } = await context.params;
        const fee = await loadFee(id);
        if (!fee || !canAccessSchool(context.session, fee.schoolId)) {
            return NextResponse.json({ error: "Frais introuvable" }, { status: 404 });
        }
        if (fee._count.payments > 0) {
            return NextResponse.json(
                { error: "Des paiements ont déjà été encaissés sur ce frais : il ne peut pas être supprimé." },
                { status: 409 },
            );
        }

        await prisma.fee.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
        return NextResponse.json({ success: true });
    },
    { allowedRoles: [...FINANCE_ROLES] },
);
