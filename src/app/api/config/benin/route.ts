import { NextRequest, NextResponse } from "next/server";
import { primarySubjects, collegeSubjects, gradeMentions } from "@/lib/benin/config";
import { LEVEL_CYCLES } from "@/lib/benin/levels";
import { createApiHandler } from "@/lib/api/api-helpers";

// GET: Récupérer la configuration Bénin (matières, coefficients, mentions)
export const GET = createApiHandler(async (request, context) => {
        const session = context.session;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    switch (type) {
        case "primary":
            return NextResponse.json({
                subjects: primarySubjects,
                mentions: gradeMentions,
                levels: LEVEL_CYCLES.PRIMARY.grades,
                exam: LEVEL_CYCLES.PRIMARY.finalExam,
            });

        case "college":
            return NextResponse.json({
                subjects: collegeSubjects,
                mentions: gradeMentions,
                levels: LEVEL_CYCLES.SECONDARY_COLLEGE.grades,
                exam: LEVEL_CYCLES.SECONDARY_COLLEGE.finalExam,
            });

        case "mentions":
            return NextResponse.json(gradeMentions);

        default:
            return NextResponse.json({
                primary: {
                    subjects: primarySubjects,
                    levels: LEVEL_CYCLES.PRIMARY.grades,
                },
                college: {
                    subjects: collegeSubjects,
                    levels: LEVEL_CYCLES.SECONDARY_COLLEGE.grades,
                },
                mentions: gradeMentions,
            });
    }

});
