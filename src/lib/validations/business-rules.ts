import prisma from "@/lib/prisma";

/**
 * Business validation rules for EduPilot
 * These validations ensure data integrity beyond simple type checking
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Course Validations
 */
export const courseValidations = {
  /**
   * Validate course publication
   */
  async validateCoursePublication(courseId: string): Promise<void> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!course) {
      throw new ValidationError("Cours non trouvé");
    }

    // Must have at least 1 module
    if (course.modules.length === 0) {
      throw new ValidationError("Le cours doit avoir au moins un module avant publication");
    }

    // Each module must have at least 1 lesson
    const modulesWithoutLessons = course.modules.filter((m) => m.lessons.length === 0);
    if (modulesWithoutLessons.length > 0) {
      throw new ValidationError(
        `Les modules suivants n'ont pas de leçons: ${modulesWithoutLessons.map((m) => m.title).join(", ")}`
      );
    }

    // Validate module order (no gaps)
    const orders = course.modules.map((m) => m.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i) {
        throw new ValidationError("L'ordre des modules doit être continu (0, 1, 2, ...)");
      }
    }
  },

  /**
   * Validate course enrollment
   */
  async validateCourseEnrollment(courseId: string, studentId: string): Promise<void> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        classSubject: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!course) {
      throw new ValidationError("Cours non trouvé");
    }

    if (!course.isPublished) {
      throw new ValidationError("Ce cours n'est pas encore disponible");
    }

    // Check if student is enrolled in the class
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        classId: course.classSubject.classId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      throw new ValidationError("Vous devez être inscrit à cette classe pour accéder à ce cours");
    }

    // Check if already enrolled
    const existing = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
    });

    if (existing) {
      throw new ValidationError("Vous êtes déjà inscrit à ce cours");
    }
  },
};

/**
 * Grade Validations
 */
export const gradeValidations = {
  /**
   * Validate grade value
   */
  async validateGradeValue(
    value: number,
    evaluationId: string,
    schoolId: string
  ): Promise<void> {
    // Get school config for min/max grades
    const config = await prisma.academicConfig.findUnique({
      where: { schoolId },
    });

    const minGrade = 0;
    const maxGrade = Number(config?.maxGrade) || 20;

    if (value < minGrade || value > maxGrade) {
      throw new ValidationError(
        `La note doit être entre ${minGrade} et ${maxGrade} pour votre établissement`
      );
    }

    // Get evaluation to check if it has a custom max
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (evaluation && value > Number(evaluation.maxGrade)) {
      throw new ValidationError(
        `La note ne peut pas dépasser ${Number(evaluation.maxGrade)} pour cette évaluation`
      );
    }
  },

  /**
   * Validate duplicate grade
   */
  async validateDuplicateGrade(
    evaluationId: string,
    studentId: string,
    excludeGradeId?: string
  ): Promise<void> {
    const existing = await prisma.grade.findFirst({
      where: {
        evaluationId,
        studentId,
        id: excludeGradeId ? { not: excludeGradeId } : undefined,
      },
    });

    if (existing) {
      throw new ValidationError("Une note existe déjà pour cet élève dans cette évaluation");
    }
  },
};

/**
 * Schedule Validations
 */
export const scheduleValidations = {
  /**
   * Validate schedule conflicts
   */
  async validateScheduleConflict(data: {
    classId?: string;
    teacherId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    excludeId?: string;
  }): Promise<void> {
    const { classId, teacherId, dayOfWeek, startTime, endTime, excludeId } = data;

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new ValidationError("Format d'heure invalide. Utilisez HH:mm (ex: 09:30)");
    }

    // Validate start < end
    if (startTime >= endTime) {
      throw new ValidationError("L'heure de début doit être avant l'heure de fin");
    }

    // Check class conflict
    if (classId) {
      const classConflict = await prisma.schedule.findFirst({
        where: {
          classId,
          dayOfWeek,
          id: excludeId ? { not: excludeId } : undefined,
          OR: [
            // New schedule starts during existing
            {
              AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }],
            },
            // New schedule ends during existing
            {
              AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
            },
            // New schedule contains existing
            {
              AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
            },
          ],
        },
      });

      if (classConflict) {
        throw new ValidationError("Cette classe a déjà un cours à cet horaire");
      }
    }

    // Check teacher conflict
    if (teacherId) {
      const teacherConflict = await prisma.schedule.findFirst({
        where: {
          classSubject: {
            teacherId,
          },
          dayOfWeek,
          id: excludeId ? { not: excludeId } : undefined,
          OR: [
            {
              AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }],
            },
            {
              AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
            },
            {
              AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
            },
          ],
        },
      });

      if (teacherConflict) {
        throw new ValidationError("Cet enseignant a déjà un cours à cet horaire");
      }
    }
  },
};

/**
 * Appointment Validations
 */
export const appointmentValidations = {
  /**
   * Validate appointment scheduling
   */
  async validateAppointmentScheduling(data: {
    teacherId: string;
    scheduledAt: Date;
    duration: number;
    excludeId?: string;
  }): Promise<void> {
    const { teacherId, scheduledAt, duration, excludeId } = data;

    // Check if appointment is in the past
    if (scheduledAt < new Date()) {
      throw new ValidationError("Le rendez-vous ne peut pas être dans le passé");
    }

    // Check teacher availability
    const dayOfWeek = scheduledAt.getDay();
    const timeStr = `${scheduledAt.getHours().toString().padStart(2, "0")}:${scheduledAt.getMinutes().toString().padStart(2, "0")}`;

    const availability = await prisma.teacherAvailability.findFirst({
      where: {
        teacherId,
        dayOfWeek,
        startTime: { lte: timeStr },
        endTime: { gt: timeStr },
        isActive: true,
      },
    });

    if (!availability) {
      throw new ValidationError("L'enseignant n'est pas disponible à cet horaire");
    }

    // Check for conflicts
    const endTime = new Date(scheduledAt.getTime() + duration * 60000);

    const conflict = await prisma.appointment.findFirst({
      where: {
        teacherId,
        status: { in: ["PENDING", "CONFIRMED"] },
        id: excludeId ? { not: excludeId } : undefined,
        scheduledAt: {
          gte: scheduledAt,
          lt: endTime,
        },
      },
    });

    if (conflict) {
      throw new ValidationError("L'enseignant a déjà un rendez-vous à cet horaire");
    }
  },
};

/**
 * Scholarship Validations
 */
export const scholarshipValidations = {
  /**
   * Validate scholarship creation
   */
  async validateScholarship(data: {
    studentId: string;
    amount?: number;
    percentage?: number;
    startDate: Date;
    endDate?: Date;
  }): Promise<void> {
    const { amount, percentage, startDate, endDate } = data;

    // Must have either amount or percentage
    if (!amount && !percentage) {
      throw new ValidationError("Le montant ou le pourcentage doit être spécifié");
    }

    // Cannot have both
    if (amount && percentage) {
      throw new ValidationError("Spécifiez soit un montant fixe, soit un pourcentage, pas les deux");
    }

    // Validate percentage range
    if (percentage && (percentage < 1 || percentage > 100)) {
      throw new ValidationError("Le pourcentage doit être entre 1 et 100");
    }

    // Validate dates
    if (endDate && endDate <= startDate) {
      throw new ValidationError("La date de fin doit être après la date de début");
    }
  },
};

/**
 * Exam Validations
 */
export const examValidations = {
  /**
   * Validate exam template before publishing
   */
  async validateExamPublication(examId: string): Promise<void> {
    const exam = await prisma.examTemplate.findUnique({
      where: { id: examId },
      include: {
        questions: true,
      },
    });

    if (!exam) {
      throw new ValidationError("Examen non trouvé");
    }

    // Must have at least 1 question
    if (exam.questions.length === 0) {
      throw new ValidationError("L'examen doit avoir au moins une question avant publication");
    }

    // Validate total points match
    const calculatedTotal = exam.questions.reduce((sum, q) => sum + q.points, 0);
    if (calculatedTotal !== exam.totalPoints) {
      throw new ValidationError(
        `Le total des points des questions (${calculatedTotal}) ne correspond pas au total de l'examen (${exam.totalPoints})`
      );
    }

    // Validate MCQ and TRUE_FALSE questions have correct answers
    const questionsWithoutAnswers = exam.questions.filter(
      (q) =>
        (q.type === "MCQ" || q.type === "TRUE_FALSE") &&
        (!q.correctAnswer || q.correctAnswer.trim() === "")
    );

    if (questionsWithoutAnswers.length > 0) {
      throw new ValidationError(
        "Toutes les questions QCM et Vrai/Faux doivent avoir une réponse correcte définie"
      );
    }

    // Validate MCQ have options
    const mcqWithoutOptions = exam.questions.filter(
      (q) => q.type === "MCQ" && (!q.options || q.options.length < 2)
    );

    if (mcqWithoutOptions.length > 0) {
      throw new ValidationError("Les questions QCM doivent avoir au moins 2 options");
    }
  },
};

const businessRules = {
  courseValidations,
  gradeValidations,
  scheduleValidations,
  appointmentValidations,
  scholarshipValidations,
  examValidations,
  ValidationError,
};

export default businessRules;
