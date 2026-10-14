/**
 * Seuils de lecture de l'établissement, pour colorer et qualifier les notes à
 * l'écran (toutes les personnes connectées de l'école, familles comprises) :
 * seuil de passage, niveaux de performance, seuils de suivi, barème des
 * mentions, moyennes d'admission CEP / BEPC. Lecture seule, aucune donnée
 * personnelle ; sans établissement actif : valeurs par défaut.
 */
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { getGradingSettings, getPassingGrade } from "@/lib/academic/grading-settings";
import { getCouncilRules } from "@/lib/academic/council-rules";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { DEFAULT_SCHOOL_THRESHOLDS, type SchoolThresholds } from "@/lib/schools/school-thresholds";

export const GET = createApiHandler(async (_request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json(DEFAULT_SCHOOL_THRESHOLDS);
    const [passingGrade, params, rules, council] = await Promise.all([
        getPassingGrade(schoolId),
        getSchoolParameters(schoolId),
        getGradingSettings(schoolId),
        getCouncilRules(schoolId),
    ]);
    const body: SchoolThresholds = {
        passingGrade,
        performance: params.performance,
        followUp: params.followUp,
        mentions: rules.mentions,
        cepPassMark: rules.cepPassMark,
        bepcPassMark: rules.bepcPassMark,
        council: {
            honorMin: council.honorMin,
            encouragementMin: council.encouragementMin,
            workWarningBelow: council.workWarningBelow,
        },
    };
    return NextResponse.json(body);
});
