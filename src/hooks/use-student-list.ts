"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { studentListFrom } from "@/lib/api/student-list";

/**
 * Liste d'élèves pour un écran (N18) : lit la clé `data` de `/api/students`.
 * `query` : paramètres de la route (ex. `limit=200`), `null` pour ne rien charger.
 */
export function useStudentList<T>(query: string | null) {
    const key = query === null ? null : query ? `/api/students?${query}` : "/api/students";
    const { data, error, isLoading, mutate } = useSWR<unknown>(key, fetcher);
    return {
        students: studentListFrom<T>(data),
        error: error as Error | undefined,
        isLoading,
        mutate,
    };
}
