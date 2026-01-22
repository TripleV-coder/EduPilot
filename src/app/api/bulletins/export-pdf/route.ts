import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateWeightedAverage, getAppreciation } from "@/lib/utils/grades";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/bulletins/export-pdf
 * Export bulletin as PDF
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { studentId, periodId } = body;

    if (!studentId || !periodId) {
      return NextResponse.json(
        { error: "studentId et periodId requis" },
        { status: 400 }
      );
    }

    // Check access rights
    const userRole = session.user.role;
    if (userRole === "STUDENT" && studentId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const childrenIds = parentProfile?.children.map((c) => c.studentId) || [];
      if (!childrenIds.includes(studentId)) {
        return NextResponse.json(
          { error: "Cet élève n'est pas votre enfant" },
          { status: 403 }
        );
      }
    }

    // Get student data
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
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

    const enrollment = student.enrollments[0];
    if (!enrollment) {
      return NextResponse.json(
        { error: "Élève non inscrit" },
        { status: 404 }
      );
    }

    // Get period
    const period = await prisma.period.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      return NextResponse.json(
        { error: "Période non trouvée" },
        { status: 404 }
      );
    }

    // Get grades for this period
    const grades = await prisma.grade.findMany({
      where: {
        studentId,
        evaluation: {
          periodId,
        },
      },
      include: {
        evaluation: {
          include: {
            classSubject: {
              include: {
                subject: true,
              },
            },
            type: true,
          },
        },
      },
    });

    // Group grades by subject
    const gradesBySubject = grades.reduce((acc: any, grade) => {
      const subjectId = grade.evaluation.classSubject.subjectId;
      const subjectName = grade.evaluation.classSubject.subject.name;

      if (!acc[subjectId]) {
        acc[subjectId] = {
          name: subjectName,
          grades: [],
        };
      }

      acc[subjectId].grades.push({
        value: grade.value,
        coefficient: grade.evaluation.coefficient,
        isAbsent: grade.isAbsent,
        isExcused: grade.isExcused,
        evaluationType: grade.evaluation.type.name,
      });

      return acc;
    }, {});

    // Calculate averages by subject
    const subjectAverages = Object.entries(gradesBySubject).map(
      ([_subjectId, data]: [string, any]) => {
        const avg = calculateWeightedAverage(data.grades);
        return {
          subject: data.name,
          average: avg !== null ? avg.toFixed(2) : "-",
          appreciation: avg !== null ? getAppreciation(avg) : "-",
        };
      }
    );

    // Calculate general average
    const allGradesData = grades
      .filter((g) => g.value !== null && !g.isAbsent)
      .map((g) => ({
        value: g.value,
        coefficient: g.evaluation.coefficient,
        isAbsent: g.isAbsent,
        isExcused: g.isExcused,
      }));

    const generalAverage = calculateWeightedAverage(allGradesData);

    // Create PDF
    const doc = new jsPDF();

    // Header - School info
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(enrollment.class.school.name, 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (enrollment.class.school.address) {
      doc.text(enrollment.class.school.address, 105, 27, { align: "center" });
    }
    if (enrollment.class.school.phone) {
      doc.text(`Tél: ${enrollment.class.school.phone}`, 105, 33, {
        align: "center",
      });
    }

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BULLETIN SCOLAIRE", 105, 50, { align: "center" });

    // Student info
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Nom: ${student.user.lastName} ${student.user.firstName}`, 20, 65);
    doc.text(`Matricule: ${student.matricule}`, 20, 72);
    doc.text(
      `Classe: ${enrollment.class.classLevel.name} - ${enrollment.class.name}`,
      20,
      79
    );
    doc.text(`Année: ${enrollment.academicYear.name}`, 20, 86);
    doc.text(`Période: ${period.name}`, 20, 93);

    // Grades table
    const tableData = subjectAverages.map((item) => [
      item.subject,
      item.average,
      item.appreciation,
    ]);

    autoTable(doc, {
      startY: 105,
      head: [["Matière", "Moyenne", "Appréciation"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202], fontStyle: "bold" },
      styles: { fontSize: 10 },
    });

    // General average
    const finalY = (doc as any).lastAutoTable.finalY || 105;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Moyenne Générale: ${generalAverage !== null ? generalAverage.toFixed(2) : "-"}/20`,
      20,
      finalY + 15
    );

    if (generalAverage !== null) {
      doc.setFont("helvetica", "normal");
      doc.text(
        `Appréciation: ${getAppreciation(generalAverage)}`,
        20,
        finalY + 23
      );
    }

    // Footer
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Édité le ${new Date().toLocaleDateString("fr-FR")}`,
      105,
      280,
      { align: "center" }
    );

    // Generate PDF as base64
    const pdfBase64 = doc.output("datauristring");

    return NextResponse.json(
      {
        success: true,
        pdf: pdfBase64,
        filename: `bulletin_${student.matricule}_${period.name}.pdf`,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(" generating PDF:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
