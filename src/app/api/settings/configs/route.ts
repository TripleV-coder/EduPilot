import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const configSchema = z.object({
    category: z.string().min(1),
    code: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
    metadata: z.any().optional(),
});

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const schoolId = await getActiveSchoolId(session);
        
        const configs = await prisma.configOption.findMany({
            where: { schoolId: schoolId || undefined },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json(configs);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session || !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const schoolId = await getActiveSchoolId(session);
        const body = await req.json();
        const validated = configSchema.parse(body);

        // Since there is no unique constraint on schoolId + code, we use findFirst
        const existing = await prisma.configOption.findFirst({
            where: {
                schoolId: schoolId || null,
                code: validated.code,
                category: validated.category,
            }
        });

        let config;
        if (existing) {
             config = await prisma.configOption.update({
                where: { id: existing.id },
                data: {
                    ...validated,
                    metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined
                },
             });
        } else {
             config = await prisma.configOption.create({
                data: {
                    ...validated,
                    schoolId: schoolId || null,
                    metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined
                },
             });
        }

        return NextResponse.json(config);
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
