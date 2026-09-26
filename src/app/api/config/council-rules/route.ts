import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import prisma from "@/lib/prisma";
import { councilRulesSchema, getCouncilRules, saveCouncilRules } from "@/lib/academic/council-rules";

/** GET /api/config/council-rules — seuils des mentions du conseil de classe de l'école active. */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        return NextResponse.json({ rules: await getCouncilRules(schoolId) });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);

/** PUT /api/config/council-rules — modifie les seuils (direction), tracé dans le journal. */
export const PUT = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        const parsed = councilRulesSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Seuils invalides" },
                { status: 400 },
            );
        }
        const previous = await getCouncilRules(schoolId);
        const rules = await saveCouncilRules(schoolId, parsed.data);
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                schoolId,
                action: "UPDATE",
                entity: "CouncilRules",
                entityId: schoolId,
                oldValues: previous,
                newValues: rules,
            },
        });
        return NextResponse.json({ rules });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
