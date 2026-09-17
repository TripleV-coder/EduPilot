import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { DEFAULT_RETENTION_POLICIES, planRetention, type RetentionDataType } from "@/lib/security/retention";

/**
 * Réglage de la conservation par l'établissement (Lot 6).
 *
 * La migration `20260914170000_default_retention_policies` pose les règles
 * INACTIVES sur les écoles existantes : aucune purge ne démarre d'elle-même.
 * C'est ici que l'école voit ce que chaque règle effacerait aujourd'hui
 * (`affected`, calculé par le même code que la purge), ajuste la durée, puis
 * active la règle. Chaque changement est tracé dans le journal d'audit.
 *
 * GET    → aperçu, dans l'ordre d'application de la purge.
 * PATCH  → une règle : durée et/ou activation.
 */

/** Toutes les catégories que la purge sait traiter (`lib/security/retention`). */
const DATA_TYPES = [
    "STUDENT_ACCOUNT",
    "ACADEMIC_RECORDS",
    "MEDICAL_RECORDS",
    "ACCOUNTING",
    "BADGE_SCAN_LOGS",
    "AUDIT_LOGS",
    "NOTIFICATIONS",
    "MESSAGES",
] as const satisfies ReadonlyArray<RetentionDataType>;

/** Pièces comptables : 10 ans OHADA, jamais moins (décision du propriétaire du 2026-09-14). */
const ACCOUNTING_MIN_MONTHS = 120;
/** 50 ans : au-delà, c'est une saisie erronée, pas une durée de conservation. */
const MAX_MONTHS = 600;

const patchSchema = z.object({
    dataType: z.enum(DATA_TYPES),
    months: z.number().int().min(1).max(MAX_MONTHS).optional(),
    isActive: z.boolean().optional(),
    /** Accepté du seul SUPER_ADMIN ; ignoré pour les autres, qui règlent leur école. */
    schoolId: z.string().optional(),
});

const NO_SCHOOL = { error: "Aucun établissement associé à ce compte", code: "NO_SCHOOL" } as const;

/** Établissement réglé : celui de la session ; le super-administrateur peut en désigner un. */
async function targetSchoolId(session: { user: { role: string } }, requested?: string): Promise<string | null> {
    if (session.user.role === "SUPER_ADMIN") {
        if (!requested) return null;
        const school = await prisma.school.findUnique({ where: { id: requested }, select: { id: true } });
        return school?.id ?? null;
    }
    return getActiveSchoolId(session as never) ?? null;
}

export const GET = createApiHandler(
    async (request, { session }) => {
        const requested = new URL(request.url).searchParams.get("schoolId") ?? undefined;
        const schoolId = await targetSchoolId(session, requested);
        if (!schoolId) return NextResponse.json(NO_SCHOOL, { status: 403 });

        return NextResponse.json({ data: await planRetention(schoolId) });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
);

export const PATCH = createApiHandler(
    async (request, { session }) => {
        const input = patchSchema.parse(await request.json());

        if (input.dataType === "ACCOUNTING" && input.months !== undefined && input.months < ACCOUNTING_MIN_MONTHS) {
            return NextResponse.json(
                {
                    error: `Les pièces comptables se conservent au moins ${ACCOUNTING_MIN_MONTHS} mois (10 ans, OHADA).`,
                    code: "RETENTION_BELOW_LEGAL_MINIMUM",
                },
                { status: 400 },
            );
        }

        const schoolId = await targetSchoolId(session, input.schoolId);
        if (!schoolId) return NextResponse.json(NO_SCHOOL, { status: 403 });

        const existing = await prisma.dataRetentionPolicy.findUnique({
            where: { schoolId_dataType: { schoolId, dataType: input.dataType } },
        });
        const fallback = DEFAULT_RETENTION_POLICIES.find((p) => p.dataType === input.dataType);
        const months = input.months ?? existing?.retentionPeriod ?? fallback?.months ?? 12;
        const isActive = input.isActive ?? existing?.isActive ?? false;

        const policy = await prisma.dataRetentionPolicy.upsert({
            where: { schoolId_dataType: { schoolId, dataType: input.dataType } },
            create: { schoolId, dataType: input.dataType, retentionPeriod: months, isActive, description: fallback?.description },
            update: { retentionPeriod: months, isActive },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "RETENTION_POLICY_UPDATE",
            entity: "DataRetentionPolicy",
            entityId: policy.id,
            oldValues: existing ? { months: existing.retentionPeriod, isActive: existing.isActive } : null,
            newValues: { months, isActive, dataType: input.dataType, schoolId },
            severity: isActive && !existing?.isActive ? "WARNING" : "INFO",
        });

        return NextResponse.json({ data: { dataType: policy.dataType, months: policy.retentionPeriod, isActive: policy.isActive } });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
);
