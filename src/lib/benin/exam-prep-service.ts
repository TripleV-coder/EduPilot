import prisma from "@/lib/prisma";
import { configService } from "@/lib/services/config-service";
import { cepSubjects, bepcSubjects } from "@/lib/benin/config";

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
    predictedSuccess: number; // 0-100%
    weakAreas: string[];
    strongAreas: string[];
}

// Les définitions par défaut (fallbacks) sont importées de @/lib/benin/config

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

        // Récupérer toutes les notes de l'année
        const grades = await prisma.grade.findMany({
            where: { studentId, deletedAt: null },
            include: {
                evaluation: {
                    include: {
                        classSubject: { include: { subject: true } },
                        period: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const examSubjects = await configService.getExamDefinition(examType);
        const subjectReadiness: StudentExamReadiness["subjectReadiness"] = [];
        const weakAreas: string[] = [];
        const strongAreas: string[] = [];

        for (const examSubject of examSubjects) {
            const subjectGrades = grades.filter(
                g => g.evaluation.classSubject.subject.code === examSubject.code && g.value
            );

            if (subjectGrades.length === 0) continue;

            const values = subjectGrades.map(g => g.value!.toNumber());
            const avgScore = values.reduce((a, b) => a + b, 0) / values.length;

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
            if (avgScore < 10) {
                recommendation = `Renforcement intensif requis en ${examSubject.name}`;
                weakAreas.push(examSubject.name);
            } else if (avgScore >= 14) {
                recommendation = `Excellent niveau, maintenir l'effort`;
                strongAreas.push(examSubject.name);
            } else {
                recommendation = `Continuer les révisions régulières`;
            }

            subjectReadiness.push({
                subject: examSubject.name,
                averageScore: Math.round(avgScore * 100) / 100,
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

        const overallAvg = totalCoefficients > 0 ? weightedSum / totalCoefficients : 0;

        const overallReadiness = Math.min(100, Math.round((overallAvg / 20) * 100));

        // Prédiction de succès (basée sur la moyenne pondérée)
        const predictedSuccess = overallAvg >= 10
            ? Math.min(95, Math.round(50 + (overallAvg - 10) * 5))
            : Math.max(5, Math.round(overallAvg * 5));

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

        const atRisk = readinessResults.filter(r => r.predictedSuccess < 50);
        const confident = readinessResults.filter(r => r.predictedSuccess >= 70);

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
