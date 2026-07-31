import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const SCAN_TYPES = ["GATE", "CANTEEN", "TRANSPORT", "LIBRARY", "INFIRMARY"] as const;

const createSchema = z.object({
    name: z.string().min(1, "Nom requis").trim(),
    type: z.enum(SCAN_TYPES).default("GATE"),
    location: z.string().trim().optional().nullable(),
    isActive: z.boolean().default(true),
});

export const GET = createApiHandler(
    async (_request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const scanPoints = await prisma.scanPoint.findMany({
            where: { schoolId },
            orderBy: { createdAt: "asc" },
        });
        return NextResponse.json({ scanPoints });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_READ],
    }
);

export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const data = parsed.data;

        const created = await prisma.scanPoint.create({
            data: {
                schoolId,
                name: data.name,
                type: data.type,
                location: data.location || null,
                isActive: data.isActive,
            },
        });
        return NextResponse.json(created, { status: 201 });
    },
    {
        // Opération vie scolaire : restreinte par rôle (STAFF inclus).
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
    }
);
