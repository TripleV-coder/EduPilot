import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

const profileUpdateSchema = z.object({
    firstName: z.string().min(2, "Le prenom doit contenir au moins 2 caracteres").trim().optional(),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caracteres").trim().optional(),
    phone: z.string().optional().nullable(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    avatar: z.string().optional().nullable(),
});

// GET: Get current user's profile
export const GET = createApiHandler(
    async (_request, { session }, _t) => {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                isTwoFactorEnabled: true,
                preferences: true,
                avatar: true,
                createdAt: true,
                studentProfile: { select: { id: true } },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
        }

        return NextResponse.json(user);
    },
    { requireAuth: true }
);

// PATCH: Update current user's profile (firstName, lastName, phone, avatar)
export const PATCH = createApiHandler(
    async (request, { session }, _t) => {
        const body = await request.json();

        const parsed = profileUpdateSchema.safeParse({
            firstName: body.firstName !== undefined ? sanitizePlainText(body.firstName) : undefined,
            lastName: body.lastName !== undefined ? sanitizePlainText(body.lastName) : undefined,
            phone: body.phone ? sanitizePlainText(body.phone) : body.phone,
            preferences: body.preferences,
            avatar: body.avatar,
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Donnees invalides", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { firstName, lastName, phone, preferences, avatar } = parsed.data;

        const updateData: Prisma.UserUpdateInput = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (phone !== undefined) updateData.phone = phone;
        if (preferences !== undefined) {
            // Fusion sur les clés de premier niveau : un écran qui n'envoie que
            // sa section (onboarding, notifications…) n'efface plus les autres
            // (consentements, thème, langue). Une clé à null est retirée.
            const current = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { preferences: true },
            });
            const stored = current?.preferences;
            const merged: Record<string, unknown> =
                stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {};
            for (const [key, value] of Object.entries(preferences)) {
                if (value === null) delete merged[key];
                else merged[key] = value;
            }
            updateData.preferences = merged as Prisma.InputJsonValue;
        }
        if (avatar !== undefined) updateData.avatar = avatar;

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                isTwoFactorEnabled: true,
                preferences: true,
                createdAt: true,
            },
        });

        logger.info("User profile updated", { userId: session.user.id });

        return NextResponse.json(updatedUser);
    },
    { requireAuth: true }
);
