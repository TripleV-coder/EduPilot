import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES, isHrManager, computePayrollNet, type AmountLine } from "@/lib/staff/hr";

function currentPeriod(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
}

const lineSchema = z.object({ label: z.string().min(1).max(120), amount: z.number().int().min(0) });
const upsertSchema = z.object({
    userId: z.string().min(1),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    baseSalary: z.number().int().min(0),
    allowances: z.array(lineSchema).max(20).default([]),
    deductions: z.array(lineSchema).max(20).default([]),
});

/**
 * GET /api/staff/payroll?period=YYYY-MM
 * Gestionnaires RH : toutes les fiches de la période. Employé : ses fiches.
 */
export const GET = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const manager = isHrManager(context.session.user.role);
        const url = new URL(request.url);
        const periodParam = url.searchParams.get("period");
        const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : currentPeriod();

        const entries = await prisma.payrollEntry.findMany({
            where: {
                schoolId,
                period,
                ...(manager ? {} : { userId: context.session.user.id }),
            },
            include: { user: { select: { firstName: true, lastName: true, role: true } } },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({
            period,
            canManage: manager,
            entries: entries.map((e) => ({
                id: e.id,
                userId: e.userId,
                name: `${e.user.firstName} ${e.user.lastName}`.trim(),
                role: e.user.role,
                baseSalary: e.baseSalary,
                allowances: e.allowances,
                deductions: e.deductions,
                netAmount: e.netAmount,
                status: e.status,
                paidAt: e.paidAt ? e.paidAt.toISOString() : null,
                journalEntryId: e.journalEntryId,
            })),
        });
    },
    { allowedRoles: STAFF_MEMBER_ROLES },
);

/**
 * POST /api/staff/payroll — crée ou met à jour une fiche de paie (brouillon).
 * Le net est recalculé serveur. Une fiche validée/payée n'est plus modifiable.
 * Gestionnaires RH uniquement.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = upsertSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { userId, period, baseSalary, allowances, deductions } = parsed.data;

        const target = await prisma.user.findFirst({
            where: { id: userId, schoolId, role: { in: STAFF_MEMBER_ROLES } },
            select: { id: true },
        });
        if (!target) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

        // Empêche l'édition d'une fiche déjà validée ou payée.
        const existing = await prisma.payrollEntry.findUnique({
            where: { userId_period: { userId, period } },
            select: { status: true },
        });
        if (existing && existing.status !== "DRAFT") {
            return NextResponse.json({ error: "Fiche déjà validée : modification impossible." }, { status: 409 });
        }

        const netAmount = computePayrollNet(baseSalary, allowances as AmountLine[], deductions as AmountLine[]);

        const entry = await prisma.payrollEntry.upsert({
            where: { userId_period: { userId, period } },
            update: { baseSalary, allowances, deductions, netAmount },
            create: {
                schoolId,
                userId,
                period,
                baseSalary,
                allowances,
                deductions,
                netAmount,
                status: "DRAFT",
                createdById: context.session.user.id,
            },
        });

        return NextResponse.json({ id: entry.id, netAmount });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
