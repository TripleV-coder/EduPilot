import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { z } from "zod";

const updateAttendanceSchema = z.object({
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).optional(),
  reason: z.string().optional(),
  justificationDocument: z.string().url().optional(),
});

/**
 * GET /api/attendance/[id]
 * Get single attendance record
 */
export const GET = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        class: {
          include: {
            classLevel: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!attendance) {
      return NextResponse.json(
        translateError({ error: "Présence non trouvée", key: "api.issues.not_found", params: { resource: "Présence" } }, t),
        { status: 404 }
      );
    }

    // Check access
    const userRole = session.user.role;
    if (userRole === "STUDENT" && attendance.studentId !== session.user.id) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const childrenIds = parentProfile?.children.map((c) => c.studentId) || [];
      if (!childrenIds.includes(attendance.studentId)) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    return NextResponse.json(attendance);
  },
  {
    requireAuth: true,
  }
);

/**
 * PATCH /api/attendance/[id]
 * Update attendance record
 */
export const PATCH = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateAttendanceSchema.parse(body);

    // Check if attendance exists
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!existingAttendance) {
      return NextResponse.json(
        translateError({ error: "Présence non trouvée", key: "api.issues.not_found", params: { resource: "Présence" } }, t),
        { status: 404 }
      );
    }

    // Verify access for teachers
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { classSubjects: true },
      });

      const hasAccess = teacherProfile?.classSubjects.some(
        (cs) => cs.classId === existingAttendance.classId
      );

      if (!hasAccess) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        class: {
          include: {
            classLevel: true,
          },
        },
      },
    });

    return NextResponse.json(updatedAttendance);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
  }
);

/**
 * DELETE /api/attendance/[id]
 * Delete attendance record
 */
export const DELETE = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    // Check if attendance exists
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!existingAttendance) {
      return NextResponse.json(
        translateError({ error: "Présence non trouvée", key: "api.issues.not_found", params: { resource: "Présence" } }, t),
        { status: 404 }
      );
    }

    // Verify access for teachers
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { classSubjects: true },
      });

      const hasAccess = teacherProfile?.classSubjects.some(
        (cs) => cs.classId === existingAttendance.classId
      );

      if (!hasAccess) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    await prisma.attendance.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Présence supprimée avec succès" },
      { status: 200 }
    );
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
  }
);
