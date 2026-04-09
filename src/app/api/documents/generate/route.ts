import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const body = await request.json();
        const { documentType, studentId, academicYearId } = body;

        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: true,
                enrollments: {
                    where: academicYearId ? { academicYearId } : { status: "ACTIVE" },
                    include: { class: { include: { classLevel: true } } }
                }
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Étudiant non trouvé" }, { status: 404 });
        }
        if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== getActiveSchoolId(session)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const enrollment = student.enrollments[0];

        // Generate PDF
        const doc = new jsPDF();

        doc.setFont("helvetica");
        doc.setFontSize(22);
        doc.setTextColor(33, 37, 41);
        doc.text("EDUPILOT", 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(108, 117, 125);
        doc.text("Système de Gestion Scolaire d'Excellence", 105, 26, { align: "center" });

        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 32, 190, 32);

        if (documentType === "CERTIFICATE_ENROLLMENT") {
            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.text("CERTIFICAT DE SCOLARITÉ", 105, 50, { align: "center" });

            doc.setFontSize(12);
            doc.text(`Je soussigné, le Directeur de l'établissement, certifie que :`, 20, 70);

            doc.setFont("helvetica", "bold");
            doc.text(`L'élève ${student.user.firstName} ${student.user.lastName}`, 20, 85);
            doc.setFont("helvetica", "normal");

            doc.text(`Matricule : ${student.matricule}`, 20, 95);
            doc.text(`Est régulièrement inscrit(e) en classe de : ${enrollment?.class.name || "Non assigné"}`, 20, 105);
            doc.text(`Pour l'année scolaire en cours.`, 20, 115);

            doc.text(`Fait pour servir et valoir ce que de droit.`, 20, 140);
            doc.text(`Le Directeur,`, 150, 160);
        } else if (documentType === "BEHAVIOR_REPORT") {
            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.text("ATTESTATION DE BONNE CONDUITE", 105, 50, { align: "center" });

            doc.setFontSize(12);
            doc.text(`Je soussigné, le Conseiller d'Éducation, certifie que :`, 20, 70);

            doc.setFont("helvetica", "bold");
            doc.text(`L'élève ${student.user.firstName} ${student.user.lastName}`, 20, 85);
            doc.setFont("helvetica", "normal");

            doc.text(`Matricule : ${student.matricule}`, 20, 95);
            doc.text(`Classe : ${enrollment?.class.name || "Non assigné"}`, 20, 105);
            doc.text(`A fait preuve d'une conduite exemplaire durant l'année scolaire.`, 20, 115);

            doc.text(`Fait pour servir et valoir ce que de droit.`, 20, 140);
            doc.text(`Le Conseiller,`, 150, 160);
        }

        const pdfBase64 = doc.output("dataurlstring");

        // Log audit
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "GENERATE",
                entity: "Document",
                entityId: student.id,
                oldValues: undefined,
                newValues: { documentType, studentId }
            }
        });

        return NextResponse.json({
            url: pdfBase64,
            filename: `${documentType}_${student.matricule}.pdf`
        });
    } catch (error) {
        logger.error(" generating document:", error as Error);
        return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
    }
}
