import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { libraryService } from "@/lib/library/service";

// Helper to get studentProfileId from userId
async function getStudentProfileId(userId: string): Promise<string | null> {
    const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
    });
    return profile?.id ?? null;
}

// Borrow a book
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { bookId, dueDate } = await req.json();

        const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId: session.user.id },
            select: { id: true, schoolId: true },
        });
        if (!studentProfile) {
            return NextResponse.json({ error: "Seuls les élèves peuvent emprunter des livres" }, { status: 403 });
        }

        const book = await prisma.book.findUnique({
            where: { id: bookId },
            select: { id: true, schoolId: true },
        });
        if (!book) {
            return NextResponse.json({ error: "Livre introuvable" }, { status: 404 });
        }
        if (book.schoolId !== studentProfile.schoolId) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const record = await libraryService.borrowBook(
            studentProfile.id,
            bookId,
            new Date(dueDate)
        );
        return NextResponse.json(record);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Borrow failed" }, { status: 400 });
    }
}

// Return a book
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { recordId } = await req.json();
        const recordInfo = await prisma.borrowingRecord.findUnique({
            where: { id: recordId },
            include: { book: { select: { schoolId: true } }, student: { select: { userId: true, schoolId: true } } },
        });

        if (!recordInfo) {
            return NextResponse.json({ error: "Emprunt introuvable" }, { status: 404 });
        }

        if (session.user.role !== "SUPER_ADMIN") {
            if (session.user.role === "STUDENT") {
                if (recordInfo.student.userId !== session.user.id) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            } else if (recordInfo.book.schoolId !== session.user.schoolId) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
        }

        const returned = await libraryService.returnBook(recordId);
        return NextResponse.json(returned);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Return failed" }, { status: 400 });
    }
}

// Get user's borrowing history
export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const studentId = await getStudentProfileId(session.user.id);
        if (!studentId) {
            const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT"];
            if (!allowedRoles.includes(session.user.role)) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            // For non-students (admins, teachers), return all borrowings for the school
            const records = await prisma.borrowingRecord.findMany({
                where: session.user.role === "SUPER_ADMIN"
                    ? {}
                    : { book: { schoolId: session.user.schoolId! } },
                include: {
                    book: { select: { title: true, author: true } },
                    student: { include: { user: { select: { firstName: true, lastName: true } } } }
                },
                orderBy: { borrowedAt: 'desc' },
                take: 100,
            });
            return NextResponse.json(records);
        }

        const records = await libraryService.getStudentBorrowings(studentId);
        return NextResponse.json(records);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Error fetching borrowings" }, { status: 500 });
    }
}
