import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createScholarshipSchema = z.object({
  studentId: z.string().cuid(),
  name: z.string().min(3).max(200),
  type: z.enum(["MERIT", "NEED_BASED", "SPORTS", "ARTS", "ACADEMIC_EXCELLENCE", "DISABILITY", "OTHER"]),
  amount: z.number().positive().optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
}).refine(data => data.amount !== undefined || data.percentage !== undefined, {
  message: "Either amount or percentage must be provided",
});

const _updateScholarshipSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  type: z.enum(["MERIT", "NEED_BASED", "SPORTS", "ARTS", "ACADEMIC_EXCELLENCE", "DISABILITY", "OTHER"]).optional(),
  amount: z.number().positive().optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/scholarships - List scholarships
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const isActive = searchParams.get("isActive");

    const where: any = {};

    // Role-based filtering
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!studentProfile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }
      where.studentId = studentProfile.id;
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          children: {
            include: {
              student: true,
            },
          },
        },
      });
      if (!parentProfile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }
      where.studentId = { in: parentProfile.children.map(c => c.student.id) };
    } else if (["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      // Admins see all scholarships for their school
      where.student = {
        enrollments: {
          some: {
            class: {
            },
          },
        },
      };
      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const scholarships = await prisma.scholarship.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            enrollments: {
              where: { status: "ACTIVE" },
              include: {
                class: {
                  include: {
                    classLevel: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(scholarships);
  } catch (error) {
    logger.error(" fetching scholarships:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// POST /api/scholarships - Create scholarship
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createScholarshipSchema.parse(body);

    // Verify student exists and belongs to school
    const student = await prisma.studentProfile.findFirst({
      where: {
        id: validatedData.studentId,
        enrollments: {
          some: {
            class: {
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Étudiant non trouvé" }, { status: 404 });
    }

    const scholarship = await prisma.scholarship.create({
      data: {
        studentId: validatedData.studentId,
        name: validatedData.name,
        type: validatedData.type,
        amount: validatedData.amount || 0,
        percentage: validatedData.percentage,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        isActive: validatedData.isActive,
        notes: validatedData.notes,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Scholarship",
        entityId: scholarship.id,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: student.user.id,
        type: "SUCCESS",
        title: "Bourse accordée",
        message: `Vous avez reçu une bourse: ${scholarship.name} (${scholarship.percentage ? `${scholarship.percentage}%` : `${scholarship.amount}`})`,
        link: `/scholarships/${scholarship.id}`,
      },
    });

    // Notify parents
    if (student.parentLinks.length > 0) {
      await prisma.notification.createMany({
        data: student.parentLinks.map(link => ({
          userId: link.parent.user.id,
          type: "SUCCESS",
          title: "Bourse accordée",
          message: `${student.user.firstName} ${student.user.lastName} a reçu une bourse: ${scholarship.name}`,
          link: `/scholarships/${scholarship.id}`,
        })),
      });
    }

    return NextResponse.json(scholarship, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" creating scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
