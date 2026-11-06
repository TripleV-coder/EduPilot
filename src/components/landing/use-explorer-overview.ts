"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export type ExplorerOverview = {
    schools: number;
    students: number;
    classes: number;
    teachers: number;
};

/**
 * Chiffres publics de la plateforme (/api/explorer/overview). Le bandeau du
 * haut de page et la section chiffres les demandaient chacun : une seule
 * requête désormais, partagée par SWR.
 */
export function useExplorerOverview() {
    return useSWR<ExplorerOverview>("/api/explorer/overview", fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });
}
