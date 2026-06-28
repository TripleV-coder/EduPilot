import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const ALUMNI_FIELDS = ["Médecine", "Tech", "Droit", "Business", "Énergie", "Autre"] as const;

const createSchema = z.object({
    firstName: z.string().min(1, "Prénom requis").trim(),
    lastName: z.string().min(1, "Nom requis").trim(),
    graduationYear: z.coerce.number().int().min(1950).max(2100),
    series: z.string().trim().optional().nullable(),
    field: z.enum(ALUMNI_FIELDS).default("Autre"),
    currentRole: z.string().trim().optional().nullable(),
    company: z.string().trim().optional().nullable(),
    email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
    phone: z.string().trim().optional().nullable(),
    isMentor: z.boolean().default(false),
    mentorTopic: z.string().trim().optional().nullable(),
});

/**
 * GET /api/alumni — annuaire des anciens élèves de l'école active, avec
 * statistiques agrégées par promotion (année de sortie). Filtre `?field=`.
 */
export const GET = createApiHandler(
    async (request, context) => {
        const { session } = context;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });
        }

        const url = new URL(request.url);
        const field = url.searchParams.get("field");

        const where = {
            schoolId,
            ...(field && field !== "all" ? { field } : {}),
        };

        const [alumni, byPromo, mentorCount, total] = await Promise.all([
            prisma.alumni.findMany({ where, orderBy: [{ graduationYear: "desc" }, { lastName: "asc" }] }),
            prisma.alumni.groupBy({
                by: ["graduationYear"],
                where: { schoolId },
                _count: { _all: true },
                orderBy: { graduationYear: "desc" },
            }),
            prisma.alumni.count({ where: { schoolId, isMentor: true } }),
            prisma.alumni.count({ where: { schoolId } }),
        ]);

        const promotions = byPromo.map((p) => ({
            year: p.graduationYear,
            members: p._count._all,
        }));

        return NextResponse.json({ alumni, promotions, mentorCount, total });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF", "TEACHER"],
        requiredPermissions: [Permission.SCHOOL_READ],
    }
);

/**
 * POST /api/alumni — ajoute un ancien élève à l'annuaire de l'école active.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const { session } = context;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Données invalides", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;

        const created = await prisma.alumni.create({
            data: {
                schoolId,
                firstName: data.firstName,
                lastName: data.lastName,
                graduationYear: data.graduationYear,
                series: data.series || null,
                field: data.field,
                currentRole: data.currentRole || null,
                company: data.company || null,
                email: data.email || null,
                phone: data.phone || null,
                isMentor: data.isMentor,
                mentorTopic: data.mentorTopic || null,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                schoolId,
                action: "CREATE",
                entity: "Alumni",
                entityId: created.id,
                newValues: { name: `${data.firstName} ${data.lastName}`, graduationYear: data.graduationYear },
            },
        });

        return NextResponse.json(created, { status: 201 });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_UPDATE],
    }
);
