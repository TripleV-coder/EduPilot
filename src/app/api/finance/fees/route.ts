import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { feeSchema } from "@/lib/validations/finance";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { resolveFinanceSchool } from "@/lib/finance/finance-scope";
import { logger } from "@/lib/utils/logger";

/** GET /api/finance/fees — contrat décrit par docs/openapi.json (npm run docs:openapi). */
export const GET = createApiHandler(
    async (request, context) => {
        try {
            const session = context.session;
            const { searchParams } = new URL(request.url);
            const requestedSchoolId = searchParams.get("schoolId");
            const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
            if (schoolAccess) return schoolAccess;
            const activeSchoolId = getActiveSchoolId(session);

            const userRole = session.user.role;

            let targetSchoolId = activeSchoolId ?? null;
            // S6 : école sélectionnée et existante pour le super-admin
            if (userRole === "SUPER_ADMIN") {
                const scope = await resolveFinanceSchool(session, requestedSchoolId, "fees:list");
                if (!scope.ok) return scope.response;
                targetSchoolId = scope.schoolId;
            }

            if (!targetSchoolId) {
                return NextResponse.json({ error: "Identifiant d'établissement requis" }, { status: 400 });
            }

            const fees = await prisma.fee.findMany({
                where: {
                    schoolId: targetSchoolId,
                    isActive: true,
                },
                include: {
                    academicYear: true,
                    _count: {
                        select: {
                            payments: true,
                            paymentPlans: true,
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
            });

            return NextResponse.json(fees);
        } catch (error) {
            logger.error("Error fetching fees", error as Error, {
                endpoint: "/api/finance/fees",
                method: "GET",
            });
            return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }
);

/** POST /api/finance/fees — contrat décrit par docs/openapi.json (npm run docs:openapi). */
export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;
        try {
            const userRole = session.user.role;
            const body = await request.json();
            const bodySchoolId = body?.schoolId as string | undefined;
            const validatedData = feeSchema.parse(body);
            const schoolAccess = ensureRequestedSchoolAccess(session, bodySchoolId);
            if (schoolAccess) return schoolAccess;
            const activeSchoolId = getActiveSchoolId(session);

            let targetSchoolId = activeSchoolId ?? null;
            if (userRole === "SUPER_ADMIN") {
                const scope = await resolveFinanceSchool(session, bodySchoolId, "fees:create");
                if (!scope.ok) return scope.response;
                targetSchoolId = scope.schoolId;
            }

            if (!targetSchoolId) {
                return NextResponse.json({ error: "Utilisateur non rattaché à un établissement" }, { status: 400 });
            }
            // Année du frais dans la même école (lot S2, doublé en base)
            if (
                validatedData.academicYearId &&
                !(await prisma.academicYear.findFirst({ where: { id: validatedData.academicYearId, schoolId: targetSchoolId }, select: { id: true } }))
            ) {
                return NextResponse.json({ error: "Cette année scolaire n'appartient pas à l'établissement concerné." }, { status: 400 });
            }

            const fee = await prisma.fee.create({
                data: {
                    schoolId: targetSchoolId,
                    name: validatedData.name,
                    description: validatedData.description,
                    amount: validatedData.amount,
                    academicYearId: validatedData.academicYearId,
                    classLevelCode: validatedData.classLevelCode,
                    dueDate: validatedData.dueDate,
                    isRequired: validatedData.isRequired,
                    isActive: true,
                },
            });

            return NextResponse.json(fee, { status: 201 });
        } catch (error) {
            if (isZodError(error)) {
                return NextResponse.json({ error: error.issues }, { status: 400 });
            }
            logger.error("Error creating fee", error as Error, {
                endpoint: "/api/finance/fees",
                method: "POST",
                userId: session.user.id,
            });
            return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
