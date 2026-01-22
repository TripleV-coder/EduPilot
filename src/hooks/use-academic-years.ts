import { useQuery } from "@tanstack/react-query";

interface Period {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    sequence: number;
}

interface AcademicYear {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    periods?: Period[];
}

const fetchAcademicYears = async (): Promise<AcademicYear[]> => {
    const response = await fetch("/api/academic-years");
    if (!response.ok) {
        throw new Error("Erreur lors du chargement des années scolaires");
    }
    return response.json();
};

export function useAcademicYears() {
    return useQuery({
        queryKey: ["academic-years"],
        queryFn: fetchAcademicYears,
    });
}
