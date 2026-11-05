import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { Permission } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/security/audit-log";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { isYearLocked } from "@/lib/academic/year-lock";
import { dependencyConflict } from "@/lib/api/dependency-guard";

const yearUpdateSchema = z
    .object({
        name: z.string().trim().min(4, "Format attendu : 2025-2026").optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        isCurrent: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadYear(id: string) {
    return prisma.academicYear.findUnique({
        where: { id },
        select: { id: true, schoolId: true, name: true, startDate: true, endDate: true, isCurrent: true, status: true },
    });
}

/**
 * PATCH /api/academic-years/[id] — corriger le nom ou les dates d'une année
 * ouverte, ou la marquer comme année en cours. Seul son statut (clôture,
 * réouverture) était modifiable.
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = yearUpdateSchema.parse(await request.json());
        const year = await loadYear(id);
        if (!year || !canAccessSchool(session, year.schoolId)) {
            return NextResponse.json({ error: "Année scolaire introuvable" }, { status: 404 });
        }
        if (isYearLocked(year.status)) {
            return NextResponse.json({ error: "Année clôturée : rouvrez-la avant de la modifier." }, { status: 409 });
        }

        const startDate = data.startDate ?? year.startDate;
        const endDate = data.endDate ?? year.endDate;
        if (endDate <= startDate) {
            return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
        }
        // Les périodes doivent rester dans l'année
        if (data.startDate || data.endDate) {
            const bounds = await prisma.period.aggregate({
                where: { academicYearId: id },
                _min: { startDate: true },
                _max: { endDate: true },
            });
            if ((bounds._min.startDate && bounds._min.startDate < startDate) || (bounds._max.endDate && bounds._max.endDate > endDate)) {
                return NextResponse.json(
                    { error: "Des périodes sortiraient des nouvelles dates : ajustez d'abord les dates des trimestres ou semestres." },
                    { status: 409 },
                );
            }
        }
        if (data.name && data.name !== year.name) {
            const duplicate = await prisma.academicYear.findFirst({
                where: { schoolId: year.schoolId, name: data.name, id: { not: id } },
                select: { id: true },
            });
            if (duplicate) return NextResponse.json({ error: "Une année porte déjà ce nom." }, { status: 409 });
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (data.isCurrent) {
                await tx.academicYear.updateMany({ where: { schoolId: year.schoolId, isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
            }
            return tx.academicYear.update({
                where: { id },
                data: {
                    ...(data.name ? { name: data.name } : {}),
                    startDate,
                    endDate,
                    ...(data.isCurrent !== undefined ? { isCurrent: data.isCurrent } : {}),
                },
            });
        });
        await createAuditLog({
            userId: session.user.id,
            action: "ACADEMIC_YEAR_UPDATED",
            entity: "AcademicYear",
            entityId: id,
            schoolId: year.schoolId,
            oldValues: { name: year.name, startDate: year.startDate, endDate: year.endDate, isCurrent: year.isCurrent },
            newValues: { name: updated.name, startDate: updated.startDate, endDate: updated.endDate, isCurrent: updated.isCurrent },
        });
        await invalidateByPath("/api/academic-years");
        return NextResponse.json(updated);
    },
    { requireAuth: true, requiredPermissions: [Permission.ACADEMIC_YEAR_UPDATE] },
);

/**
 * DELETE /api/academic-years/[id] — une année créée par erreur, sans aucune
 * donnée (ses périodes vides partent avec elle). Dès qu'elle porte des
 * inscriptions, des évaluations, des frais… : 409 (règle prudente).
 */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const year = await loadYear(id);
        if (!year || !canAccessSchool(session, year.schoolId)) {
            return NextResponse.json({ error: "Année scolaire introuvable" }, { status: 404 });
        }
        const [enrollments, evaluations, fees, councils, certificates, events, holidays, orientations] = await Promise.all([
            prisma.enrollment.count({ where: { academicYearId: id } }),
            prisma.evaluation.count({ where: { period: { academicYearId: id } } }),
            prisma.fee.count({ where: { academicYearId: id } }),
            prisma.classCouncil.count({ where: { period: { academicYearId: id } } }),
            prisma.certificate.count({ where: { academicYearId: id } }),
            prisma.schoolCalendarEvent.count({ where: { academicYearId: id } }),
            prisma.schoolHoliday.count({ where: { academicYearId: id } }),
            prisma.studentOrientation.count({ where: { academicYearId: id } }),
        ]);
        const conflict = dependencyConflict(
            `l'année ${year.name}`,
            [
                { count: enrollments, one: "inscription", many: "inscriptions" },
                { count: evaluations, one: "évaluation", many: "évaluations" },
                { count: fees, one: "frais", many: "frais" },
                { count: councils, one: "conseil de classe", many: "conseils de classe" },
                { count: certificates, one: "certificat", many: "certificats" },
                { count: events, one: "évènement du calendrier", many: "évènements du calendrier" },
                { count: holidays, one: "période de vacances", many: "périodes de vacances" },
                { count: orientations, one: "orientation", many: "orientations" },
            ],
            "Une année qui a servi se clôture, elle ne se supprime pas.",
        );
        if (conflict) return conflict;

        await prisma.academicYear.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "ACADEMIC_YEAR_DELETED",
            entity: "AcademicYear",
            entityId: id,
            schoolId: year.schoolId,
            oldValues: { name: year.name, startDate: year.startDate, endDate: year.endDate },
            severity: "WARNING",
        });
        await invalidateByPath("/api/academic-years");
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, requiredPermissions: [Permission.ACADEMIC_YEAR_DELETE] },
);
