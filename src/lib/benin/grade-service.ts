import { prisma } from "@/lib/prisma";
import { getMention, calculateWeightedAverage, gradeMentions } from "@/lib/benin/config";

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
                coefficient: g.evaluation.classSubject.subject.coefficient || 1,
                subjectName: g.evaluation.classSubject.subject.name,
            }));

        // Calculer la moyenne pondérée
        const average = calculateWeightedAverage(gradesWithCoef);

        // Obtenir la mention
        const mention = getMention(average);

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
            mention: mention ? { code: mention.code, label: mention.label, color: mention.color } : null,
        };
    }

    /**
     * Calculer le classement d'une classe pour une période
     */
    async getClassRanking(classId: string, periodId: string): Promise<StudentReportCard[]> {
        const enrollments = await prisma.enrollment.findMany({
            where: { classId, status: "ACTIVE" },
            select: { studentId: true },
        });

        const reports: StudentReportCard[] = [];

        for (const enrollment of enrollments) {
            const report = await this.getStudentReportCard(enrollment.studentId, periodId);
            if (report) reports.push(report);
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
    getMentions() {
        return gradeMentions;
    }
}

export const gradeService = new GradeService();
