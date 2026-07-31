import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";

/**
 * Moteur de promotion de fin d'année.
 *
 * Pour une classe source et une année académique cible, applique les décisions
 * par élève : PROMOTE (niveau supérieur, ou diplôme si niveau terminal),
 * REPEAT (redoublement dans la même classe), LEAVE (départ).
 *
 * La promotion CRÉE les inscriptions de l'année cible ET clôture l'inscription
 * source (ACTIVE → COMPLETED / GRADUATED / DROPPED) : un élève ne conserve donc
 * qu'une seule inscription ACTIVE à la fois (sur l'année cible), ce qui évite
 * qu'il soit compté dans les effectifs de son ancienne classe.
 *
 * L'opération est idempotente et sûre en concurrence : la clôture de la source
 * est un `updateMany` conditionnel (`status: "ACTIVE"`). Si 0 ligne est modifiée
 * (déjà traité par un passage ou un appel concurrent), aucune inscription cible
 * n'est créée — pas de doublon.
 */

export type PromotionDecision = "PROMOTE" | "REPEAT" | "LEAVE";

export interface PromotionInput {
  studentId: string;
  decision: PromotionDecision;
}

export interface PromotionResult {
  promoted: number;
  graduated: number;
  repeated: number;
  left: number;
  skipped: { studentId: string; reason: string }[];
}

export class PromotionError extends Error {}

/**
 * Choisit la classe cible au niveau supérieur : même section (nom) si elle
 * existe, sinon la première par ordre alphabétique. `null` si aucune classe.
 */
export function pickTargetClass<T extends { name: string }>(
  candidates: T[],
  sourceName: string
): T | null {
  if (candidates.length === 0) return null;
  const sameSection = candidates.find((c) => c.name === sourceName);
  if (sameSection) return sameSection;
  return [...candidates].sort((a, b) => a.name.localeCompare(b.name))[0];
}

interface StudentContext {
  sourceEnrollmentId: string | null;
  alreadyInTargetYear: boolean;
  graduationYear: number;
  firstName: string;
  lastName: string;
}

export interface PromotionPlanContext {
  sourceClassId: string;
  targetClassId: string | null;
  hasNextLevel: boolean;
  students: Map<string, StudentContext>;
}

export type PromotionOp =
  | { type: "CREATE_ENROLLMENT"; studentId: string; classId: string; sourceEnrollmentId: string }
  | { type: "GRADUATE"; studentId: string; enrollmentId: string; firstName: string; lastName: string; graduationYear: number }
  | { type: "DROP"; studentId: string; enrollmentId: string }
  | { type: "SKIP"; studentId: string; reason: string };

/**
 * Traduit des décisions en opérations concrètes (fonction pure, testable).
 */
export function planPromotion(
  ctx: PromotionPlanContext,
  decisions: PromotionInput[]
): PromotionOp[] {
  return decisions.map(({ studentId, decision }): PromotionOp => {
    const student = ctx.students.get(studentId);
    if (!student || !student.sourceEnrollmentId) {
      return { type: "SKIP", studentId, reason: "Aucune inscription active dans la classe source" };
    }

    if (decision === "LEAVE") {
      return { type: "DROP", studentId, enrollmentId: student.sourceEnrollmentId };
    }

    if (decision === "PROMOTE" && !ctx.hasNextLevel) {
      // Niveau terminal : l'élève est diplômé.
      return {
        type: "GRADUATE",
        studentId,
        enrollmentId: student.sourceEnrollmentId,
        firstName: student.firstName,
        lastName: student.lastName,
        graduationYear: student.graduationYear,
      };
    }

    if (student.alreadyInTargetYear) {
      return { type: "SKIP", studentId, reason: "Déjà inscrit sur l'année cible" };
    }

    if (decision === "PROMOTE") {
      if (!ctx.targetClassId) {
        return { type: "SKIP", studentId, reason: "Aucune classe au niveau supérieur — créez-la d'abord" };
      }
      return { type: "CREATE_ENROLLMENT", studentId, classId: ctx.targetClassId, sourceEnrollmentId: student.sourceEnrollmentId };
    }

    // REPEAT : réinscription dans la même classe pour l'année cible.
    return { type: "CREATE_ENROLLMENT", studentId, classId: ctx.sourceClassId, sourceEnrollmentId: student.sourceEnrollmentId };
  });
}

export async function promoteClass(params: {
  schoolId: string;
  sourceClassId: string;
  targetAcademicYearId: string;
  decisions: PromotionInput[];
  actorId: string;
}): Promise<PromotionResult> {
  const { schoolId, sourceClassId, targetAcademicYearId, decisions, actorId } = params;

  if (decisions.length === 0) {
    throw new PromotionError("Aucune décision de promotion fournie");
  }

  const sourceClass = await prisma.class.findFirst({
    where: { id: sourceClassId, schoolId, deletedAt: null },
    include: { classLevel: { select: { sequence: true } } },
  });
  if (!sourceClass) throw new PromotionError("Classe source introuvable dans votre établissement");

  const targetYear = await prisma.academicYear.findFirst({
    where: { id: targetAcademicYearId, schoolId },
    select: { id: true, startDate: true },
  });
  if (!targetYear) throw new PromotionError("Année académique cible introuvable dans votre établissement");

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!currentYear) throw new PromotionError("Aucune année académique courante définie");
  if (currentYear.id === targetYear.id) {
    throw new PromotionError("L'année cible doit être différente de l'année courante");
  }
  // La promotion doit projeter les élèves vers l'avenir : interdit de promouvoir
  // dans une année dont le début est antérieur ou égal à l'année courante.
  if (targetYear.startDate.getTime() <= currentYear.startDate.getTime()) {
    throw new PromotionError("L'année cible doit être postérieure à l'année courante");
  }

  const graduationYear = currentYear.endDate.getFullYear();

  // Niveau supérieur + classe cible (même section de préférence).
  const nextLevel = await prisma.classLevel.findFirst({
    where: { schoolId, sequence: { gt: sourceClass.classLevel.sequence } },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });

  let targetClassId: string | null = null;
  if (nextLevel) {
    const candidates = await prisma.class.findMany({
      where: { schoolId, classLevelId: nextLevel.id, deletedAt: null },
      select: { id: true, name: true },
    });
    targetClassId = pickTargetClass(candidates, sourceClass.name)?.id ?? null;
  }

  const studentIds = decisions.map((d) => d.studentId);

  const [sourceEnrollments, targetEnrollments] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        classId: sourceClassId,
        academicYearId: currentYear.id,
        status: "ACTIVE",
        studentId: { in: studentIds },
      },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.enrollment.findMany({
      where: { academicYearId: targetYear.id, studentId: { in: studentIds } },
      select: { studentId: true },
    }),
  ]);

  const inTargetYear = new Set(targetEnrollments.map((e) => e.studentId));
  const students = new Map<string, StudentContext>();
  for (const sid of studentIds) {
    const enrollment = sourceEnrollments.find((e) => e.studentId === sid);
    students.set(sid, {
      sourceEnrollmentId: enrollment?.id ?? null,
      alreadyInTargetYear: inTargetYear.has(sid),
      graduationYear,
      firstName: enrollment?.student.user.firstName ?? "",
      lastName: enrollment?.student.user.lastName ?? "",
    });
  }

  const ops = planPromotion(
    { sourceClassId, targetClassId, hasNextLevel: Boolean(nextLevel), students },
    decisions
  );

  const result: PromotionResult = { promoted: 0, graduated: 0, repeated: 0, left: 0, skipped: [] };

  await prisma.$transaction(async (tx) => {
    for (const op of ops) {
      switch (op.type) {
        case "SKIP":
          result.skipped.push({ studentId: op.studentId, reason: op.reason });
          break;
        case "CREATE_ENROLLMENT": {
          // Clôture conditionnelle de la source : garantit l'idempotence et
          // empêche les doublons en cas d'appels concurrents (0 ligne → skip).
          const closed = await tx.enrollment.updateMany({
            where: { id: op.sourceEnrollmentId, status: "ACTIVE" },
            data: { status: "COMPLETED" },
          });
          if (closed.count === 0) {
            result.skipped.push({ studentId: op.studentId, reason: "Inscription source déjà traitée" });
            break;
          }
          await tx.enrollment.create({
            data: {
              studentId: op.studentId,
              classId: op.classId,
              academicYearId: targetYear.id,
              status: "ACTIVE",
            },
          });
          if (op.classId === sourceClassId) result.repeated += 1;
          else result.promoted += 1;
          break;
        }
        case "GRADUATE": {
          const graduated = await tx.enrollment.updateMany({
            where: { id: op.enrollmentId, status: "ACTIVE" },
            data: { status: "GRADUATED" },
          });
          if (graduated.count === 0) {
            result.skipped.push({ studentId: op.studentId, reason: "Inscription source déjà traitée" });
            break;
          }
          await tx.alumni.create({
            data: {
              schoolId,
              studentId: op.studentId,
              firstName: op.firstName,
              lastName: op.lastName,
              graduationYear: op.graduationYear,
            },
          });
          result.graduated += 1;
          break;
        }
        case "DROP": {
          const dropped = await tx.enrollment.updateMany({
            where: { id: op.enrollmentId, status: "ACTIVE" },
            data: { status: "DROPPED" },
          });
          if (dropped.count === 0) {
            result.skipped.push({ studentId: op.studentId, reason: "Inscription source déjà traitée" });
            break;
          }
          result.left += 1;
          break;
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "PROMOTE_CLASS",
        entity: "Class",
        entityId: sourceClassId,
        newValues: {
          targetAcademicYearId,
          promoted: result.promoted,
          graduated: result.graduated,
          repeated: result.repeated,
          left: result.left,
          skipped: result.skipped.length,
        } as Prisma.InputJsonValue,
      },
    });
  }, {
    // Une classe peut compter jusqu'à 500 décisions (cap de l'API), chacune
    // faisant 1 à 2 requêtes séquentielles : on élargit le timeout interactif
    // (défaut 5 s) pour éviter un P2028 sur les gros effectifs.
    timeout: 30_000,
    maxWait: 10_000,
  });

  logger.info("Promotion de classe exécutée", { schoolId, sourceClassId, ...result, skipped: result.skipped.length });
  return result;
}
