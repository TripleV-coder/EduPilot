"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

/**
 * Pagination par curseur côté client (format unique du projet, voir
 * `src/lib/api/pagination.ts`).
 *
 * L'API ne renvoie le total qu'avec la première page ; ce hook le conserve et
 * tient la pile des curseurs parcourus, ce qui permet de garder l'affichage
 * « Page X / Y » avec précédent/suivant sans aucun count() supplémentaire.
 * La pile repart de la première page dès que l'adresse de base change (filtre).
 */
export interface CursorPageResponse<T> {
    data: T[];
    pagination: { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number };
}

function withPageParams(baseUrl: string, limit: number, cursor: string | null): string {
    const url = new URL(baseUrl, "http://placeholder.local");
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    else url.searchParams.delete("cursor");
    return `${url.pathname}${url.search}`;
}

export function useCursorPagination<T>(baseUrl: string | null, options: { limit?: number } = {}) {
    const limit = options.limit ?? 20;
    const [cursors, setCursors] = useState<Array<string | null>>([null]);
    const [total, setTotal] = useState<number | undefined>(undefined);

    // Nouveau filtre : on repart de la première page et on oublie le total.
    useEffect(() => {
        setCursors([null]);
        setTotal(undefined);
    }, [baseUrl, limit]);

    const cursor = cursors[cursors.length - 1];
    const key = baseUrl ? withPageParams(baseUrl, limit, cursor) : null;
    const { data, error, isLoading, mutate } = useSWR<CursorPageResponse<T>>(key, fetcher, {
        keepPreviousData: true,
    });

    useEffect(() => {
        if (data?.pagination.total !== undefined) setTotal(data.pagination.total);
    }, [data]);

    const nextCursor = data?.pagination.nextCursor ?? null;
    const next = useCallback(() => {
        if (nextCursor) setCursors((stack) => [...stack, nextCursor]);
    }, [nextCursor]);
    const prev = useCallback(() => {
        setCursors((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
    }, []);

    return {
        items: data?.data ?? [],
        isLoading,
        error: error as Error | undefined,
        page: cursors.length,
        total,
        totalPages: total === undefined ? undefined : Math.max(1, Math.ceil(total / limit)),
        hasNextPage: Boolean(data?.pagination.hasNextPage),
        hasPreviousPage: cursors.length > 1,
        next,
        prev,
        mutate,
    };
}
