// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import { Prisma } from "@prisma/client";

export type AnalyticsWithDetails = Prisma.StudentAnalyticsGetPayload<{
  include: {
    period: {
      select: { id: true; name: true; sequence: true };
    };
    student: {
      include: {
        user: { select: { firstName: true; lastName: true } };
        enrollments: {
          include: { class: { select: { name: true } } };
        };
      };
    };
    subjectPerformances: {
      include: {
        subject: { select: { name: true } };
      };
    };
  };
}>;
