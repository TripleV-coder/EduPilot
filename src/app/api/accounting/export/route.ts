import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { parseDateRangeParams } from "@/lib/validations/date-range";
import type { Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

const exportQuerySchema = z.object({
    fiscalYearId: z.string().cuid().optional(),
    format: z.enum(["csv", "itas"]).default("csv"),
});

/**
 * GET /api/accounting/export — Export des écritures comptables au format DGI iTAS (Bénin).
 *
 * Format CSV SYSCOHADA / compatible iTAS :
 *   DATE;JOURNAL;PIECE;LIBELLE;COMPTE_DEBIT;LIBELLE_DEBIT;COMPTE_CREDIT;LIBELLE_CREDIT;MONTANT
 *
 * Query params :
 *   - fiscalYearId (cuid) : filtre sur l'exercice
 *   - startDate / endDate : fenêtre temporelle (ISO-8601)
 *   - format : "csv" (défaut) | "itas" (même contenu, extension .itas)
 */
export const GET = createApiHandler(
    async (request: NextRequest, { session }) => {
        if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        const url = new URL(request.url);
        const parsed = exportQuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
            return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
        }
        const { fiscalYearId, format } = parsed.data;

        const dateRange = parseDateRangeParams(url.searchParams);
        const schoolId = session.user.schoolId ?? undefined;

        const where: Prisma.JournalEntryWhereInput = {
            ...(schoolId && session.user.role !== "SUPER_ADMIN" ? { schoolId } : {}),
            ...(fiscalYearId ? { fiscalYearId } : {}),
            status: "POSTED",
        };

        if (dateRange.success && (dateRange.startDate || dateRange.endDate)) {
            where.entryDate = {
                ...(dateRange.startDate ? { gte: dateRange.startDate } : {}),
                ...(dateRange.endDate ? { lte: dateRange.endDate } : {}),
            };
        }

        const entries = await prisma.journalEntry.findMany({
            where,
            include: {
                lines: {
                    include: {
                        debitAccount: { select: { syscohadaCode: true, label: true } },
                        creditAccount: { select: { syscohadaCode: true, label: true } },
                    },
                },
                school: { select: { name: true } },
            },
            orderBy: { entryDate: "asc" },
        });

        // Neutralise séparateur et préfixes de formule Excel (CSV injection)
        const csvSafe = (value: string) => {
            const cleaned = value.replace(/;/g, ",");
            return /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
        };

        // Build CSV rows — one row per JournalEntryLine
        const csvRows: string[] = [
            "DATE;JOURNAL;PIECE;LIBELLE;COMPTE_DEBIT;LIBELLE_DEBIT;COMPTE_CREDIT;LIBELLE_CREDIT;MONTANT_FCFA",
        ];

        for (const entry of entries) {
            const dateStr = entry.entryDate.toISOString().split("T")[0];
            const journal = entry.pieceRef.startsWith("PIECE") ? "GEN" : entry.pieceRef.split("-")[0];

            for (const line of entry.lines) {
                const debitCode = line.debitAccount?.syscohadaCode ?? "";
                const debitLabel = csvSafe(line.debitAccount?.label ?? "");
                const creditCode = line.creditAccount?.syscohadaCode ?? "";
                const creditLabel = csvSafe(line.creditAccount?.label ?? "");
                const label = csvSafe(entry.label);
                const piece = csvSafe(entry.pieceRef);
                const amount = line.amountFcfa.toString();

                csvRows.push(
                    `${dateStr};${journal};${piece};${label};${debitCode};${debitLabel};${creditCode};${creditLabel};${amount}`
                );
            }
        }

        const csvContent = csvRows.join("\r\n");
        const filename =
            format === "itas"
                ? `export_itas_${new Date().toISOString().split("T")[0]}.itas`
                : `export_dgi_${new Date().toISOString().split("T")[0]}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    },
    { requireAuth: true }
);
