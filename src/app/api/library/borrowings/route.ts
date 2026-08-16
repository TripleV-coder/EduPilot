import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { libraryService } from "@/lib/library/service";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

// Helper to get studentProfileId from userId
async function getStudentProfileId(userId: string): Promise<string | null> {
    const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
    });
    return profile?.id ?? null;
}

// Borrow a book
export const POST = createApiHandler(async (request, context) => {
try {
        const session = context.session;
        const { bookId, dueDate } = await request.json();

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

});

// Return a book
export const PUT = createApiHandler(async (request, context) => {
try {
        const session = context.session;
        const { recordId } = await request.json();
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
            } else if (recordInfo.book.schoolId !== getActiveSchoolId(session)) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
        }

        const returned = await libraryService.returnBook(recordId);
        return NextResponse.json(returned);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Return failed" }, { status: 400 });
    }

});

// Get user's borrowing history
export const GET = createApiHandler(async (request, context) => {
try {
        const session = context.session;
        const studentId = await getStudentProfileId(session.user.id);
        if (!studentId) {
            const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT"];
            if (!roleSatisfies(session.user.role, allowedRoles)) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            // For non-students (admins, teachers), return all borrowings for the school
            const records = await prisma.borrowingRecord.findMany({
                where: session.user.role === "SUPER_ADMIN"
                    ? {}
                    : { book: { schoolId: getActiveSchoolId(session)! } },
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

});
