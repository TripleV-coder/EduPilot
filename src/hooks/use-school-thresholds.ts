"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { DEFAULT_SCHOOL_THRESHOLDS, type SchoolThresholds } from "@/lib/schools/school-thresholds";

/**
 * Seuils de lecture de l'école (seuil de passage, niveaux, assiduité,
 * mentions, conseil). Pendant le chargement ou en cas d'échec : valeurs par
 * défaut, identiques à l'ancien comportement — l'écran reste utilisable.
 */
export function useSchoolThresholds(): SchoolThresholds {
    const { data } = useSWR<SchoolThresholds>("/api/config/thresholds", fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 5 * 60_000,
    });
    return data ?? DEFAULT_SCHOOL_THRESHOLDS;
}
