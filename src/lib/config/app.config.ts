/**
 * Configuration globale de l'application EduPilot
 * Adaptée pour le système éducatif béninois
 */

export const APP_CONFIG = {
  // Informations de base
  name: "EduPilot",
  description: "Plateforme de gestion scolaire pour le Bénin",
  version: "1.0.0",
  country: "Bénin",
  currency: "FCFA",
  timezone: "Africa/Porto-Novo",

  // Système éducatif béninois
  education: {
    // Types d'établissements supportés
    schoolTypes: [
      { value: "PRIMAIRE", label: "École Primaire", description: "CP1 à CM2" },
      { value: "COLLEGE", label: "Collège", description: "6ème à 3ème" },
      { value: "LYCEE", label: "Lycée", description: "2nde à Terminale" },
      { value: "COMPLEXE", label: "Complexe Scolaire", description: "Primaire + Collège + Lycée" },
    ],

    // Niveaux scolaires (Primaire)
    niveauxPrimaire: [
      { code: "CP1", name: "Cours Préparatoire 1ère année", order: 1 },
      { code: "CP2", name: "Cours Préparatoire 2ème année", order: 2 },
      { code: "CE1", name: "Cours Élémentaire 1ère année", order: 3 },
      { code: "CE2", name: "Cours Élémentaire 2ème année", order: 4 },
      { code: "CM1", name: "Cours Moyen 1ère année", order: 5 },
      { code: "CM2", name: "Cours Moyen 2ème année", order: 6 },
    ],

    // Niveaux collège
    niveauxCollege: [
      { code: "6EME", name: "Sixième", order: 7 },
      { code: "5EME", name: "Cinquième", order: 8 },
      { code: "4EME", name: "Quatrième", order: 9 },
      { code: "3EME", name: "Troisième", order: 10 },
    ],

    // Niveaux lycée
    niveauxLycee: [
      { code: "2NDE", name: "Seconde", order: 11 },
      { code: "1ERE", name: "Première", order: 12 },
      { code: "TLE", name: "Terminale", order: 13 },
    ],

    // Séries du lycée
    seriesLycee: [
      { code: "A", name: "Série A - Littéraire" },
      { code: "C", name: "Série C - Mathématiques et Sciences Physiques" },
      { code: "D", name: "Série D - Mathématiques et Sciences de la Vie et de la Terre" },
      { code: "E", name: "Série E - Mathématiques et Techniques" },
      { code: "F", name: "Série F - Techniques Industrielles" },
      { code: "G", name: "Série G - Économie et Gestion" },
    ],

    // Trimestres/Semestres
    periods: [
      { type: "TRIMESTRE", name: "1er Trimestre", order: 1, startMonth: 9, endMonth: 12 },
      { type: "TRIMESTRE", name: "2ème Trimestre", order: 2, startMonth: 1, endMonth: 3 },
      { type: "TRIMESTRE", name: "3ème Trimestre", order: 3, startMonth: 4, endMonth: 6 },
    ],

    // Système de notation
    grading: {
      min: 0,
      max: 20,
      passing: 10,
      excellent: 16,
      scales: [
        { min: 0, max: 4.99, label: "Très Insuffisant", color: "red" },
        { min: 5, max: 9.99, label: "Insuffisant", color: "orange" },
        { min: 10, max: 11.99, label: "Passable", color: "yellow" },
        { min: 12, max: 13.99, label: "Assez Bien", color: "blue" },
        { min: 14, max: 15.99, label: "Bien", color: "green" },
        { min: 16, max: 20, label: "Très Bien", color: "emerald" },
      ],
    },

    // Année scolaire (septembre à juin)
    academicYear: {
      startMonth: 9, // Septembre
      endMonth: 6,   // Juin
    },
  },

  // Configuration des rôles
  roles: {
    SUPER_ADMIN: {
      label: "Super Administrateur",
      description: "Accès complet à toute la plateforme",
      color: "red",
    },
    SCHOOL_ADMIN: {
      label: "Administrateur d'École",
      description: "Gestion complète d'un établissement",
      color: "purple",
    },
    DIRECTOR: {
      label: "Directeur",
      description: "Direction pédagogique et administrative",
      color: "blue",
    },
    TEACHER: {
      label: "Enseignant",
      description: "Enseignement et suivi pédagogique",
      color: "green",
    },
    PARENT: {
      label: "Parent",
      description: "Suivi de la scolarité des enfants",
      color: "orange",
    },
    STUDENT: {
      label: "Élève",
      description: "Accès aux ressources pédagogiques",
      color: "cyan",
    },
  },

  // Messages et textes
  messages: {
    welcome: "Bienvenue sur EduPilot",
    loginSuccess: "Connexion réussie",
    loginError: "Email ou mot de passe incorrect",
    sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    unauthorized: "Vous n'êtes pas autorisé à accéder à cette ressource",
    notFound: "Page non trouvée",
    serverError: "Une erreur est survenue. Veuillez réessayer.",
  },

  // Configuration UI
  ui: {
    // Couleurs principales (Tailwind)
    colors: {
      primary: "blue",
      secondary: "purple",
      accent: "green",
      danger: "red",
      warning: "orange",
      success: "green",
    },

    // Thème par défaut
    defaultTheme: "light",

    // Pagination
    pagination: {
      defaultPageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
    },
  },

  // Formats
  formats: {
    date: "dd/MM/yyyy",
    datetime: "dd/MM/yyyy HH:mm",
    time: "HH:mm",
    currency: "0,0",
  },

  // Limites
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxStudentsPerClass: 60,
    maxClassesPerTeacher: 10,
    maxChildrenPerParent: 10,
  },

  // Fonctionnalités activées
  features: {
    attendance: true,
    grades: true,
    bulletins: true,
    homework: true,
    timetable: true,
    messaging: true,
    payments: true,
    library: true,
    canteen: true,
    transport: true,
    medical: true,
    events: true,
    reports: true,
    analytics: true,
  },
};

// Helper pour obtenir tous les niveaux
export function getAllClassLevels() {
  return [
    ...APP_CONFIG.education.niveauxPrimaire,
    ...APP_CONFIG.education.niveauxCollege,
    ...APP_CONFIG.education.niveauxLycee,
  ];
}

// Helper pour obtenir les niveaux par type d'école
export function getClassLevelsBySchoolType(schoolType: string) {
  switch (schoolType) {
    case "PRIMAIRE":
      return APP_CONFIG.education.niveauxPrimaire;
    case "COLLEGE":
      return APP_CONFIG.education.niveauxCollege;
    case "LYCEE":
      return APP_CONFIG.education.niveauxLycee;
    case "COMPLEXE":
      return getAllClassLevels();
    default:
      return getAllClassLevels();
  }
}

// Helper pour formatter la note
export function formatGrade(grade: number) {
  const scale = APP_CONFIG.education.grading.scales.find(
    (s) => grade >= s.min && grade <= s.max
  );
  return scale || APP_CONFIG.education.grading.scales[0];
}

// Helper pour vérifier si une note est suffisante
export function isPassingGrade(grade: number) {
  return grade >= APP_CONFIG.education.grading.passing;
}

export default APP_CONFIG;
