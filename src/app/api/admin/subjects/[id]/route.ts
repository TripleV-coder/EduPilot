import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

// PUT: Modifier une matière
export const PUT = createApiHandler(async (request, context) => {
        const { id } = await context.params;
        const session = context.session;
    if (!session.user.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleSatisfies(session.user.role || "", ["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify subject belongs to school
    const subject = await prisma.subject.findFirst({
        where: { id, schoolId: getActiveSchoolId(session) },
    });

    if (!subject) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const body = await request.json();
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

});

// DELETE: Supprimer une matière
export const DELETE = createApiHandler(async (request, context) => {
        const { id } = await context.params;
        const session = context.session;
    if (!session.user.schoolId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleSatisfies(session.user.role || "", ["ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN"])) {
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

});
