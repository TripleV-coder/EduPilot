import { fetchAllPages } from "@/lib/api/fetch-all-pages";

/**
 * Export CSV de la liste des évaluations (page Notes).
 * Logique séparée de l'écran (refonte du design à venir).
 */
export interface EvaluationCsvRow {
    title: string | null;
    date: string;
    type?: { name: string } | null;
    classSubject?: { class?: { name: string } | null; subject?: { name: string } | null } | null;
}

const HEADERS = ["Titre", "Type", "Date", "Classe", "Matière"];

/**
 * Cellule CSV : neutralise une formule de tableur en tête de cellule (=, +, -, @)
 * et entoure de guillemets toute valeur contenant séparateur, guillemet ou saut de ligne.
 */
function cell(raw: string): string {
    const value = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildEvaluationsCsv(rows: EvaluationCsvRow[]): string {
    const lines = rows.map((row) =>
        [
            row.title ?? "",
            row.type?.name ?? "",
            row.date ? new Date(row.date).toLocaleDateString("fr-FR") : "",
            row.classSubject?.class?.name ?? "",
            row.classSubject?.subject?.name ?? "",
        ]
            .map(cell)
            .join(","),
    );
    return [HEADERS.join(","), ...lines].join("\n");
}

/** Télécharge toute la sélection (toutes les pages), pas seulement la page affichée. */
export async function exportEvaluationsCsv(baseUrl: string): Promise<void> {
    const rows = await fetchAllPages<EvaluationCsvRow>(baseUrl);
    if (rows.length === 0) return;

    const blob = new Blob(["﻿" + buildEvaluationsCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "evaluations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
}
