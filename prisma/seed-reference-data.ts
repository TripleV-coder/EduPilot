import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const beninDepartments = [
  "Alibori", "Atacora", "Atlantique", "Borgou",
  "Collines", "Couffo", "Donga", "Littoral",
  "Mono", "Ouémé", "Plateau", "Zou"
];

export const beninExams = [
  { name: "CEP", label: "Certificat d'Études Primaires" },
  { name: "BEPC", label: "Brevet d'Études du Premier Cycle" },
  { name: "BAC", label: "Baccalauréat" }
];

export const beninSeries = [
  // Enseignement Général
  { code: "A1", label: "Série A1 (Lettres)" },
  { code: "A2", label: "Série A2 (Lettres)" },
  { code: "B", label: "Série B (Sciences Sociales)" },
  { code: "C", label: "Série C (Mathématiques et Physiques)" },
  { code: "D", label: "Série D (Sciences Biologiques)" },
  // Enseignement Technique (Exemples)
  { code: "G1", label: "Série G1 (Techniques Administratives)" },
  { code: "G2", label: "Série G2 (Techniques Quantitatives de Gestion)" },
  { code: "G3", label: "Série G3 (Techniques Commerciales)" },
  { code: "F3", label: "Série F3 (Electrotechnique)" },
  { code: "F4", label: "Série F4 (Génie Civil)" },
];

export const educationLevels = [
  { code: "CI", name: "Cours d'Initiation", level: "PRIMARY" },
  { code: "CP", name: "Cours Préparatoire", level: "PRIMARY" },
  { code: "CE1", name: "Cours Élémentaire 1", level: "PRIMARY" },
  { code: "CE2", name: "Cours Élémentaire 2", level: "PRIMARY" },
  { code: "CM1", name: "Cours Moyen 1", level: "PRIMARY" },
  { code: "CM2", name: "Cours Moyen 2", level: "PRIMARY" },
  { code: "6EME", name: "6ème", level: "SECONDARY_COLLEGE" },
  { code: "5EME", name: "5ème", level: "SECONDARY_COLLEGE" },
  { code: "4EME", name: "4ème", level: "SECONDARY_COLLEGE" },
  { code: "3EME", name: "3ème", level: "SECONDARY_COLLEGE" },
  { code: "2NDE", name: "2nde", level: "SECONDARY_LYCEE" },
  { code: "1ERE", name: "1ère", level: "SECONDARY_LYCEE" },
  { code: "TLE", name: "Terminale", level: "SECONDARY_LYCEE" },
];

export const defaultAchievements = [
  { code: "PERFECT_ATTENDANCE", name: "Présence Parfaite", description: "Aucune absence sur le mois", points: 50, icon: "calendar-check" },
  { code: "TOP_STUDENT", name: "Major de Promotion", description: "Meilleure moyenne de la classe", points: 100, icon: "trophy" },
  { code: "HOMEWORK_HERO", name: "Héros des Devoirs", description: "10 devoirs rendus à l'heure consécutivement", points: 30, icon: "book-open" },
  { code: "EARLY_BIRD", name: "Lève-tôt", description: "Arrivée à l'heure tous les jours de la semaine", points: 20, icon: "sun" },
  { code: "MATH_WIZARD", name: "Génie des Maths", description: "18+ en Mathématiques", points: 40, icon: "calculator" },
];

export async function seedBeninReferenceData() {
  console.log("🇧🇯 Seeding Bénin Reference Data...");

  const referenceData = {
    departments: beninDepartments,
    exams: beninExams,
    series: beninSeries,
    levels: educationLevels,
    achievements: defaultAchievements
  };

  // Upsert global configuration
  await prisma.systemSetting.upsert({
    where: { key: "REF_BENIN_CONFIG" },
    update: {
      value: JSON.stringify(referenceData),
      updatedBy: "SYSTEM"
    },
    create: {
      key: "REF_BENIN_CONFIG",
      value: JSON.stringify(referenceData),
      type: "JSON",
      isSecret: false,
      updatedBy: "SYSTEM"
    }
  });

  console.log("   ✅ Configuration système Bénin insérée (REF_BENIN_CONFIG)");
}
