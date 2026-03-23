import prisma from "@/lib/prisma";
import { calculateWeightedAverage } from "@/lib/benin/config";
import { configService } from "@/lib/services/config-service";

export interface GradeWithCoefficient {
    value: number;
    coefficient: number;
    subjectName: string;
}

export interface StudentReportCard {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
    periodId: string;
    periodName: string;
    grades: GradeWithCoefficient[];
    average: number;
    mention: { code: string; label: string; color: string } | null;
    rank?: number;
    totalStudents?: number;
}

export class GradeService {
    /**
     * Obtenir la mention pour une moyenne donnée en utilisant les paramètres globaux
     */
    private async getMentionFromConfig(average: number) {
        const mentions = await configService.getGradeMentions();
        return mentions.find((m: any) => average >= m.minScore && average <= m.maxScore) || null;
    }

    /**
     * Calculer le bulletin d'un élève pour une période
     */
    async getStudentReportCard(
        studentId: string,
        periodId: string
    ): Promise<StudentReportCard | null> {
        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: { select: { firstName: true, lastName: true } },
                enrollments: {
                    where: { status: "ACTIVE" },
                    include: { class: true },
                    take: 1,
                },
            },
        });

        if (!student || student.enrollments.length === 0) return null;

        const enrollment = student.enrollments[0];

        // Récupérer les notes de l'élève pour cette période
        const grades = await prisma.grade.findMany({
            where: {
                studentId,
                deletedAt: null,
                evaluation: { periodId },
            },
            include: {
                evaluation: {
                    include: {
                        classSubject: {
                            include: { subject: true },
                        },
                    },
                },
            },
        });

        // Transformer en format avec coefficients
        const gradesWithCoef: GradeWithCoefficient[] = grades
            .filter(g => g.value !== null)
            .map(g => ({
                value: g.value!.toNumber(),
                coefficient: Number(g.evaluation.classSubject.coefficient) || 1,
                subjectName: g.evaluation.classSubject.subject.name,
            }));

        // Calculer la moyenne pondérée
        const average = calculateWeightedAverage(gradesWithCoef);

        // Obtenir la mention dynamique
        const mention = await this.getMentionFromConfig(average);

        // Récupérer la période
        const period = await prisma.period.findUnique({ where: { id: periodId } });

        return {
            studentId,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            classId: enrollment.classId,
            className: enrollment.class.name,
            periodId,
            periodName: period?.name || "Période",
            grades: gradesWithCoef,
            average,
            mention: mention ? { code: mention.code || "MENTION", label: mention.label, color: mention.color || "#6b7280" } : null,
        };
    }

    /**
     * Calculer le classement d'une classe pour une période
     */
    async getClassRanking(classId: string, periodId: string): Promise<StudentReportCard[]> {
        // Obtenir les mentions une seule fois pour tout le traitement
        const mentions = await configService.getGradeMentions();
        const getMention = (avg: number) => mentions.find((m: any) => avg >= m.minScore && avg <= m.maxScore) || null;

        // Batch query: get all enrollments + student data in one query
        const enrollments = await prisma.enrollment.findMany({
            where: { classId, status: "ACTIVE" },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                    },
                },
                class: true,
            },
        });

        if (enrollments.length === 0) return [];

        const studentIds = enrollments.map(e => e.studentId);

        // Batch query: get ALL grades for ALL students in ONE query
        const allGrades = await prisma.grade.findMany({
            where: {
                studentId: { in: studentIds },
                deletedAt: null,
                evaluation: { periodId },
            },
            include: {
                evaluation: {
                    include: {
                        classSubject: {
                            include: { subject: true },
                        },
                    },
                },
            },
        });

        // Single query for period
        const period = await prisma.period.findUnique({ where: { id: periodId } });

        // Group grades by student and compute averages in memory
        const gradesByStudent = new Map<string, typeof allGrades>();
        for (const grade of allGrades) {
            const existing = gradesByStudent.get(grade.studentId) || [];
            existing.push(grade);
            gradesByStudent.set(grade.studentId, existing);
        }

        const reports: StudentReportCard[] = [];

        for (const enrollment of enrollments) {
            const student = enrollment.student;
            const studentGrades = gradesByStudent.get(enrollment.studentId) || [];

            const gradesWithCoef: GradeWithCoefficient[] = studentGrades
                .filter(g => g.value !== null)
                .map(g => ({
                    value: g.value!.toNumber(),
                    coefficient: Number(g.evaluation.classSubject.coefficient) || 1,
                    subjectName: g.evaluation.classSubject.subject.name,
                }));

            const average = calculateWeightedAverage(gradesWithCoef);
            const mention = getMention(average);

            reports.push({
                studentId: enrollment.studentId,
                studentName: `${student.user.firstName} ${student.user.lastName}`,
                classId: enrollment.classId,
                className: enrollment.class.name,
                periodId,
                periodName: period?.name || "Période",
                grades: gradesWithCoef,
                average,
                mention: mention ? { code: mention.code || "MENTION", label: mention.label, color: mention.color || "#6b7280" } : null,
            });
        }

        // Trier par moyenne décroissante
        reports.sort((a, b) => b.average - a.average);

        // Ajouter le rang
        return reports.map((r, i) => ({
            ...r,
            rank: i + 1,
            totalStudents: reports.length,
        }));
    }

    /**
     * Obtenir les mentions disponibles (configurable)
     */
    async getMentions() {
        return await configService.getGradeMentions();
    }
}

export const gradeService = new GradeService();
