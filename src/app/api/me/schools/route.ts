import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { invalidateUserStatusCache } from "@/lib/auth/user-status-cache";
import { checkRateLimitKey, getClientIp } from "@/lib/rate-limit";
import { joinSchoolWithInvitation } from "@/lib/teachers/school-membership";

/** Saisies de code : 10 par quart d'heure, par compte ET par adresse. */
const JOIN_LIMIT = { maxAttempts: 10, windowMs: 15 * 60 * 1000 };

const joinSchema = z.object({ code: z.string().trim().min(1, "Code requis").max(32) });

/**
 * GET /api/me/schools — établissements de l'enseignant : principal (porte le
 * compte) et rattachements actifs obtenus par code d'invitation.
 */
export const GET = createApiHandler(
  async (_request, { session }) => {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        schoolId: true,
        school: { select: { id: true, name: true } },
        schoolAssignments: {
          where: { status: "ACTIVE" },
          orderBy: { startDate: "asc" },
          select: { schoolId: true, isPrimary: true, startDate: true, school: { select: { name: true } } },
        },
      },
    });
    if (!teacher) return NextResponse.json({ error: "Profil enseignant introuvable" }, { status: 404 });

    const schools = new Map<string, { id: string; name: string; primary: boolean; since: Date | null }>();
    if (teacher.school) schools.set(teacher.school.id, { id: teacher.school.id, name: teacher.school.name, primary: true, since: null });
    for (const a of teacher.schoolAssignments) {
      if (schools.has(a.schoolId)) continue;
      schools.set(a.schoolId, { id: a.schoolId, name: a.school.name, primary: a.isPrimary, since: a.startDate });
    }
    return NextResponse.json({ teacherId: teacher.id, schools: [...schools.values()] });
  },
  { allowedRoles: ["TEACHER"] },
);

/**
 * POST /api/me/schools — rejoint un établissement avec le code qu'il a remis.
 * Réponse identique pour tout code invalide (inconnu, utilisé, révoqué,
 * expiré) ; tentatives limitées par compte et par adresse.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const ip = getClientIp(request);
    const [byUser, byIp] = await Promise.all([
      checkRateLimitKey(`rl:teacher-join:user:${session.user.id}`, JOIN_LIMIT),
      checkRateLimitKey(`rl:teacher-join:ip:${ip}`, JOIN_LIMIT),
    ]);
    if (!byUser.success || !byIp.success) {
      const reset = Math.max(byUser.reset.getTime(), byIp.reset.getTime());
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Trop d'essais. Réessayez dans quelques minutes.", code: "RATE_LIMITED", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const parsed = joinSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Code requis" }, { status: 400 });

    const result = await joinSchoolWithInvitation({ userId: session.user.id, code: parsed.data.code });
    if (!result.ok) {
      const message =
        result.reason === "SCHOOL_INACTIVE"
          ? "Cet établissement n'est pas actif pour le moment."
          : result.reason === "NOT_A_TEACHER"
            ? "Seul un compte enseignant peut rejoindre un établissement avec un code."
            : "Code invalide ou expiré. Demandez un nouveau code à l'établissement.";
      return NextResponse.json({ error: message, code: result.reason }, { status: result.reason === "NOT_A_TEACHER" ? 403 : 400 });
    }

    // Le jeton relit les écoles accessibles : la nouvelle école est disponible dès la requête suivante.
    invalidateUserStatusCache(session.user.id);
    return NextResponse.json(
      { schoolId: result.schoolId, schoolName: result.schoolName, alreadyMember: result.alreadyMember },
      { status: result.alreadyMember ? 200 : 201 },
    );
  },
  { allowedRoles: ["TEACHER"] },
);
