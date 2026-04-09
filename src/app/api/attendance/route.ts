import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/attendance
 * List attendance records filtered by studentId, classId, date range.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const classId = searchParams.get("classId");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "500")));
        const activeSchoolId = getActiveSchoolId(session);

        if (!studentId && !classId) {
            return NextResponse.json({ error: "studentId ou classId requis" }, { status: 400 });
        }

        // Build where clause
        const where: Prisma.AttendanceWhereInput = {};

        if (studentId) where.studentId = studentId;
        if (classId) where.classId = classId;

        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to);
        }

        // School isolation for non-super admins
        if (session.user.role !== "SUPER_ADMIN") {
            if (!activeSchoolId) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            where.student = {
                user: { schoolId: activeSchoolId },
            };
        }

        // For parents, restrict to their children only
        if (session.user.role === "PARENT" && studentId) {
            const parentProfile = await prisma.parentProfile.findUnique({
                where: { userId: session.user.id },
                select: {
                    parentStudents: {
                        select: { studentId: true },
                    },
                },
            });

            const childIds = parentProfile?.parentStudents.map((s: { studentId: string }) => s.studentId) || [];
            if (!childIds.includes(studentId)) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
        }

        const records = await prisma.attendance.findMany({
            where,
            select: {
                id: true,
                status: true,
                date: true,
                reason: true,
                class: { select: { id: true, name: true } },
                student: {
                    select: {
                        id: true,
                        matricule: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            },
            orderBy: { date: "desc" },
            take: limit,
        });

        // Transform dates to ISO strings
        const data = records.map((r) => ({
            id: r.id,
            status: r.status,
            date: r.date.toISOString(),
            reason: r.reason,
            class: r.class,
            student: r.student,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        logger.error("Error fetching attendance", error as Error);
        return NextResponse.json({ error: "Erreur lors du chargement de l'assiduité" }, { status: 500 });
    }
}
