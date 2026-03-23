import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const deleteAccountSchema = z.object({
  reason: z.string().optional(),
  deleteType: z.enum(["SOFT", "HARD"]).default("SOFT"),
  confirmEmail: z.string().email(),
});

/**
 * POST /api/users/[id]/delete
 * Delete user account (RGPD compliant)
 * - SOFT: Anonymize data, keep records for legal requirements
 * - HARD: Complete deletion (only for SUPER_ADMIN)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = deleteAccountSchema.parse(body);

    // Check permissions
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const isOwnAccount = session.user.id === id;

    if (!isSuperAdmin && !isOwnAccount) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que votre propre compte" },
        { status: 403 }
      );
    }

    // Get user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: id },
      include: {
        teacherProfile: true,
        studentProfile: {
          include: {
            enrollments: true,
            grades: true,
            payments: true,
          },
        },
        parentProfile: {
          include: {
            parentStudents: true,
          },
        },
      },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Verify email confirmation
    if (validatedData.confirmEmail !== userToDelete.email) {
      return NextResponse.json(
        { error: "L'email de confirmation ne correspond pas" },
        { status: 400 }
      );
    }

    // Only SUPER_ADMIN can hard delete
    if (validatedData.deleteType === "HARD" && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Seul le super administrateur peut effectuer une suppression complète" },
        { status: 403 }
      );
    }

    // Create audit log before deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `ACCOUNT_DELETE_${validatedData.deleteType}`,
        entity: "User",
        entityId: id,
        oldValues: {
          email: userToDelete.email,
          firstName: userToDelete.firstName,
          lastName: userToDelete.lastName,
          role: userToDelete.role,
          reason: validatedData.reason,
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      },
    });

    if (validatedData.deleteType === "SOFT") {
      // SOFT DELETE: Anonymize user data, keep records
      const anonymizedEmail = `deleted_${id}@anonymized.local`;
      const anonymizedName = "Utilisateur Supprimé";

      await prisma.user.update({
        where: { id: id },
        data: {
          email: anonymizedEmail,
          firstName: anonymizedName,
          lastName: "",
          phone: null,
          avatar: null,
          isActive: false,
          password: "", // Remove password hash
          emailVerified: null,
        },
      });

      // Soft delete related messages
      await prisma.message.updateMany({
        where: {
          OR: [{ senderId: id }, { recipientId: id }],
        },
        data: {
          deletedBySender: true,
          deletedByRecipient: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Compte anonymisé avec succès (suppression douce)",
        type: "SOFT",
      });
    } else {
      // HARD DELETE: Complete removal
      // Delete in correct order to respect foreign key constraints

      // 1. Delete notifications
      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({
          where: { userId: id },
        });

        // 2. Delete messages
        await tx.message.deleteMany({
          where: {
            OR: [{ senderId: id }, { recipientId: id }],
          },
        });

        // 3. Delete student-specific data
        if (userToDelete.studentProfile) {
          await tx.homeworkSubmission.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.attendance.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.grade.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.payment.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.enrollment.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.parentStudent.deleteMany({
            where: { studentId: userToDelete.studentProfile.id },
          });

          await tx.studentProfile.delete({
            where: { id: userToDelete.studentProfile.id },
          });
        }

        // 4. Delete teacher-specific data
        if (userToDelete.teacherProfile) {
          // Unassign from class subjects
          await tx.classSubject.updateMany({
            where: { teacherId: userToDelete.teacherProfile.id },
            data: { teacherId: null },
          });

          // Unassign from main teacher role
          await tx.class.updateMany({
            where: { mainTeacherId: userToDelete.teacherProfile.id },
            data: { mainTeacherId: null },
          });

          await tx.teacherProfile.delete({
            where: { id: userToDelete.teacherProfile.id },
          });
        }

        // 5. Delete parent-specific data
        if (userToDelete.parentProfile) {
          await tx.parentStudent.deleteMany({
            where: { parentId: userToDelete.parentProfile.id },
          });

          await tx.parentProfile.delete({
            where: { id: userToDelete.parentProfile.id },
          });
        }

        // 6. Delete sessions and accounts
        await tx.session.deleteMany({
          where: { userId: id },
        });

        await tx.account.deleteMany({
          where: { userId: id },
        });

        // 7. Keep audit logs (legal requirement)
        // DO NOT delete audit logs

        // 8. Finally delete user
        await tx.user.delete({
          where: { id: id },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Compte supprimé définitivement (suppression complète)",
        type: "HARD",
      });
    }
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" deleting account:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du compte" },
      { status: 500 }
    );
  }
}
