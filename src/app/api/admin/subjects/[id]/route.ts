import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT: Modifier une matière
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subject belongs to school
    const subject = await prisma.subject.findFirst({
        where: { id: params.id, schoolId: session.user.schoolId },
    });

    if (!subject) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, category, coefficient, isActive } = body;

    const updated = await prisma.subject.update({
        where: { id: params.id },
        data: {
            ...(name && { name }),
            ...(category !== undefined && { category }),
            ...(coefficient !== undefined && { coefficient }),
            ...(isActive !== undefined && { isActive }),
        },
    });

    return NextResponse.json(updated);
}

// DELETE: Supprimer une matière
export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subject belongs to school
    const subject = await prisma.subject.findFirst({
        where: { id: params.id, schoolId: session.user.schoolId },
    });

    if (!subject) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check if subject is used in any class
    const usageCount = await prisma.classSubject.count({
        where: { subjectId: params.id },
    });

    if (usageCount > 0) {
        // Soft delete instead
        await prisma.subject.update({
            where: { id: params.id },
            data: { isActive: false },
        });
        return NextResponse.json({
            message: "Subject deactivated (in use by classes)",
            deactivated: true
        });
    }

    await prisma.subject.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Subject deleted", deleted: true });
}
