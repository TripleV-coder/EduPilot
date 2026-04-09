import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const categorySchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const schoolId = await getActiveSchoolId(session);
        
        const categories = await prisma.subjectCategory.findMany({
            where: {
                OR: [
                    { schoolId: null }, // Global categories
                    { schoolId: schoolId || undefined } // School specific
                ],
                isActive: true,
            },
            orderBy: { order: 'asc' },
        });

        return NextResponse.json(categories);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const schoolId = await getActiveSchoolId(session);
        const body = await req.json();
        const validated = categorySchema.parse(body);

        const category = await prisma.subjectCategory.create({
            data: {
                ...validated,
                schoolId: session.user.role === "SUPER_ADMIN" && !schoolId ? null : schoolId,
            },
        });

        return NextResponse.json(category);
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
