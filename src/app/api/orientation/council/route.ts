import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
    computeStudentAverages,
    gradedEvaluations,
    toDisplay,
    type GradeRecord,
} from "@/lib/academic/average-engine";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { seriesFamily, seriesShortLabel as seriesLabel } from "@/lib/benin/series";
import { createApiHandler } from "@/lib/api/api-helpers";
import { computeClassAnnual } from "@/lib/academic/class-averages";
import { getGradingSettings } from "@/lib/academic/grading-settings";

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

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
                            where: {
                                deletedAt: null,
                                evaluation: { period: { academicYearId } },
                            },
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

        const classSubjects = klass.classSubjects.map((cs) => ({ id: cs.id, coefficient: cs.coefficient }));
        const toRecords = (grades: (typeof enrollments)[number]["student"]["grades"]): GradeRecord[] =>
            grades.map((g) => ({
                evaluationId: g.evaluationId,
                classSubjectId: g.evaluation.classSubjectId,
                periodId: g.evaluation.periodId,
                value: g.value,
                isAbsent: g.isAbsent,
                isExcused: g.isExcused,
                deletedAt: g.deletedAt,
                maxGrade: g.evaluation.maxGrade,
                type: g.evaluation.type,
            }));
        // Notes attendues : évaluations déjà notées chez au moins un camarade
        const expected = gradedEvaluations(enrollments.flatMap((e) => toRecords(e.student.grades)));
        // Moyenne annuelle : exactement celle du bulletin (règles de l'école, conseils gelés)
        const [classAnnual, schoolRules] = await Promise.all([
            computeClassAnnual({
                classId,
                academicYearId,
                classSubjects: klass.classSubjects.map((cs) => ({ id: cs.id, subjectId: cs.subjectId, coefficient: cs.coefficient })),
            }),
            getGradingSettings(klass.schoolId),
        ]);
        const rules = schoolRules.calculation;

        const rows = enrollments.map((e) => {
            const student = e.student;
            // Moteur unique : formule officielle, calcul exact, moyenne annuelle
            const records = toRecords(student.grades);
            // Moyenne annuelle officielle, ou provisoire tant que l'année n'est pas terminée
            const annual = classAnnual.students.get(student.id);
            const generalAverage = annual ? annual.general ?? annual.provisional : null;
            const averageIsProvisional = !annual || annual.general === null || !annual.annual.complete;

            // BEPC blanc : notes dont le type d'évaluation mentionne « BEPC »
            const bepcAverage = toDisplay(
                computeStudentAverages(
                    records.filter((_, i) =>
                        student.grades[i].evaluation.type?.name?.toLowerCase().includes("bepc")
                    ),
                    classSubjects,
                    expected.filter((m) => {
                        const ev = enrollments.flatMap((x) => x.student.grades).find((g) => g.evaluationId === m.evaluationId);
                        return Boolean(ev?.evaluation.type?.name?.toLowerCase().includes("bepc"));
                    }),
                    { rules }
                ).general,
                rules.rounding
            );

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
                averageIsProvisional,
                missingGrades: annual?.annual.missing.length ?? 0,
                bepcAverage,
                aiSeries,
                familyWish,
                councilDecision,
                aiSeriesCode: aiTopRec?.recommendedSeries ?? null,
                councilSeries: validatedRec?.recommendedSeries ?? null,
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
            DT: "DT · EA, MIA, HR",
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
            const fam = seriesFamily(r.councilSeries ?? r.aiSeriesCode);
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
