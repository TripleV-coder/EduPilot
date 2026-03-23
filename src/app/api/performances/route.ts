import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        // Allow access to school administrators, directors and teachers
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const url = new URL(request.url);
        const periodId = url.searchParams.get("periodId");
        const academicYearId = url.searchParams.get("academicYearId");

        const schoolConstraint = (session.user.role !== "SUPER_ADMIN" && session.user.schoolId)
            ? { schoolId: session.user.schoolId }
            : {};

        // Find the academic year
        const activeYear = await prisma.academicYear.findFirst({
            where: {
                ...schoolConstraint,
                ...(academicYearId ? { id: academicYearId } : { isCurrent: true })
            }
        });

        if (!activeYear) {
            return NextResponse.json({ error: "Aucune année académique active trouvée." }, { status: 404 });
        }

        // Fetch periods for the active year
        const periods = await prisma.period.findMany({
            where: { academicYearId: activeYear.id },
            orderBy: { startDate: 'asc' }
        });

        const activePeriodId = periodId || (periods.find(p => p.startDate <= new Date() && p.endDate >= new Date())?.id || periods[0]?.id);

        if (!activePeriodId) {
            return NextResponse.json({ error: "Aucune période trouvée." }, { status: 404 });
        }

        // Fetch all classes and their classSubjects and evaluations
        const classes = await prisma.class.findMany({
            where: {
                schoolId: session.user.role !== "SUPER_ADMIN" && session.user.schoolId ? session.user.schoolId : undefined
            },
            include: {
                classLevel: true,
                classSubjects: {
                    include: {
                        subject: true,
                        evaluations: {
                            where: { periodId: activePeriodId },
                            include: {
                                grades: {
                                    where: { isAbsent: false, value: { not: null } }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Compute performance metrics
        let totalGradesCount = 0;
        let totalGradesSum = 0;

        // Detailed metrics by class level, class, and subject
        const levelAverages = new Map<string, { sum: number, count: number, name: string }>();
        const classAverages = new Map<string, { sum: number, count: number, name: string, levelName: string }>();
        const subjectAverages = new Map<string, { sum: number, count: number, name: string }>();

        classes.forEach(cls => {
            let classSum = 0;
            let classCount = 0;

            cls.classSubjects.forEach(cs => {
                let subjectSum = 0;
                let subjectCount = 0;

                cs.evaluations.forEach(ev => {
                    ev.grades.forEach(g => {
                        if (g.value !== null) {
                            const val = Number(g.value);
                            // Assuming base 20 for normalization if needed, but going with raw values
                            subjectSum += val;
                            subjectCount++;
                        }
                    });
                });

                if (subjectCount > 0) {
                    classSum += subjectSum;
                    classCount += subjectCount;
                    totalGradesSum += subjectSum;
                    totalGradesCount += subjectCount;

                    // Update global subject stats
                    const subStat = subjectAverages.get(cs.subject.id) || { sum: 0, count: 0, name: cs.subject.name };
                    subStat.sum += subjectSum;
                    subStat.count += subjectCount;
                    subjectAverages.set(cs.subject.id, subStat);
                }
            });

            if (classCount > 0) {
                // Update class stats
                classAverages.set(cls.id, {
                    sum: classSum,
                    count: classCount,
                    name: cls.name,
                    levelName: cls.classLevel.name
                });

                // Update level stats
                const lvlStat = levelAverages.get(cls.classLevelId) || { sum: 0, count: 0, name: cls.classLevel.name };
                lvlStat.sum += classSum;
                lvlStat.count += classCount;
                levelAverages.set(cls.classLevelId, lvlStat);
            }
        });

        // Format the output
        const overallAverage = totalGradesCount > 0 ? totalGradesSum / totalGradesCount : 0;

        const performanceByLevel = Array.from(levelAverages.values()).map(l => ({
            name: l.name,
            average: l.count > 0 ? Number((l.sum / l.count).toFixed(2)) : 0
        })).sort((a, b) => b.average - a.average);

        const performanceByClass = Array.from(classAverages.values()).map(c => ({
            name: `${c.levelName} ${c.name}`,
            average: c.count > 0 ? Number((c.sum / c.count).toFixed(2)) : 0
        })).sort((a, b) => b.average - a.average).slice(0, 10); // Top 10 classes

        const performanceBySubject = Array.from(subjectAverages.values()).map(s => ({
            name: s.name,
            average: s.count > 0 ? Number((s.sum / s.count).toFixed(2)) : 0
        })).sort((a, b) => b.average - a.average).slice(0, 10); // Top 10 subjects

        return NextResponse.json({
            academicYear: activeYear.name,
            periods: periods.map(p => ({ id: p.id, name: p.name })),
            activePeriodId,
            overallAverage: Number(overallAverage.toFixed(2)),
            totalEvaluations: totalGradesCount,
            performanceByLevel,
            performanceByClass,
            performanceBySubject
        });
    } catch (error) {
        logger.error(" fetching performance stats:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
