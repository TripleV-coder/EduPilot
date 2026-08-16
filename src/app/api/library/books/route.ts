import { NextRequest, NextResponse } from "next/server";
import { libraryService } from "@/lib/library/service";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";

const bookSchema = z.object({
    title: z.string().min(1),
    author: z.string().min(1),
    isbn: z.string().optional(),
    quantity: z.number().int().min(1).default(1),
});

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
const schoolId = getActiveSchoolId(session);
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || undefined;
        const category = searchParams.get('category') || undefined;

        const books = await libraryService.searchBooks(schoolId || "", query, category);
        return NextResponse.json(books);
    
    } catch (error) {
        console.error("Library books error:", error);
        return NextResponse.json([]);
    }

});

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

        const body = await request.json();
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

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
