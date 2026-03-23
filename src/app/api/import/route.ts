import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";

export const POST = createApiHandler(
  async (request, { session }) => {
    const { type, data, schoolId } = await request.json();
    const targetSchoolId = schoolId || session.user.schoolId;

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Données invalides ou vides" }, { status: 400 });
    }

    if (type !== "STUDENTS") {
      return NextResponse.json(
        {
          error: "Type d'import non supporté par cet endpoint.",
          code: "UNSUPPORTED_IMPORT_TYPE",
          supported: ["STUDENTS"],
        },
        { status: 400 }
      );
    }

    const DEFAULT_IMPORT_PASSWORD = "00000000";

    try {
      const results = await prisma.$transaction(async (tx) => {
        const processed = [];
        
        for (const item of data) {
          if (type === "STUDENTS") {
            // Logique simplifiée pour l'exemple - En prod on mapperait via headers
            const firstName = item.firstName || item["Prénom"] || "Élève";
            const lastName = item.lastName || item["Nom"] || "Nouveau";
            const email = (item.email || item["Email"]) as string | undefined;

            // On refuse la création d'élèves sans email réel dans tous les environnements
            if (!email) {
              throw new Error("EMAIL_REQUIRED_FOR_STUDENT_IMPORT");
            }

            const hashedPassword = await hash(DEFAULT_IMPORT_PASSWORD, 12);

            // 1. Créer User
            const user = await tx.user.create({
              data: {
                email,
                firstName,
                lastName,
                password: hashedPassword,
                role: UserRole.STUDENT,
                roles: [UserRole.STUDENT],
                schoolId: targetSchoolId,
                mustChangePassword: true,
              },
            });

            // 2. Créer StudentProfile
            const student = await tx.studentProfile.create({
              data: {
                userId: user.id,
                schoolId: targetSchoolId,
                matricule:
                  item.matricule ||
                  `MAT-${Math.random()
                    .toString(36)
                    .substr(2, 5)
                    .toUpperCase()}`,
              },
            });

            processed.push(student.id);
          }
        }
        return processed;
      });

      return NextResponse.json({ 
        success: true, 
        count: results.length,
        message: `${results.length} enregistrements importés.` 
      });
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_REQUIRED_FOR_STUDENT_IMPORT") {
        return NextResponse.json(
          {
            error:
              "Chaque élève à importer doit avoir un email explicite. Complétez vos données d'import.",
            code: "EMAIL_REQUIRED_FOR_STUDENT_IMPORT",
          },
          { status: 400 }
        );
      }
      logger.error("Bulk Import Error", error);
      return NextResponse.json({ error: "Échec de l'importation massive" }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE, Permission.USER_CREATE],
  }
);
