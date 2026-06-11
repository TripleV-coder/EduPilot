import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    paymentPlan: { findFirst: vi.fn() },
    installmentPayment: { findUnique: vi.fn(), count: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    courseEnrollment: { findUnique: vi.fn() },
    academicConfig: { findUnique: vi.fn() },
    evaluation: { findUnique: vi.fn() },
    grade: { findFirst: vi.fn() },
    schedule: { findFirst: vi.fn() },
    teacherAvailability: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn() },
    examTemplate: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  ValidationError,
  paymentPlanValidations,
  courseValidations,
  gradeValidations,
  scheduleValidations,
  appointmentValidations,
  scholarshipValidations,
  examValidations,
} from "@/lib/validations/business-rules";

const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("paymentPlanValidations.validatePaymentPlanCreation", () => {
  const base = {
    studentId: "s1",
    feeId: "f1",
    totalAmount: 120000,
    installments: 4,
    startDate: tomorrow(),
  };

  it("rejette une date de début passée", async () => {
    await expect(
      paymentPlanValidations.validatePaymentPlanCreation({
        ...base,
        startDate: new Date("2020-01-01"),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejette un doublon de plan actif", async () => {
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({ id: "plan1" } as any);
    await expect(paymentPlanValidations.validatePaymentPlanCreation(base)).rejects.toThrow(
      /existe déjà/
    );
  });

  it("rejette une mensualité inférieure à 10", async () => {
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);
    await expect(
      paymentPlanValidations.validatePaymentPlanCreation({
        ...base,
        totalAmount: 20,
        installments: 4,
      })
    ).rejects.toThrow(/au moins 10/);
  });

  it("accepte un plan valide", async () => {
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);
    await expect(paymentPlanValidations.validatePaymentPlanCreation(base)).resolves.toBeUndefined();
  });
});

describe("paymentPlanValidations.validateInstallmentPayment", () => {
  it("rejette une mensualité introuvable", async () => {
    vi.mocked(prisma.installmentPayment.findUnique).mockResolvedValue(null);
    await expect(
      paymentPlanValidations.validateInstallmentPayment("i1", new Date())
    ).rejects.toThrow(/non trouvée/);
  });

  it("rejette une mensualité déjà payée ou un plan inactif", async () => {
    vi.mocked(prisma.installmentPayment.findUnique).mockResolvedValue({
      status: "PAID",
      paymentPlan: { status: "ACTIVE" },
    } as any);
    await expect(
      paymentPlanValidations.validateInstallmentPayment("i1", new Date())
    ).rejects.toThrow(/déjà été payée/);

    vi.mocked(prisma.installmentPayment.findUnique).mockResolvedValue({
      status: "PENDING",
      paymentPlan: { status: "CANCELLED" },
    } as any);
    await expect(
      paymentPlanValidations.validateInstallmentPayment("i1", new Date())
    ).rejects.toThrow(/pas actif/);
  });

  it("accepte (avec warning loggé) un paiement hors ordre", async () => {
    vi.mocked(prisma.installmentPayment.findUnique).mockResolvedValue({
      status: "PENDING",
      paymentPlanId: "p1",
      dueDate: new Date(),
      paymentPlan: { status: "ACTIVE" },
    } as any);
    vi.mocked(prisma.installmentPayment.count).mockResolvedValue(2);

    await expect(
      paymentPlanValidations.validateInstallmentPayment("i1", new Date())
    ).resolves.toBeUndefined();
  });
});

describe("courseValidations", () => {
  it("publication : exige au moins un module et des leçons partout", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ modules: [] } as any);
    await expect(courseValidations.validateCoursePublication("c1")).rejects.toThrow(
      /au moins un module/
    );

    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      modules: [{ title: "Module vide", order: 0, lessons: [] }],
    } as any);
    await expect(courseValidations.validateCoursePublication("c1")).rejects.toThrow(
      /pas de leçons/
    );
  });

  it("publication : exige un ordre de modules continu", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      modules: [
        { title: "A", order: 0, lessons: [{}] },
        { title: "B", order: 2, lessons: [{}] },
      ],
    } as any);
    await expect(courseValidations.validateCoursePublication("c1")).rejects.toThrow(/continu/);
  });

  it("publication : accepte un cours bien structuré", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      modules: [
        { title: "A", order: 0, lessons: [{}] },
        { title: "B", order: 1, lessons: [{}] },
      ],
    } as any);
    await expect(courseValidations.validateCoursePublication("c1")).resolves.toBeUndefined();
  });

  it("inscription : refuse un cours non publié ou un élève hors classe", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      isPublished: false,
      classSubject: { classId: "cl1", class: {} },
    } as any);
    await expect(courseValidations.validateCourseEnrollment("c1", "s1")).rejects.toThrow(
      /pas encore disponible/
    );

    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      isPublished: true,
      classSubject: { classId: "cl1", class: {} },
    } as any);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);
    await expect(courseValidations.validateCourseEnrollment("c1", "s1")).rejects.toThrow(
      /inscrit à cette classe/
    );
  });

  it("inscription : refuse un doublon, accepte sinon", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      isPublished: true,
      classSubject: { classId: "cl1", class: {} },
    } as any);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "e1" } as any);

    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue({ id: "ce1" } as any);
    await expect(courseValidations.validateCourseEnrollment("c1", "s1")).rejects.toThrow(
      /déjà inscrit/
    );

    vi.mocked(prisma.courseEnrollment.findUnique).mockResolvedValue(null);
    await expect(courseValidations.validateCourseEnrollment("c1", "s1")).resolves.toBeUndefined();
  });
});

describe("gradeValidations", () => {
  it("borne la note par la config école puis par le barème de l'évaluation", async () => {
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ maxGrade: 20 } as any);
    await expect(gradeValidations.validateGradeValue(25, "e1", "school1")).rejects.toThrow(
      /entre 0 et 20/
    );

    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue({ maxGrade: 10 } as any);
    await expect(gradeValidations.validateGradeValue(15, "e1", "school1")).rejects.toThrow(
      /dépasser 10/
    );

    await expect(gradeValidations.validateGradeValue(8, "e1", "school1")).resolves.toBeUndefined();
  });

  it("refuse une note en doublon (sauf exclusion explicite)", async () => {
    vi.mocked(prisma.grade.findFirst).mockResolvedValue({ id: "g1" } as any);
    await expect(gradeValidations.validateDuplicateGrade("e1", "s1")).rejects.toThrow(
      /existe déjà/
    );

    vi.mocked(prisma.grade.findFirst).mockResolvedValue(null);
    await expect(
      gradeValidations.validateDuplicateGrade("e1", "s1", "g1")
    ).resolves.toBeUndefined();
    expect(vi.mocked(prisma.grade.findFirst).mock.calls[1][0].where.id).toEqual({ not: "g1" });
  });
});

describe("scheduleValidations.validateScheduleConflict", () => {
  it("valide le format et l'ordre des heures", async () => {
    await expect(
      scheduleValidations.validateScheduleConflict({
        dayOfWeek: 1,
        startTime: "9h30",
        endTime: "10:30",
      })
    ).rejects.toThrow(/Format d'heure invalide/);

    await expect(
      scheduleValidations.validateScheduleConflict({
        dayOfWeek: 1,
        startTime: "11:00",
        endTime: "10:00",
      })
    ).rejects.toThrow(/avant l'heure de fin/);
  });

  it("détecte un conflit de classe puis d'enseignant", async () => {
    vi.mocked(prisma.schedule.findFirst).mockResolvedValueOnce({ id: "sc1" } as any);
    await expect(
      scheduleValidations.validateScheduleConflict({
        classId: "cl1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
      })
    ).rejects.toThrow(/classe a déjà un cours/);

    vi.mocked(prisma.schedule.findFirst)
      .mockResolvedValueOnce(null) // pas de conflit classe
      .mockResolvedValueOnce({ id: "sc2" } as any); // conflit enseignant
    await expect(
      scheduleValidations.validateScheduleConflict({
        classId: "cl1",
        teacherId: "t1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
      })
    ).rejects.toThrow(/enseignant a déjà un cours/);
  });

  it("accepte un créneau libre", async () => {
    vi.mocked(prisma.schedule.findFirst).mockResolvedValue(null);
    await expect(
      scheduleValidations.validateScheduleConflict({
        classId: "cl1",
        teacherId: "t1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
      })
    ).resolves.toBeUndefined();
  });
});

describe("appointmentValidations.validateAppointmentScheduling", () => {
  it("refuse un rendez-vous passé, hors disponibilité, ou en conflit", async () => {
    await expect(
      appointmentValidations.validateAppointmentScheduling({
        teacherId: "t1",
        scheduledAt: new Date("2020-01-01"),
        duration: 30,
      })
    ).rejects.toThrow(/dans le passé/);

    vi.mocked(prisma.teacherAvailability.findFirst).mockResolvedValue(null);
    await expect(
      appointmentValidations.validateAppointmentScheduling({
        teacherId: "t1",
        scheduledAt: tomorrow(),
        duration: 30,
      })
    ).rejects.toThrow(/pas disponible/);

    vi.mocked(prisma.teacherAvailability.findFirst).mockResolvedValue({ id: "av1" } as any);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: "rdv1" } as any);
    await expect(
      appointmentValidations.validateAppointmentScheduling({
        teacherId: "t1",
        scheduledAt: tomorrow(),
        duration: 30,
      })
    ).rejects.toThrow(/déjà un rendez-vous/);
  });

  it("accepte un créneau disponible et libre", async () => {
    vi.mocked(prisma.teacherAvailability.findFirst).mockResolvedValue({ id: "av1" } as any);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    await expect(
      appointmentValidations.validateAppointmentScheduling({
        teacherId: "t1",
        scheduledAt: tomorrow(),
        duration: 30,
      })
    ).resolves.toBeUndefined();
  });
});

describe("scholarshipValidations.validateScholarship", () => {
  const base = { studentId: "s1", startDate: new Date("2026-01-01") };

  it("exige montant OU pourcentage, pas les deux, pourcentage borné", async () => {
    await expect(scholarshipValidations.validateScholarship(base)).rejects.toThrow(
      /doit être spécifié/
    );
    await expect(
      scholarshipValidations.validateScholarship({ ...base, amount: 100, percentage: 50 })
    ).rejects.toThrow(/pas les deux/);
    await expect(
      scholarshipValidations.validateScholarship({ ...base, percentage: 150 })
    ).rejects.toThrow(/entre 1 et 100/);
  });

  it("valide la cohérence des dates", async () => {
    await expect(
      scholarshipValidations.validateScholarship({
        ...base,
        amount: 100,
        endDate: new Date("2025-12-31"),
      })
    ).rejects.toThrow(/après la date de début/);

    await expect(
      scholarshipValidations.validateScholarship({
        ...base,
        percentage: 25,
        endDate: new Date("2026-06-30"),
      })
    ).resolves.toBeUndefined();
  });
});

describe("examValidations.validateExamPublication", () => {
  it("exige des questions, un total de points cohérent, des réponses et des options", async () => {
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue({
      totalPoints: 20,
      questions: [],
    } as any);
    await expect(examValidations.validateExamPublication("ex1")).rejects.toThrow(
      /au moins une question/
    );

    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue({
      totalPoints: 20,
      questions: [{ type: "MCQ", points: 10, correctAnswer: "A", options: ["A", "B"] }],
    } as any);
    await expect(examValidations.validateExamPublication("ex1")).rejects.toThrow(
      /ne correspond pas au total/
    );

    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue({
      totalPoints: 20,
      questions: [
        { type: "MCQ", points: 10, correctAnswer: "", options: ["A", "B"] },
        { type: "OPEN", points: 10, correctAnswer: null, options: [] },
      ],
    } as any);
    await expect(examValidations.validateExamPublication("ex1")).rejects.toThrow(
      /réponse correcte/
    );

    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue({
      totalPoints: 20,
      questions: [
        { type: "MCQ", points: 10, correctAnswer: "A", options: ["A"] },
        { type: "OPEN", points: 10, correctAnswer: null, options: [] },
      ],
    } as any);
    await expect(examValidations.validateExamPublication("ex1")).rejects.toThrow(
      /au moins 2 options/
    );
  });

  it("accepte un examen complet et cohérent", async () => {
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue({
      totalPoints: 20,
      questions: [
        { type: "MCQ", points: 12, correctAnswer: "B", options: ["A", "B", "C"] },
        { type: "TRUE_FALSE", points: 8, correctAnswer: "true", options: [] },
      ],
    } as any);
    await expect(examValidations.validateExamPublication("ex1")).resolves.toBeUndefined();
  });
});
