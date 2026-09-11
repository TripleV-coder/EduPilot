import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { SubjectCategory } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

const categorySchema = z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

const NOT_FOUND = { error: "Catégorie introuvable" };

type CategoryAccess =
    | { category: SubjectCategory; response?: undefined }
    | { category?: undefined; response: NextResponse };

/**
 * Isolation inter-établissement (audit H5/N3) : une catégorie d'école n'est
 * visible et modifiable que par cette école (404 sinon, sans révéler son
 * existence) ; une catégorie commune (`schoolId` nul) est lisible par tous et
 * modifiable par le seul super-administrateur.
 */
async function resolveCategory(
    session: Session,
    id: string,
    intent: "read" | "write",
): Promise<CategoryAccess> {
    const category = await prisma.subjectCategory.findUnique({ where: { id } });
    if (!category) return { response: NextResponse.json(NOT_FOUND, { status: 404 }) };

    if (category.schoolId === null) {
        if (intent === "write" && session.user.role !== "SUPER_ADMIN") {
            return {
                response: NextResponse.json(
                    { error: "Seul le super-administrateur peut modifier une catégorie commune" },
                    { status: 403 },
                ),
            };
        }
        return { category };
    }

    if (!canAccessSchool(session, category.schoolId)) {
        return { response: NextResponse.json(NOT_FOUND, { status: 404 }) };
    }
    return { category };
}

export const GET = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        const access = await resolveCategory(context.session, id, "read");
        if (access.response) return access.response;

        return NextResponse.json(access.category);
    },
);

export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        try {
            const access = await resolveCategory(context.session, id, "write");
            if (access.response) return access.response;

            const body = await request.json();
            const validated = categorySchema.parse(body);

            const category = await prisma.subjectCategory.update({
                where: { id },
                data: validated,
            });

            return NextResponse.json(category);
        } catch (error) {
            if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
            throw error;
        }
    },
    { allowedRoles: MANAGE_ROLES },
);

export const DELETE = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        const access = await resolveCategory(context.session, id, "write");
        if (access.response) return access.response;

        await prisma.subjectCategory.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    },
    { allowedRoles: MANAGE_ROLES },
);
