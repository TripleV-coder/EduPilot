import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

/**
 * Get meal tickets for current user or their children
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

        let userIds = [session.user.id];

        // If parent, include children
        if (session.user.role === "PARENT") {
            const parentProfile = await prisma.parentProfile.findUnique({
                where: { userId: session.user.id },
                include: { parentStudents: { include: { student: { select: { userId: true } } } } }
            });
            if (parentProfile) {
                const childUserIds = parentProfile.parentStudents.map(ps => ps.student.userId);
                userIds = [...userIds, ...childUserIds];
            }
        }

        const tickets = await prisma.mealTicket.findMany({
            where: {
                schoolId,
                userId: { in: userIds },
                deletedAt: null
            },
            include: {
                user: { select: { firstName: true, lastName: true } }
            },
            orderBy: { purchasedAt: 'desc' }
        });

        // Group by user for balance summary
        const summary = userIds.map(uid => {
            const userTickets = tickets.filter(t => t.userId === uid);
            const activeTicket = userTickets.find(t => !t.isUsed && (t.expiresAt === null || t.expiresAt > new Date()));
            const totalBalance = userTickets.reduce((sum, t) => sum + Number(t.balance), 0);
            
            return {
                userId: uid,
                userName: userTickets[0]?.user ? `${userTickets[0].user.firstName} ${userTickets[0].user.lastName}` : "Utilisateur",
                totalBalance,
                activeTicket: activeTicket || null,
                history: userTickets.slice(0, 10)
            };
        });

        return NextResponse.json(summary);
    
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

});

/** Carnet : entre 1 et 200 repas crédités en une fois. */
const purchaseSchema = z.object({
    userId: z.string().min(1).max(64),
    amount: z.number().int().min(1).max(200).default(10),
});

/**
 * Crédite un carnet de tickets repas, encaissé au guichet.
 *
 * Réservé à l'administration et à la comptabilité : la route était ouverte à
 * tout compte connecté, sans paiement — un élève ou un parent se créditait
 * autant de repas qu'il voulait, pour n'importe quel utilisateur.
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

        const parsed = purchaseSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Montant invalide (1 à 200 repas)" }, { status: 400 });
        }
        const { userId, amount } = parsed.data;

        const beneficiary = await prisma.user.findFirst({
            where: { id: userId, schoolId, isActive: true },
            select: { id: true },
        });
        if (!beneficiary) {
            return NextResponse.json({ error: "Bénéficiaire introuvable dans cet établissement" }, { status: 404 });
        }

        const ticket = await prisma.mealTicket.create({
            data: {
                schoolId,
                userId: beneficiary.id,
                qrCode: `TKT-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
                balance: amount,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        return NextResponse.json(ticket);
    } catch (error) {
        logger.error("Canteen ticket purchase failed", error as Error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] });
