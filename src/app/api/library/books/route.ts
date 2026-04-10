import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { libraryService } from "@/lib/library/service";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import prisma from "@/lib/prisma";
import { z } from "zod";

const bookSchema = z.object({
    title: z.string().min(1),
    author: z.string().min(1),
    isbn: z.string().optional(),
    quantity: z.number().int().min(1).default(1),
});

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        const schoolId = getActiveSchoolId(session);
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') || undefined;
        const category = searchParams.get('category') || undefined;

        const books = await libraryService.searchBooks(schoolId || "", query, category);
        return NextResponse.json(books);
    } catch (error) {
        console.error("Library books error:", error);
        return NextResponse.json([]);
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

        const body = await req.json();
        const validated = bookSchema.parse(body);

        const book = await prisma.book.create({
            data: {
                ...validated,
                schoolId,
                available: validated.quantity
            }
        });

        return NextResponse.json(book);
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
