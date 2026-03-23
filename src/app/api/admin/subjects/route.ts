import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { primarySubjects, collegeSubjects } from "@/lib/benin/config";

// GET: Liste des matières de l'école
export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subjects = await prisma.subject.findMany({
        where: { schoolId: session.user.schoolId },
        orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(subjects);
}

// POST: Ajouter une matière
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin permission
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, category, coefficient } = body;

    if (!name || !code) {
        return NextResponse.json({ error: "name and code required" }, { status: 400 });
    }

    // Check if code already exists
    const existing = await prisma.subject.findUnique({
        where: { schoolId_code: { schoolId: session.user.schoolId, code } },
    });

    if (existing) {
        return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    }

    const subject = await prisma.subject.create({
        data: {
            schoolId: session.user.schoolId,
            name,
            code: code.toUpperCase(),
            category: category || null,
            coefficient: coefficient || 1,
        },
    });

    return NextResponse.json(subject, { status: 201 });
}

// PUT: Importer les matières standards Bénin
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { type } = body; // "primary" or "college"

    const subjectsToImport = type === "primary" ? primarySubjects : collegeSubjects;
    let created = 0;
    let skipped = 0;

    for (const subj of subjectsToImport) {
        const existing = await prisma.subject.findUnique({
            where: { schoolId_code: { schoolId: session.user.schoolId, code: subj.code } },
        });

        if (existing) {
            skipped++;
            continue;
        }

        await prisma.subject.create({
            data: {
                schoolId: session.user.schoolId,
                name: subj.name,
                code: subj.code,
                category: subj.category,
                coefficient: subj.defaultCoefficient,
            },
        });
        created++;
    }

    return NextResponse.json({ created, skipped, total: subjectsToImport.length });
}
