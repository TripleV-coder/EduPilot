import { prisma } from "@/lib/prisma";

export class LibraryService {
    /**
     * Search books in the catalog
     */
    async searchBooks(schoolId: string, query?: string, category?: string) {
        return prisma.book.findMany({
            where: {
                schoolId,
                ...(query && {
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { author: { contains: query, mode: 'insensitive' } },
                    ]
                }),
                ...(category && { category }),
            },
            orderBy: { title: 'asc' },
            take: 50,
        });
    }

    /**
     * Borrow a book
     */
    async borrowBook(userId: string, bookId: string, dueDate: Date) {
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book || book.available < 1) {
            throw new Error("Book not available");
        }

        const [record] = await prisma.$transaction([
            prisma.borrowingRecord.create({
                data: {
                    userId,
                    bookId,
                    dueDate,
                    status: "BORROWED",
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

        if (!record || record.status === "RETURNED") {
            throw new Error("Invalid record");
        }

        const [updated] = await prisma.$transaction([
            prisma.borrowingRecord.update({
                where: { id: recordId },
                data: { status: "RETURNED", returnedAt: new Date() },
            }),
            prisma.book.update({
                where: { id: record.bookId },
                data: { available: { increment: 1 } },
            }),
        ]);

        return updated;
    }

    /**
     * Get user's borrowing history
     */
    async getUserBorrowings(userId: string) {
        return prisma.borrowingRecord.findMany({
            where: { userId },
            include: { book: { select: { title: true, author: true } } },
            orderBy: { borrowedAt: 'desc' },
        });
    }
}

export const libraryService = new LibraryService();
