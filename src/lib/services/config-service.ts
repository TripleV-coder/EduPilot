import prisma from "@/lib/prisma";
import { cepSubjects, bepcSubjects, gradeMentions } from "@/lib/benin/config";

export interface ExamSubjectConfig {
    code: string;
    name: string;
    coefficient: number;
    isPractical: boolean;
}

export class ConfigService {
    /**
     * Récupérer la définition d'un examen (matières et coefficients)
     */
    async getExamDefinition(examType: "CEP" | "BEPC" | "BAC"): Promise<ExamSubjectConfig[]> {
        const config = await prisma.configOption.findFirst({
            where: {
                category: "NATIONAL_EXAMS",
                code: examType,
                isActive: true,
            },
        });

        if (config && config.metadata && typeof config.metadata === "object") {
            const metadata = config.metadata as any;
            if (Array.isArray(metadata.subjects)) {
                return metadata.subjects;
            }
        }

        // Fallback sur les constantes si non configuré en DB
        const { cepSubjects, bepcSubjects, bacSubjects } = await import("@/lib/benin/config");
        let fallback;
        if (examType === "CEP") fallback = cepSubjects;
        else if (examType === "BEPC") fallback = bepcSubjects;
        else fallback = bacSubjects;

        return fallback.map(s => ({
            code: s.code,
            name: s.name,
            coefficient: (s as any).defaultCoefficient || (s as any).coefficient || 1,
            isPractical: s.code === "EPS" || s.code === "EAR",
        }));
    }

    /**
     * Récupérer les mentions de notes
     */
    async getGradeMentions() {
        const config = await prisma.configOption.findFirst({
            where: {
                category: "GRADE_SETTINGS",
                code: "MENTIONS",
                isActive: true,
            },
        });

        if (config && config.metadata && typeof config.metadata === "object") {
            const metadata = config.metadata as any;
            if (Array.isArray(metadata.mentions)) {
                return metadata.mentions;
            }
        }

        return gradeMentions;
    }
}

export const configService = new ConfigService();
