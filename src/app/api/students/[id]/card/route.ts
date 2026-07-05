import { NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { Permission } from "@/lib/rbac/permissions";
import { buildStudentCardData } from "@/lib/students/student-card";

/**
 * GET /api/students/[id]/card
 * Données de la carte scolaire imprimable d'un élève (recto/verso) + QR encodé
 * (data URL). Réutilise le badge d'accès existant ; aucun modèle dédié.
 */
export const GET = createApiHandler(
    async (_request, context, t) => {
        const { id } = await context.params;
        const { session } = context;

        const student = await prisma.studentProfile.findUnique({
            where: { id },
            include: {
                user: { select: { firstName: true, lastName: true, avatar: true, schoolId: true } },
                badge: { select: { code: true, revokedAt: true, validUntil: true } },
                school: { select: { name: true, logo: true, primaryColor: true } },
                enrollments: {
                    where: { status: "ACTIVE", deletedAt: null },
                    include: {
                        class: { select: { name: true } },
                        academicYear: { select: { name: true } },
                    },
                    orderBy: { academicYear: { startDate: "desc" } },
                    take: 1,
                },
            },
        });

        if (!student || student.deletedAt) {
            return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Élève"), t), { status: 404 });
        }
        if (!canAccessSchool(session, student.user.schoolId)) {
            return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        const enrollment = student.enrollments[0];
        const card = buildStudentCardData({
            student: {
                matricule: student.matricule,
                photoUrl: student.user.avatar,
                firstName: student.user.firstName,
                lastName: student.user.lastName,
                dateOfBirth: student.dateOfBirth,
            },
            className: enrollment?.class.name ?? null,
            academicYearLabel: enrollment?.academicYear.name ?? null,
            school: student.school,
            badge: student.badge,
        });

        const qrDataUrl = await QRCode.toDataURL(card.qrPayload, { margin: 1, width: 256 });

        return NextResponse.json({ card: { ...card, qrDataUrl } });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_READ],
    },
);
