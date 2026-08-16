import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const GET = createApiHandler(
    async (request, { session }) => {
        const url = new URL(request.url);
        const requestedSchoolId = url.searchParams.get("schoolId");
        const accessError = ensureRequestedSchoolAccess(session, requestedSchoolId);
        if (accessError) return accessError;

        const schoolId = requestedSchoolId ?? getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json(
                { error: "Aucun établissement actif associé au compte." },
                { status: 400 },
            );
        }

        const [campaigns, monthCount, dispatched] = await Promise.all([
            prisma.voiceCampaign.findMany({
                where: { schoolId },
                orderBy: { createdAt: "desc" },
                take: 10,
                include: {
                    translations: {
                        select: { lang: true, audioUrl: true },
                    },
                },
            }),
            prisma.voiceCampaign.count({
                where: {
                    schoolId,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.voiceCampaign.aggregate({
                where: { schoolId, status: { in: ["DISPATCHED", "COMPLETED"] } },
                _sum: {
                    audienceSize: true,
                    reachedCount: true,
                    listenedCount: true,
                    costFcfa: true,
                },
            }),
        ]);

        const reachRate =
            dispatched._sum.audienceSize && dispatched._sum.audienceSize > 0
                ? ((dispatched._sum.reachedCount ?? 0) / dispatched._sum.audienceSize) * 100
                : null;
        const listenRate =
            dispatched._sum.reachedCount && dispatched._sum.reachedCount > 0
                ? ((dispatched._sum.listenedCount ?? 0) / dispatched._sum.reachedCount) * 100
                : null;
        const avgCostFcfa =
            dispatched._sum.audienceSize && dispatched._sum.audienceSize > 0
                ? (dispatched._sum.costFcfa ?? 0) / dispatched._sum.audienceSize
                : null;

        return NextResponse.json(
            {
                schoolId,
                kpis: {
                    campaignsThisMonth: monthCount,
                    audienceTotal: dispatched._sum.audienceSize ?? 0,
                    reachRate,
                    listenRate,
                    avgCostFcfa,
                },
                campaigns: campaigns.map((c) => ({
                    id: c.id,
                    templateKind: c.templateKind,
                    textFr: c.textFr,
                    status: c.status,
                    audienceSize: c.audienceSize,
                    reachedCount: c.reachedCount,
                    listenedCount: c.listenedCount,
                    dispatchedAt: c.dispatchedAt?.toISOString() ?? null,
                    createdAt: c.createdAt.toISOString(),
                    languages: c.translations.map((t) => t.lang),
                })),
            },
            {
                headers: {
                    "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
                },
            },
        );
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
