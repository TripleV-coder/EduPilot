import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { primarySubjects, collegeSubjects, gradeMentions } from "@/lib/benin/config";
import { LEVEL_CYCLES } from "@/lib/benin/levels";

// GET: Récupérer la configuration Bénin (matières, coefficients, mentions)
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
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
}
