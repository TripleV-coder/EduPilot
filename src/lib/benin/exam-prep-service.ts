import prisma from "@/lib/prisma";
import { configService } from "@/lib/services/config-service";
import { computeAnnualAverages, toDisplay } from "@/lib/academic/average-engine";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";

export interface ExamSubject {
    code: string;
    name: string;
    coefficient: number;
    isPractical: boolean; // Épreuves pratiques (sport, arts)
}

export interface StudentExamReadiness {
    studentId: string;
    studentName: string;
    examType: "CEP" | "BEPC";
    overallReadiness: number; // 0-100%
    subjectReadiness: {
        subject: string;
        averageScore: number;
        trend: "UP" | "DOWN" | "STABLE";
        recommendation: string;
    }[];
    /** Chance estimée d'atteindre la moyenne d'admission (%), null sans aucune note. */
    predictedSuccess: number | null;
    weakAreas: string[];
    strongAreas: string[];
}

// Les définitions par défaut (fallbacks) sont importées de @/lib/benin/config

/**
 * Chance (en %) qu'une moyenne d'examen atteigne `passMark`, la note d'examen
 * étant supposée s'écarter de la moyenne de l'année d'environ `uncertainty`
 * points (loi normale). Bornée à 1–99 % : l'application n'annonce jamais une
 * certitude. Avec 2 points d'écart : 10/20 → 50 %, 12/20 → 84 %, 8/20 → 16 %.
 */
export function examSuccessProbability(average: number, passMark: number, uncertainty: number): number {
    const z = (average - passMark) / Math.max(uncertainty, 0.01);
    return Math.min(99, Math.max(1, Math.round(normalCdf(z) * 100)));
}

/** Fonction de répartition de la loi normale centrée réduite (Abramowitz-Stegun 7.1.26, erreur < 1,5e-7). */
function normalCdf(z: number): number {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export class ExamPrepService {
    /**
     * Analyser la préparation d'un élève à un examen
     */
    async analyzeStudentReadiness(
        studentId: string,
        examType: "CEP" | "BEPC"
    ): Promise<StudentExamReadiness | null> {
        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: { user: { select: { firstName: true, lastName: true } } },
        });

        if (!student) return null;

        // Notes de l'année en cours uniquement (avant : toutes les années mélangées)
        const enrollment = await prisma.enrollment.findFirst({
            where: { studentId, status: "ACTIVE" },
            select: { academicYearId: true },
        });
        if (!enrollment) return null;
        const grades = await prisma.grade.findMany({
            where: { studentId, deletedAt: null, evaluation: { period: { academicYearId: enrollment.academicYearId } } },
            include: {
                evaluation: {
                    include: {
                        classSubject: { include: { subject: true } },
                        period: true,
                        type: { select: { code: true, name: true, category: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const examSubjects = await configService.getExamDefinition(examType);
        const schoolRules = await getGradingSettings(student.schoolId);
        const examParams = (await getSchoolParameters(student.schoolId)).exams;
        // Moyenne d'admission de l'examen : règles de l'établissement (10 par défaut)
        const passMark = examType === "CEP" ? schoolRules.cepPassMark : schoolRules.bepcPassMark;
        const subjectReadiness: StudentExamReadiness["subjectReadiness"] = [];
        const weakAreas: string[] = [];
        const strongAreas: string[] = [];

        for (const examSubject of examSubjects) {
            const subjectGrades = grades.filter(
                g => g.evaluation.classSubject.subject.code === examSubject.code
            );

            // Moyenne de la matière : moteur unique (formule officielle, notes ramenées sur 20,
            // absence non justifiée = 0), moyenne des périodes déjà évaluées
            const annual = computeAnnualAverages(
                subjectGrades.map((g) => ({
                    evaluationId: g.evaluationId,
                    classSubjectId: g.evaluation.classSubjectId,
                    periodId: g.evaluation.periodId,
                    value: g.value,
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                    maxGrade: g.evaluation.maxGrade,
                    type: g.evaluation.type,
                })),
                Array.from(new Set(subjectGrades.map((g) => g.evaluation.classSubjectId)), (id) => ({ id, coefficient: 1 })),
                Array.from(new Set(subjectGrades.map((g) => g.evaluation.periodId)), (id) => ({ id })),
                [],
                { rules: schoolRules.calculation }
            );
            const avgScore = toDisplay(annual.general ?? annual.provisional, schoolRules.calculation.rounding);
            if (avgScore === null) continue;

            // Tendance sur les notes ramenées sur 20 (les plus récentes d'abord ; 0 compris)
            const values = subjectGrades
                .filter((g) => g.value !== null && !g.isAbsent && !g.isExcused && Number(g.evaluation.maxGrade) > 0)
                .map((g) => (Number(g.value) / Number(g.evaluation.maxGrade)) * 20);

            // Calculer la tendance (dernières notes vs premières)
            let trend: "UP" | "DOWN" | "STABLE" = "STABLE";
            if (values.length >= 3) {
                const recentAvg = values.slice(0, Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(values.length / 2);
                const olderAvg = values.slice(Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0) / (values.length - Math.ceil(values.length / 2));
                if (recentAvg > olderAvg + 1) trend = "UP";
                else if (recentAvg < olderAvg - 1) trend = "DOWN";
            }

            // Générer recommandation
            let recommendation = "";
            if (avgScore < passMark) {
                recommendation = `Renforcement intensif requis en ${examSubject.name}`;
                weakAreas.push(examSubject.name);
            } else if (avgScore >= examParams.strongSubjectFrom) {
                recommendation = `Excellent niveau, maintenir l'effort`;
                strongAreas.push(examSubject.name);
            } else {
                recommendation = `Continuer les révisions régulières`;
            }

            subjectReadiness.push({
                subject: examSubject.name,
                averageScore: avgScore,
                trend,
                recommendation,
            });
        }

        // Calculer la préparation globale pondérée par les coefficients
        const totalCoefficients = subjectReadiness.reduce((sum, sr) => {
            const subject = examSubjects.find(es => es.name === sr.subject);
            return sum + (subject?.coefficient || 1);
        }, 0);

        const weightedSum = subjectReadiness.reduce((sum, sr) => {
            const subject = examSubjects.find(es => es.name === sr.subject);
            return sum + (sr.averageScore * (subject?.coefficient || 1));
        }, 0);

        const overallAvg = totalCoefficients > 0 ? weightedSum / totalCoefficients : null;

        const overallReadiness = overallAvg === null ? 0 : Math.min(100, Math.round((overallAvg / 20) * 100));

        // Chance d'atteindre la moyenne d'admission : sans note, pas d'estimation (jamais un faux 5 %)
        const predictedSuccess = overallAvg === null
            ? null
            : examSuccessProbability(overallAvg, passMark, examParams.examUncertainty);

        return {
            studentId,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            examType,
            overallReadiness,
            subjectReadiness,
            predictedSuccess,
            weakAreas,
            strongAreas,
        };
    }

    /**
     * Obtenir les statistiques de préparation d'une classe
     */
    async getClassExamStats(classId: string, examType: "CEP" | "BEPC") {
        const enrollments = await prisma.enrollment.findMany({
            where: { classId, status: "ACTIVE" },
            select: { studentId: true },
        });

        const readinessResults: StudentExamReadiness[] = [];

        for (const e of enrollments) {
            const result = await this.analyzeStudentReadiness(e.studentId, examType);
            if (result) readinessResults.push(result);
        }

        const avgReadiness = readinessResults.length > 0
            ? readinessResults.reduce((a, b) => a + b.overallReadiness, 0) / readinessResults.length
            : 0;

        const classSchoolId = (await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } }))?.schoolId;
        const { examAtRiskBelow, examConfidentFrom } = (await getSchoolParameters(classSchoolId)).exams;
        const atRisk = readinessResults.filter(r => r.predictedSuccess !== null && r.predictedSuccess < examAtRiskBelow);
        const confident = readinessResults.filter(r => r.predictedSuccess !== null && r.predictedSuccess >= examConfidentFrom);

        return {
            totalStudents: readinessResults.length,
            averageReadiness: Math.round(avgReadiness),
            atRiskCount: atRisk.length,
            confidentCount: confident.length,
            students: readinessResults.sort((a, b) => b.overallReadiness - a.overallReadiness),
        };
    }
}

export const examPrepService = new ExamPrepService();
