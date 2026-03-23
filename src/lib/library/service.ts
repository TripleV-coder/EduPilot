import prisma from "@/lib/prisma";

export class LibraryService {
    /**
     * Search books in the catalog
     */
    async searchBooks(schoolId: string, query?: string, category?: string) {
        try {
            return await prisma.book.findMany({
                where: {
                    schoolId,
                    ...(query && {
                        OR: [
                            { title: { contains: query, mode: 'insensitive' as const } },
                            { author: { contains: query, mode: 'insensitive' as const } },
                        ]
                    }),
                    ...(category && { category }),
                },
                orderBy: { title: 'asc' },
                take: 50,
            });
        } catch (error) {
            console.error("LibraryService.searchBooks error:", error);
            return [];
        }
    }

    /**
     * Borrow a book - requires studentProfileId
     */
    async borrowBook(studentId: string, bookId: string, dueDate: Date) {
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book || book.available < 1) {
            throw new Error("Book not available");
        }

        const [record] = await prisma.$transaction([
            prisma.borrowingRecord.create({
                data: {
                    studentId,
                    bookId,
                    dueDate,
                    isPending: true,
                },
            }),
            prisma.book.update({
                where: { id: bookId },
                data: { available: { decrement: 1 } },
            }),
        ]);

        return record;
    }

    /**
     * Return a book
     */
    async returnBook(recordId: string) {
        const record = await prisma.borrowingRecord.findUnique({
            where: { id: recordId },
            include: { book: true },
        });

        if (!record || !record.isPending) {
            throw new Error("Invalid record");
        }

        const [updated] = await prisma.$transaction([
            prisma.borrowingRecord.update({
                where: { id: recordId },
                data: { isPending: false, returnedAt: new Date() },
            }),
            prisma.book.update({
                where: { id: record.bookId },
                data: { available: { increment: 1 } },
            }),
        ]);

        return updated;
    }

    /**
     * Get student's borrowing history
     */
    async getStudentBorrowings(studentId: string) {
        try {
            return await prisma.borrowingRecord.findMany({
                where: { studentId },
                include: { book: { select: { title: true, author: true } } },
                orderBy: { borrowedAt: 'desc' },
            });
        } catch (error) {
            console.error("LibraryService.getStudentBorrowings error:", error);
            return [];
        }
    }
}

export const libraryService = new LibraryService();
