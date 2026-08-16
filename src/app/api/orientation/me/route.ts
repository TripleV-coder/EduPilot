import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { calculateWeightedAverage } from "@/lib/utils/grades";
import { computeIndicativeRecommendations } from "@/lib/services/orientation";
import { logger } from "@/lib/utils/logger";
import type { RecommendedSeries } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";

function seriesLabel(s: RecommendedSeries | null | undefined): string | null {
    if (!s) return null;
    const map: Partial<Record<RecommendedSeries, string>> = {
        SERIE_A1: "A1",
        SERIE_A2: "A2",
        SERIE_B: "B",
        SERIE_C: "C",
        SERIE_D: "D",
        SERIE_E: "E",
        SERIE_F1: "F1",
        SERIE_F2: "F2",
        SERIE_F3: "F3",
        SERIE_F4: "F4",
        SERIE_G1: "G1",
        SERIE_G2: "G2",
        SERIE_G3: "G3",
        STI: "STI",
        STA: "STA",
        EFS: "EFS",
        MMV: "MMV",
        TOUR: "TOUR",
        HR: "HR",
        FORMATION_PRO: "FP",
        APPRENTISSAGE: "App.",
    };
    return map[s] ?? s.replace("SERIE_", "");
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const { searchParams } = new URL(request.url);
        const academicYearIdParam = searchParams.get("academicYearId");

        const student = await prisma.studentProfile.findFirst({
            where: { userId: session.user.id },
            include: {
                user: { select: { firstName: true, lastName: true } },
            },
        });
        if (!student) {
            return NextResponse.json(
                { error: "Profil élève non trouvé" },
                { status: 404 }
            );
        }

        // Current or specified academic year
        const academicYear = academicYearIdParam
            ? await prisma.academicYear.findUnique({
                  where: { id: academicYearIdParam },
              })
            : await prisma.academicYear.findFirst({
                  where: { schoolId: student.schoolId, isCurrent: true },
              });
        if (!academicYear) {
            return NextResponse.json(
                { error: "Année académique introuvable" },
                { status: 404 }
            );
        }

        // Active enrollment for the year (to know class + class subjects)
        const enrollment = await prisma.enrollment.findFirst({
            where: {
                studentId: student.id,
                academicYearId: academicYear.id,
                status: "ACTIVE",
            },
            include: {
                class: {
                    include: {
                        classLevel: true,
                        classSubjects: {
                            include: { subject: true },
                        },
                    },
                },
            },
        });

        // Existing orientation + recommendations for the year
        const orientation = await prisma.studentOrientation.findFirst({
            where: {
                studentId: student.id,
                academicYearId: academicYear.id,
            },
            include: {
                recommendations: { orderBy: { rank: "asc" } },
            },
        });

        if (!orientation || orientation.recommendations.length === 0) {
            // Pas encore de dossier du conseil : recommandations indicatives
            // calculées à la volée depuis les notes réelles (P2.5)
            const indicative = await computeIndicativeRecommendations(
                student.id,
                academicYear.id
            );

            return NextResponse.json({
                student: {
                    firstName: student.user.firstName,
                    lastName: student.user.lastName,
                },
                academicYear: { id: academicYear.id, name: academicYear.name },
                hasOrientation: false,
                recommendations: [],
                aiTop: null,
                wishes: [],
                subjectAverages: [],
                indicative: {
                    generalAverage: indicative.generalAverage,
                    recommendations: indicative.recommendations.map((rec) => ({
                        series: seriesLabel(rec.series),
                        name: rec.name,
                        description: rec.description,
                        score: rec.score,
                        strengths: rec.strengths.slice(0, 3),
                        warnings: rec.warnings.slice(0, 2),
                    })),
                },
            });
        }

        // Per-subject averages — pulled from current-year grades, all periods
        const grades = await prisma.grade.findMany({
            where: {
                studentId: student.id,
                evaluation: {
                    period: { academicYearId: academicYear.id },
                },
            },
            include: {
                evaluation: {
                    include: {
                        classSubject: { include: { subject: true } },
                    },
                },
            },
        });

        const bySubject = new Map<
            string,
            { name: string; grades: { value: typeof grades[number]["value"]; coefficient: typeof grades[number]["evaluation"]["coefficient"]; isAbsent: boolean; isExcused: boolean }[] }
        >();
        for (const g of grades) {
            const subjectId = g.evaluation.classSubject.subject.id;
            const entry =
                bySubject.get(subjectId) ??
                {
                    name: g.evaluation.classSubject.subject.name,
                    grades: [],
                };
            entry.grades.push({
                value: g.value,
                coefficient: g.evaluation.coefficient,
                isAbsent: g.isAbsent,
                isExcused: g.isExcused,
            });
            bySubject.set(subjectId, entry);
        }

        const subjectAverages = Array.from(bySubject.values())
            .map((s) => ({
                name: s.name,
                average: calculateWeightedAverage(s.grades),
            }))
            .filter((s) => s.average !== null)
            .sort((a, b) => (b.average! - a.average!));

        const recommendations = orientation.recommendations.map((r) => ({
            id: r.id,
            rank: r.rank,
            series: seriesLabel(r.recommendedSeries),
            seriesEnum: r.recommendedSeries,
            score: Number(r.score),
            justification: r.justification,
            strengths: r.strengths,
            warnings: r.warnings,
            isValidated: r.isValidated,
        }));

        const aiTop = recommendations[0] ?? null;
        const wishes = recommendations.slice(0, 3);

        return NextResponse.json({
            student: {
                firstName: student.user.firstName,
                lastName: student.user.lastName,
            },
            academicYear: { id: academicYear.id, name: academicYear.name },
            enrollment: enrollment
                ? {
                      classId: enrollment.class.id,
                      className: enrollment.class.name,
                      levelName: enrollment.class.classLevel.name,
                  }
                : null,
            orientationId: orientation.id,
            status: orientation.status,
            hasOrientation: true,
            aiTop,
            wishes,
            recommendations,
            subjectAverages,
        });
    
    } catch (error) {
        logger.error("orientation me:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du chargement de l'orientation" },
            { status: 500 }
        );
    }

}, { allowedRoles: ["STUDENT"] });
