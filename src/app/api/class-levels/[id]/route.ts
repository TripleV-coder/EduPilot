import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { Permission } from "@/lib/rbac/permissions";
import { classLevelSchema } from "@/lib/validations/school";
import { createAuditLog } from "@/lib/security/audit-log";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { dependencyConflict } from "@/lib/api/dependency-guard";

const levelUpdateSchema = classLevelSchema
    .partial()
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadLevel(id: string) {
    return prisma.classLevel.findUnique({
        where: { id },
        select: { id: true, schoolId: true, name: true, code: true, level: true, sequence: true },
    });
}

/**
 * PATCH /api/class-levels/[id] — renommer un niveau, corriger son code ou son
 * ordre. Changer de cycle n'est permis que si aucune classe n'y est rattachée
 * (les règles de calcul et d'orientation dépendent du cycle).
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = levelUpdateSchema.parse(await request.json());
        const level = await loadLevel(id);
        if (!level || !canAccessSchool(session, level.schoolId)) {
            return NextResponse.json({ error: "Niveau introuvable" }, { status: 404 });
        }

        if (data.code && data.code !== level.code) {
            const duplicate = await prisma.classLevel.findFirst({
                where: { schoolId: level.schoolId, code: data.code, id: { not: id } },
                select: { id: true },
            });
            if (duplicate) return NextResponse.json({ error: "Un niveau utilise déjà ce code." }, { status: 409 });
        }
        if (data.level && data.level !== level.level) {
            const classes = await prisma.class.count({ where: { classLevelId: id } });
            if (classes > 0) {
                return NextResponse.json(
                    { error: `Ce niveau porte ${classes} classe(s) : son cycle ne peut plus changer.` },
                    { status: 409 },
                );
            }
            const school = await prisma.school.findUnique({ where: { id: level.schoolId }, select: { offeredLevels: true } });
            if (school?.offeredLevels?.length && !school.offeredLevels.includes(data.level)) {
                return NextResponse.json({ error: "Ce cycle n'est pas offert par votre établissement." }, { status: 403 });
            }
        }

        const updated = await prisma.classLevel.update({ where: { id }, data });
        await createAuditLog({
            userId: session.user.id,
            action: "CLASS_LEVEL_UPDATED",
            entity: "ClassLevel",
            entityId: id,
            schoolId: level.schoolId,
            oldValues: { name: level.name, code: level.code, level: level.level, sequence: level.sequence },
            newValues: { name: updated.name, code: updated.code, level: updated.level, sequence: updated.sequence },
        });
        await Promise.all([invalidateByPath("/api/class-levels"), invalidateByPath(CACHE_PATHS.classes)]);
        return NextResponse.json(updated);
    },
    { requireAuth: true, requiredPermissions: [Permission.SCHOOL_UPDATE] },
);

/** DELETE /api/class-levels/[id] — niveau sans classe, ressource ni orientation (règle prudente). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const level = await loadLevel(id);
        if (!level || !canAccessSchool(session, level.schoolId)) {
            return NextResponse.json({ error: "Niveau introuvable" }, { status: 404 });
        }
        const [classes, resources, orientations] = await Promise.all([
            prisma.class.count({ where: { classLevelId: id } }),
            prisma.resource.count({ where: { classLevelId: id } }),
            prisma.studentOrientation.count({ where: { classLevelId: id } }),
        ]);
        const conflict = dependencyConflict(
            `le niveau ${level.name}`,
            [
                { count: classes, one: "classe", many: "classes" },
                { count: resources, one: "ressource pédagogique", many: "ressources pédagogiques" },
                { count: orientations, one: "orientation d'élève", many: "orientations d'élèves" },
            ],
            "Supprimez ou déplacez d'abord ses classes.",
        );
        if (conflict) return conflict;

        await prisma.classLevel.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "CLASS_LEVEL_DELETED",
            entity: "ClassLevel",
            entityId: id,
            schoolId: level.schoolId,
            oldValues: { name: level.name, code: level.code, level: level.level },
            severity: "WARNING",
        });
        await invalidateByPath("/api/class-levels");
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, requiredPermissions: [Permission.SCHOOL_UPDATE] },
);
