import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
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

  // Informations établissement - validations renforcées
  schoolName: z.string()
    .min(3, "Le nom de l'établissement doit contenir au moins 3 caractères")
    .max(200, "Le nom est trop long")
    .refine(
      (val) => !/<|>|'|"|;|--/.test(val),
      "Le nom contient des caractères non autorisés"
    )
    .transform(val => val.trim()),

  schoolAddress: z.string()
    .min(5, "L'adresse doit contenir au moins 5 caractères")
    .max(300, "L'adresse est trop longue")
    .refine(
      (val) => !/<|>|'|"|;|--/.test(val),
      "L'adresse contient des caractères non autorisés"
    )
    .transform(val => val.trim()),

  schoolCity: z.string()
    .min(2, "Le nom de la ville doit contenir au moins 2 caractères")
    .max(100, "Le nom de la ville est trop long")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Le nom de la ville contient des caractères non valides")
    .transform(val => val.trim()),

  schoolPhone: z.string()
    .min(8, "Le numéro de téléphone est trop court")
    .max(20, "Le numéro de téléphone est trop long")
    .regex(/^[\d\s+()-]+$/, "Format de téléphone invalide")
    .transform(val => val.trim()),
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

    // Double vérification: aucun utilisateur ne doit exister
    const existingUserCount = await prisma.user.count();
    if (existingUserCount > 0) {
      return NextResponse.json(
        { error: "Le système a déjà été configuré. Cette opération ne peut être effectuée qu'une seule fois." },
        { status: 403 }
      );
    }

    // Vérifier si l'email existe déjà (sécurité supplémentaire)
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 400 }
      );
    }

    // Vérifier qu'il n'y a pas d'établissement déjà créé
    const existingSchoolCount = await prisma.school.count();
    if (existingSchoolCount > 0) {
      return NextResponse.json(
        { error: "Un établissement existe déjà dans le système" },
        { status: 403 }
      );
    }

    // Créer l'établissement et l'administrateur dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer l'établissement
      const school = await tx.school.create({
        data: {
          name: validatedData.schoolName,
          code: `SCH${Date.now()}`, // Générer un code unique basé sur timestamp
          type: "PRIVATE",
          level: "MIXED", // Par défaut, établissement mixte
          address: validatedData.schoolAddress,
          city: validatedData.schoolCity,
          phone: validatedData.schoolPhone,
          email: validatedData.email,
          isActive: true,
        },
      });

      // 2. Créer l'utilisateur super admin avec hash sécurisé
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
          schoolId: school.id,
        },
      });

      // 3. Créer une configuration académique par défaut
      await tx.academicConfig.create({
        data: {
          schoolId: school.id,
          periodType: "TRIMESTER",
          periodsCount: 3,
          maxGrade: 20,
          passingGrade: 10,
        },
      });

      // 4. Logger l'événement de sécurité
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "INITIAL_SETUP_COMPLETED",
          entity: "SYSTEM",
          entityId: school.id,
          newValues: {
            schoolName: school.name,
            schoolCode: school.code,
            adminEmail: user.email,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return { school, user };
    }, {
      maxWait: 10000, // Attendre max 10 secondes pour acquérir le lock
      timeout: 20000, // Timeout total de 20 secondes
    });

    return NextResponse.json(
      {
        message: "Configuration initiale réussie",
        school: {
          id: result.school.id,
          name: result.school.name,
        },
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
    if (error instanceof z.ZodError) {
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
