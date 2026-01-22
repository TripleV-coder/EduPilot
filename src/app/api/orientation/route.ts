import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentOrientationSchema } from "@/lib/validations/orientation";
import { generateOrientationRecommendations } from "@/lib/services/orientation";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";


/**
 * GET /api/orientation
 * Liste des orientations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const academicYearId = searchParams.get("academicYearId");

    const where: any = {};

    // Filtrage par rôle
    if (session.user.role === "STUDENT") {
      // Élève ne peut voir que sa propre orientation
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!studentProfile) {
        return NextResponse.json([]);
      }
      where.studentId = studentProfile.id;
    } else if (session.user.role === "PARENT") {
      // Parent ne peut voir que l'orientation de ses enfants
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          children: {
            select: { studentId: true },
          },
        },
      });
      if (!parentProfile) {
        return NextResponse.json([]);
      }
      where.studentId = {
        in: parentProfile.children.map((c) => c.studentId),
      };
    } else if (session.user.role !== "SUPER_ADMIN") {
      // Pour les autres rôles, filtrer par école
      where.student = {
        user: {
        },
      };
    }

    if (studentId) where.studentId = studentId;
    if (academicYearId) where.academicYearId = academicYearId;

    const orientations = await prisma.studentOrientation.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        academicYear: {
          select: { name: true },
        },
        classLevel: {
          select: { name: true },
        },
        recommendations: {
          orderBy: { rank: "asc" },
        },
        subjectAnalyses: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orientations);
  } catch (error) {
    logger.error("Error fetching orientations", error as Error);
    return NextResponse.json({ error: "Erreur lors de la récupération des orientations", code: "FETCH_ERROR" }, { status: 500 });
  }
}

/**
 * POST /api/orientation
 * Créer une orientation et générer les recommandations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const data = studentOrientationSchema.parse(body);

    // Vérifier que l'élève appartient à l'école (sauf super admin)
    if (session.user.role !== "SUPER_ADMIN") {
      const student = await prisma.studentProfile.findUnique({
        where: { id: data.studentId },
        include: { user: true },
      });

      if (!student || student.user.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Vérifier si une orientation existe déjà
    const existing = await prisma.studentOrientation.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: data.academicYearId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Une orientation existe déjà pour cet élève cette année" },
        { status: 400 }
      );
    }

    // Créer l'orientation
    const orientation = await prisma.studentOrientation.create({
      data: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        classLevelId: data.classLevelId,
        status: "PENDING",
      },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        academicYear: {
          select: { name: true },
        },
        classLevel: {
          select: { name: true },
        },
      },
    });

    // Générer les recommandations en arrière-plan (ou de façon synchrone)
    try {
      await generateOrientationRecommendations(orientation.id);

      // Récupérer l'orientation avec les recommandations
      const orientationWithRecs = await prisma.studentOrientation.findUnique({
        where: { id: orientation.id },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          academicYear: {
            select: { name: true },
          },
          classLevel: {
            select: { name: true },
          },
          recommendations: {
            orderBy: { rank: "asc" },
          },
          subjectAnalyses: true,
        },
      });

      return NextResponse.json(orientationWithRecs, { status: 201 });
    } catch (recError) {
      logger.error("Error generating recommendations", recError as Error);
      // Retourner quand même l'orientation créée
      return NextResponse.json(orientation, { status: 201 });
    }
  } catch (error) {
    logger.error("Error creating orientation", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", code: "VALIDATION_ERROR", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Erreur lors de la création de l'orientation", code: "CREATE_ERROR" }, { status: 500 });
  }
}
