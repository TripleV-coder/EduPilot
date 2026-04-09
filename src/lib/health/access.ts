import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type SessionLike = {
  user?: {
    id: string;
    role: string;
    schoolId?: string | null;
  };
} | null;

type StudentAccessRecord = {
  id: string;
  schoolId: string;
  userId: string;
};

function getActiveSchoolId(session: SessionLike) {
  return session?.user?.schoolId ?? null;
}

export const HEALTH_STAFF_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "DIRECTOR",
  "NURSE",
  "SECRETARY",
] as const;

export const HEALTH_READ_ROLES = [...HEALTH_STAFF_ROLES, "PARENT", "STUDENT"] as const;
export const HEALTH_RECORD_WRITE_ROLES = [...HEALTH_STAFF_ROLES, "PARENT"] as const;
export const HEALTH_CONTACT_WRITE_ROLES = [...HEALTH_STAFF_ROLES, "PARENT"] as const;
export const HEALTH_VACCINATION_WRITE_ROLES = HEALTH_STAFF_ROLES;

export function requireHealthRole(session: SessionLike, allowedRoles: readonly string[]) {
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (
    session.user.role !== "SUPER_ADMIN" &&
    HEALTH_STAFF_ROLES.includes(session.user.role as (typeof HEALTH_STAFF_ROLES)[number]) &&
    !getActiveSchoolId(session)
  ) {
    return NextResponse.json(
      { error: "Aucun établissement associé à ce compte" },
      { status: 403 }
    );
  }

  return null;
}

export async function getParentStudentIds(userId: string): Promise<string[]> {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: {
      parentStudents: {
        select: { studentId: true },
      },
    },
  });

  return parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
}

export async function getOwnStudentProfile(userId: string): Promise<StudentAccessRecord | null> {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      schoolId: true,
      userId: true,
    },
  });
}

export async function ensureStudentHealthAccess(
  session: SessionLike,
  studentId: string,
  prefetchedStudent?: StudentAccessRecord | null
) {
  if (!session?.user) {
    return {
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const student =
    prefetchedStudent ??
    (await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        schoolId: true,
        userId: true,
      },
    }));

  if (!student) {
    return {
      response: NextResponse.json({ error: "Élève non trouvé" }, { status: 404 }),
    };
  }

  if (session.user.role === "SUPER_ADMIN") {
    return { student };
  }

  if (HEALTH_STAFF_ROLES.includes(session.user.role as (typeof HEALTH_STAFF_ROLES)[number])) {
    if (getActiveSchoolId(session) !== student.schoolId) {
      return {
        response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
    }
    return { student };
  }

  if (session.user.role === "PARENT") {
    const childrenIds = await getParentStudentIds(session.user.id);
    if (!childrenIds.includes(student.id)) {
      return {
        response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
    }
    return { student };
  }

  if (session.user.role === "STUDENT") {
    const ownStudentProfile = await getOwnStudentProfile(session.user.id);
    if (!ownStudentProfile || ownStudentProfile.id !== student.id) {
      return {
        response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
    }
    return { student };
  }

  return {
    response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
  };
}

export async function ensureMedicalRecordHealthAccess(session: SessionLike, medicalRecordId: string) {
  const medicalRecord = await prisma.medicalRecord.findUnique({
    where: { id: medicalRecordId },
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          id: true,
          schoolId: true,
          userId: true,
        },
      },
    },
  });

  if (!medicalRecord) {
    return {
      response: NextResponse.json({ error: "Dossier médical non trouvé" }, { status: 404 }),
    };
  }

  const access = await ensureStudentHealthAccess(session, medicalRecord.studentId, medicalRecord.student);
  if (access.response) {
    return access;
  }

  return { medicalRecord, student: access.student };
}

export async function ensureEmergencyContactHealthAccess(session: SessionLike, emergencyContactId: string) {
  const emergencyContact = await prisma.emergencyContact.findUnique({
    where: { id: emergencyContactId },
    select: {
      id: true,
      isPrimary: true,
      medicalRecordId: true,
      medicalRecord: {
        select: {
          studentId: true,
          student: {
            select: {
              id: true,
              schoolId: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!emergencyContact) {
    return {
      response: NextResponse.json({ error: "Contact d'urgence non trouvé" }, { status: 404 }),
    };
  }

  const access = await ensureStudentHealthAccess(
    session,
    emergencyContact.medicalRecord.studentId,
    emergencyContact.medicalRecord.student
  );
  if (access.response) {
    return access;
  }

  return { emergencyContact, student: access.student };
}

export async function ensureVaccinationHealthAccess(session: SessionLike, vaccinationId: string) {
  const vaccination = await prisma.vaccination.findUnique({
    where: { id: vaccinationId },
    select: {
      id: true,
      medicalRecordId: true,
      medicalRecord: {
        select: {
          studentId: true,
          student: {
            select: {
              id: true,
              schoolId: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!vaccination) {
    return {
      response: NextResponse.json({ error: "Vaccination non trouvée" }, { status: 404 }),
    };
  }

  const access = await ensureStudentHealthAccess(
    session,
    vaccination.medicalRecord.studentId,
    vaccination.medicalRecord.student
  );
  if (access.response) {
    return access;
  }

  return { vaccination, student: access.student };
}
