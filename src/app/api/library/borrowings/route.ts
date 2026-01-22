import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { libraryService } from "@/lib/library/service";

// Borrow a book
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { bookId, dueDate } = await req.json();
        const record = await libraryService.borrowBook(
            session.user.id,
            bookId,
            new Date(dueDate)
        );
        return NextResponse.json(record);
    } catch (_error) {
        return NextResponse.json({ error: "Borrow failed" }, { status: 400 });
    }
}

// Return a book
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { recordId } = await req.json();
        const record = await libraryService.returnBook(recordId);
        return NextResponse.json(record);
    } catch (_error) {
        return NextResponse.json({ error: "Return failed" }, { status: 400 });
    }
}

// Get user's borrowing history
export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const records = await libraryService.getUserBorrowings(session.user.id);
    return NextResponse.json(records);
}
