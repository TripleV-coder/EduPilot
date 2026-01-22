import { useQuery } from "@tanstack/react-query";

interface Class {
    id: string;
    name: string;
    capacity: number;
    mainTeacherId?: string;
    mainTeacher?: {
        user: {
            firstName: string;
            lastName: string;
        }
    };
    classLevel: {
        name: string;
    };
    _count?: {
        students: number;
    };
}

interface Meta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface ClassesResponse {
    data: Class[];
    meta: Meta;
}

const fetchClasses = async (): Promise<ClassesResponse> => {
    // Assuming /api/classes exists and follows standard pattern
    const response = await fetch("/api/classes");
    if (!response.ok) {
        throw new Error("Erreur lors du chargement des classes");
    }
    return response.json();
};

export function useClasses() {
    return useQuery({
        queryKey: ["classes"],
        queryFn: fetchClasses,
    });
}
