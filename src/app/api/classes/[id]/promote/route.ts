import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler, isValidCuid } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { promoteClass, PromotionError } from "@/lib/students/promotion";

const promoteSchema = z.object({
  targetAcademicYearId: z.string().min(1),
  decisions: z
    .array(
      z.object({
        studentId: z.string().min(1),
        decision: z.enum(["PROMOTE", "REPEAT", "LEAVE"]),
      })
    )
    .min(1, "Au moins une décision est requise")
    .max(500, "Trop de décisions en une seule opération (max 500)"),
});

/**
 * POST /api/classes/[classId]/promote
 * Applique les décisions de fin d'année (promotion / redoublement / départ)
 * pour une classe, en créant les inscriptions de l'année académique cible.
 */
export const POST = createApiHandler(
  async (request, { session, params }) => {
    const { classId } = await params;
    if (!isValidCuid(classId)) {
      return NextResponse.json({ error: "Identifiant de classe invalide" }, { status: 400 });
    }

    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json(
        { error: "Aucun établissement associé à votre session" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = promoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.issues },
        { status: 400 }
      );
    }

    try {
      const result = await promoteClass({
        schoolId,
        sourceClassId: classId,
        targetAcademicYearId: parsed.data.targetAcademicYearId,
        decisions: parsed.data.decisions,
        actorId: session.user.id,
      });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof PromotionError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
