import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler, translateError, createPaginatedResponse } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";

// Validation schema for attendance
const attendanceSchema = z.object({
  studentId: z.string().cuid(),
  classId: z.string().cuid(),
  date: z.string().datetime(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: z.string().optional(),
  justificationDocument: z.string().url().optional(),
});

const bulkAttendanceSchema = z.object({
  classId: z.string().cuid(),
  date: z.string().datetime(),
  attendances: z.array(
    z.object({
      studentId: z.string().cuid(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      reason: z.string().optional(),
    })
  ),
});

export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: any = {};

    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (status) where.status = status;

    const userRole = session.user.role;
    if (userRole === "STUDENT") {
      where.studentId = session.user.id;
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });
      if (parentProfile) {
        const childrenIds = parentProfile.children.map((c) => c.studentId);
        where.studentId = { in: childrenIds };
      }
    } else if (userRole === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { classSubjects: true },
      });
      if (teacherProfile) {
        const teacherClassIds = teacherProfile.classSubjects.map((cs) => cs.classId);
        where.classId = { in: teacherClassIds };
      }
    }

    if (session.user.schoolId && userRole !== "SUPER_ADMIN") {
      where.student = {
        user: { schoolId: session.user.schoolId },
      };
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
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
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return createPaginatedResponse(attendances, page, limit, total);
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();

    if (body.attendances && Array.isArray(body.attendances)) {
      // Bulk attendance
      const validatedData = bulkAttendanceSchema.parse(body);

      if (session.user.role === "TEACHER") {
        const teacherProfile = await prisma.teacherProfile.findUnique({
          where: { userId: session.user.id },
          include: { classSubjects: true },
        });

        const hasAccess = teacherProfile?.classSubjects.some(
          (cs) => cs.classId === validatedData.classId
        );

        if (!hasAccess) {
          return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }
      }

      const attendanceRecords = validatedData.attendances.map((att) => ({
        studentId: att.studentId,
        classId: validatedData.classId,
        date: new Date(validatedData.date),
        status: att.status,
        reason: att.reason,
        recordedById: session.user.id,
      }));

      const result = await prisma.attendance.createMany({
        data: attendanceRecords,
        skipDuplicates: true,
      });

      return NextResponse.json(
        {
          message: `${result.count} présences enregistrées`,
          count: result.count,
        },
        { status: 201 }
      );
    } else {
      // Single attendance
      const validatedData = attendanceSchema.parse(body);

      if (session.user.role === "TEACHER") {
        const teacherProfile = await prisma.teacherProfile.findUnique({
          where: { userId: session.user.id },
          include: { classSubjects: true },
        });

        const hasAccess = teacherProfile?.classSubjects.some(
          (cs) => cs.classId === validatedData.classId
        );

        if (!hasAccess) {
          return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: validatedData.studentId,
          classId: validatedData.classId,
          date: new Date(validatedData.date),
          status: validatedData.status,
          reason: validatedData.reason,
          justificationDocument: validatedData.justificationDocument,
          recordedById: session.user.id,
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
        },
      });

      return NextResponse.json(attendance, { status: 201 });
    }
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
  }
);
