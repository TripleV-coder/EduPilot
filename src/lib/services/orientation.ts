import prisma from "@/lib/prisma";
import { RecommendedSeries, SubjectGroup, PerformanceTrend } from "@prisma/client";

/**
 * Service d'orientation scolaire
 * Analyse les performances et recommande des séries
 */

// ============================================
// MAPPING MATIÈRES → GROUPES
// ============================================

const SUBJECT_GROUP_KEYWORDS: Record<SubjectGroup, string[]> = {
  LITTERAIRE: ["français", "littérature", "philosophie", "histoire", "géographie"],
  SCIENTIFIQUE: ["mathématiques", "maths", "physique", "chimie", "svt", "sciences"],
  ECONOMIQUE: ["économie", "comptabilité", "gestion", "commerce"],
  TECHNIQUE: ["technologie", "dessin", "technique", "informatique"],
  LANGUES: ["anglais", "allemand", "espagnol", "langue"],
  ARTS: ["arts", "musique", "dessin"],
  SPORT: ["eps", "sport", "éducation physique"],
};

/**
 * Détermine le groupe d'une matière basé sur son nom
 */
export function classifySubject(subjectName: string): SubjectGroup | null {
  const name = subjectName.toLowerCase();

  for (const [group, keywords] of Object.entries(SUBJECT_GROUP_KEYWORDS)) {
    if (keywords.some((keyword) => name.includes(keyword))) {
      return group as SubjectGroup;
    }
  }

  return null;
}

// ============================================
// RÈGLES D'ORIENTATION PAR SÉRIE
// ============================================

interface SeriesRequirements {
  series: RecommendedSeries;
  name: string;
  primaryGroup: SubjectGroup;
  secondaryGroups: SubjectGroup[];
  minAverageRequired: number;
  description: string;
}

const SERIES_REQUIREMENTS: SeriesRequirements[] = [
  {
    series: "SERIE_C",
    name: "Série C (Maths-Physique)",
    primaryGroup: "SCIENTIFIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 12,
    description: "Mathématiques et Sciences Physiques - pour les profils scientifiques forts",
  },
  {
    series: "SERIE_D",
    name: "Série D (Sciences de la Vie)",
    primaryGroup: "SCIENTIFIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 11,
    description: "Sciences de la Vie et de la Terre - profil scientifique équilibré",
  },
  {
    series: "SERIE_A1",
    name: "Série A1 (Littéraire - Lettres et Langues)",
    primaryGroup: "LITTERAIRE",
    secondaryGroups: ["LANGUES"],
    minAverageRequired: 10,
    description: "Littéraire - pour les profils forts en lettres et langues",
  },
  {
    series: "SERIE_A2",
    name: "Série A2 (Littéraire - Sciences Humaines)",
    primaryGroup: "LITTERAIRE",
    secondaryGroups: ["LANGUES", "ECONOMIQUE"],
    minAverageRequired: 10,
    description: "Littéraire - pour les profils forts en sciences humaines",
  },
  {
    series: "SERIE_B",
    name: "Série B (Économique et Social)",
    primaryGroup: "ECONOMIQUE",
    secondaryGroups: ["LITTERAIRE", "SCIENTIFIQUE"],
    minAverageRequired: 10,
    description: "Économique et Social - profil équilibré entre lettres et sciences",
  },
  {
    series: "SERIE_E",
    name: "Série E (Maths-Technique)",
    primaryGroup: "SCIENTIFIQUE",
    secondaryGroups: ["TECHNIQUE"],
    minAverageRequired: 11,
    description: "Mathématiques et Technique - sciences appliquées",
  },
  {
    series: "SERIE_G1",
    name: "Série G1 (Techniques Administratives)",
    primaryGroup: "ECONOMIQUE",
    secondaryGroups: ["TECHNIQUE"],
    minAverageRequired: 9,
    description: "Techniques Administratives - gestion et administration",
  },
  {
    series: "SERIE_G2",
    name: "Série G2 (Techniques Quantitatives de Gestion)",
    primaryGroup: "ECONOMIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 10,
    description: "Techniques Quantitatives de Gestion - gestion avec mathématiques",
  },
  {
    series: "SERIE_G3",
    name: "Série G3 (Techniques Commerciales)",
    primaryGroup: "ECONOMIQUE",
    secondaryGroups: ["LANGUES"],
    minAverageRequired: 9,
    description: "Techniques Commerciales - commerce et vente",
  },
  {
    series: "SERIE_F1",
    name: "Série F1 (Fabrication Mécanique)",
    primaryGroup: "TECHNIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 9,
    description: "Fabrication Mécanique - techniques industrielles",
  },
  {
    series: "SERIE_F2",
    name: "Série F2 (Électronique)",
    primaryGroup: "TECHNIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 9,
    description: "Électronique - technologies électroniques",
  },
  {
    series: "SERIE_F3",
    name: "Série F3 (Électrotechnique)",
    primaryGroup: "TECHNIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 9,
    description: "Électrotechnique - technologies électriques",
  },
  {
    series: "SERIE_F4",
    name: "Série F4 (Génie Civil)",
    primaryGroup: "TECHNIQUE",
    secondaryGroups: ["SCIENTIFIQUE"],
    minAverageRequired: 9,
    description: "Génie Civil - construction et bâtiment",
  },
  {
    series: "FORMATION_PRO",
    name: "Formation Professionnelle",
    primaryGroup: "TECHNIQUE",
    secondaryGroups: [],
    minAverageRequired: 8,
    description: "Formation professionnelle spécialisée",
  },
];

// ============================================
// ANALYSE ET SCORING
// ============================================

/**
 * Calcule le score de compatibilité pour une série
 */
function calculateSeriesScore(
  requirements: SeriesRequirements,
  groupAverages: Map<SubjectGroup, number>,
  generalAverage: number
): {
  score: number;
  strengths: string[];
  warnings: string[];
} {
  const strengths: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // 1. Vérifier moyenne générale minimum
  if (generalAverage >= requirements.minAverageRequired) {
    score += 20;
    strengths.push(`Moyenne générale suffisante (${generalAverage.toFixed(2)}/20)`);
  } else {
    score -= 20;
    warnings.push(
      `Moyenne générale insuffisante (${generalAverage.toFixed(2)}/20, minimum requis: ${requirements.minAverageRequired}/20)`
    );
  }

  // 2. Analyser le groupe principal
  const primaryAvg = groupAverages.get(requirements.primaryGroup);
  if (primaryAvg !== undefined) {
    if (primaryAvg >= 14) {
      score += 40;
      strengths.push(`Excellent niveau en ${requirements.primaryGroup} (${primaryAvg.toFixed(2)}/20)`);
    } else if (primaryAvg >= 12) {
      score += 30;
      strengths.push(`Bon niveau en ${requirements.primaryGroup} (${primaryAvg.toFixed(2)}/20)`);
    } else if (primaryAvg >= 10) {
      score += 15;
      strengths.push(`Niveau correct en ${requirements.primaryGroup} (${primaryAvg.toFixed(2)}/20)`);
    } else if (primaryAvg >= 8) {
      score += 5;
      warnings.push(`Niveau faible en ${requirements.primaryGroup} (${primaryAvg.toFixed(2)}/20)`);
    } else {
      score -= 10;
      warnings.push(`Niveau insuffisant en ${requirements.primaryGroup} (${primaryAvg.toFixed(2)}/20)`);
    }
  } else {
    warnings.push(`Pas de données pour ${requirements.primaryGroup}`);
  }

  // 3. Analyser les groupes secondaires
  for (const group of requirements.secondaryGroups) {
    const secondaryAvg = groupAverages.get(group);
    if (secondaryAvg !== undefined) {
      if (secondaryAvg >= 12) {
        score += 15;
        strengths.push(`Bon niveau en ${group} (${secondaryAvg.toFixed(2)}/20)`);
      } else if (secondaryAvg >= 10) {
        score += 10;
      } else if (secondaryAvg < 8) {
        warnings.push(`Niveau faible en ${group} (${secondaryAvg.toFixed(2)}/20)`);
      }
    }
  }

  // 4. Bonus si toutes les moyennes sont > 10
  const allAbove10 = Array.from(groupAverages.values()).every((avg) => avg >= 10);
  if (allAbove10) {
    score += 10;
    strengths.push("Profil équilibré sans points faibles majeurs");
  }

  // Normaliser le score sur 100
  score = Math.max(0, Math.min(100, score));

  return { score, strengths, warnings };
}

// ============================================
// GÉNÉRATION DES RECOMMANDATIONS
// ============================================

/**
 * Génère les recommandations d'orientation pour un élève
 */
export async function generateOrientationRecommendations(orientationId: string) {
  // 1. Récupérer l'orientation et les données de l'élève
  const orientation = await prisma.studentOrientation.findUnique({
    where: { id: orientationId },
    include: {
      student: {
        include: {
          enrollments: {
            where: {
              academicYearId: "",
              status: "ACTIVE",
            },
            include: {
              class: {
                include: {
                  classSubjects: {
                    include: {
                      subject: true,
                      evaluations: {
                        include: {
                          grades: {
                            where: { studentId: "" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      academicYear: true,
    },
  });

  if (!orientation) {
    throw new Error("Orientation not found");
  }

  // Mise à jour des IDs dans la requête
  const orientationWithData = await prisma.studentOrientation.findUnique({
    where: { id: orientationId },
    include: {
      student: {
        include: {
          enrollments: {
            where: {
              academicYearId: orientation.academicYearId,
              status: "ACTIVE",
            },
            include: {
              class: {
                include: {
                  classSubjects: {
                    include: {
                      subject: true,
                      evaluations: {
                        include: {
                          grades: {
                            where: { studentId: orientation.studentId },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!orientationWithData?.student.enrollments[0]) {
    throw new Error("No active enrollment found");
  }

  const enrollment = orientationWithData.student.enrollments[0];

  // 2. Calculer les moyennes par groupe de matières
  const groupGrades: Map<SubjectGroup, number[]> = new Map();

  for (const cs of enrollment.class.classSubjects) {
    const subjectGroup = classifySubject(cs.subject.name);
    if (!subjectGroup) continue;

    const grades = cs.evaluations
      .flatMap((ev) => ev.grades)
      .filter((g) => g.value !== null && !g.isAbsent)
      .map((g) => Number(g.value));

    if (grades.length > 0) {
      if (!groupGrades.has(subjectGroup)) {
        groupGrades.set(subjectGroup, []);
      }
      groupGrades.get(subjectGroup)!.push(...grades);
    }
  }

  // Calculer les moyennes par groupe
  const groupAverages: Map<SubjectGroup, number> = new Map();
  for (const [group, grades] of groupGrades) {
    const average = grades.reduce((sum, g) => sum + g, 0) / grades.length;
    groupAverages.set(group, average);
  }

  // 3. Calculer la moyenne générale
  const allGrades = Array.from(groupGrades.values()).flat();
  const generalAverage =
    allGrades.length > 0 ? allGrades.reduce((sum, g) => sum + g, 0) / allGrades.length : 0;

  // 4. Sauvegarder les analyses par groupe
  for (const [group, grades] of groupGrades) {
    const average = groupAverages.get(group)!;
    const min = Math.min(...grades);
    const max = Math.max(...grades);

    // Calculer la tendance (à implémenter avec historique)
    const trend: PerformanceTrend = "STABLE";

    // Calculer le taux de constance
    const stdDev = Math.sqrt(
      grades.reduce((sum, g) => sum + Math.pow(g - average, 2), 0) / grades.length
    );
    const consistency = Math.max(0, 100 - (stdDev / average) * 100);

    await prisma.subjectGroupAnalysis.upsert({
      where: {
        orientationId_subjectGroup: {
          orientationId,
          subjectGroup: group,
        },
      },
      create: {
        orientationId,
        subjectGroup: group,
        averageScore: average,
        trend,
        consistency,
        gradesCount: grades.length,
        minGrade: min,
        maxGrade: max,
      },
      update: {
        averageScore: average,
        trend,
        consistency,
        gradesCount: grades.length,
        minGrade: min,
        maxGrade: max,
      },
    });
  }

  // 5. Calculer les scores pour toutes les séries
  const recommendations: Array<{
    series: RecommendedSeries;
    score: number;
    strengths: string[];
    warnings: string[];
    justification: string;
  }> = [];

  for (const req of SERIES_REQUIREMENTS) {
    const { score, strengths, warnings } = calculateSeriesScore(
      req,
      groupAverages,
      generalAverage
    );

    const justification = `
**${req.name}**

${req.description}

**Analyse:**
- Moyenne générale: ${generalAverage.toFixed(2)}/20
- Groupe principal (${req.primaryGroup}): ${groupAverages.get(req.primaryGroup)?.toFixed(2) ?? "N/A"}/20
${req.secondaryGroups.map((g) => `- Groupe secondaire (${g}): ${groupAverages.get(g)?.toFixed(2) ?? "N/A"}/20`).join("\n")}

**Score de compatibilité:** ${score}/100
    `.trim();

    recommendations.push({
      series: req.series,
      score,
      strengths,
      warnings,
      justification,
    });
  }

  // Trier par score décroissant
  recommendations.sort((a, b) => b.score - a.score);

  // 6. Sauvegarder les 3 meilleures recommandations
  const topRecommendations = recommendations.slice(0, 3);

  for (let i = 0; i < topRecommendations.length; i++) {
    const rec = topRecommendations[i];

    await prisma.orientationRecommendation.create({
      data: {
        orientationId,
        recommendedSeries: rec.series,
        rank: i + 1,
        score: rec.score,
        justification: rec.justification,
        strengths: rec.strengths,
        warnings: rec.warnings,
      },
    });
  }

  // 7. Mettre à jour le statut de l'orientation
  await prisma.studentOrientation.update({
    where: { id: orientationId },
    data: {
      status: "RECOMMENDED",
    },
  });

  return topRecommendations;
}
