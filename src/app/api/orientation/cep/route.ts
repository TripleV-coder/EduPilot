import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeAnnualAverages, gradedEvaluations, toDisplay, type GradeRecord } from "@/lib/academic/average-engine";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { computeClassAnnual } from "@/lib/academic/class-averages";
import { getGradingSettings, mentionFor, type MentionScale } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

type Variant = "success" | "info" | "neutral" | "warning" | "danger";

/**
 * Pronostic CEP selon les règles de l'école : mention tirée du barème de
 * l'établissement, aptitude à partir du seuil d'admission réglé (10 par défaut).
 */
function pronosticFromAvg(
    avg: number | null,
    passMark: number,
    mentions: MentionScale
): {
    label: string;
    variant: Variant;
    aptForGrade6: boolean;
    needsReinforcement: boolean;
} {
    if (avg === null) {
        return { label: "À évaluer", variant: "neutral", aptForGrade6: false, needsReinforcement: true };
    }
    const apt = avg >= passMark;
    const label = mentionFor(avg, mentions) ?? "—";
    if (avg >= passMark + 4) return { label, variant: "success", aptForGrade6: true, needsReinforcement: false };
    if (apt) return { label, variant: "info", aptForGrade6: true, needsReinforcement: false };
    if (avg >= passMark - 2) return { label, variant: "warning", aptForGrade6: false, needsReinforcement: true };
    return { label, variant: "danger", aptForGrade6: false, needsReinforcement: true };
}

/** Recommandation : paliers 14 / 12 / 10 / 8 au seuil par défaut de 10, décalés avec le seuil de l'école. */
function recommendationFromAvg(avg: number | null, passMark: number): string {
    if (avg === null) return "Évaluation à compléter";
    if (avg >= passMark + 4) return "Apte 6ᵉ";
    if (avg >= passMark + 2) return "Apte 6ᵉ · révision conseillée";
    if (avg >= passMark) return "Soutien · vacances";
    if (avg >= passMark - 2) return "Soutien intensif";
    return "Redoublement à étudier";
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

        const schoolRules = await getGradingSettings(klass.schoolId);

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
                            where: {
                                deletedAt: null,
                                evaluation: { period: { academicYearId } },
                            },
                            include: {
                                evaluation: { include: { classSubject: true, type: true } },
                            },
                        },
                    },
                },
            },
        });

        // Périodes de l'année : (S1 + S2) / 2 ou (T1 + T2 + T3) / 3
        const yearPeriods = await prisma.period.findMany({
            where: { academicYearId },
            select: { id: true },
            orderBy: { sequence: "asc" },
        });
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
        const expected = gradedEvaluations(enrollments.flatMap((e) => toRecords(e.student.grades)));
        // Moyenne générale annuelle : exactement celle du bulletin (règles de l'école,
        // coefficients et règles gelés par les conseils, moyennes d'origine des transférés)
        const classAnnual = await computeClassAnnual({
            classId,
            academicYearId,
            classSubjects: klass.classSubjects.map((cs) => ({ id: cs.id, subjectId: cs.subjectId, coefficient: cs.coefficient })),
        });
        const rules = schoolRules.calculation;

        const rows = enrollments.map((e) => {
            const student = e.student;
            // Moteur unique : formule officielle, calcul exact, moyenne annuelle
            const records = toRecords(student.grades);
            const subjectsOf = (bucket?: "lecture" | "calcul" | "dictee") =>
                klass.classSubjects
                    .filter((cs) => bucket === undefined || csBucket.get(cs.id) === bucket)
                    .map((cs) => ({ id: cs.id, coefficient: cs.coefficient }));
            // Piliers CEP (lecture, calcul, dictée) : même moteur, règles de l'école
            const averageOf = (bucket: "lecture" | "calcul" | "dictee") => {
                const annual = computeAnnualAverages(records, subjectsOf(bucket), yearPeriods, expected, { rules });
                return toDisplay(annual.general ?? annual.provisional, rules.rounding);
            };

            const overall = classAnnual.students.get(student.id);
            const generalAverage = overall ? overall.general ?? overall.provisional : null;
            const averageIsProvisional = !overall || overall.general === null || !overall.annual.complete;
            const lecture = averageOf("lecture");
            const calcul = averageOf("calcul");
            const dictee = averageOf("dictee");

            const pronostic = pronosticFromAvg(generalAverage, schoolRules.cepPassMark, schoolRules.mentions);
            const recommendation = recommendationFromAvg(generalAverage, schoolRules.cepPassMark);

            return {
                studentId: student.id,
                name: `${student.user.firstName} ${student.user.lastName}`,
                generalAverage,
                averageIsProvisional,
                missingGrades: overall?.annual.missing.length ?? 0,
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
        // Élèves projetés au seuil « mention Bien » réglé par l'école (14 par défaut),
        // compté sur la moyenne et non sur un libellé que l'école peut renommer
        const { cepMentionGoodFrom } = (await getSchoolParameters(klass.schoolId)).exams;
        const mentionBien = rows.filter(
            (r) => r.generalAverage !== null && r.generalAverage >= cepMentionGoodFrom
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
                mentionBienFrom: cepMentionGoodFrom,
                toReinforce,
                passMark: schoolRules.cepPassMark,
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

/** Inscrit les élèves actifs de la classe à la session CEP. */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        const body = await request.json().catch(() => ({}));
        const classId = String(body.classId ?? "");
        const academicYearId = String(body.academicYearId ?? "");
        if (!classId || !academicYearId) {
            return NextResponse.json({ error: "classId et academicYearId sont requis" }, { status: 400 });
        }
        const klass = await prisma.class.findFirst({
            where: { id: classId, ...(schoolId ? { schoolId } : {}) },
            select: {
                classLevelId: true,
                enrollments: { where: { status: "ACTIVE" }, select: { studentId: true } },
            },
        });
        if (!klass) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
        let enrolled = 0;
        for (const enrollment of klass.enrollments) {
            await prisma.studentOrientation.upsert({
                where: { studentId_academicYearId: { studentId: enrollment.studentId, academicYearId } },
                create: {
                    studentId: enrollment.studentId,
                    academicYearId,
                    classLevelId: klass.classLevelId,
                },
                update: {},
            });
            enrolled += 1;
        }
        return NextResponse.json({ enrolled }, { status: 201 });
    },
    { allowedRoles: ROLES },
);
