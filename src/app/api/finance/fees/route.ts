import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { feeSchema } from "@/lib/validations/finance";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
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

            const targetSchoolId =
                userRole === "SUPER_ADMIN"
                    ? (requestedSchoolId || activeSchoolId || null)
                    : activeSchoolId;

            if (!targetSchoolId) {
                return NextResponse.json({ error: "School ID required" }, { status: 400 });
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
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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

            const targetSchoolId =
                userRole === "SUPER_ADMIN"
                    ? (bodySchoolId || activeSchoolId || null)
                    : activeSchoolId;

            if (!targetSchoolId) {
                return NextResponse.json({ error: "User not associated with a school" }, { status: 400 });
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
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
