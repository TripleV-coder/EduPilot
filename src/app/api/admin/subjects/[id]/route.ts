import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

// PUT: Modifier une matière
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subject belongs to school
    const subject = await prisma.subject.findFirst({
        where: { id, schoolId: getActiveSchoolId(session) },
    });

    if (!subject) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, category, coefficient, isActive } = body;

    const updated = await prisma.subject.update({
        where: { id },
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
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subject belongs to school
    const subject = await prisma.subject.findFirst({
        where: { id, schoolId: getActiveSchoolId(session) },
    });

    if (!subject) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check if subject is used in any class
    const usageCount = await prisma.classSubject.count({
        where: { subjectId: id },
    });

    if (usageCount > 0) {
        // Soft delete instead
        await prisma.subject.update({
            where: { id },
            data: { isActive: false },
        });
        return NextResponse.json({
            message: "Subject deactivated (in use by classes)",
            deactivated: true
        });
    }

    await prisma.subject.delete({ where: { id } });
    return NextResponse.json({ message: "Subject deleted", deleted: true });
}
