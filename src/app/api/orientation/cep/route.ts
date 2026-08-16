import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { calculateWeightedAverage } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

type Variant = "success" | "info" | "neutral" | "warning" | "danger";

function pronosticFromAvg(avg: number | null): {
    label: string;
    variant: Variant;
    aptForGrade6: boolean;
    needsReinforcement: boolean;
} {
    if (avg === null) {
        return {
            label: "À évaluer",
            variant: "neutral",
            aptForGrade6: false,
            needsReinforcement: true,
        };
    }
    if (avg >= 16)
        return {
            label: "Très Bien",
            variant: "success",
            aptForGrade6: true,
            needsReinforcement: false,
        };
    if (avg >= 14)
        return {
            label: "Bien",
            variant: "success",
            aptForGrade6: true,
            needsReinforcement: false,
        };
    if (avg >= 12)
        return {
            label: "Passable",
            variant: "info",
            aptForGrade6: true,
            needsReinforcement: false,
        };
    if (avg >= 10)
        return {
            label: "Risque échec",
            variant: "warning",
            aptForGrade6: false,
            needsReinforcement: true,
        };
    return {
        label: "Échec probable",
        variant: "danger",
        aptForGrade6: false,
        needsReinforcement: true,
    };
}

function recommendationFromAvg(avg: number | null): string {
    if (avg === null) return "Évaluation à compléter";
    if (avg >= 14) return "Apte 6ᵉ";
    if (avg >= 12) return "Apte 6ᵉ · revision conseillée";
    if (avg >= 10) return "Soutien · vacances";
    if (avg >= 8) return "Soutien intensif";
    return "Redoublement conseillé";
}

// Subject-name heuristic for CEP pillars
function classifySubject(name: string): "lecture" | "calcul" | "dictee" | null {
    const n = name.toLowerCase();
    if (
        n.includes("dictée") ||
        n.includes("dictee") ||
        n.includes("orthographe")
    )
        return "dictee";
    if (
        n.includes("lecture") ||
        n.includes("français") ||
        n.includes("francais") ||
        n.includes("expression") ||
        n.includes("compréhension") ||
        n.includes("comprehension")
    )
        return "lecture";
    if (
        n.includes("calcul") ||
        n.includes("math") ||
        n.includes("arithmétique") ||
        n.includes("arithmetique")
    )
        return "calcul";
    return null;
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

        // Build a map classSubjectId → CEP pillar bucket
        const csBucket = new Map<string, "lecture" | "calcul" | "dictee">();
        for (const cs of klass.classSubjects) {
            const bucket = classifySubject(cs.subject.name);
            if (bucket) csBucket.set(cs.id, bucket);
        }

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
                                evaluation: { include: { classSubject: true } },
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

            // Per-pillar grades
            const lectureGrades: typeof allGrades = [];
            const calculGrades: typeof allGrades = [];
            const dicteeGrades: typeof allGrades = [];
            for (const g of student.grades) {
                const bucket = csBucket.get(g.evaluation.classSubjectId);
                const item = {
                    value: g.value,
                    coefficient: g.evaluation.coefficient,
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                };
                if (bucket === "lecture") lectureGrades.push(item);
                else if (bucket === "calcul") calculGrades.push(item);
                else if (bucket === "dictee") dicteeGrades.push(item);
            }

            const lecture = calculateWeightedAverage(lectureGrades);
            const calcul = calculateWeightedAverage(calculGrades);
            const dictee = calculateWeightedAverage(dicteeGrades);

            const pronostic = pronosticFromAvg(generalAverage);
            const recommendation = recommendationFromAvg(generalAverage);

            return {
                studentId: student.id,
                name: `${student.user.firstName} ${student.user.lastName}`,
                generalAverage,
                lecture,
                calcul,
                dictee,
                pronostic,
                recommendation,
            };
        });

        rows.sort((a, b) => {
            if (a.generalAverage === null) return 1;
            if (b.generalAverage === null) return -1;
            return b.generalAverage - a.generalAverage;
        });

        const total = rows.length;
        const apt = rows.filter((r) => r.pronostic.aptForGrade6).length;
        const mentionBien = rows.filter(
            (r) => r.pronostic.label === "Bien" || r.pronostic.label === "Très Bien"
        ).length;
        const toReinforce = rows.filter((r) => r.pronostic.needsReinforcement).length;
        const successRateEstimate =
            total > 0 ? Math.round((apt / total) * 100) : null;

        return NextResponse.json({
            class: {
                id: klass.id,
                name: klass.name,
                level: klass.classLevel.name,
                size: total,
            },
            metrics: {
                candidatesCount: total,
                successRateEstimate,
                mentionBienProjected: mentionBien,
                toReinforce,
                decInscriptionsSent: total,
                decInscriptionsTotal: total,
            },
            students: rows,
            cyclesInfo: [
                {
                    cycle: "1ᵉʳ cycle",
                    classes: "CI + CP",
                    color: "brand",
                    description: "Apprentissage lecture, écriture, calcul.",
                },
                {
                    cycle: "2ᵉ cycle",
                    classes: "CE1 + CE2",
                    color: "info",
                    description: "Consolidation des fondamentaux.",
                },
                {
                    cycle: "3ᵉ cycle · CEP",
                    classes: "CM1 + CM2",
                    color: "success",
                    description:
                        "Approfondissement & préparation au CEP (passage en 6ᵉ).",
                },
            ],
        });
    
    } catch (error) {
        logger.error("orientation cep:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du calcul du pronostic CEP" },
            { status: 500 }
        );
    }

});
