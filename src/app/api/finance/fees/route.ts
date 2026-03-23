import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { feeSchema } from "@/lib/validations/finance";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/finance/fees
 * @swagger
 * /api/finance/fees:
 *   get:
 *     summary: Liste des frais
 *     description: Récupère la liste des frais scolaires
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: schoolId
 *         in: query
 *         schema:
 *           type: string
 *         description: ID de l'établissement
 *     responses:
 *       200:
 *         description: Liste des frais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const schoolId = searchParams.get("schoolId");

        // Only allow fetching fees for user's school or if admin
        // For now, assume schoolId is passed or derived from user profile
        // But schema doesn't link User directly to School easily for all roles,
        // usually we use `session.user.schoolId` if added to session, or fetch profile.

        // Let's check user permissions
        const userRole = session.user.role;
        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"];

        if (!allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Since we don't have schoolId in session easily (yet), we fetch user profile
        // Or we rely on client passing schoolId (which should be validated)

        let targetSchoolId = schoolId;

        if (userRole !== "SUPER_ADMIN") {
            targetSchoolId = session.user.schoolId || null;
        }

        if (!targetSchoolId) {
            // Try to find school from user profile
            // This depends on how User is linked to School. 
            // TeacherProfile, StudentProfile have schoolId. But what about Accountant?
            // Accountant should likely have a profile or a direct link.
            // Looking at ProfileData in profile/page.tsx, it seems there is `school` relation on User or profile.
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { school: true } // Assuming User has schoolId or relation
            });
            targetSchoolId = user?.schoolId || null;
        }

        if (!targetSchoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const fees = await prisma.fee.findMany({
            where: {
                schoolId: targetSchoolId,
                isActive: true, // You might want to filter by active
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
}

/**
 * POST /api/finance/fees
 * @swagger
 * /api/finance/fees:
 *   post:
 *     summary: Créer un frais
 *     description: Crée un nouveau frais scolaire
 *     tags: [Finance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schoolId
 *               - name
 *               - amount
 *             properties:
 *               schoolId:
 *                 type: string
 *               name:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Frais créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export async function POST(request: NextRequest) {
    let authSession: Session | null = null;
    try {
        authSession = await auth();
        if (!authSession?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = authSession.user.role;
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const bodySchoolId = body?.schoolId as string | undefined;
        const validatedData = feeSchema.parse(body);

        // Ensure schoolId is present. If not in body (schema doesn't have it?), get from user.
        // feeSchema has: name, description, amount, academicYearId, classLevelCode, dueDate, isRequired.
        // It does NOT have schoolId. So we must infer it.

        const user = await prisma.user.findUnique({
            where: { id: authSession.user.id },
            select: { schoolId: true }
        });

        const targetSchoolId =
            userRole === "SUPER_ADMIN"
                ? (bodySchoolId || user?.schoolId || null)
                : (user?.schoolId || null);

        if (userRole !== "SUPER_ADMIN" && bodySchoolId && bodySchoolId !== user?.schoolId) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

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
            userId: authSession?.user?.id,
        });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
