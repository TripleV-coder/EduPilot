import { useQuery } from "@tanstack/react-query";

interface ClassLevel {
    id: string;
    name: string;
    code: string;
    level: string;
    sequence: number;
}

const fetchClassLevels = async (): Promise<ClassLevel[]> => {
    const response = await fetch("/api/class-levels");
    if (!response.ok) {
        throw new Error("Erreur lors du chargement des niveaux");
    }
    return response.json();
};

export function useClassLevels() {
    return useQuery({
        queryKey: ["class-levels"],
        queryFn: fetchClassLevels,
    });
}
