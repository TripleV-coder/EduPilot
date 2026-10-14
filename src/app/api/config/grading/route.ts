/**
 * Règles de l'établissement (calcul des moyennes, mentions, options, orientation).
 * GET : toute l'équipe de l'école (lecture) ; PUT : direction uniquement.
 * Validation stricte (choix bornés, cohérence), changement tracé (avant / après).
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isZodError } from "@/lib/is-zod-error";
import {
    DEFAULT_GRADING_SETTINGS,
    getGradingSettings,
    getPassingGrade,
    gradingSettingsSchema,
    saveGradingSettings,
} from "@/lib/academic/grading-settings";
import { periodsCountFor } from "@/lib/academic/period-rules";
import { validateFormula } from "@/lib/academic/formula";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";

const READ_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF"];
const WRITE_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

export const GET = createApiHandler(
    async (_request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        const [settings, passingGrade, config] = await Promise.all([
            getGradingSettings(schoolId),
            getPassingGrade(schoolId),
            prisma.academicConfig.findUnique({ where: { schoolId }, select: { periodType: true } }),
        ]);
        const periodType = config?.periodType ?? "TRIMESTER";
        return NextResponse.json({
            settings,
            defaults: DEFAULT_GRADING_SETTINGS,
            passingGrade,
            periodType,
            periodsCount: periodsCountFor(periodType),
            canEdit: roleSatisfies(context.session.user.role, WRITE_ROLES),
        });
    },
    { allowedRoles: READ_ROLES },
);

export const PUT = createApiHandler(
    async (request, context) => {
        const session = context.session;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        try {
            const settings = gradingSettingsSchema.parse(await request.json());

            // Formule annuelle : uniquement les périodes qui existent dans l'année de l'école
            const config = await prisma.academicConfig.findUnique({
                where: { schoolId },
                select: { periodType: true },
            });
            const periods = periodsCountFor(config?.periodType ?? "TRIMESTER") ?? 3;
            const annualCheck = validateFormula(settings.calculation.annualFormula, "ANNUAL", periods);
            if (!annualCheck.ok) {
                return NextResponse.json(
                    { error: `Moyenne annuelle : ${annualCheck.error}`, code: "ANNUAL_FORMULA_INVALID" },
                    { status: 400 },
                );
            }

            const before = await getGradingSettings(schoolId);
            const saved = await saveGradingSettings(schoolId, settings, session.user.id);

            // Les moyennes enregistrées (tableaux de bord, espace parents) suivent
            // les nouvelles règles : recalcul de l'année en cours en arrière-plan.
            // Les périodes au conseil validé gardent leurs règles gelées.
            const affectsAverages =
                JSON.stringify(before.calculation) !== JSON.stringify(saved.calculation) ||
                JSON.stringify(before.mentions) !== JSON.stringify(saved.mentions);
            let recalculation: "started" | "none" = "none";
            if (affectsAverages) {
                const year = await prisma.academicYear.findFirst({
                    where: { schoolId, isCurrent: true },
                    select: { id: true },
                });
                if (year) {
                    recalculation = "started";
                    void syncAllStudentsForSchool(schoolId, year.id).catch((error: unknown) =>
                        logger.error("Recalcul après changement des règles", error as Error, { schoolId }),
                    );
                }
            }
            return NextResponse.json({ settings: saved, recalculation });
        } catch (error) {
            if (isZodError(error)) {
                // Premier problème, expliqué en français (formule refusée, seuil hors limites…)
                const issue = error.issues[0];
                const where =
                    issue?.path.join(".") === "calculation.subjectFormula"
                        ? "Formule des matières : "
                        : issue?.path.join(".") === "calculation.annualFormula"
                          ? "Moyenne annuelle : "
                          : "";
                return NextResponse.json(
                    { error: issue ? `${where}${issue.message}` : "Réglages invalides", details: error.issues },
                    { status: 400 },
                );
            }
            throw error;
        }
    },
    { allowedRoles: WRITE_ROLES },
);
