import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { strongPasswordSchema } from "@/lib/validations/auth";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

const studentUpdateSchema = z.object({
  email: z.string().email("Email invalide").optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  password: strongPasswordSchema.optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  classId: z.string().cuid().optional(),
  matricule: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const GET = createApiHandler(
  async (request, context, t) => {
    const { id } = await context.params;
    const { session } = context;

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            schoolId: true,
            school: {
              select: { id: true, name: true },
            },
          },
        },
        enrollments: {
          include: {
            class: {
              include: { classLevel: true },
            },
            academicYear: true,
          },
          orderBy: { academicYear: { startDate: "desc" } },
        },
        parentStudents: {
          include: {
            parent: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true, phone: true },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Élève"), t), { status: 404 });
    }

    // Verify school access for non-super admins
    if (!canAccessSchool(session, student.user.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      const childrenIds = parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
      if (!childrenIds.includes(id)) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    if (session.user.role === "STUDENT") {
      const ownStudentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!ownStudentProfile || ownStudentProfile.id !== id) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    return NextResponse.json(student);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"],
  }
);

export const PATCH = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Élève"), t), { status: 404 });
    }

    // Verify school access
    if (!canAccessSchool(session, student.user.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const body = await request.json();
    const validatedData = studentUpdateSchema.parse(body);

    if (validatedData.classId) {
      const targetClass = await prisma.class.findUnique({
        where: { id: validatedData.classId },
        select: { id: true, schoolId: true },
      });

      if (!targetClass) {
        return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Classe"), t), { status: 404 });
      }

      if (!canAccessSchool(session, targetClass.schoolId)) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    // Update user and student profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user data
      const userData: Record<string, unknown> = {};
      if (validatedData.email) userData.email = validatedData.email;
      if (validatedData.firstName) userData.firstName = validatedData.firstName;
      if (validatedData.lastName) userData.lastName = validatedData.lastName;
      if (validatedData.phone !== undefined) userData.phone = validatedData.phone;
      if (validatedData.isActive !== undefined) userData.isActive = validatedData.isActive;
      if (validatedData.password) {
        userData.password = await bcrypt.hash(validatedData.password, 12);
      }

      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: student.userId },
          data: userData,
        });
      }

      // Update student profile data
      const profileData: Record<string, unknown> = {};
      if (validatedData.dateOfBirth !== undefined) profileData.dateOfBirth = validatedData.dateOfBirth;
      if (validatedData.gender !== undefined) profileData.gender = validatedData.gender;
      if (validatedData.birthPlace !== undefined) profileData.birthPlace = validatedData.birthPlace;
      if (validatedData.nationality !== undefined) profileData.nationality = validatedData.nationality;
      if (validatedData.address !== undefined) profileData.address = validatedData.address;
      if (validatedData.matricule !== undefined) profileData.matricule = validatedData.matricule;

      const updatedStudent = await tx.studentProfile.update({
        where: { id },
        data: profileData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              schoolId: true,
              school: {
                select: { id: true, name: true }
              }
            },
          },
        },
      });

      // Update enrollment if classId is provided
      if (validatedData.classId) {
        const activeEnrollment = await tx.enrollment.findFirst({
          where: {
            studentId: id,
            status: "ACTIVE",
          },
        });

        if (activeEnrollment) {
          await tx.enrollment.update({
            where: { id: activeEnrollment.id },
            data: { classId: validatedData.classId },
          });
        }
      }

      return updatedStudent;
    });

    await invalidateByPath(CACHE_PATHS.students);

    return NextResponse.json(result);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);

export const DELETE = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Élève"), t), { status: 404 });
    }

    // Verify school access
    if (!canAccessSchool(session, student.user.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    // Soft delete: deactivate user instead of permanently deleting all data
    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false },
    });

    await invalidateByPath(CACHE_PATHS.students);

    return NextResponse.json({ success: true, deactivated: true });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
