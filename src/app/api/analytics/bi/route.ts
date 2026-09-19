import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roundTo } from "@/lib/analytics/helpers";
import { collectedByLocalMonth, latestSnapshotStats } from "@/lib/services/analytics/bi-aggregates";

function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET /api/analytics/bi
 * One-shot aggregator for the "Analytics BI" board:
 *  - 4 KPI tiles (students, collection rate, attendance, success)
 *  - 12-month billed-vs-collected series
 *  - Payment-method breakdown (pie)
 *  - Top 5 subjects by average grade
 *  - Last AI insight if available (otherwise null)
 *
 * Paiements et analyses sont agrégés par PostgreSQL (M5) : rien n'est chargé
 * ligne à ligne, et le taux de réussite porte sur le dernier instantané de
 * CHAQUE élève (il était calculé sur les 500 plus récents seulement).
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
        const scope = { schoolId, academicYearId };

        const [studentCount, fees, collectedByMethod, collectedByMonth, attendanceAgg, snapshots] = await Promise.all([
            prisma.studentProfile.count({
                where: {
                    user: { schoolId, isActive: true },
                },
            }),
            // Définitions de frais (par niveau et par nature) : quelques dizaines par
            // établissement, bornées par nature — pas de ligne par élève.
            prisma.fee.findMany({
                where: feeWhere,
                select: { amount: true, createdAt: true },
            }),
            prisma.payment.groupBy({
                by: ["method"],
                where: {
                    status: { in: ["VERIFIED", "RECONCILED"] },
                    fee: feeWhere,
                },
                _sum: { amount: true },
            }),
            collectedByLocalMonth(scope, twelveMonthsAgo),
            prisma.attendance.groupBy({
                by: ["status"],
                where: {
                    class: { schoolId },
                },
                _count: { _all: true },
            }),
            latestSnapshotStats(scope),
        ]);

        // ── Finance totals + payment method breakdown ──────
        const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);
        const totalCollected = collectedByMethod.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
        const collectionRate = totalFees > 0 ? (totalCollected / totalFees) * 100 : 0;

        const paymentMix = collectedByMethod
            .map((row) => {
                const amount = Number(row._sum.amount ?? 0);
                return {
                    method: row.method,
                    amount: roundTo(amount, 0),
                    share: totalCollected > 0 ? roundTo((amount / totalCollected) * 100, 1) : 0,
                };
            })
            .sort((a, b) => b.amount - a.amount);

        // ── 12-month billed-vs-collected ───────────────────
        const months: Array<{ key: string; label: string; billed: number; collected: number }> = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            months.push({
                key: monthKey(d),
                label: d.toLocaleDateString("fr-FR", { month: "short" }),
                billed: 0,
                collected: 0,
            });
        }
        const monthIndex = new Map(months.map((m, i) => [m.key, i]));
        for (const f of fees) {
            if (f.createdAt < twelveMonthsAgo) continue;
            const idx = monthIndex.get(monthKey(f.createdAt));
            if (idx !== undefined) months[idx].billed += Number(f.amount);
        }
        for (const row of collectedByMonth) {
            const idx = monthIndex.get(row.month);
            if (idx !== undefined) months[idx].collected += row.amount;
        }
        const monthly = months.map((m) => ({
            label: m.label,
            billed: roundTo(m.billed, 0),
            collected: roundTo(m.collected, 0),
        }));

        // ── Attendance rate ────────────────────────────────
        const attendanceTotal = attendanceAgg.reduce((sum, a) => sum + a._count._all, 0);
        const attendancePresent = attendanceAgg
            .filter((a) => a.status === "PRESENT" || a.status === "LATE")
            .reduce((sum, a) => sum + a._count._all, 0);
        const attendanceRate = attendanceTotal > 0 ? (attendancePresent / attendanceTotal) * 100 : 0;

        // ── Pass rate + top subjects from latest StudentAnalytics ──
        const passRate = snapshots.total > 0 ? (snapshots.passing / snapshots.total) * 100 : 0;
        const topSubjects = snapshots.subjects
            .map((row) => ({ subject: row.subject ?? "—", average: roundTo(row.average, 2) }))
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
