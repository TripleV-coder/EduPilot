import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { importClassesAllOrNothing } from "@/lib/import/class-import";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * POST /api/import/classes — { data: ImportClass[], schoolId? }
 * Tout ou rien (Lot 5, N47) : niveau et professeur principal doivent exister ;
 * 200 { created, errors: [] } ; sinon 422/409 { created: 0, errors: [{ row, field?, message }] }.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const body = await request.json();
        const { data, schoolId: bodySchoolId } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
        }

        if (data.length > 500) {
            return NextResponse.json(
                { error: "Maximum 500 lignes par import. Découpez votre fichier." },
                { status: 400 }
            );
        }

        let schoolId = getActiveSchoolId(session) || null;
        if (session.user.role === "SUPER_ADMIN") {
            const { searchParams } = new URL(request.url);
            schoolId = bodySchoolId || searchParams.get("schoolId") || null;
        }

        if (!schoolId) {
            const userFull = await prisma.user.findUnique({ where: { id: session.user.id } });
            schoolId = userFull?.schoolId ?? null;
        }
        if (!schoolId) {
            return NextResponse.json({ error: "School context required" }, { status: 400 });
        }

        const schoolExists = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { id: true },
        });
        if (!schoolExists) {
            return NextResponse.json({ error: "School not found" }, { status: 400 });
        }

        const outcome = await importClassesAllOrNothing(schoolId, data);
        if (outcome.status === 200 && outcome.body.created > 0) {
            await invalidateByPath(CACHE_PATHS.classes).catch(() => { });
        }
        const { credentials: _unused, ...payload } = outcome.body;
        return NextResponse.json(payload, { status: outcome.status });
    },
    { allowedRoles: ALLOWED_ROLES },
);
