import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { computeContentHash, hashIp, canSignDocType } from "@/lib/signatures/signature";

const DOC_TYPES = ["REPORT_CARD", "CERTIFICATE", "PARENT_AUTHORIZATION", "STAFF_CONTRACT"] as const;

const createSchema = z.object({
    docType: z.enum(DOC_TYPES),
    docId: z.string().min(1).max(200),
    method: z.enum(["DRAWN", "TYPED", "OTP"]),
    signatureData: z.string().max(200_000).optional().nullable(),
    // Instantané canonique du document, scellé par le hash de contenu.
    payload: z.unknown(),
});

function clientIp(request: Request): string {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * GET /api/signatures?docType=&docId= — signatures d'un document (dans l'école active).
 */
export const GET = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const url = new URL(request.url);
        const docType = url.searchParams.get("docType");
        const docId = url.searchParams.get("docId");
        if (!docType || !docId || !DOC_TYPES.includes(docType as (typeof DOC_TYPES)[number])) {
            return NextResponse.json({ error: "docType et docId requis" }, { status: 400 });
        }

        const signatures = await prisma.documentSignature.findMany({
            where: { schoolId, docType: docType as (typeof DOC_TYPES)[number], docId },
            orderBy: { signedAt: "asc" },
            select: {
                id: true,
                signerName: true,
                signerRole: true,
                method: true,
                signatureData: true,
                signedAt: true,
            },
        });

        return NextResponse.json({ signatures });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STAFF", "ACCOUNTANT"] },
);

/**
 * POST /api/signatures — appose une signature sur un document.
 * L'autorisation dépend du type (direction pour bulletins/certificats/contrats,
 * parent pour l'autorisation parentale). Le hash de contenu scelle le document.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { docType, docId, method, signatureData, payload } = parsed.data;

        if (!canSignDocType(context.session.user.role, docType)) {
            return NextResponse.json({ error: "Vous n'êtes pas autorisé à signer ce document." }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: context.session.user.id },
            select: { firstName: true, lastName: true },
        });
        const signerName = user ? `${user.firstName} ${user.lastName}`.trim() : "Signataire";

        // Anti-doublon : un même signataire ne signe qu'une fois le même document.
        const existing = await prisma.documentSignature.findFirst({
            where: { schoolId, docType, docId, signerId: context.session.user.id },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json({ error: "Vous avez déjà signé ce document." }, { status: 409 });
        }

        const contentHash = computeContentHash(docType, docId, payload);

        const signature = await prisma.documentSignature.create({
            data: {
                schoolId,
                docType,
                docId,
                signerId: context.session.user.id,
                signerName,
                signerRole: context.session.user.role,
                method,
                signatureData: signatureData ?? null,
                contentHash,
                ipHash: hashIp(clientIp(request), process.env.SIGNATURE_SALT ?? "edupilot"),
            },
            select: { id: true, signedAt: true },
        });

        return NextResponse.json({ id: signature.id, signedAt: signature.signedAt }, { status: 201 });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT"] },
);
