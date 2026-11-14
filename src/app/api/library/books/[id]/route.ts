import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";

const bookUpdateSchema = z
    .object({
        title: z.string().trim().min(1).optional(),
        author: z.string().trim().min(1).optional(),
        isbn: z.string().trim().max(20).nullable().optional(),
        category: z.string().trim().max(80).nullable().optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        location: z.string().trim().max(80).nullable().optional(),
        quantity: z.number().int().min(0).max(10_000).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadBook(id: string) {
    return prisma.book.findUnique({ where: { id }, select: { id: true, schoolId: true, title: true, author: true, quantity: true, available: true } });
}

/**
 * PATCH /api/library/books/[id] — corriger une fiche d'ouvrage ou son nombre
 * d'exemplaires. Le stock disponible suit : on ne peut pas descendre sous le
 * nombre d'exemplaires actuellement prêtés.
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = bookUpdateSchema.parse(await request.json());
        const book = await loadBook(id);
        if (!book || !canAccessSchool(session, book.schoolId)) {
            return NextResponse.json({ error: "Ouvrage introuvable" }, { status: 404 });
        }
        let available = book.available;
        if (data.quantity !== undefined && data.quantity !== book.quantity) {
            const lent = book.quantity - book.available;
            if (data.quantity < lent) {
                return NextResponse.json(
                    { error: `${lent} exemplaire(s) sont prêtés : le nombre d'exemplaires ne peut pas descendre en dessous.` },
                    { status: 409 },
                );
            }
            available = data.quantity - lent;
        }
        const updated = await prisma.book.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.author !== undefined ? { author: data.author } : {}),
                ...(data.isbn !== undefined ? { isbn: data.isbn || null } : {}),
                ...(data.category !== undefined ? { category: data.category || null } : {}),
                ...(data.description !== undefined ? { description: data.description || null } : {}),
                ...(data.location !== undefined ? { location: data.location || null } : {}),
                ...(data.quantity !== undefined ? { quantity: data.quantity, available } : {}),
            },
        });
        await createAuditLog({
            userId: session.user.id, action: "BOOK_UPDATED", entity: "Book", entityId: id, schoolId: book.schoolId,
            oldValues: { title: book.title, author: book.author, quantity: book.quantity, available: book.available },
            newValues: { title: updated.title, author: updated.author, quantity: updated.quantity, available: updated.available },
        });
        return NextResponse.json(updated);
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);

/** DELETE /api/library/books/[id] — ouvrage jamais prêté (l'historique des prêts est conservé). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const book = await loadBook(id);
        if (!book || !canAccessSchool(session, book.schoolId)) {
            return NextResponse.json({ error: "Ouvrage introuvable" }, { status: 404 });
        }
        const borrowings = await prisma.borrowingRecord.count({ where: { bookId: id } });
        const conflict = dependencyConflict(
            `l'ouvrage « ${book.title} »`,
            [{ count: borrowings, one: "prêt dans son historique", many: "prêts dans son historique" }],
            "Pour le retirer du rayon, mettez son nombre d'exemplaires à 0.",
        );
        if (conflict) return conflict;
        await prisma.book.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id, action: "BOOK_DELETED", entity: "Book", entityId: id, schoolId: book.schoolId,
            oldValues: { title: book.title, author: book.author },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
