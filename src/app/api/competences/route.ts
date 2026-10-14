import { DEFAULT_SCHOOL_PARAMETERS, type SchoolParameters } from "@/lib/schools/school-parameters";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { assertNotCouncilLocked, assertSubjectTeacher } from "@/lib/academic/grade-write-guard";

const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

// MEMP math competences (the design's reference grid). When the evaluation
// title doesn't carry an explicit competence tag we round-robin by index so
// each evaluation still feeds the matrix.
const COMPETENCES = [
    { id: "C1", label: "C1 · Chercher · résoudre un problème" },
    { id: "C2", label: "C2 · Modéliser · traduire une situation" },
    { id: "C3", label: "C3 · Représenter · figures, graphiques" },
    { id: "C4", label: "C4 · Raisonner · démontrer" },
    { id: "C5", label: "C5 · Calculer · technique opératoire" },
    { id: "C6", label: "C6 · Communiquer · expression" },
] as const;

type CompetenceId = typeof COMPETENCES[number]["id"];

function classifyEvaluation(title: string, idx: number): CompetenceId {
    // Étiquette explicite posée à l'enregistrement (« C3 · représenter »)
    const tagged = /^(C[1-6])\s*·/.exec(title.trim());
    if (tagged) return tagged[1] as CompetenceId;
    const t = title.toLowerCase();
    if (t.includes("problème") || t.includes("probleme") || t.includes("chercher"))
        return "C1";
    if (t.includes("modéli") || t.includes("modeli") || t.includes("traduire"))
        return "C2";
    if (
        t.includes("représent") ||
        t.includes("represent") ||
        t.includes("figure") ||
        t.includes("graphique")
    )
        return "C3";
    if (t.includes("raisonn") || t.includes("démontrer") || t.includes("demontrer"))
        return "C4";
    if (t.includes("calcul") || t.includes("opér") || t.includes("oper")) return "C5";
    if (t.includes("communi") || t.includes("expression") || t.includes("orale"))
        return "C6";
    return COMPETENCES[idx % COMPETENCES.length].id;
}

function bucket(
    value: number | null | undefined,
    max = 20,
    c: Pick<SchoolParameters["competences"], "acquiredFrom" | "inProgressFrom"> = DEFAULT_SCHOOL_PARAMETERS.competences,
): "A" | "EC" | "NA" | "NE" {
    if (value === null || value === undefined) return "NE";
    const norm = (Number(value) / max) * 20;
    if (norm >= c.acquiredFrom) return "A";
    if (norm >= c.inProgressFrom) return "EC";
    return "NA";
}

export const GET = createApiHandler(
  async (request, context) => {
    try {
    const session = context.session;

        const { searchParams } = new URL(request.url);
        const classId = searchParams.get("classId");
        const subjectId = searchParams.get("subjectId");
        if (!classId) {
            return NextResponse.json(
                { error: "classId est requis" },
                { status: 400 }
            );
        }

        const klass = await prisma.class.findUnique({
            where: { id: classId },
            include: {
                classLevel: true,
                classSubjects: { include: { subject: true } },
                enrollments: {
                    where: { status: "ACTIVE" },
                    select: { studentId: true },
                },
            },
        });
        if (!klass) {
            return NextResponse.json(
                { error: "Classe introuvable" },
                { status: 404 }
            );
        }
        if (
            session.user.role !== "SUPER_ADMIN" &&
            klass.schoolId !== getActiveSchoolId(session)
        ) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        // Seuils Acquis / En cours réglés par l'école
        const competenceParams = (await getSchoolParameters(klass.schoolId)).competences;

        const classSubjects = subjectId
            ? klass.classSubjects.filter((cs) => cs.subject.id === subjectId)
            : klass.classSubjects;

        const classSubjectIds = classSubjects.map((cs) => cs.id);

        const evaluations = await prisma.evaluation.findMany({
            where: { classSubjectId: { in: classSubjectIds } },
            select: {
                id: true,
                title: true,
                maxGrade: true,
                grades: {
                    where: {
                        studentId: { in: klass.enrollments.map((e) => e.studentId) },
                    },
                    select: { value: true, studentId: true, isAbsent: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // Pre-compute matrix counts by competence and bucket
        const matrix: Record<CompetenceId, { A: number; EC: number; NA: number; NE: number }> =
            {
                C1: { A: 0, EC: 0, NA: 0, NE: 0 },
                C2: { A: 0, EC: 0, NA: 0, NE: 0 },
                C3: { A: 0, EC: 0, NA: 0, NE: 0 },
                C4: { A: 0, EC: 0, NA: 0, NE: 0 },
                C5: { A: 0, EC: 0, NA: 0, NE: 0 },
                C6: { A: 0, EC: 0, NA: 0, NE: 0 },
            };

        // Per-student best-known status per competence
        const perStudent = new Map<string, Partial<Record<CompetenceId, "A" | "EC" | "NA">>>();

        evaluations.forEach((ev, idx) => {
            const comp = classifyEvaluation(ev.title || "", idx);
            const max = Number(ev.maxGrade) || 20;
            for (const g of ev.grades) {
                if (g.isAbsent) continue;
                const bk = bucket(g.value !== null ? Number(g.value) : null, max, competenceParams);
                if (bk === "NE") continue;
                const map = perStudent.get(g.studentId) ?? {};
                // Best score wins (A > EC > NA)
                const prev = map[comp];
                const rank = { A: 3, EC: 2, NA: 1, NE: 0 } as const;
                if (!prev || rank[bk] > rank[prev]) {
                    map[comp] = bk;
                }
                perStudent.set(g.studentId, map);
            }
        });

        // Roll up to matrix counts
        const totalStudents = klass.enrollments.length;
        for (const compMeta of COMPETENCES) {
            const comp = compMeta.id;
            let A = 0;
            let EC = 0;
            let NA = 0;
            for (const map of perStudent.values()) {
                const v = map[comp];
                if (v === "A") A += 1;
                else if (v === "EC") EC += 1;
                else if (v === "NA") NA += 1;
            }
            const NE = totalStudents - (A + EC + NA);
            matrix[comp] = { A, EC, NA, NE: Math.max(0, NE) };
        }

        // Insights
        const rows = COMPETENCES.map((c) => ({
            ...c,
            counts: matrix[c.id],
            pctAcquis: totalStudents > 0 ? matrix[c.id].A / totalStudents : 0,
        }));
        const strong = rows.filter((r) => r.pctAcquis >= 0.7).map((r) => r.id);
        const toReinforce = rows
            .filter((r) => r.pctAcquis >= 0.4 && r.pctAcquis < 0.7)
            .sort((a, b) => a.pctAcquis - b.pctAcquis)
            .map((r) => r.id);
        const critical = rows
            .filter((r) => r.pctAcquis < 0.4)
            .sort((a, b) => a.counts.NA - b.counts.NA)
            .map((r) => r.id);

        return NextResponse.json({
            class: {
                id: klass.id,
                name: klass.name,
                level: klass.classLevel.name,
                size: totalStudents,
            },
            subject: subjectId
                ? classSubjects[0]?.subject
                    ? {
                          id: classSubjects[0].subject.id,
                          name: classSubjects[0].subject.name,
                      }
                    : null
                : null,
            competences: COMPETENCES,
            matrix,
            insights: {
                strong,
                toReinforce,
                critical,
            },
        });
    } catch (error) {
        logger.error("competences:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du calcul des compétences" },
            { status: 500 }
        );
    }

  },
  { allowedRoles: ROLES },
);


const competenceEvaluationSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  competenceId: z.enum(["C1", "C2", "C3", "C4", "C5", "C6"]),
  level: z.enum(["A", "EC", "NA"]),
});

/**
 * Enregistre une évaluation de compétence pour les élèves actifs de la classe.
 * Réservé à l'enseignant de la matière, dans la période en cours, hors période
 * figée. Le type « Compétence » est classé hors moyenne : ces niveaux
 * alimentent la grille de compétences sans jamais modifier les moyennes.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const parsed = competenceEvaluationSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Classe, matière, compétence (C1 à C6) et niveau (Acquis, En cours, Non acquis) sont requis." },
        { status: 400 },
      );
    }
    const { classId, subjectId, competenceId, level } = parsed.data;
    const schoolId = getActiveSchoolId(session);

    const klass = await prisma.class.findFirst({
      where: { id: classId, ...(schoolId ? { schoolId } : {}) },
      select: {
        schoolId: true,
        classSubjects: {
          where: { subjectId },
          select: { id: true, classId: true, teacher: { select: { userId: true } } },
        },
        enrollments: { where: { status: "ACTIVE" }, select: { studentId: true } },
      },
    });
    if (!klass) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    const classSubject = klass.classSubjects[0];
    // Valeur enregistrée pour chaque niveau, réglée par l'école
    const { scoreAcquired, scoreInProgress, scoreNotAcquired } = (await getSchoolParameters(klass.schoolId)).competences;
    const levelScore = { A: scoreAcquired, EC: scoreInProgress, NA: scoreNotAcquired } as const;
    if (!classSubject) return NextResponse.json({ error: "Cette matière n'est pas enseignée dans la classe." }, { status: 400 });

    const notTeacher = assertSubjectTeacher(session, classSubject);
    if (notTeacher) return notTeacher;

    // Période en cours (celle qui contient la date du jour), pas la première de l'année
    const now = new Date();
    const period = await prisma.period.findFirst({
      where: {
        academicYear: { schoolId: klass.schoolId, isCurrent: true },
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true },
    });
    if (!period) {
      return NextResponse.json({ error: "Aucune période en cours aujourd'hui pour cet établissement." }, { status: 400 });
    }
    const yearLock = await guardPeriodWritable(period.id);
    if (yearLock) return yearLock;
    const councilLock = await assertNotCouncilLocked(classSubject.classId, period.id);
    if (councilLock) return councilLock;

    const type = await prisma.evaluationType.upsert({
      where: { schoolId_code: { schoolId: klass.schoolId, code: "COMPETENCE" } },
      create: { schoolId: klass.schoolId, code: "COMPETENCE", name: "Compétence", category: "COMPETENCE" },
      update: { category: "COMPETENCE" },
      select: { id: true },
    });

    const label = COMPETENCES.find((c) => c.id === competenceId)!.label;
    const evaluation = await prisma.evaluation.create({
      data: {
        classSubjectId: classSubject.id,
        periodId: period.id,
        typeId: type.id,
        title: label,
        date: now,
        maxGrade: 20,
        grades: {
          create: klass.enrollments.map((enrollment) => ({
            studentId: enrollment.studentId,
            value: levelScore[level],
          })),
        },
      },
    });
    return NextResponse.json({ id: evaluation.id }, { status: 201 });
  },
  { allowedRoles: ["TEACHER"] },
);
