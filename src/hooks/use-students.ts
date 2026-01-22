import { useQuery } from "@tanstack/react-query";

interface Student {
  id: string;
  matricule?: string;
  dateOfBirth?: string;
  gender?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    schoolId?: string;
  };
  enrollments?: any[];
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StudentsResponse {
  data: Student[];
  meta: Meta;
}

const fetchStudents = async (): Promise<StudentsResponse> => {
  const response = await fetch("/api/students");
  if (!response.ok) {
    throw new Error("Erreur lors du chargement des élèves");
  }
  return response.json();
};

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
  });
}
