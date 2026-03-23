import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const gradeSubmissionSchema = z.object({
  grade: z.number().min(0).max(100),
  feedback: z.string().optional(),
});

/**
 * POST /api/homework/submissions/[id]/grade
 * Grade a homework submission (Teachers only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "homeworkSubmission", id, "Soumission non trouvée");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = gradeSubmissionSchema.parse(body);

    // Get submission with homework details
    const submission = await prisma.homeworkSubmission.findUnique({
      where: { id: id },
      include: {
        homework: {
          include: {
            classSubject: {
              select: {
                teacherId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Soumission non trouvée" },
        { status: 404 }
      );
    }

    // Verify teacher can grade this
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacherProfile || submission.homework.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez noter que vos propres devoirs" },
          { status: 403 }
        );
      }
    }

    // Validate grade is within max grade
    if (
      submission.homework.maxGrade &&
      validatedData.grade > Number(submission.homework.maxGrade)
    ) {
      return NextResponse.json(
        { error: `La note ne peut pas dépasser ${submission.homework.maxGrade}` },
        { status: 400 }
      );
    }

    // Update submission with grade
    const gradedSubmission = await prisma.homeworkSubmission.update({
      where: { id: id },
      data: {
        grade: validatedData.grade,
        feedback: validatedData.feedback,
        gradedAt: new Date(),
        gradedById: session.user.id,
      },
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
          },
        },
        homework: {
          include: {
            classSubject: {
              include: {
                subject: true,
              },
            },
          },
        },
        gradedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create notification for student
    await prisma.notification.create({
      data: {
        userId: gradedSubmission.student.user.id,
        type: "GRADE",
        title: "Devoir noté",
        message: `Votre devoir "${gradedSubmission.homework.title}" a été noté: ${validatedData.grade}/${submission.homework.maxGrade || 20}`,
        link: `/homework/${submission.homeworkId}`,
      },
    });

    return NextResponse.json(gradedSubmission);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" grading submission:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la notation du devoir" },
      { status: 500 }
    );
  }
}
