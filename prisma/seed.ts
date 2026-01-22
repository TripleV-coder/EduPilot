import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBeninReferenceData } from "./seed-reference-data";

const prisma = new PrismaClient();

// ============================================
// DONNÉES RÉALISTES POUR LE BÉNIN
// ============================================
const cities = ["Cotonou", "Porto-Novo", "Abomey-Calavi", "Bohicon", "Parakou", "Djougou", "Natitingou", "Lokossa", "Ouidah", "Kandi"];
const nationalities = ["Beninoise", "Togolaise", "Nigériane", "Ghanéenne", "Française", "Ivoirienne"];
const firstNamesMale = ["Koffi", "Jean", "Pierre", "David", "Fabrice", "Ange", "Christian", "Didier", "Michaël", "Alain", "Beni", "Cédric", "Eric", "Fidèle", "Gilles", "Hubert", "Ismaël", "Josué", "Kevin", "Loïc", "Marcel", "Nicolas", "Olivier", "Patrick", "Rodrigue", "Serge", "Théodore", "Ulrich", "Victor", "Wilfried"];
const firstNamesFemale = ["Amina", "Esther", "Marie", "Fatou", "Aicha", "Nadia", "Claire", "Émilie", "Florence", "Grace", "Hortense", "Irène", "Julie", "Kate", "Laura", "Mireille", "Nathalie", "Olivia", "Patricia", "Rosine", "Sandrine", "Thérèse", "Ursule", "Véronique", "Wivine", "Xavière", "Yvonne", "Zoé"];
const lastNames = ["Agbossou", "Dossou", "Chabi", "Hounkpatin", "Ahounou", "Bello", "Togan", "Zinsou", "Kêkê", "Sèhouéto", "Coulibaly", "Diarra", "Bamba", "Diallo", "Ouattara", "Taloti", "Gandonou", "Houétchénou", "Yacoubou", "Adjavon", "Sossou", "Gbèdji", "Akpovo", "Djidonou", "Fanougbo", "Gnanhoui", "Hounmenou", "Idohou", "Jidohou", "Kounou"];

const professions = [
  "Commerçant", "Fonctionnaire", "Artisan", "Agriculteur", "Infirmier",
  "Enseignant", "Médecin", "Avocat", "Ingénieur", "Chauffeur",
  "Comptable", "Pharmacien", "Architecte", "Journaliste", "Banquier",
  "Entrepreneur", "Mécanicien", "Coiffeur", "Couturier", "Menuisier"
];

// ============================================
// FONCTIONS UTILITAIRES
// ============================================
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomGrade(min: number = 4, max: number = 20): number {
  return Math.round((Math.random() * (max - min) + min) * 2) / 2;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function generatePhone(): Promise<string> {
  return `+229 ${randomInt(60, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`;
}

function generateMatricule(prefix: string, index: number, year: number = 2024): string {
  return `${prefix}${year}${String(index + 1).padStart(4, "0")}`;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function createUser(
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  schoolId: string | null,
  password: string = "Password123!"
) {
  const hashedPassword = await hashPassword(password);
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role as any,
      schoolId: schoolId || undefined,
      phone: await generatePhone(),
    },
  });
}

// ============================================
// FONCTION PRINCIPALE DE SEED
// ============================================
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🌱 EDUPILOT - GÉNÉRATION DE DONNÉES DE TEST COMPLÈTES");
  console.log("=".repeat(60) + "\n");

  // ============================================
  // 1. NETTOYAGE DE LA BASE DE DONNÉES
  // ============================================
  console.log("🗑️  Suppression des données existantes...");

  // Suppression dans l'ordre inverse des dépendances
  await prisma.examAnswer.deleteMany();
  await prisma.examSession.deleteMany();
  await prisma.question.deleteMany();
  await prisma.examTemplate.deleteMany();
  await prisma.lessonCompletion.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.course.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.evaluationType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.gradeHistory.deleteMany();
  await prisma.subjectPerformance.deleteMany();
  await prisma.studentAnalytics.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.eventParticipation.deleteMany();
  await prisma.schoolEvent.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.sanction.deleteMany();
  await prisma.behaviorIncident.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.vaccination.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.installmentPayment.deleteMany();
  await prisma.paymentPlan.deleteMany();
  await prisma.scholarship.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.teacherAvailability.deleteMany();
  await prisma.schoolCalendarEvent.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.schoolHoliday.deleteMany();
  await prisma.dataAccessRequest.deleteMany();
  await prisma.dataRetentionPolicy.deleteMany();
  await prisma.dataConsent.deleteMany();
  await prisma.orientationRecommendation.deleteMany();
  await prisma.subjectGroupAnalysis.deleteMany();
  await prisma.studentOrientation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.parentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();
  await prisma.classLevel.deleteMany();
  await prisma.period.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.academicConfig.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.firstLoginToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  console.log("✅ Base de données nettoyée\n");

  // ============================================
  // 1.1 CONFIGURATION DE RÉFÉRENCE BÉNIN
  // ============================================
  await seedBeninReferenceData();

  // ============================================
  // 2. CRÉATION DU SUPER ADMIN
  // ============================================
  console.log("👤 Création du Super Admin...");
  const superAdmin = await createUser("admin@edupilot.bj", "Super", "Administrateur", "SUPER_ADMIN", null);
  console.log("   ✅ Super Admin créé: admin@edupilot.bj\n");

  // ============================================
  // 3. CRÉATION DES ÉCOLES
  // ============================================
  console.log("🏫 Création des établissements scolaires...\n");

  // École 1: Collège privé (école principale avec données complètes)
  const school1 = await prisma.school.create({
    data: {
      name: "Collège d'Excellence Saint-Michel",
      code: "CESM",
      type: "PRIVATE",
      level: "SECONDARY_COLLEGE",
      city: "Cotonou",
      address: "Quartier Akpakpa, Rue 112, Lot 456",
      phone: await generatePhone(),
      email: "contact@saintmichel.bj",
    },
  });

  // École 2: Lycée public
  const school2 = await prisma.school.create({
    data: {
      name: "Lycée National Béhanzin",
      code: "LNB",
      type: "PUBLIC",
      level: "SECONDARY_LYCEE",
      city: "Porto-Novo",
      address: "Avenue du Gouverneur, BP 2345",
      phone: await generatePhone(),
      email: "direction@lycee-behanzin.bj",
    },
  });

  // École 3: École primaire
  const school3 = await prisma.school.create({
    data: {
      name: "École Primaire Les Étoiles Brillantes",
      code: "EPEB",
      type: "PRIVATE",
      level: "PRIMARY",
      city: "Abomey-Calavi",
      address: "Quartier Togoudo, Carré 234",
      phone: await generatePhone(),
      email: "contact@etoilesbrillantes.bj",
    },
  });

  console.log("   ✅ 3 établissements créés\n");

  // ============================================
  // 4. CRÉATION DES ADMINISTRATEURS D'ÉCOLE
  // ============================================
  console.log("👔 Création des administrateurs d'école...\n");

  // Admin École 1
  const schoolAdmin1 = await createUser(
    "admin@saintmichel.bj",
    "Robert",
    "Agbossou",
    "SCHOOL_ADMIN",
    school1.id
  );

  // Directeur École 1
  const director1 = await createUser(
    "directeur@saintmichel.bj",
    "François",
    "Hounkpatin",
    "DIRECTOR",
    school1.id
  );

  // Comptable École 1
  const accountant1 = await createUser(
    "comptable@saintmichel.bj",
    "Félicité",
    "Dossou",
    "ACCOUNTANT",
    school1.id
  );

  // Admin École 2
  await createUser("admin@lycee-behanzin.bj", "Germain", "Togan", "SCHOOL_ADMIN", school2.id);
  await createUser("directeur@lycee-behanzin.bj", "Honorine", "Zinsou", "DIRECTOR", school2.id);

  console.log("   ✅ Administrateurs créés\n");

  // ============================================
  // 5. CONFIGURATION ACADÉMIQUE - ÉCOLE 1
  // ============================================
  console.log("📅 Configuration académique...\n");

  const academicYear1 = await prisma.academicYear.create({
    data: {
      schoolId: school1.id,
      name: "2024-2025",
      startDate: new Date("2024-09-16"),
      endDate: new Date("2025-07-15"),
      isCurrent: true,
    },
  });

  await prisma.academicConfig.create({
    data: {
      schoolId: school1.id,
      periodType: "TRIMESTER",
      periodsCount: 3,
      maxGrade: 20,
      passingGrade: 10,
    },
  });

  // Périodes du trimestre
  const periods = await Promise.all([
    prisma.period.create({
      data: {
        academicYearId: academicYear1.id,
        name: "1er Trimestre",
        type: "TRIMESTER",
        startDate: new Date("2024-09-16"),
        endDate: new Date("2024-12-20"),
        sequence: 1,
      },
    }),
    prisma.period.create({
      data: {
        academicYearId: academicYear1.id,
        name: "2ème Trimestre",
        type: "TRIMESTER",
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-03-28"),
        sequence: 2,
      },
    }),
    prisma.period.create({
      data: {
        academicYearId: academicYear1.id,
        name: "3ème Trimestre",
        type: "TRIMESTER",
        startDate: new Date("2025-04-14"),
        endDate: new Date("2025-07-15"),
        sequence: 3,
      },
    }),
  ]);

  // Configuration pour école 2 et 3
  const academicYear2 = await prisma.academicYear.create({
    data: {
      schoolId: school2.id,
      name: "2024-2025",
      startDate: new Date("2024-09-16"),
      endDate: new Date("2025-07-15"),
      isCurrent: true,
    },
  });

  await prisma.academicConfig.create({
    data: {
      schoolId: school2.id,
      periodType: "SEMESTER",
      periodsCount: 2,
      maxGrade: 20,
      passingGrade: 10,
    },
  });

  const academicYear3 = await prisma.academicYear.create({
    data: {
      schoolId: school3.id,
      name: "2024-2025",
      startDate: new Date("2024-09-16"),
      endDate: new Date("2025-07-15"),
      isCurrent: true,
    },
  });

  await prisma.academicConfig.create({
    data: {
      schoolId: school3.id,
      periodType: "TRIMESTER",
      periodsCount: 3,
      maxGrade: 20,
      passingGrade: 10,
    },
  });

  console.log("   ✅ Configuration académique terminée\n");

  // ============================================
  // 6. TYPES D'ÉVALUATIONS
  // ============================================
  console.log("📋 Création des types d'évaluations...\n");

  const evalTypes = await Promise.all([
    prisma.evaluationType.create({ data: { schoolId: school1.id, name: "Devoir surveillé", code: "DS", weight: 1, maxCount: 5 } }),
    prisma.evaluationType.create({ data: { schoolId: school1.id, name: "Composition", code: "COMP", weight: 3, maxCount: 1 } }),
    prisma.evaluationType.create({ data: { schoolId: school1.id, name: "Interrogation écrite", code: "IE", weight: 0.5, maxCount: 8 } }),
    prisma.evaluationType.create({ data: { schoolId: school1.id, name: "Participation orale", code: "ORAL", weight: 0.5, maxCount: 4 } }),
    prisma.evaluationType.create({ data: { schoolId: school1.id, name: "Travaux pratiques", code: "TP", weight: 1, maxCount: 3 } }),
  ]);

  console.log("   ✅ Types d'évaluations créés\n");

  // ============================================
  // 7. MATIÈRES
  // ============================================
  console.log("📚 Création des matières...\n");

  const subjectsData = [
    { name: "Français", code: "FR", category: "Langues", coef: 4 },
    { name: "Mathématiques", code: "MATH", category: "Sciences", coef: 4 },
    { name: "Physique-Chimie", code: "PC", category: "Sciences", coef: 3 },
    { name: "Sciences de la Vie et de la Terre", code: "SVT", category: "Sciences", coef: 3 },
    { name: "Anglais", code: "ANG", category: "Langues", coef: 3 },
    { name: "Histoire-Géographie", code: "HG", category: "Humanités", coef: 2 },
    { name: "Éducation Civique et Morale", code: "ECM", category: "Humanités", coef: 1 },
    { name: "Philosophie", code: "PHILO", category: "Humanités", coef: 2 },
    { name: "Éducation Physique et Sportive", code: "EPS", category: "Sport", coef: 2 },
    { name: "Informatique", code: "INFO", category: "Sciences", coef: 1 },
    { name: "Arts Plastiques", code: "ART", category: "Arts", coef: 1 },
  ];

  const subjects = await Promise.all(
    subjectsData.map((s) => prisma.subject.create({
      data: { schoolId: school1.id, name: s.name, code: s.code, category: s.category }
    }))
  );

  console.log(`   ✅ ${subjects.length} matières créées\n`);

  // ============================================
  // 8. NIVEAUX ET CLASSES
  // ============================================
  console.log("🏛️  Création des niveaux et classes...\n");

  const collegeLevels = [
    { name: "6ème", code: "6EME", sequence: 1 },
    { name: "5ème", code: "5EME", sequence: 2 },
    { name: "4ème", code: "4EME", sequence: 3 },
    { name: "3ème", code: "3EME", sequence: 4 },
  ];

  const collegeClasses: any[] = [];
  const classLevelRecords: any[] = [];

  for (const level of collegeLevels) {
    const levelRecord = await prisma.classLevel.create({
      data: {
        schoolId: school1.id,
        name: level.name,
        code: level.code,
        sequence: level.sequence,
        level: "SECONDARY_COLLEGE" as any
      }
    });
    classLevelRecords.push(levelRecord);

    // 2 classes par niveau (A et B)
    for (const section of ["A", "B"]) {
      const cls = await prisma.class.create({
        data: {
          schoolId: school1.id,
          classLevelId: levelRecord.id,
          name: section,
          capacity: randomInt(30, 45),
        },
      });
      collegeClasses.push({ ...cls, level: levelRecord, levelName: level.name });
    }
  }

  console.log(`   ✅ ${collegeLevels.length} niveaux et ${collegeClasses.length} classes créés\n`);

  // ============================================
  // 9. ENSEIGNANTS
  // ============================================
  console.log("👨‍🏫 Création des enseignants...\n");

  const teachersData = [
    { firstName: "Marie-Claire", lastName: "Agbossou", subject: "Français", email: "m.agbossou" },
    { firstName: "Pierre", lastName: "Hounkpatin", subject: "Mathématiques", email: "p.hounkpatin" },
    { firstName: "Fatou", lastName: "Bello", subject: "Physique-Chimie", email: "f.bello" },
    { firstName: "Jean-Baptiste", lastName: "Dossou", subject: "Sciences de la Vie et de la Terre", email: "jb.dossou" },
    { firstName: "Aicha", lastName: "Togan", subject: "Anglais", email: "a.togan" },
    { firstName: "Christian", lastName: "Chabi", subject: "Histoire-Géographie", email: "c.chabi" },
    { firstName: "Claire", lastName: "Ahounou", subject: "Philosophie", email: "c.ahounou" },
    { firstName: "David", lastName: "Zinsou", subject: "Éducation Physique et Sportive", email: "d.zinsou" },
    { firstName: "Emmanuel", lastName: "Gandonou", subject: "Informatique", email: "e.gandonou" },
    { firstName: "Grâce", lastName: "Sossou", subject: "Arts Plastiques", email: "g.sossou" },
    { firstName: "Henri", lastName: "Kounou", subject: "Éducation Civique et Morale", email: "h.kounou" },
    { firstName: "Irène", lastName: "Gbèdji", subject: "Français", email: "i.gbedji" },
  ];

  const teachers: any[] = [];
  for (let i = 0; i < teachersData.length; i++) {
    const t = teachersData[i];
    const user = await createUser(
      `${t.email}@saintmichel.bj`,
      t.firstName,
      t.lastName,
      "TEACHER",
      school1.id
    );
    const profile = await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        schoolId: school1.id,
        matricule: generateMatricule("ENS", i),
        specialization: t.subject,
        hireDate: randomDate(new Date(2015, 8, 1), new Date(2023, 8, 1)),
      },
    });
    teachers.push({ user, profile, data: t });
  }

  console.log(`   ✅ ${teachers.length} enseignants créés\n`);

  // ============================================
  // 10. AFFECTATION DES MATIÈRES AUX CLASSES
  // ============================================
  console.log("📎 Affectation des matières aux classes...\n");

  const classSubjects: any[] = [];
  for (const cls of collegeClasses) {
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const subjectData = subjectsData[i];

      // Exclure Philosophie pour 6ème et 5ème
      if (subject.code === "PHILO" && (cls.levelName === "6ème" || cls.levelName === "5ème")) {
        continue;
      }

      const teacher = teachers.find(t => t.data.subject === subject.name);
      if (teacher) {
        const cs = await prisma.classSubject.create({
          data: {
            classId: cls.id,
            subjectId: subject.id,
            teacherId: teacher.profile.id,
            coefficient: subjectData.coef,
            weeklyHours: subject.code === "MATH" || subject.code === "FR" ? 5 : 3,
          },
        });
        classSubjects.push({ ...cs, class: cls, subject, teacher });
      }
    }
  }

  // Assigner les professeurs principaux
  for (let i = 0; i < collegeClasses.length && i < teachers.length; i++) {
    await prisma.class.update({
      where: { id: collegeClasses[i].id },
      data: { mainTeacherId: teachers[i].profile.id },
    });
  }

  console.log(`   ✅ ${classSubjects.length} affectations matières/classes créées\n`);

  // ============================================
  // 11. PARENTS ET ÉLÈVES (100 familles)
  // ============================================
  console.log("👨‍👩‍👧‍👦 Création des familles (parents et élèves)...\n");

  // Scénarios d'élèves pour diversité
  interface StudentScenario {
    type: string;
    count: number;
    gradeRange: [number, number];
    attendanceRate: number;
    behaviorScore: number;
    description: string;
  }

  const studentScenarios: StudentScenario[] = [
    { type: "excellent", count: 15, gradeRange: [16, 20], attendanceRate: 98, behaviorScore: 95, description: "Élève excellent" },
    { type: "tres_bon", count: 20, gradeRange: [14, 17], attendanceRate: 95, behaviorScore: 90, description: "Très bon élève" },
    { type: "bon", count: 25, gradeRange: [12, 15], attendanceRate: 90, behaviorScore: 85, description: "Bon élève" },
    { type: "moyen", count: 20, gradeRange: [10, 13], attendanceRate: 85, behaviorScore: 80, description: "Élève moyen" },
    { type: "en_difficulte", count: 12, gradeRange: [7, 11], attendanceRate: 75, behaviorScore: 70, description: "Élève en difficulté" },
    { type: "irregulier", count: 8, gradeRange: [5, 14], attendanceRate: 65, behaviorScore: 60, description: "Élève irrégulier" },
  ];

  const students: any[] = [];
  const parents: any[] = [];
  let studentIndex = 0;
  let scenarioIndex = 0;
  let currentScenarioCount = 0;

  for (let familyIndex = 0; familyIndex < 100; familyIndex++) {
    const familyLastName = randomElement(lastNames);

    // Créer le père
    const fatherFirstName = randomElement(firstNamesMale);
    const fatherUser = await createUser(
      `${fatherFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${familyIndex}@gmail.com`,
      fatherFirstName,
      familyLastName,
      "PARENT",
      school1.id
    );
    const fatherProfile = await prisma.parentProfile.create({
      data: {
        userId: fatherUser.id,
        profession: randomElement(professions),
      },
    });
    parents.push({ user: fatherUser, profile: fatherProfile, relationship: "Père" });

    // Créer la mère (70% des familles)
    let motherProfile = null;
    if (Math.random() < 0.7) {
      const motherFirstName = randomElement(firstNamesFemale);
      const motherUser = await createUser(
        `${motherFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${familyIndex}m@gmail.com`,
        motherFirstName,
        familyLastName,
        "PARENT",
        school1.id
      );
      motherProfile = await prisma.parentProfile.create({
        data: {
          userId: motherUser.id,
          profession: randomElement(professions),
        },
      });
      parents.push({ user: motherUser, profile: motherProfile, relationship: "Mère" });
    }

    // Nombre d'enfants par famille (1 à 3)
    const childrenCount = randomInt(1, 3);

    for (let childIndex = 0; childIndex < childrenCount && studentIndex < 100; childIndex++) {
      // Déterminer le scénario de l'élève
      if (currentScenarioCount >= studentScenarios[scenarioIndex].count) {
        scenarioIndex++;
        currentScenarioCount = 0;
      }
      const scenario = studentScenarios[Math.min(scenarioIndex, studentScenarios.length - 1)];
      currentScenarioCount++;

      const gender = randomElement(["MALE", "FEMALE"]);
      const studentFirstName = gender === "MALE"
        ? randomElement(firstNamesMale)
        : randomElement(firstNamesFemale);

      const assignedClass = randomElement(collegeClasses);

      const studentUser = await createUser(
        `${studentFirstName.toLowerCase()}.${familyLastName.toLowerCase()}${studentIndex}@eleve.saintmichel.bj`,
        studentFirstName,
        familyLastName,
        "STUDENT",
        school1.id
      );

      const birthYear = assignedClass.levelName === "6ème" ? 2013 :
        assignedClass.levelName === "5ème" ? 2012 :
          assignedClass.levelName === "4ème" ? 2011 : 2010;

      const studentProfile = await prisma.studentProfile.create({
        data: {
          userId: studentUser.id,
          schoolId: school1.id,
          matricule: generateMatricule("ELV", studentIndex),
          dateOfBirth: randomDate(new Date(birthYear, 0, 1), new Date(birthYear, 11, 31)),
          gender: gender as any,
          birthPlace: randomElement(cities),
          nationality: randomElement(nationalities),
          address: `Quartier ${randomElement(["Akpakpa", "Cadjèhoun", "Fidjrossè", "Gbégamey", "Kouhounou", "Mènontin", "Zogbo"])}, Cotonou`,
        },
      });

      // Inscription
      await prisma.enrollment.create({
        data: {
          studentId: studentProfile.id,
          classId: assignedClass.id,
          academicYearId: academicYear1.id,
          status: "ACTIVE",
        },
      });

      // Lien parent-enfant
      await prisma.parentStudent.create({
        data: {
          parentId: fatherProfile.id,
          studentId: studentProfile.id,
          relationship: "Père",
          isPrimary: true,
        },
      });

      if (motherProfile) {
        await prisma.parentStudent.create({
          data: {
            parentId: motherProfile.id,
            studentId: studentProfile.id,
            relationship: "Mère",
            isPrimary: false,
          },
        });
      }

      students.push({
        user: studentUser,
        profile: studentProfile,
        class: assignedClass,
        scenario,
        parents: motherProfile ? [fatherProfile, motherProfile] : [fatherProfile]
      });
      studentIndex++;
    }
  }

  console.log(`   ✅ ${parents.length} parents et ${students.length} élèves créés\n`);

  // ============================================
  // 12. ÉVALUATIONS ET NOTES
  // ============================================
  console.log("📊 Création des évaluations et notes...\n");

  let totalGrades = 0;
  const gradesByStudent: Map<string, number[]> = new Map();

  for (const cs of classSubjects) {
    const classStudents = students.filter(s => s.class.id === cs.class.id);

    for (const period of periods) {
      // Créer les évaluations pour chaque période
      const evaluationsForPeriod = [
        { title: `Composition ${cs.subject.name} - ${period.name}`, type: evalTypes[1], weight: 3 },
        { title: `DS 1 ${cs.subject.name}`, type: evalTypes[0], weight: 1 },
        { title: `DS 2 ${cs.subject.name}`, type: evalTypes[0], weight: 1 },
        { title: `IE ${cs.subject.name}`, type: evalTypes[2], weight: 0.5 },
      ];

      for (const evalData of evaluationsForPeriod) {
        const evalDate = randomDate(
          new Date(period.startDate),
          new Date(period.endDate)
        );

        const evaluation = await prisma.evaluation.create({
          data: {
            classSubjectId: cs.id,
            periodId: period.id,
            typeId: evalData.type.id,
            title: evalData.title,
            date: evalDate,
            maxGrade: 20,
            coefficient: evalData.weight,
          },
        });

        // Notes pour chaque élève selon son scénario
        for (const student of classStudents) {
          const [minGrade, maxGrade] = student.scenario.gradeRange;
          let gradeValue = randomGrade(minGrade, maxGrade);

          // Variation aléatoire pour plus de réalisme
          if (Math.random() < 0.1) {
            gradeValue = Math.max(0, gradeValue - randomInt(2, 4));
          } else if (Math.random() < 0.1) {
            gradeValue = Math.min(20, gradeValue + randomInt(1, 3));
          }

          const isAbsent = Math.random() < (100 - student.scenario.attendanceRate) / 100 * 0.1;

          await prisma.grade.create({
            data: {
              evaluationId: evaluation.id,
              studentId: student.profile.id,
              value: isAbsent ? null : gradeValue,
              isAbsent,
              isExcused: isAbsent && Math.random() < 0.5,
              comment: gradeValue >= 16 ? "Excellent travail" :
                gradeValue >= 14 ? "Très bien" :
                  gradeValue >= 12 ? "Bon travail" :
                    gradeValue < 8 ? "Des efforts à fournir" : null,
            },
          });

          if (!isAbsent) {
            const existingGrades = gradesByStudent.get(student.profile.id) || [];
            existingGrades.push(gradeValue);
            gradesByStudent.set(student.profile.id, existingGrades);
          }
          totalGrades++;
        }
      }
    }
  }

  console.log(`   ✅ ${totalGrades} notes créées\n`);

  // ============================================
  // 13. PRÉSENCES/ABSENCES
  // ============================================
  console.log("📅 Création des enregistrements de présence...\n");

  let totalAttendance = 0;
  const schoolDays = [];
  const startDate = new Date(2024, 8, 16); // 16 septembre 2024
  const endDate = new Date(2024, 11, 20); // 20 décembre 2024

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) { // Exclure weekends
      schoolDays.push(new Date(d));
    }
  }

  for (const student of students) {
    const absenceRate = (100 - student.scenario.attendanceRate) / 100;
    const expectedAbsences = Math.floor(schoolDays.length * absenceRate);

    const absenceDays = schoolDays
      .sort(() => Math.random() - 0.5)
      .slice(0, expectedAbsences);

    for (const day of absenceDays) {
      const status = Math.random() < 0.3 ? "LATE" : "ABSENT";
      const isExcused = Math.random() < 0.4;

      await prisma.attendance.create({
        data: {
          studentId: student.profile.id,
          classId: student.class.id,
          date: day,
          status: isExcused ? "EXCUSED" : status as any,
          reason: isExcused ? randomElement(["Maladie", "Rendez-vous médical", "Raison familiale", "Transport"]) : null,
          recordedById: teachers[0].user.id,
        },
      });
      totalAttendance++;
    }
  }

  console.log(`   ✅ ${totalAttendance} enregistrements de présence créés\n`);

  // ============================================
  // 14. DEVOIRS
  // ============================================
  console.log("📝 Création des devoirs...\n");

  const homeworks: any[] = [];
  for (const cs of classSubjects.slice(0, 20)) {
    const hw = await prisma.homework.create({
      data: {
        classSubjectId: cs.id,
        title: `Devoir: ${randomElement([
          "Exercices du chapitre",
          "Dissertation",
          "Analyse de document",
          "Problèmes de révision",
          "Exposé à préparer",
          "Recherche documentaire",
          "Questions de cours"
        ])}`,
        description: `Travail à rendre sur le thème ${cs.subject.name}. Consignes détaillées disponibles.`,
        dueDate: randomDate(new Date(2024, 10, 1), new Date(2024, 11, 30)),
        maxGrade: 20,
        createdById: cs.teacher.user.id,
        isPublished: true,
      },
    });
    homeworks.push(hw);

    // Créer des soumissions pour certains élèves
    const classStudents = students.filter(s => s.class.id === cs.class.id);
    for (const student of classStudents) {
      if (Math.random() < 0.7) { // 70% de soumissions
        const [minGrade, maxGrade] = student.scenario.gradeRange;
        await prisma.homeworkSubmission.create({
          data: {
            homeworkId: hw.id,
            studentId: student.profile.id,
            content: "Devoir soumis",
            submittedAt: new Date(),
            grade: randomGrade(minGrade, maxGrade),
            feedback: randomElement(["Bon travail", "À améliorer", "Excellent", "Bien", null]),
            gradedAt: new Date(),
            gradedById: cs.teacher.user.id,
          },
        });
      }
    }
  }

  console.log(`   ✅ ${homeworks.length} devoirs créés avec soumissions\n`);

  // ============================================
  // 15. INCIDENTS DE COMPORTEMENT ET SANCTIONS
  // ============================================
  console.log("⚠️  Création des incidents de comportement...\n");

  const incidentTypes = ["LATE", "ABSENCE_UNEXCUSED", "DISRUPTION", "DISRESPECT", "CHEATING", "DRESS_CODE"];
  const incidentSeverities = ["LOW", "MEDIUM", "HIGH"];

  let incidentCount = 0;
  for (const student of students) {
    // Les élèves avec faible score comportemental ont plus d'incidents
    const incidentProbability = (100 - student.scenario.behaviorScore) / 100;
    const numIncidents = Math.floor(Math.random() * 3 * incidentProbability);

    for (let i = 0; i < numIncidents; i++) {
      const incident = await prisma.behaviorIncident.create({
        data: {
          studentId: student.profile.id,
          incidentType: randomElement(incidentTypes) as any,
          severity: randomElement(incidentSeverities) as any,
          description: randomElement([
            "Retard répété en classe",
            "Bavardage pendant le cours",
            "Non-respect du règlement intérieur",
            "Perturbation du cours",
            "Oubli répété du matériel scolaire",
            "Comportement inapproprié en classe"
          ]),
          date: randomDate(new Date(2024, 8, 16), new Date(2024, 11, 20)),
          location: randomElement(["Salle de classe", "Cour de récréation", "Cantine", "Couloir"]),
          reportedById: randomElement(teachers).user.id,
          isResolved: Math.random() < 0.7,
          resolvedAt: Math.random() < 0.7 ? new Date() : null,
        },
      });
      incidentCount++;

      // Ajouter une sanction pour certains incidents
      if (Math.random() < 0.5) {
        await prisma.sanction.create({
          data: {
            incidentId: incident.id,
            type: randomElement(["WARNING", "DETENTION", "PARENT_CONFERENCE", "COUNSELING"]) as any,
            description: "Suite à l'incident signalé",
            startDate: new Date(),
            isServed: Math.random() < 0.8,
            assignedById: director1.id,
          },
        });
      }
    }
  }

  console.log(`   ✅ ${incidentCount} incidents de comportement créés\n`);

  // ============================================
  // 16. DOSSIERS MÉDICAUX
  // ============================================
  console.log("🏥 Création des dossiers médicaux...\n");

  const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  const allergens = ["Arachides", "Lait", "Oeufs", "Gluten", "Poussière", "Pollen", "Pénicilline"];
  const vaccines = ["BCG", "Polio", "DTC", "Rougeole", "Fièvre jaune", "Hépatite B", "Méningite"];

  let medicalCount = 0;
  for (const student of students) {
    if (Math.random() < 0.6) { // 60% des élèves ont un dossier médical
      const medicalRecord = await prisma.medicalRecord.create({
        data: {
          studentId: student.profile.id,
          bloodType: randomElement(bloodTypes),
          medicalHistory: Math.random() < 0.3 ? randomElement([
            "Asthme léger",
            "Porteur de lunettes",
            "Diabète type 1",
            "Aucun antécédent particulier"
          ]) : null,
          medications: Math.random() < 0.2 ? [randomElement(["Ventoline", "Insuline", "Antihistaminique"])] : [],
          notes: "Dossier médical à jour",
        },
      });
      medicalCount++;

      // Allergies (20% des élèves)
      if (Math.random() < 0.2) {
        await prisma.allergy.create({
          data: {
            medicalRecordId: medicalRecord.id,
            allergen: randomElement(allergens),
            severity: randomElement(["MILD", "MODERATE", "SEVERE"]),
            reaction: randomElement(["Éruption cutanée", "Difficultés respiratoires", "Gonflement"]),
            treatment: "Antihistaminique en cas de réaction",
          },
        });
      }

      // Vaccinations
      const numVaccines = randomInt(3, 7);
      for (let i = 0; i < numVaccines; i++) {
        await prisma.vaccination.create({
          data: {
            medicalRecordId: medicalRecord.id,
            vaccineName: vaccines[i % vaccines.length],
            dateGiven: randomDate(new Date(2010, 0, 1), new Date(2024, 0, 1)),
            administeredBy: "Centre de santé communal",
            batchNumber: `VAC${randomInt(1000, 9999)}`,
          },
        });
      }

      // Contacts d'urgence
      for (const parent of student.parents) {
        await prisma.emergencyContact.create({
          data: {
            medicalRecordId: medicalRecord.id,
            name: `${parent.userId}`,
            relationship: parent === student.parents[0] ? "Père" : "Mère",
            phone: await generatePhone(),
            isPrimary: parent === student.parents[0],
          },
        });
      }
    }
  }

  console.log(`   ✅ ${medicalCount} dossiers médicaux créés\n`);

  // ============================================
  // 17. FRAIS DE SCOLARITÉ ET PAIEMENTS
  // ============================================
  console.log("💰 Création des frais et paiements...\n");

  const fees = await Promise.all([
    prisma.fee.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: "Scolarité Annuelle",
        description: "Frais de scolarité pour l'année 2024-2025",
        amount: 150000,
        dueDate: new Date(2024, 9, 31),
        isRequired: true,
      },
    }),
    prisma.fee.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: "Frais d'Inscription",
        description: "Frais d'inscription nouveaux élèves",
        amount: 25000,
        dueDate: new Date(2024, 8, 15),
        isRequired: true,
      },
    }),
    prisma.fee.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: "Frais de Bibliothèque",
        description: "Accès à la bibliothèque et aux ressources",
        amount: 5000,
        dueDate: new Date(2024, 9, 31),
        isRequired: false,
      },
    }),
    prisma.fee.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: "Frais d'Examen",
        description: "Frais pour les examens officiels",
        amount: 10000,
        dueDate: new Date(2025, 3, 30),
        isRequired: true,
      },
    }),
    prisma.fee.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: "Tenue Sportive",
        description: "Kit sportif de l'école",
        amount: 15000,
        dueDate: new Date(2024, 9, 31),
        isRequired: false,
      },
    }),
  ]);

  let paymentCount = 0;
  for (const student of students) {
    for (const fee of fees) {
      // 80% des élèves ont payé la scolarité
      const hasPaid = fee.isRequired ? Math.random() < 0.8 : Math.random() < 0.5;

      if (hasPaid) {
        await prisma.payment.create({
          data: {
            studentId: student.profile.id,
            feeId: fee.id,
            amount: fee.amount,
            paidAt: randomDate(new Date(2024, 8, 1), new Date(2024, 10, 30)),
            method: randomElement(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER"]) as any,
            status: "VERIFIED",
            reference: `PAY${randomInt(100000, 999999)}`,
          },
        });
        paymentCount++;
      }
    }
  }

  // Bourses pour certains élèves
  const excellentStudents = students.filter(s => s.scenario.type === "excellent");
  for (const student of excellentStudents.slice(0, 5)) {
    await prisma.scholarship.create({
      data: {
        studentId: student.profile.id,
        name: "Bourse d'excellence",
        type: "MERIT",
        amount: 50000,
        percentage: 30,
        startDate: new Date(2024, 8, 16),
        endDate: new Date(2025, 7, 15),
        isActive: true,
        notes: "Attribuée pour excellents résultats académiques",
      },
    });
  }

  console.log(`   ✅ ${fees.length} frais et ${paymentCount} paiements créés\n`);

  // ============================================
  // 18. EMPLOIS DU TEMPS
  // ============================================
  console.log("📆 Création des emplois du temps...\n");

  const timeSlots = [
    { start: "07:30", end: "08:30" },
    { start: "08:30", end: "09:30" },
    { start: "09:45", end: "10:45" },
    { start: "10:45", end: "11:45" },
    { start: "12:00", end: "13:00" },
    { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" },
  ];

  let scheduleCount = 0;
  for (const cls of collegeClasses) {
    const classSubjectsForClass = classSubjects.filter(cs => cs.class.id === cls.id);

    for (let day = 1; day <= 5; day++) { // Lundi à Vendredi
      let subjectIndex = 0;
      for (const slot of timeSlots.slice(0, 6)) {
        const cs = classSubjectsForClass[subjectIndex % classSubjectsForClass.length];
        if (cs) {
          await prisma.schedule.create({
            data: {
              classId: cls.id,
              classSubjectId: cs.id,
              dayOfWeek: day,
              startTime: slot.start,
              endTime: slot.end,
              room: `Salle ${cls.levelName.charAt(0)}${randomInt(1, 5)}`,
            },
          });
          scheduleCount++;
        }
        subjectIndex++;
      }
    }
  }

  console.log(`   ✅ ${scheduleCount} créneaux d'emploi du temps créés\n`);

  // ============================================
  // 19. DISPONIBILITÉS ENSEIGNANTS
  // ============================================
  console.log("🕐 Création des disponibilités enseignants...\n");

  for (const teacher of teachers) {
    for (let day = 1; day <= 5; day++) {
      await prisma.teacherAvailability.create({
        data: {
          teacherId: teacher.profile.id,
          dayOfWeek: day,
          startTime: "07:30",
          endTime: "17:00",
          isActive: true,
        },
      });
    }
  }

  console.log(`   ✅ Disponibilités enseignants créées\n`);

  // ============================================
  // 20. RENDEZ-VOUS PARENTS-PROFESSEURS
  // ============================================
  console.log("📞 Création des rendez-vous...\n");

  let appointmentCount = 0;
  for (let i = 0; i < 30; i++) {
    const student = randomElement(students);
    const teacher = randomElement(teachers);
    const parent = student.parents[0];

    await prisma.appointment.create({
      data: {
        teacherId: teacher.profile.id,
        parentId: parent.id,
        studentId: student.profile.id,
        scheduledAt: randomDate(new Date(2024, 10, 1), new Date(2025, 1, 28)),
        duration: randomElement([15, 30, 45]),
        type: randomElement(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]) as any,
        status: randomElement(["PENDING", "CONFIRMED", "COMPLETED"]) as any,
        location: "Bureau des enseignants",
        notes: randomElement([
          "Discussion sur les résultats scolaires",
          "Suivi comportemental",
          "Orientation scolaire",
          "Bilan de mi-trimestre",
          null
        ]),
        createdById: parent.userId || teacher.user.id,
      },
    });
    appointmentCount++;
  }

  console.log(`   ✅ ${appointmentCount} rendez-vous créés\n`);

  // ============================================
  // 21. ÉVÉNEMENTS SCOLAIRES
  // ============================================
  console.log("🎉 Création des événements scolaires...\n");

  const events = await Promise.all([
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Journée Portes Ouvertes",
        description: "Venez découvrir notre établissement et rencontrer les enseignants",
        type: "GENERAL",
        startDate: new Date(2024, 11, 15, 9, 0),
        endDate: new Date(2024, 11, 15, 16, 0),
        location: "Cour principale de l'école",
        isPublished: true,
        createdById: director1.id,
      },
    }),
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Tournoi Interscolaire de Football",
        description: "Compétition sportive entre établissements de la région",
        type: "SPORTS",
        startDate: new Date(2024, 11, 20, 8, 0),
        endDate: new Date(2024, 11, 20, 17, 0),
        location: "Stade municipal",
        fee: 2000,
        maxParticipants: 50,
        requiresPermission: true,
        isPublished: true,
        createdById: director1.id,
      },
    }),
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Fête de Noël",
        description: "Spectacle de fin d'année avec les élèves",
        type: "CULTURAL",
        startDate: new Date(2024, 11, 22, 14, 0),
        endDate: new Date(2024, 11, 22, 18, 0),
        location: "Salle des fêtes",
        isPublished: true,
        createdById: director1.id,
      },
    }),
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Examen Blanc - BEPC",
        description: "Préparation aux examens officiels pour les élèves de 3ème",
        type: "ACADEMIC",
        startDate: new Date(2025, 1, 10, 7, 30),
        endDate: new Date(2025, 1, 14, 12, 0),
        location: "Salles d'examen",
        isPublished: true,
        createdById: director1.id,
      },
    }),
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Sortie Pédagogique - Musée d'Abomey",
        description: "Visite culturelle du palais royal d'Abomey",
        type: "FIELD_TRIP",
        startDate: new Date(2025, 2, 15, 7, 0),
        endDate: new Date(2025, 2, 15, 18, 0),
        location: "Abomey",
        fee: 5000,
        maxParticipants: 80,
        requiresPermission: true,
        isPublished: true,
        createdById: director1.id,
      },
    }),
    prisma.schoolEvent.create({
      data: {
        schoolId: school1.id,
        title: "Réunion Parents-Professeurs",
        description: "Rencontre trimestrielle pour discuter des résultats",
        type: "PARENT_MEETING",
        startDate: new Date(2024, 11, 18, 15, 0),
        endDate: new Date(2024, 11, 18, 18, 0),
        location: "Salles de classe",
        isPublished: true,
        createdById: director1.id,
      },
    }),
  ]);

  // Participations aux événements
  for (const event of events) {
    if (event.maxParticipants) {
      const participatingStudents = students
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(event.maxParticipants, randomInt(20, 50)));

      for (const student of participatingStudents) {
        await prisma.eventParticipation.create({
          data: {
            eventId: event.id,
            studentId: student.profile.id,
            status: randomElement(["REGISTERED", "CONFIRMED"]) as any,
            permissionGiven: event.requiresPermission ? Math.random() < 0.8 : true,
            permissionBy: student.parents[0].id,
            paymentStatus: event.fee ? (Math.random() < 0.7 ? "PAID" : "PENDING") : null,
          },
        });
      }
    }
  }

  console.log(`   ✅ ${events.length} événements créés avec participations\n`);

  // ============================================
  // 22. COURS LMS
  // ============================================
  console.log("📖 Création des cours en ligne (LMS)...\n");

  const coursesData = [
    {
      subject: "Mathématiques",
      title: "Algèbre - Équations du premier degré",
      modules: [
        { title: "Introduction aux équations", lessons: ["Définitions et vocabulaire", "Équivalence d'équations", "Exercices de base"] },
        { title: "Résolution d'équations", lessons: ["Méthode de résolution", "Équations avec fractions", "Problèmes concrets"] },
        { title: "Applications", lessons: ["Problèmes de la vie courante", "Exercices avancés", "QCM de révision"] },
      ]
    },
    {
      subject: "Français",
      title: "La Dissertation - Méthodologie complète",
      modules: [
        { title: "Comprendre le sujet", lessons: ["Analyse des termes", "Problématique", "Plan détaillé"] },
        { title: "Rédiger l'introduction", lessons: ["L'accroche", "Présentation du sujet", "Annonce du plan"] },
        { title: "Développer les arguments", lessons: ["Structure d'un paragraphe", "Exemples et citations", "Transitions"] },
      ]
    },
    {
      subject: "Physique-Chimie",
      title: "L'électricité - Circuits électriques",
      modules: [
        { title: "Notions de base", lessons: ["Tension et intensité", "Loi d'Ohm", "Résistances"] },
        { title: "Circuits en série et parallèle", lessons: ["Montage en série", "Montage en parallèle", "Mesures électriques"] },
      ]
    },
    {
      subject: "Anglais",
      title: "English Grammar - Tenses",
      modules: [
        { title: "Present Tenses", lessons: ["Simple Present", "Present Continuous", "Practice exercises"] },
        { title: "Past Tenses", lessons: ["Simple Past", "Past Continuous", "Present Perfect"] },
      ]
    },
  ];

  let courseCount = 0;
  for (const courseData of coursesData) {
    const subject = subjects.find(s => s.name === courseData.subject);
    const teacher = teachers.find(t => t.data.subject === courseData.subject);

    if (subject && teacher) {
      // Trouver un classSubject correspondant
      const cs = classSubjects.find(c => c.subject.id === subject.id);
      if (cs) {
        const course = await prisma.course.create({
          data: {
            classSubjectId: cs.id,
            title: courseData.title,
            description: `Cours complet sur ${courseData.title}`,
            isPublished: true,
            createdById: teacher.user.id,
          },
        });
        courseCount++;

        let moduleOrder = 1;
        for (const moduleData of courseData.modules) {
          const module = await prisma.courseModule.create({
            data: {
              courseId: course.id,
              title: moduleData.title,
              order: moduleOrder++,
            },
          });

          let lessonOrder = 1;
          for (const lessonTitle of moduleData.lessons) {
            await prisma.lesson.create({
              data: {
                moduleId: module.id,
                title: lessonTitle,
                content: `Contenu de la leçon: ${lessonTitle}. Lorem ipsum dolor sit amet...`,
                type: randomElement(["TEXT", "VIDEO", "PDF"]) as any,
                duration: randomInt(15, 45),
                order: lessonOrder++,
              },
            });
          }
        }

        // Inscriptions aux cours
        const courseStudents = students
          .filter(s => classSubjects.some(c => c.class.id === s.class.id && c.subject.id === subject.id))
          .slice(0, 30);

        for (const student of courseStudents) {
          await prisma.courseEnrollment.create({
            data: {
              courseId: course.id,
              studentId: student.profile.id,
              progress: randomInt(0, 100),
              completedAt: Math.random() < 0.2 ? new Date() : null,
            },
          });
        }
      }
    }
  }

  console.log(`   ✅ ${courseCount} cours LMS créés avec modules et leçons\n`);

  // ============================================
  // 23. EXAMENS EN LIGNE
  // ============================================
  console.log("📝 Création des examens en ligne...\n");

  const examsData = [
    {
      subject: "Mathématiques",
      title: "QCM - Équations et Inéquations",
      questions: [
        { q: "Quelle est la solution de l'équation 2x + 5 = 11 ?", options: ["x = 2", "x = 3", "x = 4", "x = 5"], correct: "x = 3" },
        { q: "Si 3x - 7 = 14, alors x = ?", options: ["5", "6", "7", "8"], correct: "7" },
        { q: "Résoudre: x/2 + 3 = 7", options: ["x = 2", "x = 4", "x = 6", "x = 8"], correct: "x = 8" },
        { q: "L'équation 5x = 0 a pour solution:", options: ["x = 0", "x = 5", "x = -5", "Pas de solution"], correct: "x = 0" },
        { q: "Quel nombre vérifie 2(x+1) = 10 ?", options: ["3", "4", "5", "6"], correct: "4" },
      ]
    },
    {
      subject: "Français",
      title: "QCM - Les figures de style",
      questions: [
        { q: "Une métaphore est:", options: ["Une comparaison avec 'comme'", "Une comparaison sans outil", "Une exagération", "Une répétition"], correct: "Une comparaison sans outil" },
        { q: "'Il pleut des cordes' est:", options: ["Une litote", "Une hyperbole", "Une métonymie", "Une personnification"], correct: "Une hyperbole" },
        { q: "L'antithèse consiste à:", options: ["Répéter un mot", "Opposer deux idées", "Exagérer", "Comparer"], correct: "Opposer deux idées" },
      ]
    },
  ];

  let examCount = 0;
  for (const examData of examsData) {
    const subject = subjects.find(s => s.name === examData.subject);
    const teacher = teachers.find(t => t.data.subject === examData.subject);

    if (subject && teacher) {
      const cs = classSubjects.find(c => c.subject.id === subject.id);
      if (cs) {
        const exam = await prisma.examTemplate.create({
          data: {
            classSubjectId: cs.id,
            title: examData.title,
            description: `Examen de ${examData.subject}`,
            duration: 30,
            totalPoints: examData.questions.length * 4,
            passingScore: Math.floor(examData.questions.length * 4 * 0.5),
            isPublished: true,
            createdById: teacher.user.id,
          },
        });
        examCount++;

        let questionOrder = 1;
        for (const qData of examData.questions) {
          await prisma.question.create({
            data: {
              examTemplateId: exam.id,
              type: "MCQ",
              question: qData.q,
              options: qData.options,
              correctAnswer: qData.correct,
              points: 4,
              order: questionOrder++,
            },
          });
        }

        // Sessions d'examen pour certains élèves
        const examStudents = students
          .filter(s => classSubjects.some(c => c.class.id === s.class.id && c.subject.id === subject.id))
          .slice(0, 20);

        for (const student of examStudents) {
          if (Math.random() < 0.6) {
            const score = randomInt(0, examData.questions.length * 4);
            await prisma.examSession.create({
              data: {
                examTemplateId: exam.id,
                studentId: student.profile.id,
                startedAt: randomDate(new Date(2024, 10, 1), new Date(2024, 11, 15)),
                submittedAt: new Date(),
                timeSpent: randomInt(600, 1800),
                score,
                totalPoints: examData.questions.length * 4,
                isPassed: score >= Math.floor(examData.questions.length * 4 * 0.5),
              },
            });
          }
        }
      }
    }
  }

  console.log(`   ✅ ${examCount} examens en ligne créés\n`);

  // ============================================
  // 24. RESSOURCES PÉDAGOGIQUES
  // ============================================
  console.log("📚 Création des ressources pédagogiques...\n");

  const resourcesData = [
    { title: "Cours complet - Équations", subject: "Mathématiques", type: "LESSON" },
    { title: "Exercices corrigés - Algèbre", subject: "Mathématiques", type: "EXERCISE" },
    { title: "Annales BEPC 2023", subject: "Mathématiques", type: "EXAM" },
    { title: "Méthodologie dissertation", subject: "Français", type: "DOCUMENT" },
    { title: "Textes à analyser", subject: "Français", type: "LESSON" },
    { title: "Vidéo - La physique au quotidien", subject: "Physique-Chimie", type: "VIDEO" },
    { title: "TP - Mesures électriques", subject: "Physique-Chimie", type: "EXERCISE" },
    { title: "Grammar Rules - English", subject: "Anglais", type: "DOCUMENT" },
    { title: "Histoire du Bénin - Chronologie", subject: "Histoire-Géographie", type: "DOCUMENT" },
  ];

  let resourceCount = 0;
  for (const resData of resourcesData) {
    const subject = subjects.find(s => s.name === resData.subject);
    const teacher = teachers.find(t => t.data.subject === resData.subject);

    if (subject && teacher) {
      await prisma.resource.create({
        data: {
          schoolId: school1.id,
          title: resData.title,
          description: `Ressource pédagogique pour ${resData.subject}`,
          type: resData.type as any,
          category: resData.subject,
          subjectId: subject.id,
          fileUrl: `/resources/${resData.title.toLowerCase().replace(/ /g, "-")}.pdf`,
          fileType: "application/pdf",
          fileSize: randomInt(100000, 5000000),
          isPublic: true,
          uploadedById: teacher.user.id,
        },
      });
      resourceCount++;
    }
  }

  console.log(`   ✅ ${resourceCount} ressources créées\n`);

  // ============================================
  // 25. CERTIFICATS
  // ============================================
  console.log("📜 Création des certificats...\n");

  let certCount = 0;
  for (const student of students.slice(0, 30)) {
    await prisma.certificate.create({
      data: {
        studentId: student.profile.id,
        type: randomElement(["ENROLLMENT", "ATTENDANCE", "CONDUCT"]) as any,
        academicYearId: academicYear1.id,
        issuedById: director1.id,
        certificateNumber: `CERT${academicYear1.name.replace("-", "")}${String(certCount + 1).padStart(4, "0")}`,
        validUntil: new Date(2025, 7, 31),
      },
    });
    certCount++;
  }

  console.log(`   ✅ ${certCount} certificats créés\n`);

  // ============================================
  // 26. ANNONCES
  // ============================================
  console.log("📢 Création des annonces...\n");

  const announcements = [
    { title: "Rentrée scolaire 2024-2025", content: "La rentrée des classes est fixée au lundi 16 septembre 2024 à 7h30. Tous les élèves doivent se présenter en tenue réglementaire.", priority: "HIGH" },
    { title: "Calendrier des compositions", content: "Les compositions du 1er trimestre auront lieu du 9 au 13 décembre 2024. Les emplois du temps sont affichés.", priority: "HIGH" },
    { title: "Réunion parents-professeurs", content: "Une réunion de concertation parents-professeurs se tiendra le 18 décembre à 15h dans les salles de classe.", priority: "NORMAL" },
    { title: "Vacances de Noël", content: "Les vacances de Noël débuteront le 21 décembre 2024 et prendront fin le 5 janvier 2025.", priority: "NORMAL" },
    { title: "Inscriptions activités parascolaires", content: "Les inscriptions aux activités parascolaires (football, basketball, chorale) sont ouvertes au secrétariat.", priority: "LOW" },
  ];

  for (const ann of announcements) {
    await prisma.announcement.create({
      data: {
        schoolId: school1.id,
        title: ann.title,
        content: ann.content,
        type: "GENERAL",
        priority: ann.priority as any,
        isPublished: true,
        publishedAt: new Date(),
        authorId: director1.id,
      },
    });
  }

  console.log(`   ✅ ${announcements.length} annonces créées\n`);

  // ============================================
  // 27. MESSAGES INTERNES
  // ============================================
  console.log("💬 Création des messages...\n");

  const messages = [
    { from: director1.id, to: teachers[0].user.id, subject: "Réunion pédagogique", content: "Une réunion pédagogique est programmée pour vendredi à 16h." },
    { from: teachers[0].user.id, to: parents[0].user.id, subject: "Suivi de votre enfant", content: "Je souhaite vous rencontrer pour discuter des résultats de votre enfant." },
    { from: superAdmin.id, to: schoolAdmin1.id, subject: "Mise à jour système", content: "Une mise à jour du système sera effectuée ce weekend." },
  ];

  for (const msg of messages) {
    await prisma.message.create({
      data: {
        senderId: msg.from,
        recipientId: msg.to,
        subject: msg.subject,
        content: msg.content,
        isRead: Math.random() < 0.5,
      },
    });
  }

  console.log(`   ✅ ${messages.length} messages créés\n`);

  // ============================================
  // 28. NOTIFICATIONS
  // ============================================
  console.log("🔔 Création des notifications...\n");

  let notifCount = 0;
  for (const student of students.slice(0, 50)) {
    const notifTypes = [
      { type: "GRADE", title: "Nouvelle note", message: "Une nouvelle note a été ajoutée à votre bulletin" },
      { type: "ATTENDANCE", title: "Absence signalée", message: "Une absence a été enregistrée" },
      { type: "MESSAGE", title: "Nouveau message", message: "Vous avez reçu un nouveau message" },
    ];

    const notif = randomElement(notifTypes);
    await prisma.notification.create({
      data: {
        userId: student.user.id,
        type: notif.type as any,
        title: notif.title,
        message: notif.message,
        isRead: Math.random() < 0.3,
      },
    });
    notifCount++;
  }

  console.log(`   ✅ ${notifCount} notifications créées\n`);

  // ============================================
  // 29. CALENDRIER ET JOURS FÉRIÉS
  // ============================================
  console.log("📅 Création du calendrier scolaire...\n");

  // Jours fériés nationaux
  const publicHolidays = [
    { name: "Fête de l'Indépendance", date: new Date("2024-08-01"), type: "NATIONAL" },
    { name: "Toussaint", date: new Date("2024-11-01"), type: "RELIGIOUS" },
    { name: "Noël", date: new Date("2024-12-25"), type: "RELIGIOUS" },
    { name: "Jour de l'An", date: new Date("2025-01-01"), type: "NATIONAL" },
    { name: "Fête du Travail", date: new Date("2025-05-01"), type: "INTERNATIONAL" },
    { name: "Ascension", date: new Date("2025-05-29"), type: "RELIGIOUS" },
  ];

  for (const holiday of publicHolidays) {
    await prisma.publicHoliday.create({
      data: {
        name: holiday.name,
        date: holiday.date,
        type: holiday.type as any,
        isRecurring: true,
      },
    });
  }

  // Vacances scolaires
  await prisma.schoolHoliday.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear1.id,
      name: "Vacances de Noël",
      type: "CHRISTMAS",
      startDate: new Date("2024-12-21"),
      endDate: new Date("2025-01-05"),
    },
  });

  await prisma.schoolHoliday.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear1.id,
      name: "Vacances de Pâques",
      type: "EASTER",
      startDate: new Date("2025-04-18"),
      endDate: new Date("2025-04-28"),
    },
  });

  // Événements du calendrier scolaire
  const calendarEvents = [
    { name: "Pré-rentrée des enseignants", type: "PRE_RENTREE", date: new Date("2024-09-12") },
    { name: "Rentrée des classes", type: "RENTREE", date: new Date("2024-09-16") },
    { name: "Fin du 1er trimestre", type: "FIN_TRIMESTRE", date: new Date("2024-12-20") },
    { name: "Conseil de classe 1er trimestre", type: "CONSEIL_CLASSE", date: new Date("2024-12-18") },
    { name: "Remise des bulletins", type: "REMISE_BULLETINS", date: new Date("2024-12-21") },
  ];

  for (const event of calendarEvents) {
    await prisma.schoolCalendarEvent.create({
      data: {
        schoolId: school1.id,
        academicYearId: academicYear1.id,
        name: event.name,
        type: event.type as any,
        startDate: event.date,
        isAllDay: true,
        isPublic: true,
      },
    });
  }

  console.log(`   ✅ Calendrier scolaire créé\n`);

  // ============================================
  // 30. ANALYTICS ET ORIENTATION
  // ============================================
  console.log("📈 Création des analytics et données d'orientation...\n");

  for (const student of students) {
    const grades = gradesByStudent.get(student.profile.id) || [];
    const avgGrade = grades.length > 0
      ? grades.reduce((a, b) => a + b, 0) / grades.length
      : randomGrade(student.scenario.gradeRange[0], student.scenario.gradeRange[1]);

    const performanceLevel =
      avgGrade >= 16 ? "EXCELLENT" :
        avgGrade >= 14 ? "VERY_GOOD" :
          avgGrade >= 12 ? "GOOD" :
            avgGrade >= 10 ? "AVERAGE" :
              avgGrade >= 8 ? "INSUFFICIENT" : "WEAK";

    const riskLevel =
      avgGrade >= 12 ? "NONE" :
        avgGrade >= 10 ? "LOW" :
          avgGrade >= 8 ? "MEDIUM" : "HIGH";

    await prisma.studentAnalytics.create({
      data: {
        studentId: student.profile.id,
        periodId: periods[0].id,
        academicYearId: academicYear1.id,
        generalAverage: avgGrade,
        classRank: randomInt(1, 30),
        classSize: 30,
        performanceLevel: performanceLevel as any,
        progressionRate: randomInt(-10, 15),
        consistencyRate: randomInt(60, 95),
        riskLevel: riskLevel as any,
        riskFactors: riskLevel !== "NONE" ? ["Notes en baisse", "Absences fréquentes"] : [],
      },
    });

    // Orientation pour les élèves de 3ème
    if (student.class.levelName === "3ème") {
      const orientation = await prisma.studentOrientation.create({
        data: {
          studentId: student.profile.id,
          academicYearId: academicYear1.id,
          classLevelId: student.class.level.id,
          status: randomElement(["PENDING", "ANALYZED", "RECOMMENDED"]) as any,
        },
      });

      // Recommandations basées sur la moyenne
      const series = avgGrade >= 14
        ? ["SERIE_C", "SERIE_D"]
        : avgGrade >= 12
          ? ["SERIE_D", "SERIE_B"]
          : ["SERIE_A", "SERIE_G2"];

      for (let i = 0; i < series.length; i++) {
        await prisma.orientationRecommendation.create({
          data: {
            orientationId: orientation.id,
            recommendedSeries: series[i] as any,
            rank: i + 1,
            score: randomInt(60, 95),
            justification: `Recommandation basée sur les performances académiques`,
            strengths: ["Bons résultats dans les matières principales"],
          },
        });
      }
    }
  }

  console.log(`   ✅ Analytics et orientations créés\n`);

  // ============================================
  // 31. AUDIT LOGS
  // ============================================
  console.log("📋 Création des logs d'audit...\n");

  const auditActions = [
    { action: "CREATE", entity: "USER", description: "Création d'un utilisateur" },
    { action: "UPDATE", entity: "GRADE", description: "Modification d'une note" },
    { action: "DELETE", entity: "ATTENDANCE", description: "Suppression d'une présence" },
    { action: "LOGIN", entity: "SESSION", description: "Connexion utilisateur" },
  ];

  for (const log of auditActions) {
    await prisma.auditLog.create({
      data: {
        userId: superAdmin.id,
        action: log.action,
        entity: log.entity,
        entityId: randomElement(students).profile.id,
        ipAddress: `192.168.1.${randomInt(1, 255)}`,
      },
    });
  }

  console.log(`   ✅ Logs d'audit créés\n`);

  // ============================================
  // 32. PARAMÈTRES SYSTÈME
  // ============================================
  console.log("⚙️  Création des paramètres système...\n");

  await prisma.systemSetting.createMany({
    data: [
      { key: "app_name", value: "EduPilot", type: "string" },
      { key: "default_language", value: "fr", type: "string" },
      { key: "academic_year", value: "2024-2025", type: "string" },
      { key: "grading_scale", value: "20", type: "number" },
      { key: "passing_grade", value: "10", type: "number" },
      { key: "session_timeout", value: "3600", type: "number" },
      { key: "enable_sms_notifications", value: "true", type: "boolean" },
      { key: "enable_email_notifications", value: "true", type: "boolean" },
    ],
  });

  console.log(`   ✅ Paramètres système créés\n`);

  // ============================================
  // RÉSUMÉ FINAL
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("🎉 GÉNÉRATION DES DONNÉES TERMINÉE AVEC SUCCÈS!");
  console.log("=".repeat(60));

  console.log("\n📊 RÉSUMÉ DES DONNÉES CRÉÉES:");
  console.log("─".repeat(40));
  console.log(`   🏫 Établissements:        3`);
  console.log(`   👤 Super Admin:           1`);
  console.log(`   👔 Administrateurs:       5`);
  console.log(`   👨‍🏫 Enseignants:           ${teachers.length}`);
  console.log(`   👨‍👩‍👧‍👦 Parents:              ${parents.length}`);
  console.log(`   👨‍🎓 Élèves:                ${students.length}`);
  console.log(`   🏛️  Classes:               ${collegeClasses.length}`);
  console.log(`   📚 Matières:              ${subjects.length}`);
  console.log(`   📝 Notes:                 ${totalGrades}`);
  console.log(`   📅 Présences/Absences:    ${totalAttendance}`);
  console.log(`   💰 Paiements:             ${paymentCount}`);
  console.log(`   📆 Créneaux EDT:          ${scheduleCount}`);
  console.log(`   📖 Cours LMS:             ${courseCount}`);
  console.log(`   📝 Examens en ligne:      ${examCount}`);
  console.log(`   🏥 Dossiers médicaux:     ${medicalCount}`);
  console.log(`   📞 Rendez-vous:           ${appointmentCount}`);
  console.log(`   🎉 Événements:            ${events.length}`);
  console.log(`   📜 Certificats:           ${certCount}`);
  console.log(`   ⚠️  Incidents:             ${incidentCount}`);

  console.log("\n🔐 COMPTES DE TEST:");
  console.log("─".repeat(40));
  console.log("   📌 Super Admin:");
  console.log("      Email: admin@edupilot.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Admin École Saint-Michel:");
  console.log("      Email: admin@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Directeur:");
  console.log("      Email: directeur@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Comptable:");
  console.log("      Email: comptable@saintmichel.bj");
  console.log("      Mot de passe: Password123!");
  console.log("");
  console.log("   📌 Enseignants (exemples):");
  teachers.slice(0, 4).forEach(t => {
    console.log(`      - ${t.data.firstName} ${t.data.lastName} (${t.data.subject})`);
    console.log(`        Email: ${t.user.email}`);
  });
  console.log("      ...");
  console.log("");
  console.log("   📌 Parents: prénom.nom[index]@gmail.com");
  console.log("   📌 Élèves: prénom.nom[index]@eleve.saintmichel.bj");
  console.log("");
  console.log("   🔑 Mot de passe universel: Password123!");

  console.log("\n" + "=".repeat(60));
  console.log("✅ L'application est prête pour les tests!");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
