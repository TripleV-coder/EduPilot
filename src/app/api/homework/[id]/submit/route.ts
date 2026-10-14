import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";

const submitSchema = z
  .object({
    content: z.string().max(20_000).optional(),
    attachments: z.array(z.string().min(1).max(500)).max(5).optional(),
  })
  .refine(
    (data) => Boolean(data.content?.trim()) || (data.attachments?.length ?? 0) > 0,
    { message: "Ajoutez un texte ou un fichier." },
  );

/**
 * POST /api/homework/[id]/submit
 * L'élève rend son devoir (texte et/ou fichier).
 */
export const POST = createApiHandler(
  async (request, context) => {
    try {
      const { id } = await context.params;
      const session = context.session;

      const guard = await assertModelAccess(session, "homework", id, "Devoir non trouvé");
      if (guard) return guard;

      const body = submitSchema.parse(await request.json());

      const homework = await prisma.homework.findUnique({
        where: { id },
        select: {
          id: true,
          isPublished: true,
          classSubject: { select: { classId: true } },
        },
      });
      if (!homework) {
        return NextResponse.json({ error: "Devoir non trouvé" }, { status: 404 });
      }
      if (!homework.isPublished) {
        return NextResponse.json({ error: "Ce devoir n'est pas publié." }, { status: 403 });
      }

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          enrollments: {
            where: { status: "ACTIVE", classId: homework.classSubject.classId },
            select: { id: true },
          },
        },
      });
      if (!studentProfile || studentProfile.enrollments.length === 0) {
        return NextResponse.json({ error: "Vous n'êtes pas inscrit dans cette classe." }, { status: 403 });
      }

      const existing = await prisma.homeworkSubmission.findUnique({
        where: { homeworkId_studentId: { homeworkId: id, studentId: studentProfile.id } },
        select: { id: true, grade: true },
      });
      if (existing?.grade != null) {
        return NextResponse.json({ error: "Ce devoir est déjà noté." }, { status: 409 });
      }

      const content = body.content?.trim() || null;
      const attachments = body.attachments ?? [];
      const submission = existing
        ? await prisma.homeworkSubmission.update({
            where: { id: existing.id },
            data: { content, attachments, submittedAt: new Date() },
          })
        : await prisma.homeworkSubmission.create({
            data: {
              homeworkId: id,
              studentId: studentProfile.id,
              content,
              attachments,
            },
          });

      await invalidateByPath(CACHE_PATHS.homework);
      return NextResponse.json(submission, { status: existing ? 200 : 201 });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json(
          { error: error.issues[0]?.message ?? "Données invalides" },
          { status: 400 },
        );
      }
      logger.error("homework submit", error as Error);
      return NextResponse.json({ error: "Erreur lors du rendu du devoir" }, { status: 500 });
    }
  },
  { allowedRoles: ["STUDENT"] },
);
