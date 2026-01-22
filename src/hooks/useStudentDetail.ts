"use client";

import { useApiQuery } from "./use-api";

export interface StudentDetailData {
  personal: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    dateOfBirth?: string;
    gender?: string;
    birthPlace?: string;
    nationality?: string;
    address?: string;
    phone?: string;
  };
  enrollment: {
    id: string;
    classId: string;
    className: string;
    classLevel: string;
    academicYearId: string;
    academicYear: string;
    enrollmentDate: string;
  };
  parentInfo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    relationship: string;
  }[];
  medicalInfo?: {
    bloodType?: string;
    allergies: string[];
    vaccinations: string[];
    emergencyContacts: Array<{
      name: string;
      phone: string;
      relationship: string;
    }>;
  };
  stats: {
    currentAverage: number;
    previousAverage?: number;
    classRank: number;
    totalStudents: number;
    attendance: number;
    totalAbsences: number;
    incidentCount: number;
  };
  academicProgress: {
    term: string;
    average: number;
    grades: Array<{
      id: string;
      subjectName: string;
      grade: number;
      max: number;
      coefficient: number;
      evaluationDate: string;
    }>;
  }[];
  behavior: {
    totalIncidents: number;
    incidents: Array<{
      id: string;
      type: string;
      description: string;
      severity: "low" | "medium" | "high";
      sanction?: string;
      date: string;
    }>;
  };
  certificates: Array<{
    id: string;
    type: string;
    issuedDate: string;
    downloadUrl?: string;
  }>;
}

export function useStudentDetail(studentId: string | null) {
  const profileQuery = useApiQuery<any>(
    studentId ? `/api/students/${studentId}` : null
  );

  const gradesQuery = useApiQuery<any>(
    studentId ? `/api/grades?studentId=${studentId}` : null
  );

  const attendanceQuery = useApiQuery<any>(
    studentId ? `/api/attendance?studentId=${studentId}` : null
  );

  const medicalQuery = useApiQuery<any>(
    studentId ? `/api/medical-records?studentId=${studentId}` : null
  );

  const incidentsQuery = useApiQuery<any>(
    studentId ? `/api/incidents?studentId=${studentId}` : null
  );

  const certificatesQuery = useApiQuery<any>(
    studentId ? `/api/certificates?studentId=${studentId}` : null
  );

  const isLoading =
    profileQuery.isPending ||
    gradesQuery.isPending ||
    attendanceQuery.isPending ||
    medicalQuery.isPending ||
    incidentsQuery.isPending ||
    certificatesQuery.isPending;

  const error =
    profileQuery.error ||
    gradesQuery.error ||
    attendanceQuery.error ||
    medicalQuery.error ||
    incidentsQuery.error ||
    certificatesQuery.error;

  const isError = !!error;

  const data =
    profileQuery.data &&
      gradesQuery.data &&
      attendanceQuery.data &&
      medicalQuery.data &&
      incidentsQuery.data
      ? {
        personal: {
          id: profileQuery.data.id,
          firstName: profileQuery.data.firstName,
          lastName: profileQuery.data.lastName,
          email: profileQuery.data.email,
          avatar: profileQuery.data.avatar,
          dateOfBirth: profileQuery.data.dateOfBirth,
          gender: profileQuery.data.gender,
          birthPlace: profileQuery.data.birthPlace,
          nationality: profileQuery.data.nationality,
          address: profileQuery.data.address,
          phone: profileQuery.data.phone,
        },
        enrollment: {
          id: profileQuery.data.enrollments?.[0]?.id,
          classId: profileQuery.data.enrollments?.[0]?.classId,
          className: profileQuery.data.enrollments?.[0]?.class?.name,
          classLevel: profileQuery.data.enrollments?.[0]?.class?.level?.name,
          academicYearId: profileQuery.data.enrollments?.[0]?.academicYearId,
          academicYear: profileQuery.data.enrollments?.[0]?.academicYear?.name,
          enrollmentDate: profileQuery.data.enrollments?.[0]?.enrollmentDate,
        },
        parentInfo: profileQuery.data.parentStudents?.map(
          (ps: any) => ({
            id: ps.parent?.id,
            firstName: ps.parent?.firstName,
            lastName: ps.parent?.lastName,
            email: ps.parent?.email,
            phone: ps.parent?.phone,
            relationship: ps.relationship,
          })
        ),
        medicalInfo: {
          bloodType: medicalQuery.data.bloodType,
          allergies: medicalQuery.data.allergies || [],
          vaccinations: medicalQuery.data.vaccinations || [],
          emergencyContacts: medicalQuery.data.emergencyContacts || [],
        },
        stats: {
          currentAverage: gradesQuery.data.average || 0,
          previousAverage: gradesQuery.data.previousAverage,
          classRank: gradesQuery.data.rank || 0,
          totalStudents: gradesQuery.data.totalStudents || 0,
          attendance: attendanceQuery.data.percentage || 0,
          totalAbsences: attendanceQuery.data.absences || 0,
          incidentCount: incidentsQuery.data.count || 0,
        },
        academicProgress: gradesQuery.data.history || [],
        behavior: {
          totalIncidents: incidentsQuery.data.count || 0,
          incidents: incidentsQuery.data.incidents || [],
        },
        certificates: certificatesQuery.data?.certificates || [],
      }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
