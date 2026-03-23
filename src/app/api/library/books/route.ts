import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { libraryService } from "@/lib/library/service";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        // Allowed if user has schoolId OR is SUPER_ADMIN
        if (!session.user.schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') || undefined;
        const category = searchParams.get('category') || undefined;

        // If Super Admin has no schoolId, they see a global view or we pass undefined
        const books = await libraryService.searchBooks(session.user.schoolId || "", query, category);
        return NextResponse.json(books);
    } catch (error) {
        console.error("Library books error:", error);
        // Return empty array instead of 500 to prevent UI error state
        return NextResponse.json([]);
    }
}
