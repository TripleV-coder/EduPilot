/**
 * Lecture d'un fichier d'import (CSV, XLSX, XLS) à partir de ses OCTETS
 * (Lot 5, N45). L'ancienne lecture (readAsBinaryString + XLSX type "binary")
 * abîmait les CSV en UTF-8 sans BOM — export par défaut de LibreOffice ou
 * Google Sheets — (« AÃ¯cha ») et perdait les caractères Windows-1252 hors
 * Latin-1, dont l'apostrophe typographique (« NDiaye »).
 *
 * - Classeurs Excel reconnus à leur signature (ZIP pour .xlsx, OLE pour .xls).
 * - CSV : UTF-8 strict, sinon Windows-1252 (Excel français) ; BOM retiré.
 * - Lignes entièrement vides et colonnes sans en-tête ignorées.
 *
 * SheetJS (390 Ko) est chargé **à la demande** (Lot 8) : il n'est utile qu'au
 * moment où quelqu'un choisit un fichier. Un import statique l'ajoutait au
 * paquet de la page d'import, donc au téléchargement de tous ceux qui
 * l'ouvrent — y compris sur un téléphone en réseau lent. C'est ce qui rend
 * cette fonction asynchrone.
 */
type SheetJs = typeof import("xlsx");

let sheetJs: Promise<SheetJs> | null = null;

/** Une seule fois par session : les imports suivants réutilisent le module. */
function loadSheetJs(): Promise<SheetJs> {
    sheetJs ??= import("xlsx");
    return sheetJs;
}
export type SpreadsheetRows = {
    headers: string[];
    rows: Array<Record<string, unknown>>;
};

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Octets 0x80–0x9F de Windows-1252 (table WHATWG). Le reste coïncide avec
 * latin-1. Décodage fait à la main : le `TextDecoder("windows-1252")` de
 * Node 20 décode en latin-1 et change « N’Diaye » en « N\u0092Diaye ».
 */
const CP1252_HIGH = [
    0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
    0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

function decodeWindows1252(bytes: Uint8Array): string {
    let text = "";
    for (const byte of bytes) {
        text += String.fromCharCode(byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte);
    }
    return text;
}

export function decodeText(bytes: Uint8Array): string {
    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        text = decodeWindows1252(bytes);
    }
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readWorkbook(XLSX: SheetJs, bytes: Uint8Array) {
    if (startsWith(bytes, ZIP) || startsWith(bytes, OLE)) {
        return XLSX.read(bytes, { type: "array", cellDates: false });
    }
    // CSV / texte : décodé ici, puis lu comme chaîne (aucune conversion de page de codes par SheetJS).
    return XLSX.read(decodeText(bytes), { type: "string", raw: true });
}

export async function readSpreadsheetRows(bytes: Uint8Array, _fileName?: string): Promise<SpreadsheetRows> {
    const XLSX = await loadSheetJs();
    const workbook = readWorkbook(XLSX, bytes);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return { headers: [], rows: [] };

    const raw = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: undefined, raw: false });
    if (raw.length === 0) return { headers: [], rows: [] };

    const headerCells = (raw[0] ?? []).map((cell) => String(cell ?? "").trim());
    const columns = headerCells
        .map((header, index) => ({ header, index }))
        .filter((column) => column.header !== "");

    const rows = raw
        .slice(1)
        .filter((cells) => Array.isArray(cells) && cells.some((cell) => String(cell ?? "").trim() !== ""))
        .map((cells) => {
            const record: Record<string, unknown> = {};
            for (const { header, index } of columns) {
                const value = cells[index];
                record[header] = value === undefined || String(value).trim() === "" ? undefined : value;
            }
            return record;
        });

    return { headers: columns.map((column) => column.header), rows };
}
