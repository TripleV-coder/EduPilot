import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { logger } from "@/lib/utils/logger";
import { Prisma } from "@prisma/client";
import * as z from "zod";

const initialSetupSchema = z.object({
  // Informations administrateur - validations renforcées
  firstName: z.string()
    .min(2, "Le prénom doit contenir au moins 2 caractères")
    .max(100, "Le prénom est trop long")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le prénom contient des caractères non valides")
    .transform(val => val.trim()),

  lastName: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le nom contient des caractères non valides")
    .transform(val => val.trim()),

  email: z.string()
    .email("Email invalide")
    .max(255, "Email trop long")
    .toLowerCase()
    .transform(val => val.trim()),

  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe est trop long")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
    .refine(
      (val) => !/<|>|'|"|;|--|\||&/.test(val),
      "Le mot de passe contient des caractères non autorisés"
    ),

  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export async function POST(req: Request) {
  try {
    // Limite de taille du body pour éviter les attaques
    const body = await req.json();

    // Vérifier la taille du payload
    const bodySize = JSON.stringify(body).length;
    if (bodySize > 10000) { // 10KB max
      return NextResponse.json(
        { error: "Données trop volumineuses" },
        { status: 413 }
      );
    }

    const validatedData = initialSetupSchema.parse(body);

    // Créer l'établissement et l'administrateur dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      const existingUserCount = await tx.user.count();

      if (existingUserCount > 0) {
        throw new Error("INITIAL_SETUP_ALREADY_DONE");
      }

      // Vérifier si l'email existe déjà (sécurité supplémentaire)
      const existingUser = await tx.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        throw new Error("INITIAL_SETUP_EMAIL_TAKEN");
      }

      // Créer l'utilisateur super admin avec hash sécurisé
      // Utiliser 12 rounds pour un meilleur équilibre sécurité/performance
      const hashedPassword = await hash(validatedData.password, 12);
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });

      // Logger l'événement de sécurité
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "INITIAL_SETUP_COMPLETED",
          entity: "SYSTEM",
          entityId: user.id,
          newValues: {
            adminEmail: user.email,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return { user };
    }, {
      maxWait: 10000, // Attendre max 10 secondes pour acquérir le lock
      timeout: 20000, // Timeout total de 20 secondes
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json(
      {
        message: "Configuration initiale réussie",
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INITIAL_SETUP_ALREADY_DONE") {
        return NextResponse.json(
          { error: "Le système a déjà été configuré. Cette opération ne peut être effectuée qu'une seule fois." },
          { status: 409 }
        );
      }
      if (error.message === "INITIAL_SETUP_EMAIL_TAKEN") {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé" },
          { status: 400 }
        );
      }
    }
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Erreur lors de la configuration initiale:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la configuration" },
      { status: 500 }
    );
  }
}

/**
 * GET - Vérifier si le système a besoin d'être initialisé
 * Retourne setupNeeded: true si aucun utilisateur n'existe
 */
export async function GET(_req: NextRequest) {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json(
      { setupNeeded: userCount === 0 },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Erreur lors de la vérification du statut:", error);
    return NextResponse.json(
      { error: "Impossible de vérifier le statut du système" },
      { status: 500 }
    );
  }
}
