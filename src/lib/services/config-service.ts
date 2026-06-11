import prisma from "@/lib/prisma";
import { cepSubjects, bepcSubjects, gradeMentions } from "@/lib/benin/config";
import { logger } from "@/lib/utils/logger";

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
            const metadata = config.metadata as Record<string, unknown>;
            if (Array.isArray(metadata.subjects)) {
                return metadata.subjects as ExamSubjectConfig[];
            }
        }

        // Fallback sur les constantes si non configuré en DB.
        // Alerte : en production cela signifie que le seed ConfigOption
        // (category NATIONAL_EXAMS) n'a pas été exécuté au déploiement.
        logger.warn(
            "ConfigOption NATIONAL_EXAMS absente ou invalide — fallback sur la configuration Bénin embarquée",
            { module: "config-service", examType }
        );
        const { cepSubjects, bepcSubjects, bacSubjects } = await import("@/lib/benin/config");
        let fallback;
        if (examType === "CEP") fallback = cepSubjects;
        else if (examType === "BEPC") fallback = bepcSubjects;
        else fallback = bacSubjects;

        return fallback.map((s: { code: string; name: string; defaultCoefficient: number; isPractical?: boolean }) => ({
            code: s.code,
            name: s.name,
            coefficient: s.defaultCoefficient || 1,
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
            const metadata = config.metadata as Record<string, unknown>;
            if (Array.isArray(metadata.mentions)) {
                return metadata.mentions;
            }
        }

        logger.warn(
            "ConfigOption GRADE_SETTINGS/MENTIONS absente — fallback sur les mentions Bénin embarquées",
            { module: "config-service" }
        );
        return gradeMentions;
    }
}

export const configService = new ConfigService();
