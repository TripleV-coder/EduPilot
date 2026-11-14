import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { jsPDF } from "jspdf";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { z } from "zod";
import type { IncidentSeverity } from "@prisma/client";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { incidentSeverityLabel } from "@/lib/labels/incidents";

/** Gravités dans l'ordre du paramètre « discipline » (1 → 4 ; 5 = jamais bloquant). */
const SEVERITY_ORDER: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
/** Libellé de gravité, le même que partout dans l'application (Mineur → Critique). */
const severityWord = (severity: IncidentSeverity) => incidentSeverityLabel(severity).toLowerCase();

const generateSchema = z.object({
    documentType: z.enum(["CERTIFICATE_ENROLLMENT", "BEHAVIOR_REPORT"]),
    studentId: z.string().min(1).max(64),
    academicYearId: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/documents/generate — certificat de scolarité, attestation de conduite.
 * Documents signés par la direction : réservés à ses rôles (comme la page).
 */

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const parsed = generateSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Type de document ou élève invalide" }, { status: 400 });
        }
        const { documentType, studentId, academicYearId } = parsed.data;

        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: true,
                enrollments: {
                    where: academicYearId ? { academicYearId } : { status: "ACTIVE" },
                    include: {
                        class: { include: { classLevel: true } },
                        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
                    }
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
        // Un certificat de scolarité n'atteste que d'une inscription réelle
        // (il affirmait « régulièrement inscrit en classe de : Non assigné »).
        if (documentType === "CERTIFICATE_ENROLLMENT" && !enrollment) {
            return NextResponse.json(
                { error: "Aucune inscription pour cette année : certificat impossible." },
                { status: 409 }
            );
        }
        // Attestation de bonne conduite (TD-021) : elle n'était émise qu'au vu du
        // nom de l'élève, sans consulter un seul incident. Elle exige désormais
        // une inscription sur l'année et l'absence d'incident d'une gravité égale
        // ou supérieure au seuil réglé par l'école (paramètres › Discipline).
        let conductClause = "";
        if (documentType === "BEHAVIOR_REPORT") {
            if (!enrollment) {
                return NextResponse.json(
                    { error: "Aucune inscription pour cette année : attestation impossible." },
                    { status: 409 }
                );
            }
            const params = await getSchoolParameters(student.schoolId);
            const threshold = params.discipline.conductCertificateBlockingSeverity;
            const blocking = SEVERITY_ORDER.slice(Math.max(0, threshold - 1));
            // Le texte n'affirme que ce qui a été vérifié.
            conductClause =
                threshold <= SEVERITY_ORDER.length
                    ? `N'a fait l'objet d'aucun incident de gravité « ${severityWord(blocking[0])} » ou plus durant l'année scolaire ${enrollment.academicYear.name}.`
                    : `A fait preuve d'une bonne conduite durant l'année scolaire ${enrollment.academicYear.name}.`;
            if (blocking.length > 0 && threshold <= SEVERITY_ORDER.length) {
                const year = enrollment.academicYear;
                const incidents = await prisma.behaviorIncident.findMany({
                    where: {
                        studentId: student.id,
                        severity: { in: blocking },
                        date: { gte: year.startDate, lte: year.endDate },
                    },
                    select: { severity: true },
                });
                if (incidents.length > 0) {
                    return NextResponse.json(
                        {
                            error: `Attestation de bonne conduite impossible : ${incidents.length} incident${incidents.length > 1 ? "s" : ""} de gravité « ${severityWord(blocking[0])} » ou plus sur l'année ${year.name}.`,
                            code: "CONDUCT_INCIDENTS",
                            incidents: incidents.length,
                        },
                        { status: 409 }
                    );
                }
            }
        }
        const school = await prisma.school.findUnique({ where: { id: student.schoolId }, select: { name: true } });

        // Generate PDF
        const doc = new jsPDF();

        doc.setFont("helvetica");
        doc.setFontSize(22);
        doc.setTextColor(33, 37, 41);
        // L'établissement émetteur, pas le logiciel.
        doc.text((school?.name ?? "Établissement").toUpperCase(), 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(108, 117, 125);
        doc.text("Document émis via EduPilot", 105, 26, { align: "center" });

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
            doc.text(doc.splitTextToSize(conductClause, 170), 20, 115);

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
                schoolId: student.schoolId,
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

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
