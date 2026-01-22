import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const templateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    type: z.enum(["TEACHERS", "STUDENTS", "CLASSES", "PARENTS"]),
    mappings: z.record(z.string(), z.string()),
});

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const schoolId = session.user.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const templates = await prisma.importTemplate.findMany({
            where: {
                schoolId,
                ...(type && { type: type as any }),
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(templates);
    } catch (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = templateSchema.parse(body);

        const schoolId = session.user.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const template = await prisma.importTemplate.create({
            data: {
                schoolId,
                createdById: session.user.id,
                name: validatedData.name,
                type: validatedData.type as any,
                mappings: validatedData.mappings as any,
            },
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("Error creating template:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation failed", details: error.issues },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
