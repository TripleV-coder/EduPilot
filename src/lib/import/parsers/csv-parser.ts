/**
 * CSV Parser - Generic CSV file parser with encoding detection
 * @module lib/import/parsers/csv-parser
 */

export interface ParsedRow {
    [key: string]: string;
}

export interface CsvParseResult {
    headers: string[];
    rows: ParsedRow[];
    totalRows: number;
    errors: ParseError[];
}

export interface ParseError {
    row: number;
    message: string;
}

export interface CsvParseOptions {
    delimiter?: string;
    skipEmptyLines?: boolean;
    trimValues?: boolean;
    headerRow?: number; // 0-indexed, default 0
    maxRows?: number; // Limit for preview
}

/**
 * Parse CSV content string into structured data
 */
export function parseCsvContent(
    content: string,
    options: CsvParseOptions = {}
): CsvParseResult {
    const {
        delimiter = detectDelimiter(content),
        skipEmptyLines = true,
        trimValues = true,
        headerRow = 0,
        maxRows,
    } = options;

    const errors: ParseError[] = [];
    const lines = content.split(/\r?\n/);

    if (lines.length === 0) {
        return { headers: [], rows: [], totalRows: 0, errors: [{ row: 0, message: "Fichier vide" }] };
    }

    // Parse headers
    const headerLine = lines[headerRow];
    if (!headerLine) {
        return { headers: [], rows: [], totalRows: 0, errors: [{ row: headerRow, message: "Ligne d'en-tête manquante" }] };
    }

    const headers = parseCsvLine(headerLine, delimiter).map(h =>
        trimValues ? h.trim().toLowerCase().replace(/\s+/g, "_") : h
    );

    // Parse data rows
    const rows: ParsedRow[] = [];
    const dataStartRow = headerRow + 1;
    const maxRowIndex = maxRows ? Math.min(dataStartRow + maxRows, lines.length) : lines.length;

    for (let i = dataStartRow; i < maxRowIndex; i++) {
        const line = lines[i];

        // Skip empty lines if option is set
        if (skipEmptyLines && (!line || line.trim() === "")) {
            continue;
        }

        try {
            const values = parseCsvLine(line, delimiter);
            const row: ParsedRow = {};

            headers.forEach((header, index) => {
                const value = values[index] || "";
                row[header] = trimValues ? value.trim() : value;
            });

            rows.push(row);
        } catch (error) {
            errors.push({
                row: i + 1, // 1-indexed for user display
                message: error instanceof Error ? error.message : "Erreur de parsing",
            });
        }
    }

    return {
        headers,
        rows,
        totalRows: rows.length,
        errors,
    };
}

/**
 * Parse a single CSV line, handling quotes and escapes
 */
function parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i += 2;
                } else {
                    // End of quoted field
                    inQuotes = false;
                    i++;
                }
            } else {
                current += char;
                i++;
            }
        } else {
            if (char === '"') {
                // Start of quoted field
                inQuotes = true;
                i++;
            } else if (char === delimiter) {
                // End of field
                result.push(current);
                current = "";
                i++;
            } else {
                current += char;
                i++;
            }
        }
    }

    // Add last field
    result.push(current);

    return result;
}

/**
 * Detect the delimiter used in CSV content
 */
function detectDelimiter(content: string): string {
    const firstLine = content.split(/\r?\n/)[0] || "";

    const delimiters = [",", ";", "\t", "|"];
    let bestDelimiter = ",";
    let maxCount = 0;

    for (const delimiter of delimiters) {
        const count = (firstLine.match(new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        if (count > maxCount) {
            maxCount = count;
            bestDelimiter = delimiter;
        }
    }

    return bestDelimiter;
}

/**
 * Convert File/Blob to string with encoding detection
 */
export async function fileToString(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === "string") {
                resolve(content);
            } else {
                reject(new Error("Failed to read file as string"));
            }
        };

        reader.onerror = () => {
            reject(new Error("Error reading file"));
        };

        // Try UTF-8 first
        reader.readAsText(file, "UTF-8");
    });
}

/**
 * Generate CSV content from data
 */
export function generateCsv(
    headers: string[],
    rows: (string | number | boolean | null | undefined)[][],
    delimiter: string = ","
): string {
    const escapeCsvValue = (value: unknown): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headerLine = headers.map(escapeCsvValue).join(delimiter);
    const dataLines = rows.map(row => row.map(escapeCsvValue).join(delimiter));

    return [headerLine, ...dataLines].join("\n");
}

/**
 * Parse uploaded file as CSV
 */
export async function parseUploadedCsv(
    file: File,
    options: CsvParseOptions = {}
): Promise<CsvParseResult> {
    const content = await fileToString(file);
    return parseCsvContent(content, options);
}
