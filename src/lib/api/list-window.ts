import type { NextRequest } from "next/server";
import { getPaginationParams, type PaginationParams } from "@/lib/api/api-helpers";
import {
    buildCursorPage,
    encodeCursor,
    getCursorParams,
    InvalidCursorError,
    keysetOrderBy,
    keysetWhere,
    type CursorPagination,
    type CursorValue,
} from "@/lib/api/pagination";

/**
 * Fenêtre d'une liste paginée : curseur (keyset) par défaut — format unique du
 * projet, voir `pagination.ts` —, ancien mode `?page=` toléré jusqu'au Lot 8
 * pour les consommateurs non migrés (réponse inchangée, construite par la route).
 *
 *   const list = getListWindow(request, { sortField: "createdAt", direction: "desc" });
 *   const [rows, total] = await Promise.all([
 *     prisma.x.findMany({ where: list.where(where), orderBy: list.orderBy, skip: list.skip, take: list.take }),
 *     list.needsTotal ? prisma.x.count({ where }) : undefined,
 *   ]);
 *   if (list.offset) return <ancien format>(rows, total, list.offset);
 *   return NextResponse.json(list.page(rows, (row) => row.createdAt, total));
 *
 * Même tri dans les deux modes : (clé de tri, id), l'id départageant les ex æquo.
 * La clé de tri doit être non nulle (une ligne à clé nulle sortirait du keyset).
 *
 * Tri composé ou sur une colonne nullable (ex. priorité puis date de publication) :
 * option `positional` — même format de réponse et de curseur opaque pour le client,
 * mais le curseur porte la position (OFFSET) au lieu d'une valeur de tri. Réservé
 * aux listes de taille modérée ; `orderBy` est alors fourni par la route et doit se
 * terminer par l'id (ordre total, stable d'une page à l'autre).
 */
export interface ListWindow {
    /** Mode `?page=` (déprécié) : paramètres de l'ancien format ; `null` en mode curseur. */
    offset: PaginationParams | null;
    limit: number;
    orderBy: object[];
    skip: number | undefined;
    take: number;
    /** count() à exécuter : toujours en mode `?page=`, première page seulement en mode curseur. */
    needsTotal: boolean;
    /** Ajoute la condition « après le curseur » au filtre de la liste. */
    where<W extends object>(where: W): W;
    /** Réponse du mode curseur : `{ data, pagination }`. */
    page<Row extends { id: string }>(
        rows: Row[],
        sortValue: (row: Row) => CursorValue,
        total?: number,
    ): { data: Row[]; pagination: CursorPagination };
}

type ListLimits = {
    defaultLimit?: number;
    maxLimit?: number;
    /** Nom du paramètre de taille de l'ancien mode (ex. `pageSize`). */
    limitParam?: string;
};

export function getListWindow(
    request: NextRequest,
    options:
        | ({ sortField: string; direction: "asc" | "desc"; positional?: false } & ListLimits)
        | ({ positional: true; orderBy: object[] } & ListLimits),
): ListWindow {
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const limits = { defaultLimit: options.defaultLimit, maxLimit: options.maxLimit };
    const offset = searchParams.has("page")
        ? getPaginationParams(request, { ...limits, limitParam: options.limitParam })
        : null;
    const cursor = offset ? null : getCursorParams(searchParams, limits);
    const limit = offset ? offset.limit : cursor!.limit;

    if (options.positional) {
        // Curseur positionnel : la valeur encodée est le rang de la première ligne de la page.
        const position = cursor?.cursor ? cursor.cursor.value : 0;
        if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
            throw new InvalidCursorError();
        }
        const skip = offset ? offset.skip : position;
        return {
            offset,
            limit,
            orderBy: options.orderBy,
            skip,
            take: offset ? limit : limit + 1,
            needsTotal: offset ? true : cursor!.withTotal,
            where: (where) => where,
            page: (rows, _sortValue, total) => {
                const hasNextPage = rows.length > limit;
                const data = hasNextPage ? rows.slice(0, limit) : rows;
                const last = data[data.length - 1];
                return {
                    data,
                    pagination: {
                        limit,
                        hasNextPage,
                        nextCursor: hasNextPage && last ? encodeCursor({ value: skip + limit, id: last.id }) : null,
                        ...(total !== undefined ? { total } : {}),
                    },
                };
            },
        };
    }

    const { sortField, direction } = options;
    return {
        offset,
        limit,
        orderBy: keysetOrderBy(sortField, direction),
        skip: offset?.skip,
        take: offset ? limit : limit + 1,
        needsTotal: offset ? true : cursor!.withTotal,
        where: <W extends object>(where: W) =>
            cursor?.cursor
                ? ({ AND: [where, keysetWhere(sortField, direction, cursor.cursor)] } as unknown as W)
                : where,
        page: (rows, sortValue, total) => {
            const result = buildCursorPage(rows, limit, sortValue);
            return { data: result.data, pagination: { ...result.pagination, ...(total !== undefined ? { total } : {}) } };
        },
    };
}
