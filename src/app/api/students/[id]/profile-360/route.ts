import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { roundTo } from "@/lib/analytics/helpers";
import { Permission } from "@/lib/rbac/permissions";

/**
 * GET /api/students/[id]/profile-360
 * Aggregates everything the "Vue 360°" tab of the student profile needs:
 *  - core stats (average, rank, attendance, payment status)
 *  - subject rows for the current period
 *  - last 5 period averages for the evolution chart
 *  - parents/contacts list
 *  - medical summary
 *  - latest AI/risk insight (when applicable)
 *  - recent activity (audit log + grade + payment events)
 */
export const GET = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;

        const student = await prisma.studentProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true, firstName: true, lastName: true, email: true,
                        phone: true, schoolId: true, isActive: true, avatar: true,
                    },
                },
                enrollments: {
                    where: { status: "ACTIVE" },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        class: {
                            select: {
                                id: true, name: true,
                                _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
                            },
                        },
                        academicYear: { select: { id: true, name: true, isCurrent: true } },
                    },
                },
                parentStudents: {
                    include: {
                        parent: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true, lastName: true,
                                        email: true, phone: true,
                                    },
                                },
                            },
                        },
                    },
                },
                medicalRecord: {
                    include: {
                        allergies: { select: { allergen: true, severity: true } },
                    },
                },
            },
        });

        if (!student || !student.user) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }

        if (!canAccessSchool(session, student.user.schoolId)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const currentEnrollment = student.enrollments[0];
        const classId = currentEnrollment?.class?.id;
        const classSize = currentEnrollment?.class?._count?.enrollments ?? 0;
        const academicYearId = currentEnrollment?.academicYear?.id;

        // ── Latest analytics for this student ────────────────
        const lastAnalytics = academicYearId
            ? await prisma.studentAnalytics.findFirst({
                where: { studentId: id, academicYearId },
                orderBy: { createdAt: "desc" },
                include: {
                    period: { select: { name: true } },
                    subjectPerformances: {
                        include: { subject: { select: { id: true, name: true } } },
                        orderBy: { average: "desc" },
                    },
                },
            })
            : null;

        const evolutionRows = academicYearId
            ? await prisma.studentAnalytics.findMany({
                where: { studentId: id },
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                    period: { select: { name: true } },
                    academicYear: { select: { name: true } },
                },
            })
            : [];

        // Subject coefficients via Subject.coefficient
        const subjectIds = lastAnalytics?.subjectPerformances.map((sp) => sp.subjectId) ?? [];
        const subjectsForCoef = subjectIds.length > 0
            ? await prisma.subject.findMany({
                where: { id: { in: subjectIds } },
                select: { id: true, coefficient: true },
            })
            : [];
        const coefficientBySubject = new Map(
            subjectsForCoef.map((s) => [s.id, Number(s.coefficient ?? 1)]),
        );

        // ── Attendance rate over the year ────────────────────
        const attendanceAgg = classId
            ? await prisma.attendance.groupBy({
                by: ["status"],
                where: { studentId: id, classId },
                _count: { _all: true },
            })
            : [];
        const attendanceTotal = attendanceAgg.reduce((sum, a) => sum + a._count._all, 0);
        const attendancePresent = attendanceAgg
            .filter((a) => a.status === "PRESENT" || a.status === "LATE")
            .reduce((sum, a) => sum + a._count._all, 0);
        const attendanceRate = attendanceTotal > 0 ? (attendancePresent / attendanceTotal) * 100 : null;

        // ── Payment status (any overdue?) ────────────────────
        const overduePayments = await prisma.paymentPlan.findMany({
            where: {
                studentId: id,
                status: "OVERDUE",
            },
            select: { id: true },
        });
        const paymentStatus: "ok" | "late" | "unknown" = overduePayments.length === 0 ? "ok" : "late";

        const subjects = (lastAnalytics?.subjectPerformances ?? []).map((sp) => ({
            subjectId: sp.subjectId,
            name: sp.subject?.name ?? "—",
            coefficient: coefficientBySubject.get(sp.subjectId) ?? 1,
            average: sp.average !== null ? roundTo(Number(sp.average), 2) : null,
            min: sp.minGrade !== null ? Number(sp.minGrade) : null,
            max: sp.maxGrade !== null ? Number(sp.maxGrade) : null,
            isStrength: sp.isStrength,
            isWeakness: sp.isWeakness,
        }));

        const evolution = evolutionRows
            .map((row) => ({
                label: row.period?.name ?? row.academicYear?.name ?? "—",
                average: row.generalAverage !== null ? roundTo(Number(row.generalAverage), 2) : 0,
            }))
            .reverse();

        const parents = student.parentStudents.map((ps) => ({
            firstName: ps.parent.user.firstName ?? "",
            lastName: ps.parent.user.lastName ?? "",
            relationship: ps.relationship,
            email: ps.parent.user.email ?? null,
            phone: ps.parent.user.phone ?? null,
            isPrimary: ps.isPrimary,
        }));

        const medical = student.medicalRecord
            ? {
                bloodType: student.medicalRecord.bloodType,
                conditions: student.medicalRecord.conditions,
                medications: student.medicalRecord.medications,
                allergies: student.medicalRecord.allergies.map((a) => ({
                    allergen: a.allergen,
                    severity: a.severity,
                })),
                notes: student.medicalRecord.notes,
                updatedAt: student.medicalRecord.updatedAt.toISOString(),
            }
            : null;

        // ── Recent activity ──────────────────────────────────
        const recentActivity: Array<{ label: string; at: string; kind: string }> = [];

        if (classId) {
            const recentAttendance = await prisma.attendance.findMany({
                where: { studentId: id, classId },
                orderBy: { date: "desc" },
                take: 2,
                select: { date: true, status: true },
            });
            for (const a of recentAttendance) {
                recentActivity.push({
                    kind: "attendance",
                    label: a.status === "PRESENT" ? "Présence confirmée" : a.status === "ABSENT" ? "Absence enregistrée" : "Retard signalé",
                    at: a.date.toISOString(),
                });
            }
        }

        const recentGrades = await prisma.grade.findMany({
            where: { studentId: id, value: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 2,
            include: {
                evaluation: {
                    select: {
                        title: true,
                        maxGrade: true,
                        classSubject: { select: { subject: { select: { name: true } } } },
                    },
                },
            },
        });
        for (const g of recentGrades) {
            const max = g.evaluation?.maxGrade ? Number(g.evaluation.maxGrade) : 20;
            const subjectName = g.evaluation?.classSubject?.subject?.name ?? "Évaluation";
            recentActivity.push({
                kind: "grade",
                label: `${subjectName} · ${Number(g.value ?? 0).toFixed(1).replace(".", ",")}/${max}`,
                at: g.createdAt.toISOString(),
            });
        }

        const recentPayment = await prisma.payment.findFirst({
            where: { studentId: id, status: { in: ["VERIFIED", "RECONCILED"] } },
            orderBy: { paidAt: "desc" },
            select: { amount: true, paidAt: true, createdAt: true },
        });
        if (recentPayment) {
            recentActivity.push({
                kind: "payment",
                label: `Paiement reçu · ${Number(recentPayment.amount).toLocaleString("fr-FR")} FCFA`,
                at: (recentPayment.paidAt ?? recentPayment.createdAt).toISOString(),
            });
        }

        recentActivity.sort((a, b) => b.at.localeCompare(a.at));

        const stats = {
            averageGrade: lastAnalytics?.generalAverage !== null && lastAnalytics?.generalAverage !== undefined
                ? roundTo(Number(lastAnalytics.generalAverage), 2)
                : null,
            rank: lastAnalytics?.classRank ?? null,
            classSize: lastAnalytics?.classSize ?? classSize,
            attendanceRate: attendanceRate !== null ? roundTo(attendanceRate, 1) : null,
            paymentStatus,
            riskLevel: lastAnalytics?.riskLevel ?? "NONE",
            currentPeriod: lastAnalytics?.period?.name ?? null,
        };

        return NextResponse.json({
            student: {
                id: student.id,
                firstName: student.user.firstName,
                lastName: student.user.lastName,
                avatar: student.user.avatar,
                matricule: student.matricule,
                className: currentEnrollment?.class?.name ?? null,
                academicYearName: currentEnrollment?.academicYear?.name ?? null,
            },
            stats,
            subjects,
            evolution,
            parents,
            medical,
            recentActivity: recentActivity.slice(0, 6),
        });
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.STUDENT_READ],
    },
);
