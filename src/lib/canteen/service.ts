import { prisma } from "@/lib/prisma";

export class CanteenService {
    /**
     * Get menu for a specific date or today
     */
    async getMenu(schoolId: string, date: Date = new Date()) {
        // Normalize date to start of day if necessary, 
        // but prisma @db.Date usually handles YYYY-MM-DD comparisons
        return prisma.canteenMenu.findFirst({
            where: {
                schoolId,
                date: date,
                isActive: true
            }
        });
    }

    /**
     * Purchase a meal ticket
     */
    async purchaseTicket(userId: string, schoolId: string, amount: number) {
        // In a real app, we'd verify payment here or deduction from wallet
        // For now, we assume payment is handled upstream or this is "credit"

        const ticket = await prisma.mealTicket.create({
            data: {
                userId,
                schoolId,
                price: amount,
                status: "VALID",
                qrCode: `TICKET-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            }
        });

        return ticket;
    }

    /**
     * Validate/Consume a ticket (e.g. at counter via QR scan)
     */
    async useTicket(qrCode: string, schoolId: string) {
        const ticket = await prisma.mealTicket.findFirst({
            where: { qrCode, schoolId, status: "VALID" }
        });

        if (!ticket) {
            throw new Error("Invalid or expired ticket");
        }

        const updated = await prisma.mealTicket.update({
            where: { id: ticket.id },
            data: {
                status: "USED",
                usedAt: new Date()
            }
        });

        return updated;
    }
}

export const canteenService = new CanteenService();
