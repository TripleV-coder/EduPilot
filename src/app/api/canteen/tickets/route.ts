import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * Get meal tickets for current user or their children
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
}

/**
 * Purchase a new ticket (simulated)
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const schoolId = getActiveSchoolId(session);
        const { userId, amount } = await req.json();

        // In a real app, this would be triggered by a payment webhook
        const ticket = await prisma.mealTicket.create({
            data: {
                schoolId: schoolId!,
                userId: userId || session.user.id,
                qrCode: `TKT-${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
                balance: amount || 10, // 10 meals by default
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            }
        });

        return NextResponse.json(ticket);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
