import { useQuery } from "@tanstack/react-query";

interface Teacher {
    id: string;
    matricule?: string;
    specialization?: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
        isActive: boolean;
    };
    classSubjects?: any[]; // Simplified for now
    mainClasses?: any[];
}

interface Meta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface TeachersResponse {
    data: Teacher[];
    meta: Meta;
}

const fetchTeachers = async (): Promise<TeachersResponse> => {
    const response = await fetch("/api/teachers");
    if (!response.ok) {
        throw new Error("Erreur lors du chargement des enseignants");
    }
    return response.json();
};

export function useTeachers() {
    return useQuery({
        queryKey: ["teachers"],
        queryFn: fetchTeachers,
    });
}
