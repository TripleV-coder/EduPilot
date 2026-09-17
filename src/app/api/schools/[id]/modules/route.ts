import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ensureRequestedSchoolAccess } from "@/lib/api/tenant-isolation";
import { hasPermission, Permission } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/security/audit-log";
import { ALL_MODULE_IDS, MODULES, normalizeEnabledModules } from "@/lib/modules/catalog";
import { invalidateSchoolModulesCache } from "@/lib/modules/school-modules";

/**
 * Modules actifs d'un établissement (Lot 6 — minimisation).
 *
 * GET   → le catalogue avec l'état de chaque module.
 * PATCH → la liste des modules actifs. Les modules indispensables sont
 *         toujours conservés ; un identifiant inconnu est écarté.
 */

const bodySchema = z.object({
    enabledModules: z.array(z.string()).max(ALL_MODULE_IDS.length * 2),
});

export const GET = createApiHandler(async (request, context) => {
    const { id } = await context.params;
    const access = ensureRequestedSchoolAccess(context.session, id);
    if (access) return access;

    if (!hasPermission(context.session.user.role, Permission.SCHOOL_READ)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { id }, select: { enabledModules: true } });
    if (!school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });

    const enabled = normalizeEnabledModules(school.enabledModules);
    return NextResponse.json({
        schoolId: id,
        data: MODULES.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
            required: Boolean(m.required),
            enabled: enabled.includes(m.id),
        })),
    });
});

export const PATCH = createApiHandler(async (request, context) => {
    const { id } = await context.params;
    const access = ensureRequestedSchoolAccess(context.session, id);
    if (access) return access;

    if (!hasPermission(context.session.user.role, Permission.SCHOOL_UPDATE)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const parsed = bodySchema.parse(await request.json());
    const enabledModules = normalizeEnabledModules(parsed.enabledModules);

    const existing = await prisma.school.findUnique({ where: { id }, select: { enabledModules: true } });
    if (!existing) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });

    const updated = await prisma.school.update({
        where: { id },
        data: { enabledModules },
        select: { enabledModules: true },
    });
    invalidateSchoolModulesCache(id);

    await createAuditLog({
        userId: context.session.user.id,
        action: "SCHOOL_MODULES_UPDATE",
        entity: "School",
        entityId: id,
        oldValues: { enabledModules: normalizeEnabledModules(existing.enabledModules) },
        newValues: { enabledModules: updated.enabledModules },
        severity: "WARNING",
    });

    logger.info("Modules de l'établissement mis à jour", { schoolId: id, count: updated.enabledModules.length });

    return NextResponse.json({ schoolId: id, enabledModules: updated.enabledModules });
});
