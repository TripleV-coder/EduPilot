import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { calculateWeightedAverage } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import type { RecommendedSeries } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

// Map enum series → display label
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

// Reduce a label to its top-level family for distribution bucketing
function familyOf(label: string | null): string | null {
    if (!label) return null;
    if (label === "DT") return "DT";
    if (label.startsWith("A")) return "A";
    if (label.startsWith("F")) return "F";
    if (label.startsWith("G")) return "G";
    return label[0];
}

type State = "ok" | "arbitrage" | "conflict";

function deriveState(
    aiTop: string | null,
    familyWish: string | null,
    council: string | null
): State {
    // Council not decided + AI ≠ family => conflict (désaccord)
    if (!council) {
        if (aiTop && familyWish && aiTop !== familyWish) return "conflict";
        return "arbitrage";
    }
    // Council picked something that contradicts both AI and family
    if (
        aiTop &&
        familyWish &&
        council !== aiTop &&
        council !== familyWish
    ) {
        return "conflict";
    }
    return "ok";
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
        if (!ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const classId = searchParams.get("classId");
        const academicYearId = searchParams.get("academicYearId");
        if (!classId || !academicYearId) {
            return NextResponse.json(
                { error: "classId et academicYearId sont requis" },
                { status: 400 }
            );
        }

        const klass = await prisma.class.findUnique({
            where: { id: classId },
            include: {
                classLevel: true,
                classSubjects: { include: { subject: true } },
            },
        });
        if (!klass) {
            return NextResponse.json(
                { error: "Classe non trouvée" },
                { status: 404 }
            );
        }
        if (
            session.user.role !== "SUPER_ADMIN" &&
            klass.schoolId !== getActiveSchoolId(session)
        ) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        // Roster — active enrollments in this class for the year
        const enrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                academicYearId,
                status: "ACTIVE",
            },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        grades: {
                            include: {
                                evaluation: { include: { classSubject: true, type: true } },
                            },
                        },
                        studentOrientations: {
                            where: { academicYearId },
                            include: {
                                recommendations: { orderBy: { rank: "asc" } },
                            },
                        },
                    },
                },
            },
        });

        const rows = enrollments.map((e) => {
            const student = e.student;
            const allGrades = student.grades.map((g) => ({
                value: g.value,
                coefficient: g.evaluation.coefficient,
                isAbsent: g.isAbsent,
                isExcused: g.isExcused,
            }));
            const generalAverage = calculateWeightedAverage(allGrades);

            // BEPC blanc: average of grades whose evaluation.type.name starts with "BEPC"
            const bepcGrades = student.grades
                .filter((g) =>
                    g.evaluation.type?.name?.toLowerCase().includes("bepc")
                )
                .map((g) => ({
                    value: g.value,
                    coefficient: g.evaluation.coefficient,
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                }));
            const bepcAverage = calculateWeightedAverage(bepcGrades);

            const orientation = student.studentOrientations[0] ?? null;
            const recs = orientation?.recommendations ?? [];
            const aiTopRec = recs[0] ?? null;
            const wishRec = recs[1] ?? null;
            const validatedRec = recs.find((r) => r.isValidated) ?? null;

            const aiSeries = seriesLabel(aiTopRec?.recommendedSeries);
            const familyWish = seriesLabel(wishRec?.recommendedSeries);
            const councilDecision = seriesLabel(validatedRec?.recommendedSeries);
            const state = deriveState(aiSeries, familyWish, councilDecision);

            return {
                studentId: student.id,
                name: `${student.user.firstName} ${student.user.lastName}`,
                generalAverage,
                bepcAverage,
                aiSeries,
                familyWish,
                councilDecision,
                state,
                orientationId: orientation?.id ?? null,
                hasAi: aiTopRec !== null,
            };
        });

        rows.sort((a, b) => {
            if (a.generalAverage === null) return 1;
            if (b.generalAverage === null) return -1;
            return b.generalAverage - a.generalAverage;
        });

        // Metrics
        const totalToOrient = rows.length;
        const decisionsSaved = rows.filter((r) => r.councilDecision !== null).length;
        const inArbitration = rows.filter((r) => r.state === "arbitrage").length;
        const conflicts = rows.filter((r) => r.state === "conflict").length;
        const aiReady = rows.filter((r) => r.hasAi).length;

        // Distribution — by family of council decision (or AI if undecided)
        const families = ["A", "B", "C", "D", "E", "F", "G", "DT"] as const;
        const FAMILY_LABELS: Record<string, string> = {
            A: "A1-A2 · Lettres",
            B: "B · Sci. sociales",
            C: "C · Sciences & Math",
            D: "D · Bio-Géologie",
            E: "E · Math & Tech.",
            F: "F (F1-F4) · Indus.",
            G: "G (G1-G3) · Tertiaire",
            DT: "DT · Pro",
        };
        const FAMILY_COLORS: Record<string, string> = {
            A: "brand",
            B: "brand",
            C: "info",
            D: "success",
            E: "info",
            F: "warning",
            G: "warning",
            DT: "danger",
        };
        const familyCounts = new Map<string, number>(families.map((f) => [f, 0]));
        for (const r of rows) {
            const decided = r.councilDecision ?? r.aiSeries;
            const fam = familyOf(decided);
            if (fam && familyCounts.has(fam)) {
                familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1);
            }
        }
        const distribution = families.map((fam) => {
            const count = familyCounts.get(fam) ?? 0;
            return {
                family: fam,
                label: FAMILY_LABELS[fam],
                color: FAMILY_COLORS[fam],
                count,
                pct: totalToOrient > 0 ? Math.round((count / totalToOrient) * 100) : 0,
            };
        });

        // Pick the most pressing conflict (lowest avg with conflict state)
        const topConflict =
            rows
                .filter((r) => r.state === "conflict" && r.aiSeries && r.familyWish)
                .sort((a, b) => (a.generalAverage ?? 99) - (b.generalAverage ?? 99))[0] ??
            null;

        return NextResponse.json({
            class: {
                id: klass.id,
                name: klass.name,
                level: klass.classLevel.name,
                size: totalToOrient,
            },
            metrics: {
                totalToOrient,
                decisionsSaved,
                inArbitration,
                conflicts,
                aiReady,
            },
            students: rows,
            distribution,
            topConflict,
        });
    
    } catch (error) {
        logger.error("orientation council:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du calcul du conseil d'orientation" },
            { status: 500 }
        );
    }

});
