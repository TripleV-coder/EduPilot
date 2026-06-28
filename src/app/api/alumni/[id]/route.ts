import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALUMNI_FIELDS = ["Médecine", "Tech", "Droit", "Business", "Énergie", "Autre"] as const;

const patchSchema = z.object({
    firstName: z.string().min(1).trim().optional(),
    lastName: z.string().min(1).trim().optional(),
    graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
    series: z.string().trim().optional().nullable(),
    field: z.enum(ALUMNI_FIELDS).optional(),
    currentRole: z.string().trim().optional().nullable(),
    company: z.string().trim().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    phone: z.string().trim().optional().nullable(),
    isMentor: z.boolean().optional(),
    mentorTopic: z.string().trim().optional().nullable(),
});

async function loadScoped(id: string, schoolId: string) {
    const alumni = await prisma.alumni.findUnique({ where: { id } });
    if (!alumni || alumni.schoolId !== schoolId) return null;
    return alumni;
}

export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const existing = await loadScoped(id, schoolId);
        if (!existing) return NextResponse.json({ error: "Ancien élève introuvable" }, { status: 404 });

        const body = await request.json().catch(() => ({}));
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;
        const updated = await prisma.alumni.update({
            where: { id },
            data: { ...data, email: data.email === "" ? null : data.email },
        });
        return NextResponse.json(updated);
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_UPDATE],
    }
);

export const DELETE = createApiHandler(
    async (_request, context) => {
        const { id } = await context.params;
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const existing = await loadScoped(id, schoolId);
        if (!existing) return NextResponse.json({ error: "Ancien élève introuvable" }, { status: 404 });

        await prisma.alumni.delete({ where: { id } });
        await prisma.auditLog.create({
            data: {
                userId: context.session.user.id,
                schoolId,
                action: "DELETE",
                entity: "Alumni",
                entityId: id,
            },
        });
        return NextResponse.json({ success: true });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
        requiredPermissions: [Permission.SCHOOL_UPDATE],
    }
);
