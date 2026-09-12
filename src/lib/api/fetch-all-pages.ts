import { fetcher } from "@/lib/fetcher";
import type { CursorPageResponse } from "@/hooks/use-cursor-pagination";

/**
 * Parcourt toutes les pages d'une liste paginée par curseur (côté client).
 *
 * Pour les usages qui ont besoin de TOUTE la sélection (export, planning d'une
 * semaine) : jamais une liste coupée à la première page. Lots de 100, sans
 * total (aucun count()), plafond de pages pour ne jamais boucler indéfiniment.
 */
export async function fetchAllPages<T>(
    baseUrl: string,
    options: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
    const pageSize = options.pageSize ?? 100;
    const maxPages = options.maxPages ?? 200;
    const rows: T[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < maxPages; page++) {
        const url = new URL(baseUrl, "http://placeholder.local");
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("total", "0");
        if (cursor) url.searchParams.set("cursor", cursor);

        const body = (await fetcher(`${url.pathname}${url.search}`)) as CursorPageResponse<T>;
        rows.push(...body.data);
        cursor = body.pagination.nextCursor;
        if (!cursor) return rows;
    }
    throw new Error(`Liste trop longue : plafond de ${maxPages} pages atteint.`);
}
