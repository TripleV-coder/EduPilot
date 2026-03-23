/**
 * CanteenService — Gestion de la cantine scolaire
 *
 * Utilise les modèles Prisma CanteenMenu et MealTicket.
 */
import prisma from "@/lib/prisma";
import crypto from "crypto";

export class CanteenService {
    /**
     * Récupère le menu du jour pour une école donnée.
     */
    async getMenu(schoolId: string, date: Date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const menu = await prisma.canteenMenu.findUnique({
            where: {
                schoolId_date: {
                    schoolId,
                    date: startOfDay,
                },
            },
        });

        return menu;
    }

    /**
     * Récupère les menus d'une semaine pour une école.
     */
    async getWeeklyMenus(schoolId: string, weekStart: Date) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const menus = await prisma.canteenMenu.findMany({
            where: {
                schoolId,
                date: {
                    gte: weekStart,
                    lte: weekEnd,
                },
            },
            orderBy: { date: "asc" },
        });

        return menus;
    }

    /**
     * Crée ou met à jour un menu pour un jour donné.
     */
    async upsertMenu(schoolId: string, date: Date, data: { starter?: string; mainCourse?: string; dessert?: string }) {
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        return prisma.canteenMenu.upsert({
            where: {
                schoolId_date: {
                    schoolId,
                    date: normalizedDate,
                },
            },
            update: {
                starterName: data.starter,
                mainCourse: data.mainCourse,
                dessert: data.dessert,
            },
            create: {
                schoolId,
                date: normalizedDate,
                starterName: data.starter,
                mainCourse: data.mainCourse ?? 'Menu principal',
                dessert: data.dessert,
                priceStudent: 0,
            },
        });
    }

    /**
     * Achète un ticket repas pour un utilisateur.
     */
    async purchaseTicket(userId: string, schoolId: string, balance: number = 1, paymentId?: string) {
        const qrCode = crypto.randomUUID();

        const ticket = await prisma.mealTicket.create({
            data: {
                schoolId,
                userId,
                qrCode,
                balance,
                paymentId,
                purchasedAt: new Date(),
            },
        });

        return ticket;
    }

    /**
     * Supprime (soft-delete) un ticket repas.
     */
    async deleteTicket(ticketId: string) {
        return prisma.mealTicket.update({
            where: { id: ticketId },
            data: { deletedAt: new Date() },
        });
    }

    /**
     * Utilise un ticket repas via son QR code.
     */
    async useTicket(qrCode: string, schoolId: string) {
        const ticket = await prisma.mealTicket.findUnique({
            where: { qrCode },
        });

        if (!ticket) {
            throw new Error("Ticket introuvable.");
        }

        if (ticket.schoolId !== schoolId) {
            throw new Error("Ce ticket n'appartient pas à cet établissement.");
        }

        if (ticket.isUsed) {
            throw new Error("Ce ticket a déjà été utilisé.");
        }

        if (ticket.expiresAt && ticket.expiresAt < new Date()) {
            throw new Error("Ce ticket est expiré.");
        }

        // Atomic update to prevent race conditions (double spending)
        const updated = await prisma.mealTicket.updateMany({
            where: {
                id: ticket.id,
                isUsed: false // Crucial: only update if not already used
            },
            data: {
                isUsed: true,
                usedAt: new Date(),
            },
        });

        if (updated.count === 0) {
            throw new Error("Ce ticket a déjà été utilisé ou est invalide.");
        }

        return { ...ticket, isUsed: true, usedAt: new Date() };
    }
}

export const canteenService = new CanteenService();
