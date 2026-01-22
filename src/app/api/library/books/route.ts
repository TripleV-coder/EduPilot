import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { libraryService } from "@/lib/library/service";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || undefined;
    const category = searchParams.get('category') || undefined;

    const books = await libraryService.searchBooks(session.user.schoolId, query, category);
    return NextResponse.json(books);
}
