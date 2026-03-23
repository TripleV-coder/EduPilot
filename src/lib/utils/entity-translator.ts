/**
 * Utility to translate technical entity names to user-friendly French names
 */

/**
 * Check if word starts with vowel sound for proper French grammar
 */
export function startsWithVowel(word: string): boolean {
  const vowels = ['a', 'e', 'i', 'o', 'u', 'é', 'è', 'ê', 'à', 'â', 'î', 'ô', 'û', 'h'];
  return vowels.includes(word.charAt(0).toLowerCase());
}

/**
 * Translate entity name to French
 */
export function translateEntity(entity: string): string {
  const translations: Record<string, string> = {
    // Users & Auth
    user: "utilisateur",
    account: "compte",
    session: "session",

    // School Structure
    school: "école",
    class: "classe",
    classlevel: "niveau scolaire",
    subject: "matière",
    classsubject: "matière de classe",
    enrollment: "inscription",

    // Academic
    grade: "note",
    evaluation: "évaluation",
    evaluationtype: "type d'évaluation",
    homework: "devoir",
    homeworksubmission: "rendu de devoir",
    schedule: "emploi du temps",
    academicyear: "année scolaire",
    period: "période",

    // Attendance
    attendance: "présence",

    // Students & Teachers
    student: "élève",
    studentprofile: "profil élève",
    teacher: "enseignant",
    teacherprofile: "profil enseignant",
    parent: "parent",
    parentprofile: "profil parent",
    parentstudent: "lien parent-élève",

    // Financial
    payment: "paiement",
    paymentplan: "plan de paiement",
    installmentpayment: "échéance",
    fee: "frais",
    scholarship: "bourse",

    // Communication
    message: "message",
    notification: "notification",
    announcement: "annonce",

    // Events & Calendar
    schoolevent: "événement scolaire",
    eventparticipation: "participation événement",
    appointment: "rendez-vous",
    teacheravailability: "disponibilité enseignant",
    schoolholiday: "vacances scolaires",
    publicholiday: "jour férié",
    schoolcalendarevent: "événement calendrier",

    // Resources & Learning
    resource: "ressource",
    course: "cours",
    coursemodule: "module de cours",
    lesson: "leçon",
    courseenrollment: "inscription cours",
    lessoncompletion: "complétion leçon",
    certificate: "certificat",

    // Exams
    examtemplate: "modèle d'examen",
    examsession: "session d'examen",
    examanswer: "réponse d'examen",
    question: "question",

    // Medical & Health
    medicalrecord: "dossier médical",
    allergy: "allergie",
    vaccination: "vaccination",
    emergencycontact: "contact d'urgence",

    // Behavior & Discipline
    behaviorincident: "incident comportemental",
    sanction: "sanction",

    // Orientation & Analytics
    studentorientation: "orientation élève",
    orientationrecommendation: "recommandation d'orientation",
    subjectgroupanalysis: "analyse de groupe",
    studentanalytics: "analytique élève",
    subjectperformance: "performance matière",
    gradehistory: "historique des notes",

    // Compliance & Data
    dataconsent: "consentement données",
    dataretentionpolicy: "politique de rétention",
    dataaccessrequest: "demande d'accès données",
    auditlog: "journal d'audit",

    // Configuration
    systemsetting: "paramètre système",
    academicconfig: "configuration académique",
    configoption: "option de configuration",

    // Reference Data
    city: "ville",
    profession: "profession",
    nationality: "nationalité",
    subjectcategory: "catégorie de matière",
  };

  const normalized = entity.toLowerCase().trim();
  return translations[normalized] || entity;
}

/**
 * Format action with proper French grammar
 */
export function formatAction(action: string, entity: string): string {
  const translatedEntity = translateEntity(entity);

  switch (action) {
    case "CREATE":
      return startsWithVowel(translatedEntity)
        ? `Création d'${translatedEntity}`
        : `Création de ${translatedEntity}`;
    case "UPDATE":
      return startsWithVowel(translatedEntity)
        ? `Modification d'${translatedEntity}`
        : `Modification de ${translatedEntity}`;
    case "DELETE":
      return startsWithVowel(translatedEntity)
        ? `Suppression d'${translatedEntity}`
        : `Suppression de ${translatedEntity}`;
    case "EXPORT":
      return `Export de ${translatedEntity}`;
    case "LOGIN":
    case "LOGIN_SUCCESS":
      return "Connexion réussie";
    case "LOGIN_FAILED":
      return "Tentative de connexion échouée";
    case "LOGIN_FAILED_LOCKED":
      return "Tentative de connexion sur compte verrouillé";
    case "LOGOUT":
      return "Déconnexion";
    case "VIEW":
      return startsWithVowel(translatedEntity)
        ? `Consultation d'${translatedEntity}`
        : `Consultation de ${translatedEntity}`;
    case "IMPORT":
      return startsWithVowel(translatedEntity)
        ? `Import d'${translatedEntity}`
        : `Import de ${translatedEntity}`;
    case "SUBMIT":
      return startsWithVowel(translatedEntity)
        ? `Soumission d'${translatedEntity}`
        : `Soumission de ${translatedEntity}`;
    case "GRADE":
      return `Notation de ${translatedEntity}`;
    case "ENROLL":
      return startsWithVowel(translatedEntity)
        ? `Inscription à ${translatedEntity}`
        : `Inscription à ${translatedEntity}`;
    case "ATTENDANCE":
      return `Prise de présence`;
    default:
      return `${action} - ${translatedEntity}`;
  }
}
