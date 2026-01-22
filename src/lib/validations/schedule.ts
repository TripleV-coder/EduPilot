import { z } from "zod";

// Time format validation (HH:mm)
const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const timeSchema = z
  .string()
  .regex(timeRegex, "Format d'heure invalide (attendu: HH:mm, ex: 08:30)");

export const scheduleSchema = z
  .object({
    classId: z.string().cuid("ID de classe invalide"),
    classSubjectId: z.string().cuid("ID de matière invalide").optional().nullable(),
    dayOfWeek: z.coerce
      .number()
      .int("Le jour doit être un nombre entier")
      .min(0, "Le jour doit être entre 0 (Lundi) et 6 (Dimanche)")
      .max(6, "Le jour doit être entre 0 (Lundi) et 6 (Dimanche)"),
    startTime: timeSchema,
    endTime: timeSchema,
    room: z.string().max(50, "Le nom de la salle est trop long").optional(),
  })
  .refine(
    (data) => {
      // Validate that endTime is after startTime
      const [startHours, startMinutes] = data.startTime.split(":").map(Number);
      const [endHours, endMinutes] = data.endTime.split(":").map(Number);

      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;

      return endTotalMinutes > startTotalMinutes;
    },
    {
      message: "L'heure de fin doit être après l'heure de début",
      path: ["endTime"],
    }
  );

export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const DAYS_OF_WEEK = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

export const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];
