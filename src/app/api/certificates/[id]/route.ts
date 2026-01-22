import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/certificates/[id]
 * Get certificate details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: params.id },
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
        academicYear: true,
        issuedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificat non trouvé" },
        { status: 404 }
      );
    }

    // Check access
    const userRole = session.user.role;

    if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (certificate.studentId !== studentProfile?.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });
      const childrenIds = parentProfile?.children.map((c) => c.studentId) || [];
      if (!childrenIds.includes(certificate.studentId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole)
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(certificate);
  } catch (error) {
    logger.error(" fetching certificate:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du certificat" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/certificates/[id]
 * Delete certificate (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: params.id },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificat non trouvé" },
        { status: 404 }
      );
    }

    await prisma.certificate.delete({
      where: { id: params.id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_CERTIFICATE",
        entity: "Certificate",
        entityId: params.id,
        oldValues: {
          certificateNumber: certificate.certificateNumber,
          type: certificate.type,
        },
      },
    });

    return NextResponse.json({
      message: "Certificat supprimé avec succès",
    });
  } catch (error) {
    logger.error(" deleting certificate:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du certificat" },
      { status: 500 }
    );
  }
}
