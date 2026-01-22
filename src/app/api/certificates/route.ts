import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import jsPDF from "jspdf";
import { logger } from "@/lib/utils/logger";

const createCertificateSchema = z.object({
  studentId: z.string().cuid(),
  type: z.enum(["ENROLLMENT", "ATTENDANCE", "CONDUCT", "SUCCESS", "CUSTOM"]),
  academicYearId: z.string().cuid().optional(),
  reason: z.string().optional(),
  customText: z.string().optional(),
});

/**
 * GET /api/certificates
 * List certificates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based filtering
    const userRole = session.user.role;

    if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!studentProfile) {
        return NextResponse.json(
          { error: "Profil élève non trouvé" },
          { status: 404 }
        );
      }
      where.studentId = studentProfile.id;
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });
      if (!parentProfile) {
        return NextResponse.json(
          { error: "Profil parent non trouvé" },
          { status: 404 }
        );
      }
      where.studentId = {
        in: parentProfile.children.map((c) => c.studentId),
      };
    } else if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole)
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Filter by studentId (for admin views)
    if (studentId && ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole)) {
      where.studentId = studentId;
    }

    // Filter by type
    if (type) {
      where.type = type;
    }

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
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
          academicYear: true,
          issuedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.certificate.count({ where }),
    ]);

    return NextResponse.json({
      certificates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching certificates:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des certificats" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/certificates
 * Create and generate a certificate (Admin/Director only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createCertificateSchema.parse(body);

    // Get student info
    const student = await prisma.studentProfile.findUnique({
      where: { id: validatedData.studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            schoolId: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            class: {
              include: {
                classLevel: true,
                school: true,
              },
            },
            academicYear: true,
          },
          take: 1,
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Élève non trouvé" },
        { status: 404 }
      );
    }

    // Generate certificate number
    const year = new Date().getFullYear();
    const count = await prisma.certificate.count({
      where: {
        issuedAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    const certificateNumber = `CERT-${year}-${String(count + 1).padStart(5, "0")}`;

    // Get academic year if not provided
    let academicYearId = validatedData.academicYearId;
    if (!academicYearId && student.enrollments[0]) {
      academicYearId = student.enrollments[0].academicYearId;
    }

    // Generate PDF
    const doc = new jsPDF();
    const school = student.enrollments[0]?.class.school;
    const enrollment = student.enrollments[0];

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(school?.name || "Établissement Scolaire", 105, 30, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (school?.address) {
      doc.text(school.address, 105, 40, { align: "center" });
    }
    if (school?.phone) {
      doc.text(`Tél: ${school.phone}`, 105, 46, { align: "center" });
    }

    // Certificate title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    let certificateTitle = "";
    switch (validatedData.type) {
      case "ENROLLMENT":
        certificateTitle = "CERTIFICAT DE SCOLARITÉ";
        break;
      case "ATTENDANCE":
        certificateTitle = "CERTIFICAT D'ASSIDUITÉ";
        break;
      case "CONDUCT":
        certificateTitle = "CERTIFICAT DE BONNE CONDUITE";
        break;
      case "SUCCESS":
        certificateTitle = "CERTIFICAT DE RÉUSSITE";
        break;
      case "CUSTOM":
        certificateTitle = "CERTIFICAT";
        break;
    }
    doc.text(certificateTitle, 105, 70, { align: "center" });

    // Certificate number
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`N° ${certificateNumber}`, 105, 80, { align: "center" });

    // Body
    doc.setFontSize(12);
    const bodyText = `Le Directeur de ${school?.name || "l'établissement"} certifie que :`;
    doc.text(bodyText, 20, 100);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const studentName = `${student.user.firstName} ${student.user.lastName}`.toUpperCase();
    doc.text(studentName, 105, 115, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Matricule: ${student.matricule}`, 105, 125, { align: "center" });

    if (enrollment) {
      doc.text(
        `Classe: ${enrollment.class.classLevel.name} - ${enrollment.class.name}`,
        105,
        135,
        { align: "center" }
      );
      doc.text(
        `Année scolaire: ${enrollment.academicYear.name}`,
        105,
        145,
        { align: "center" }
      );
    }

    // Type-specific text
    let bodyContent = "";
    switch (validatedData.type) {
      case "ENROLLMENT":
        bodyContent = `est régulièrement inscrit(e) et suit les cours dans notre établissement pour l'année scolaire en cours.`;
        break;
      case "ATTENDANCE":
        bodyContent = `a fait preuve d'une assiduité exemplaire durant l'année scolaire en cours.`;
        break;
      case "CONDUCT":
        bodyContent = `a fait preuve d'une conduite irréprochable et d'un comportement exemplaire durant sa scolarité dans notre établissement.`;
        break;
      case "SUCCESS":
        bodyContent = `a obtenu d'excellents résultats scolaires et mérite nos félicitations.`;
        break;
      case "CUSTOM":
        bodyContent = validatedData.customText || "";
        break;
    }

    const splitBody = doc.splitTextToSize(bodyContent, 170);
    doc.text(splitBody, 20, 160);

    // Reason if provided
    if (validatedData.reason) {
      doc.text("Motif:", 20, 180);
      const splitReason = doc.splitTextToSize(validatedData.reason, 170);
      doc.text(splitReason, 20, 188);
    }

    // Footer
    const today = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    doc.text(`Fait à ${school?.city || "..."}, le ${today}`, 20, 240);

    doc.text("Le Directeur", 150, 260);
    doc.text(`${session.user.firstName} ${session.user.lastName}`, 150, 268);

    // Convert to base64
    const pdfBase64 = doc.output("dataurlstring");

    // Create certificate record
    const certificate = await prisma.certificate.create({
      data: {
        studentId: validatedData.studentId,
        type: validatedData.type,
        academicYearId,
        reason: validatedData.reason,
        issuedById: session.user.id,
        certificateNumber,
        pdfUrl: pdfBase64,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid 1 year
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
        issuedBy: {
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
        userId: student.user.id,
        type: "INFO",
        title: "Nouveau certificat",
        message: `Un certificat de scolarité (${certificateTitle}) a été généré pour vous`,
        link: `/certificates/${certificate.id}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_CERTIFICATE",
        entity: "Certificate",
        entityId: certificate.id,
        newValues: {
          type: validatedData.type,
          studentId: validatedData.studentId,
          certificateNumber,
        },
      },
    });

    return NextResponse.json(certificate, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { status: 400 }
      );
    }

    logger.error(" creating certificate:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du certificat" },
      { status: 500 }
    );
  }
}
