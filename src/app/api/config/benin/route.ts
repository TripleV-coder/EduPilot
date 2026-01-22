import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { primarySubjects, collegeSubjects, gradeMentions, levelConfig } from "@/lib/benin/config";

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
                levels: levelConfig.PRIMARY.levels,
                exam: levelConfig.PRIMARY.finalExam,
            });

        case "college":
            return NextResponse.json({
                subjects: collegeSubjects,
                mentions: gradeMentions,
                levels: levelConfig.COLLEGE.levels,
                exam: levelConfig.COLLEGE.finalExam,
            });

        case "mentions":
            return NextResponse.json(gradeMentions);

        default:
            return NextResponse.json({
                primary: {
                    subjects: primarySubjects,
                    levels: levelConfig.PRIMARY.levels,
                },
                college: {
                    subjects: collegeSubjects,
                    levels: levelConfig.COLLEGE.levels,
                },
                mentions: gradeMentions,
            });
    }
}
