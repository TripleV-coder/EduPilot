import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Validation des bornes de dates passées en query string (?startDate=&endDate=).
 *
 * Sans validation, `new Date("n'importe quoi")` produit une Invalid Date qui
 * part telle quelle dans le `where` Prisma (erreur 500 ou filtre silencieusement
 * faux). Accepte les formats ISO date ("2026-01-31") et datetime.
 */
export const dateRangeQuerySchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (range) => !range.startDate || !range.endDate || range.startDate <= range.endDate,
    { message: "startDate doit précéder endDate" }
  );

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export type ParsedDateRange =
  | { success: true; startDate?: Date; endDate?: Date }
  | { success: false; response: NextResponse };

/**
 * Parse et valide startDate/endDate depuis les searchParams.
 * Retourne soit les dates (absentes si non fournies), soit une réponse 400
 * prête à renvoyer.
 */
export function parseDateRangeParams(searchParams: URLSearchParams): ParsedDateRange {
  const result = dateRangeQuerySchema.safeParse({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Plage de dates invalide : utilisez un format ISO (AAAA-MM-JJ).",
          details: result.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, ...result.data };
}
