import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { computeContentHash } from "@/lib/signatures/signature";

const verifySchema = z.object({ payload: z.unknown() });

/**
 * POST /api/signatures/[id]/verify — vérifie l'intégrité d'un document signé.
 * Recalcule le hash à partir du document courant fourni et le compare au hash scellé :
 * `valid=false` signale une altération depuis la signature.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = verifySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Payload requis" }, { status: 400 });
        }

        const signature = await prisma.documentSignature.findFirst({
            where: { id, schoolId },
            select: { docType: true, docId: true, contentHash: true, signerName: true, signedAt: true },
        });
        if (!signature) return NextResponse.json({ error: "Signature introuvable" }, { status: 404 });

        const recomputed = computeContentHash(signature.docType, signature.docId, parsed.data.payload);
        const valid = recomputed === signature.contentHash;

        return NextResponse.json({
            valid,
            signerName: signature.signerName,
            signedAt: signature.signedAt,
        });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STAFF", "ACCOUNTANT"] },
);
