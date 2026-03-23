import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/payments/[id]/invoice
 * Generate payment invoice/receipt as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get payment with all details
    const payment = await prisma.payment.findUnique({
      where: { id: id },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
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
              },
              take: 1,
            },
          },
        },
        fee: {
          include: {
            school: true,
            academicYear: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    // Check access
    const userRole = session.user.role;
    if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (payment.studentId !== studentProfile?.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { parentStudents: true },
      });
      const childrenIds = parentProfile?.parentStudents.map((c) => c.studentId) || [];
      if (!childrenIds.includes(payment.studentId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(
        userRole
      )
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (userRole !== "SUPER_ADMIN" && payment.fee.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Generate PDF
    const doc = new jsPDF();
    const school = payment.fee.school;
    const student = payment.student;
    const enrollment = student.enrollments[0];

    // Header with school logo/info
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(school.name, 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (school.address) {
      doc.text(school.address, 105, 28, { align: "center" });
    }
    if (school.phone) {
      doc.text(`Tél: ${school.phone}`, 105, 34, { align: "center" });
    }
    if (school.email) {
      doc.text(`Email: ${school.email}`, 105, 40, { align: "center" });
    }

    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    // Invoice title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REÇU DE PAIEMENT", 105, 55, { align: "center" });

    // Invoice number and date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`N° Reçu: ${payment.id.substring(0, 12).toUpperCase()}`, 20, 65);
    doc.text(
      `Date: ${payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("fr-FR") : 'N/A'}`,
      20,
      71
    );
    if (payment.reference) {
      doc.text(`Référence: ${payment.reference}`, 20, 77);
    }

    // Student information box
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 85, 170, 35, "F");
    doc.setFont("helvetica", "bold");
    doc.text("INFORMATIONS ÉLÈVE", 25, 92);

    doc.setFont("helvetica", "normal");
    doc.text(
      `Nom: ${student.user.firstName} ${student.user.lastName}`,
      25,
      100
    );
    doc.text(`Matricule: ${student.matricule}`, 25, 106);
    if (enrollment) {
      doc.text(
        `Classe: ${enrollment.class.classLevel.name} - ${enrollment.class.name}`,
        25,
        112
      );
    }

    // Payment details table
    const tableData = [
      [
        payment.fee.name,
        payment.fee.description || "",
        `${Number(payment.fee.amount).toLocaleString("fr-FR")} FCFA`,
        `${Number(payment.amount).toLocaleString("fr-FR")} FCFA`,
      ],
    ];

    autoTable(doc, {
      startY: 130,
      head: [["Désignation", "Description", "Montant dû", "Montant payé"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
      },
    });

    // Payment information
    let finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.text("INFORMATIONS DE PAIEMENT", 20, finalY);

    doc.setFont("helvetica", "normal");
    finalY += 7;

    const paymentMethodLabels: Record<string, string> = {
      CASH: "Espèces",
      MOBILE_MONEY_MTN: "Mobile Money MTN",
      MOBILE_MONEY_MOOV: "Mobile Money Moov",
      BANK_TRANSFER: "Virement bancaire",
      CHECK: "Chèque",
      OTHER: "Autre",
    };

    doc.text(
      `Méthode de paiement: ${paymentMethodLabels[payment.method] || payment.method}`,
      20,
      finalY
    );
    finalY += 6;

    if (payment.receivedBy) {
      doc.text(`Reçu par: ${payment.receivedBy}`, 20, finalY);
      finalY += 6;
    }

    if (payment.notes) {
      doc.text("Notes:", 20, finalY);
      const splitNotes = doc.splitTextToSize(payment.notes, 170);
      doc.text(splitNotes, 20, finalY + 6);
      finalY += 6 + splitNotes.length * 5;
    }

    // Total box
    finalY += 5;
    doc.setFillColor(66, 139, 202);
    doc.rect(120, finalY, 70, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL PAYÉ:", 125, finalY + 6);
    doc.text(
      `${Number(payment.amount).toLocaleString("fr-FR")} FCFA`,
      185,
      finalY + 6,
      { align: "right" }
    );

    // Footer
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    finalY += 25;
    doc.text(
      "Ce reçu fait foi de paiement. À conserver précieusement.",
      105,
      finalY,
      { align: "center" }
    );

    // Signature area
    finalY += 15;
    doc.setFont("helvetica", "normal");
    doc.text("Le Comptable", 150, finalY);
    doc.line(140, finalY + 15, 180, finalY + 15);

    // Watermark
    doc.setFontSize(50);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "bold");
    doc.text("PAYÉ", 105, 150, {
      align: "center",
      angle: 45,
    });

    // Convert to base64
    const pdfBase64 = doc.output("dataurlstring");

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      filename: `facture_${payment.id.substring(0, 8)}_${student.matricule}.pdf`,
    });
  } catch (error) {
    logger.error(" generating invoice:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de la facture" },
      { status: 500 }
    );
  }
}
