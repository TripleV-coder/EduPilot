import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ZodSchema } from "zod";

export interface ParseResult<T> {
    data: T[];
    errors: any[];
    meta: any;
}

export interface ValidationResult<T> {
    valid: T[];
    invalid: { row: number; data: any; errors: any[] }[];
}

export async function parseCsv<T>(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: Papa.ParseResult<T>) => {
                resolve(results.data);
            },
            error: (error: Error) => {
                reject(error);
            },
        });
    });
}

export async function parseExcel<T>(file: File): Promise<T[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
}

export function validateImportData<T>(
    data: any[],
    schema: ZodSchema<T>
): ValidationResult<T> {
    const valid: T[] = [];
    const invalid: { row: number; data: any; errors: any[] }[] = [];

    data.forEach((item, index) => {
        // Basic cleanup of empty strings to undefined for optional fields if needed, 
        // but Zod .or(z.literal("")) handles empty strings usually.
        // Let's rely on Zod.

        const result = schema.safeParse(item);
        if (result.success) {
            valid.push(result.data);
        } else {
            // console.log("Validation error:", JSON.stringify(result.error, null, 2));
            invalid.push({
                row: index + 1,
                data: item,
                errors: (result.error as any).errors || (result.error as any).issues || [],
            });
        }
    });

    return { valid, invalid };
}
