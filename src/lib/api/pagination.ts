/**
 * Pagination par curseur (keyset) — format unique du projet (Lot 3).
 *
 *   GET /api/<liste>?limit=20&cursor=<opaque>&total=0
 *   { "data": [...], "pagination": { "limit": 20, "nextCursor": "…" | null, "hasNextPage": true, "total": 120 } }
 *
 * - Tri toujours stable sur (clé de tri, id) : les identifiants cuid ne portent
 *   pas d'ordre temporel fiable, l'id sert à départager les ex æquo.
 * - Pas d'OFFSET : chaque page reprend strictement après le dernier élément
 *   (condition keyset indexable), quel que soit le rang de la page.
 * - `total` n'est calculé que sur la première page (sans curseur), et peut être
 *   désactivé par `total=0` : les pages suivantes ne paient aucun count().
 * - Curseur opaque (base64url) : le client le renvoie tel quel. Invalide → 400.
 *
 * Côté client : `useCursorPagination` (src/hooks) tient la pile des curseurs et
 * expose page / totalPages / next / prev pour garder les écrans « Page X / Y ».
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export type CursorValue = Date | string | number;

export interface DecodedCursor {
    value: CursorValue;
    id: string;
}

export interface CursorParams {
    limit: number;
    cursor: DecodedCursor | null;
    withTotal: boolean;
}

export interface CursorPagination {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
    total?: number;
}

export class InvalidCursorError extends Error {
    constructor() {
        super("Curseur de pagination invalide.");
        this.name = "InvalidCursorError";
    }
}

type EncodedCursor = { t: "d" | "s" | "n"; v: string | number; id: string };

export function encodeCursor(cursor: DecodedCursor): string {
    const { value, id } = cursor;
    const payload: EncodedCursor =
        value instanceof Date
            ? { t: "d", v: value.toISOString(), id }
            : typeof value === "number"
              ? { t: "n", v: value, id }
              : { t: "s", v: value, id };
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): DecodedCursor {
    let payload: Partial<EncodedCursor>;
    try {
        payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<EncodedCursor>;
    } catch {
        throw new InvalidCursorError();
    }
    if (!payload || typeof payload.id !== "string" || payload.id.length === 0) throw new InvalidCursorError();

    if (payload.t === "d" && typeof payload.v === "string") {
        const date = new Date(payload.v);
        if (Number.isNaN(date.getTime())) throw new InvalidCursorError();
        return { value: date, id: payload.id };
    }
    if (payload.t === "n" && typeof payload.v === "number" && Number.isFinite(payload.v)) {
        return { value: payload.v, id: payload.id };
    }
    if (payload.t === "s" && typeof payload.v === "string") {
        return { value: payload.v, id: payload.id };
    }
    throw new InvalidCursorError();
}

export function getCursorParams(
    searchParams: URLSearchParams,
    options: { defaultLimit?: number; maxLimit?: number } = {},
): CursorParams {
    const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_LIMIT;
    const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;

    const rawLimit = searchParams.get("limit");
    const parsed = rawLimit === null ? NaN : Number.parseInt(rawLimit, 10);
    const limit = Number.isNaN(parsed) ? defaultLimit : Math.min(maxLimit, Math.max(1, parsed));

    const rawCursor = searchParams.get("cursor");
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    const withTotal = cursor === null && searchParams.get("total") !== "0";

    return { limit, cursor, withTotal };
}

export function keysetOrderBy(field: string, direction: "asc" | "desc") {
    return [{ [field]: direction }, { id: direction }];
}

/** Condition « strictement après le curseur » pour l'ordre (field, id). */
export function keysetWhere(field: string, direction: "asc" | "desc", cursor: DecodedCursor | null) {
    if (!cursor) return {};
    const op = direction === "desc" ? "lt" : "gt";
    return {
        OR: [
            { [field]: { [op]: cursor.value } },
            { [field]: cursor.value, id: { [op]: cursor.id } },
        ],
    };
}

/**
 * Construit une page à partir de lignes lues avec `take: limit + 1` : la ligne
 * supplémentaire signale seulement l'existence d'une page suivante.
 */
export function buildCursorPage<Row extends { id: string }>(
    rows: Row[],
    limit: number,
    sortValue: (row: Row) => CursorValue,
): { data: Row[]; pagination: CursorPagination } {
    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
        data,
        pagination: {
            limit,
            hasNextPage,
            nextCursor: hasNextPage && last ? encodeCursor({ value: sortValue(last), id: last.id }) : null,
        },
    };
}
