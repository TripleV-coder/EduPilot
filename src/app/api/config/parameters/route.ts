/**
 * Paramètres de l'établissement (seuils d'alerte, délais, analyses…).
 * GET : toute l'équipe de l'école (lecture) ; PUT : direction uniquement.
 * Validation stricte (bornes et cohérences), changement tracé (avant / après) ;
 * les analyses de l'année en cours sont recalculées si un seuil les concerne.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isZodError } from "@/lib/is-zod-error";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { DEFAULT_SCHOOL_PARAMETERS, schoolParametersSchema, type SchoolParameters } from "@/lib/schools/school-parameters";
import { getSchoolParameters, saveSchoolParameters } from "@/lib/schools/school-parameters-store";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";

const READ_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF"];
const WRITE_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

export const GET = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        return NextResponse.json({
            parameters: await getSchoolParameters(schoolId),
            defaults: DEFAULT_SCHOOL_PARAMETERS,
            canEdit: roleSatisfies(session.user.role, WRITE_ROLES),
        });
    },
    { allowedRoles: READ_ROLES },
);

export const PUT = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        try {
            const parameters = schoolParametersSchema.parse(await request.json()) as unknown as SchoolParameters;
            const before = await getSchoolParameters(schoolId);
            const saved = await saveSchoolParameters(schoolId, parameters, session.user.id);

            // Niveaux de risque et de performance enregistrés : recalcul de l'année en cours
            // (le climat de l'école et l'alerte « classe absente » ne changent aucune analyse d'élève)
            const riskInputs = ({ climateExcellentBelow: _c1, climateWatchFrom: _c2, classAbsenceAlert: _c3, ...rest }: SchoolParameters["followUp"]) => rest;
            const affectsAnalytics =
                JSON.stringify(before.performance) !== JSON.stringify(saved.performance) ||
                JSON.stringify(riskInputs(before.followUp)) !== JSON.stringify(riskInputs(saved.followUp));
            let recalculation: "started" | "none" = "none";
            if (affectsAnalytics) {
                const year = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
                if (year) {
                    recalculation = "started";
                    void syncAllStudentsForSchool(schoolId, year.id).catch((error: unknown) =>
                        logger.error("Recalcul après changement des paramètres", error as Error, { schoolId }),
                    );
                }
            }
            return NextResponse.json({ parameters: saved, recalculation });
        } catch (error) {
            if (isZodError(error)) {
                const issue = error.issues[0];
                return NextResponse.json({ error: issue?.message ?? "Paramètres invalides", details: error.issues }, { status: 400 });
            }
            throw error;
        }
    },
    { allowedRoles: WRITE_ROLES },
);
