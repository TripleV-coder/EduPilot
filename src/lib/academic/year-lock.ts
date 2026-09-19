import { NextResponse } from "next/server";
import type { AcademicYearStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Clôture d'année scolaire (TD-018).
 *
 * Une année CLOSED ou ARCHIVED est figée : ses évaluations, ses notes et les
 * présences datées dans ses bornes ne s'écrivent plus. Seule une réouverture
 * explicite (auditée) lève le verrou.
 */
export const LOCKED_YEAR_STATUSES: readonly AcademicYearStatus[] = ["CLOSED", "ARCHIVED"];

export function isYearLocked(status: AcademicYearStatus): boolean {
  return LOCKED_YEAR_STATUSES.includes(status);
}

type LockedYear = { id: string; name: string };

function lockedResponse(year: LockedYear) {
  return NextResponse.json(
    {
      error: `L'année scolaire « ${year.name} » est clôturée : aucune modification n'est possible. Un administrateur peut la rouvrir.`,
      code: "ACADEMIC_YEAR_CLOSED",
      academicYearId: year.id,
    },
    { status: 409 }
  );
}

/** Refuse l'écriture si la période appartient à une année clôturée. */
export async function guardPeriodWritable(periodId: string): Promise<NextResponse | null> {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { academicYear: { select: { id: true, name: true, status: true } } },
  });
  if (period && isYearLocked(period.academicYear.status)) {
    return lockedResponse(period.academicYear);
  }
  return null;
}

/**
 * Refuse l'écriture d'une présence datée dans une année clôturée de
 * l'établissement. Les présences ne portent pas d'année : la date fait foi.
 */
export async function guardAttendanceDateWritable(
  schoolId: string,
  date: Date
): Promise<NextResponse | null> {
  const year = await prisma.academicYear.findFirst({
    where: {
      schoolId,
      status: { in: [...LOCKED_YEAR_STATUSES] },
      startDate: { lte: date },
      endDate: { gte: date },
    },
    select: { id: true, name: true },
  });
  return year ? lockedResponse(year) : null;
}
