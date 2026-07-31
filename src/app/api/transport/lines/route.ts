import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
    ON_TIME: { label: "À l'heure", variant: "success" },
    DELAYED: { label: "Retardée", variant: "warning" },
    INCIDENT: { label: "Incident", variant: "danger" },
    INACTIVE: { label: "Suspendue", variant: "warning" },
};

/**
 * GET /api/transport/lines
 *
 * Lignes de transport de l'établissement (modèles TransportLine/Bus/
 * BusRoute/StudentTransport — P2.4). `configured` reste false tant que
 * l'école n'a ni ligne ni bus : la page affiche alors son empty state.
 */
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
                { status: 400 }
            );
        }

        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

        const [lines, totalBuses, assignedBuses, transportedStudents, weekIncidents] =
            await Promise.all([
                prisma.transportLine.findMany({
                    where: { schoolId, isActive: true },
                    orderBy: { number: "asc" },
                    include: {
                        buses: {
                            where: { isActive: true },
                            select: { driverName: true },
                            take: 1,
                        },
                        _count: {
                            select: { students: { where: { isActive: true } } },
                        },
                    },
                }),
                prisma.bus.count({ where: { schoolId, isActive: true } }),
                prisma.bus.count({ where: { schoolId, isActive: true, lineId: { not: null } } }),
                prisma.studentTransport.count({
                    where: { isActive: true, line: { schoolId } },
                }),
                prisma.transportLine.count({
                    where: { schoolId, status: "INCIDENT", updatedAt: { gte: weekAgo } },
                }),
            ]);

        const configured = lines.length > 0 || totalBuses > 0;

        return NextResponse.json({
            configured,
            metrics: {
                activeBuses: configured ? assignedBuses : null,
                totalBuses: configured ? totalBuses : null,
                transportedStudents: configured ? transportedStudents : null,
                // Pas de suivi GPS : aucune source réelle de latence — null assumé
                morningLatencyAvg: null,
                weekIncidents: configured ? weekIncidents : null,
            },
            lines: lines.map((line) => {
                const status = STATUS_LABELS[line.status] ?? STATUS_LABELS.ON_TIME;
                return {
                    id: line.id,
                    number: line.number,
                    label: line.label,
                    driverName: line.buses[0]?.driverName ?? null,
                    status: status.label,
                    statusVariant: status.variant,
                    note: line.note,
                    studentCount: line._count.students,
                };
            }),
            notifications: lines
                .filter((line) => line.status !== "ON_TIME" && line.note)
                .map((line) => ({
                    id: line.id,
                    message: `Ligne ${line.number} — ${line.note}`,
                })),
        });
    },
    { requireAuth: true }
);
