import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import bcrypt from "bcryptjs";
import { importStudentSchema } from "@/lib/import/schemas";
import { z } from "zod";

// Wrap the shared schema in an array for bulk import structure expectations if needed
// But the shared schema is for a single student. 
// The API body is expected to be { students: ImportStudent[] } ??
// The current implementation expects { students: [] }. 
// Let's explicitly define the body schema using the shared one.

const bodySchema = z.object({
  students: z.array(importStudentSchema)
});

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: validation.error.issues
      }, { status: 400 });
    }

    const { students } = validation.data;

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as string[],
    };

    for (const student of students) {
      try {
        // Check if user already exists by email
        // Email is optional in schema? No, ImportStudentSchema says email is optional/empty.
        // But for User creation, email is usually required or we generate one?
        // Let's check schema: email: z.string().email().optional().or(z.literal(""))

        let email = student.email;
        if (!email) {
          // Generate placeholder if allowed, or error?
          // For now, let's require email or generate one based on name/matricule if we were doing specific logic.
          // But User model enforces unique email.
          // We'll skip if no email for now or log error?
          // Actually, let's try to generate one: student.{firstname}.{lastname}.{random}@edupilot.local
          email = `${student.firstName}.${student.lastName}.${Math.random().toString(36).slice(-4)}@edupilot.local`.toLowerCase();
        }

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          results.failed++;
          results.errors.push(`Email déjà utilisé: ${email}`);
          continue;
        }

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        // Generate matricule logic
        // If provided, use it. Check uniqueness.
        // If not, generate.
        let matricule = student.matricule;
        if (matricule) {
          const existingMatricule = await prisma.studentProfile.findFirst({
            where: { schoolId, matricule }
          });
          if (existingMatricule) {
            results.failed++;
            results.errors.push(`Matricule déjà utilisé: ${matricule}`);
            continue;
          }
        } else {
          const lastMatricule = await prisma.studentProfile.findFirst({
            orderBy: { matricule: "desc" },
            where: { schoolId },
          });
          const nextNum = lastMatricule
            ? parseInt(lastMatricule.matricule.replace(/^E/, "")) + 1
            : 1;
          matricule = `E${nextNum.toString().padStart(5, "0")}`;
        }

        // Create user and student profile in a transaction
        await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: email!,
              password: hashedPassword,
              firstName: student.firstName,
              lastName: student.lastName,
              role: "STUDENT",
              schoolId,
            },
          });

          // Parse dates
          let dateOfBirth: Date | undefined;
          if (student.dateOfBirth) {
            // Try parsing ISO or DD/MM/YYYY
            // Simple check
            if (student.dateOfBirth.includes("/")) {
              const [d, m, y] = student.dateOfBirth.split("/");
              dateOfBirth = new Date(`${y}-${m}-${d}`);
            } else {
              dateOfBirth = new Date(student.dateOfBirth);
            }
          }

          const profile = await tx.studentProfile.create({
            data: {
              userId: newUser.id,
              matricule: matricule!,
              schoolId,
              dateOfBirth,
              gender: student.gender as any, // Cast to Schema Enum
              birthPlace: student.birthPlace,
              address: student.address,
            },
          });

          // Enrollments
          if (student.className) {
            const classData = await tx.class.findFirst({
              where: {
                schoolId,
                name: { equals: student.className, mode: "insensitive" },
              },
            });

            if (classData) {
              const currentYear = await tx.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
              });

              if (currentYear) {
                await tx.enrollment.create({
                  data: {
                    studentId: profile.id, // Use profile ID not user ID
                    classId: classData.id,
                    academicYearId: currentYear.id,
                    status: "ACTIVE",
                  },
                });
              }
            }
          }

          // Link Parent
          if (student.parentEmail) {
            const parentUser = await tx.user.findUnique({
              where: { email: student.parentEmail },
              include: { parentProfile: true }
            });

            if (parentUser && parentUser.parentProfile) {
              await tx.parentStudent.create({
                data: {
                  parentId: parentUser.parentProfile.id,
                  studentId: profile.id,
                  relationship: "PARENT" // Default
                }
              });
            }
          }
        });

        results.created.push(`${student.firstName} ${student.lastName} (${email})`);
        results.success++;
      } catch (error) {
        console.error(error);
        results.failed++;
        results.errors.push(`Erreur pour ${student.firstName} ${student.lastName}: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
      }
    }

    return NextResponse.json({
      message: `Import terminé: ${results.success} étudiants créés, ${results.failed} échoués`,
      results,
    });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);

export const GET = createApiHandler(
  async (_request, _context, _t) => {
    // Return CSV template enriched
    const template = `email,firstName,lastName,className,dateOfBirth,gender,birthPlace,address,parentEmail
jean.dupont@exemple.com,Jean,Dupont,Terminale A1,01/01/2005,M,Cotonou,Akpakpa,papa.dupont@gmail.com
marie.martin@exemple.com,Marie,Martin,Terminale A1,15/05/2005,F,Porto-Novo,Avakpa,maman.martin@gmail.com`;

    return new NextResponse(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=modele_import_eleves_complet.csv",
      },
    });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);

