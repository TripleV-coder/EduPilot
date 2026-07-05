import { NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { Permission } from "@/lib/rbac/permissions";
import { buildStudentCardData, type StudentCardData } from "@/lib/students/student-card";

/**
 * GET /api/classes/[id]/cards
 * Cartes scolaires de tous les élèves actifs d'une classe (impression en lot).
 */
export const GET = createApiHandler(
    async (_request, context, t) => {
        const { id } = await context.params;
        const { session } = context;

        const klass = await prisma.class.findUnique({
            where: { id },
            select: { schoolId: true, name: true },
        });
        if (!klass) {
            return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Classe"), t), { status: 404 });
        }
        if (!canAccessSchool(session, klass.schoolId)) {
            return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        const school = await prisma.school.findUnique({
            where: { id: klass.schoolId },
            select: { name: true, logo: true, primaryColor: true },
        });
        if (!school) {
            return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Établissement"), t), { status: 404 });
        }

        const enrollments = await prisma.enrollment.findMany({
            where: { classId: id, status: "ACTIVE", student: { deletedAt: null } },
            include: {
                academicYear: { select: { name: true } },
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true, avatar: true } },
                        badge: { select: { code: true, revokedAt: true, validUntil: true } },
                    },
                },
            },
        });

        // Un élève peut avoir plusieurs inscriptions actives (transferts) : on ne
        // garde qu'une carte par élève.
        const seen = new Set<string>();
        const cards: Array<StudentCardData & { qrDataUrl: string }> = [];
        for (const enr of enrollments) {
            if (seen.has(enr.studentId)) continue;
            seen.add(enr.studentId);
            const card = buildStudentCardData({
                student: {
                    matricule: enr.student.matricule,
                    photoUrl: enr.student.user.avatar,
                    firstName: enr.student.user.firstName,
                    lastName: enr.student.user.lastName,
                    dateOfBirth: enr.student.dateOfBirth,
                },
                className: klass.name,
                academicYearLabel: enr.academicYear.name,
                school,
                badge: enr.student.badge,
            });
            const qrDataUrl = await QRCode.toDataURL(card.qrPayload, { margin: 1, width: 256 });
            cards.push({ ...card, qrDataUrl });
        }

        cards.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));

        return NextResponse.json({ className: klass.name, count: cards.length, cards });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_READ],
    },
);
