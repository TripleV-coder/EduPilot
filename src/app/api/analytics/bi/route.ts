import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roundTo } from "@/lib/analytics/helpers";

/**
 * GET /api/analytics/bi
 * One-shot aggregator for the "Analytics BI" board:
 *  - 4 KPI tiles (students, collection rate, attendance, success)
 *  - 12-month billed-vs-collected series
 *  - Payment-method breakdown (pie)
 *  - Top 5 subjects by average grade
 *  - Last AI insight if available (otherwise null)
 */
export const GET = createApiHandler(
    async (request, { session }) => {
        const { searchParams } = new URL(request.url);
        const schoolId = searchParams.get("schoolId") ?? getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
        }

        const academicYearId = searchParams.get("academicYearId");
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const feeWhere: Prisma.FeeWhereInput = {
            schoolId,
            ...(academicYearId ? { academicYearId } : {}),
        };

        // ── Students count ─────────────────────────────────
        const studentCount = await prisma.studentProfile.count({
            where: {
                user: { schoolId, isActive: true },
            },
        });

        // ── Finance totals + payments ──────────────────────
        const fees = await prisma.fee.findMany({
            where: feeWhere,
            select: { amount: true, createdAt: true },
        });
        const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);

        const payments = await prisma.payment.findMany({
            where: {
                status: { in: ["VERIFIED", "RECONCILED"] },
                fee: feeWhere,
            },
            select: { amount: true, method: true, paidAt: true, createdAt: true },
        });

        const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const collectionRate = totalFees > 0 ? (totalCollected / totalFees) * 100 : 0;

        // ── Payment method breakdown ───────────────────────
        const methodTotals = new Map<string, number>();
        for (const p of payments) {
            const key = p.method ?? "OTHER";
            methodTotals.set(key, (methodTotals.get(key) ?? 0) + Number(p.amount));
        }
        const paymentMix = Array.from(methodTotals.entries())
            .map(([method, amount]) => ({
                method,
                amount: roundTo(amount, 0),
                share: totalCollected > 0 ? roundTo((amount / totalCollected) * 100, 1) : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // ── 12-month billed-vs-collected ───────────────────
        const months: Array<{ key: string; label: string; billed: number; collected: number }> = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: d.toLocaleDateString("fr-FR", { month: "short" }),
                billed: 0,
                collected: 0,
            });
        }
        const monthIndex = new Map(months.map((m, i) => [m.key, i]));
        for (const f of fees) {
            if (f.createdAt < twelveMonthsAgo) continue;
            const k = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth() + 1).padStart(2, "0")}`;
            const idx = monthIndex.get(k);
            if (idx !== undefined) months[idx].billed += Number(f.amount);
        }
        for (const p of payments) {
            const when = p.paidAt ?? p.createdAt;
            if (when < twelveMonthsAgo) continue;
            const k = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
            const idx = monthIndex.get(k);
            if (idx !== undefined) months[idx].collected += Number(p.amount);
        }
        const monthly = months.map((m) => ({
            label: m.label,
            billed: roundTo(m.billed, 0),
            collected: roundTo(m.collected, 0),
        }));

        // ── Attendance rate ────────────────────────────────
        const attendanceAgg = await prisma.attendance.groupBy({
            by: ["status"],
            where: {
                class: { schoolId },
            },
            _count: { _all: true },
        });
        const attendanceTotal = attendanceAgg.reduce((sum, a) => sum + a._count._all, 0);
        const attendancePresent = attendanceAgg
            .filter((a) => a.status === "PRESENT" || a.status === "LATE")
            .reduce((sum, a) => sum + a._count._all, 0);
        const attendanceRate = attendanceTotal > 0 ? (attendancePresent / attendanceTotal) * 100 : 0;

        // ── Pass rate + top subjects from latest StudentAnalytics ──
        const recentAnalytics = await prisma.studentAnalytics.findMany({
            where: {
                student: { user: { schoolId } },
                ...(academicYearId ? { academicYearId } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 500,
            select: {
                studentId: true,
                generalAverage: true,
                createdAt: true,
                subjectPerformances: {
                    select: {
                        average: true,
                        subject: { select: { name: true } },
                    },
                },
            },
        });
        const latestByStudent = new Map<string, typeof recentAnalytics[number]>();
        for (const a of recentAnalytics) {
            if (!latestByStudent.has(a.studentId)) latestByStudent.set(a.studentId, a);
        }
        const latest = Array.from(latestByStudent.values());
        const studentCountWithGrade = latest.length;
        const passing = latest.filter((a) => Number(a.generalAverage ?? 0) >= 10).length;
        const passRate = studentCountWithGrade > 0 ? (passing / studentCountWithGrade) * 100 : 0;

        const subjectTotals = new Map<string, { sum: number; count: number }>();
        for (const a of latest) {
            for (const sp of a.subjectPerformances ?? []) {
                const name = sp.subject?.name ?? "—";
                const value = Number(sp.average ?? 0);
                if (!Number.isFinite(value)) continue;
                const cur = subjectTotals.get(name) ?? { sum: 0, count: 0 };
                cur.sum += value;
                cur.count += 1;
                subjectTotals.set(name, cur);
            }
        }
        const topSubjects = Array.from(subjectTotals.entries())
            .map(([subject, { sum, count }]) => ({
                subject,
                average: roundTo(sum / Math.max(count, 1), 2),
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 5);

        // ── Last AI insight (optional) ─────────────────────
        // No persistent ActionPlan/AI insight model is wired today; expose null
        // so the UI shows its fallback empty state.
        const insight: { headline: string; recommendation: string; createdAt: string } | null = null;

        return NextResponse.json({
            kpis: {
                studentCount,
                collectionRate: roundTo(collectionRate, 1),
                attendanceRate: roundTo(attendanceRate, 1),
                passRate: roundTo(passRate, 1),
            },
            totalCollected: roundTo(totalCollected, 0),
            monthly,
            paymentMix,
            topSubjects,
            insight,
            updatedAt: now.toISOString(),
        });
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.ANALYTICS_VIEW],
    },
);
