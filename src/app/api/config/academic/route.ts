import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import type { PeriodType } from "@prisma/client";

const WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

const patchSchema = z.object({
    periodType: z.enum(["TRIMESTER", "SEMESTER", "HYBRID"]),
    periodsCount: z.number().int().min(1).max(6).optional(),
    maxGrade: z.number().min(1).max(100).optional(),
    passingGrade: z.number().min(0).max(100).optional(),
});

function periodsCountFor(type: PeriodType): number {
    if (type === "SEMESTER") return 2;
    if (type === "HYBRID") return 4;
    return 3;
}

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif" },
                { status: 400 }
            );
        }

        const [config, currentYear] = await Promise.all([
            prisma.academicConfig.findUnique({ where: { schoolId } }),
            prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
                include: {
                    periods: { orderBy: { sequence: "asc" } },
                    schoolHolidays: { orderBy: { startDate: "asc" } },
                },
            }),
        ]);

        return NextResponse.json({
            config: config
                ? {
                      periodType: config.periodType,
                      periodsCount: config.periodsCount,
                      maxGrade: Number(config.maxGrade),
                      passingGrade: Number(config.passingGrade),
                  }
                : {
                      periodType: "TRIMESTER" as PeriodType,
                      periodsCount: 3,
                      maxGrade: 20,
                      passingGrade: 10,
                  },
            academicYear: currentYear
                ? {
                      id: currentYear.id,
                      name: currentYear.name,
                      startDate: currentYear.startDate.toISOString(),
                      endDate: currentYear.endDate.toISOString(),
                  }
                : null,
            periods:
                currentYear?.periods.map((p) => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    sequence: p.sequence,
                    startDate: p.startDate.toISOString(),
                    endDate: p.endDate.toISOString(),
                })) ?? [],
            holidays:
                currentYear?.schoolHolidays.map((h) => ({
                    id: h.id,
                    name: h.name,
                    type: h.type,
                    startDate: h.startDate.toISOString(),
                    endDate: h.endDate.toISOString(),
                    description: h.description,
                })) ?? [],
        });
    } catch (error) {
        logger.error("config/academic GET:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du chargement de la configuration" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }
        if (!WRITE_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const data = patchSchema.parse(body);
        const periodsCount = data.periodsCount ?? periodsCountFor(data.periodType);

        const config = await prisma.academicConfig.upsert({
            where: { schoolId },
            create: {
                schoolId,
                periodType: data.periodType,
                periodsCount,
                maxGrade: data.maxGrade ?? 20,
                passingGrade: data.passingGrade ?? 10,
            },
            update: {
                periodType: data.periodType,
                periodsCount,
                ...(data.maxGrade !== undefined ? { maxGrade: data.maxGrade } : {}),
                ...(data.passingGrade !== undefined
                    ? { passingGrade: data.passingGrade }
                    : {}),
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                schoolId,
                action: "UPDATE",
                entity: "AcademicConfig",
                entityId: config.id,
                newValues: data,
            },
        });

        return NextResponse.json({
            config: {
                periodType: config.periodType,
                periodsCount: config.periodsCount,
                maxGrade: Number(config.maxGrade),
                passingGrade: Number(config.passingGrade),
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        logger.error("config/academic PATCH:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors de l'enregistrement" },
            { status: 500 }
        );
    }
}
