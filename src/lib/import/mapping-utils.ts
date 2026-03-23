/**
 * Mapping Utilities for Import System
 * Provides smart column mapping suggestions based on string similarity
 */

export interface FieldDefinition {
    key: string;
    label: string;
    required: boolean;
    type?: "string" | "email" | "date" | "number" | "enum";
    description?: string;
    enumValues?: string[];
}

/**
 * Field definitions for different import types
 */
export const TEACHER_FIELDS: FieldDefinition[] = [
    { key: "firstName", label: "Prénom", required: true, type: "string" },
    { key: "lastName", label: "Nom", required: true, type: "string" },
    { key: "email", label: "Email", required: true, type: "email" },
    { key: "phone", label: "Téléphone", required: false, type: "string" },
    { key: "subjects", label: "Matières", required: false, type: "string", description: "Séparées par des virgules" },
    { key: "qualification", label: "Qualification", required: false, type: "string" },
    { key: "type", label: "Type", required: false, type: "enum", enumValues: ["PERMANENT", "CONTRACTUAL", "TEMPORARY"] },
];

export const STUDENT_FIELDS: FieldDefinition[] = [
    { key: "firstName", label: "Prénom", required: true, type: "string" },
    { key: "lastName", label: "Nom", required: true, type: "string" },
    { key: "email", label: "Email", required: false, type: "email" },
    { key: "dateOfBirth", label: "Date de naissance", required: false, type: "date", description: "DD/MM/YYYY" },
    { key: "gender", label: "Genre", required: false, type: "enum", enumValues: ["M", "F"] },
    { key: "birthPlace", label: "Lieu de naissance", required: false, type: "string" },
    { key: "address", label: "Adresse", required: false, type: "string" },
    { key: "className", label: "Classe", required: false, type: "string" },
    { key: "parentEmail", label: "Email parent", required: false, type: "email" },
    { key: "matricule", label: "Matricule", required: false, type: "string" },
];

export const CLASS_FIELDS: FieldDefinition[] = [
    { key: "name", label: "Nom", required: true, type: "string", description: "Ex: 6ème A" },
    { key: "level", label: "Niveau", required: true, type: "string", description: "Ex: 6EME" },
    { key: "program", label: "Filière", required: false, type: "string" },
    { key: "capacity", label: "Capacité", required: false, type: "number" },
    { key: "mainTeacherEmail", label: "Email prof principal", required: false, type: "email" },
];

export const PARENT_FIELDS: FieldDefinition[] = [
    { key: "firstName", label: "Prénom", required: true, type: "string" },
    { key: "lastName", label: "Nom", required: true, type: "string" },
    { key: "email", label: "Email", required: false, type: "email" },
    { key: "phone", label: "Téléphone", required: true, type: "string" },
    { key: "address", label: "Adresse", required: false, type: "string" },
    { key: "cin", label: "CIN", required: false, type: "string" },
    { key: "job", label: "Profession", required: false, type: "string" },
    { key: "childrenMatricules", label: "Matricules enfants", required: false, type: "string", description: "Séparés par des virgules" },
];

/**
 * Calculate string similarity using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1, higher is better)
 */
function similarity(a: string, b: string): number {
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Common variations for field names
 */
const FIELD_ALIASES: Record<string, string[]> = {
    firstName: ["prénom", "prenom", "first name", "firstname", "given name"],
    lastName: ["nom", "last name", "lastname", "nom de famille", "surname"],
    email: ["email", "e-mail", "mail", "courriel", "adresse email"],
    phone: ["téléphone", "telephone", "phone", "tel", "mobile", "portable"],
    dateOfBirth: ["date de naissance", "naissance", "birth date", "dob", "né le", "ne le"],
    gender: ["genre", "sexe", "gender", "sex"],
    address: ["adresse", "address", "domicile"],
    className: ["classe", "class", "nom de classe"],
    matricule: ["matricule", "student id", "id", "numéro"],
    subjects: ["matières", "matieres", "subjects", "subject"],
    level: ["niveau", "level", "grade"],
    capacity: ["capacité", "capacite", "capacity", "effectif"],
    birthPlace: ["lieu de naissance", "lieu naissance", "birth place", "birthplace"],
    parentEmail: ["email parent", "parent email", "email du parent"],
    cin: ["cin", "cni", "carte identité", "id card"],
    job: ["profession", "métier", "metier", "job", "occupation"],
    childrenMatricules: ["matricules enfants", "enfants", "children", "students"],
};

/**
 * Suggest mapping based on column headers
 */
export function suggestMapping(
    sourceHeaders: string[],
    targetFields: FieldDefinition[]
): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const header of sourceHeaders) {
        let bestMatch: { field: string; score: number } = { field: "", score: 0 };

        for (const field of targetFields) {
            // Check exact match
            if (header.toLowerCase() === field.key.toLowerCase() ||
                header.toLowerCase() === field.label.toLowerCase()) {
                bestMatch = { field: field.key, score: 1 };
                break;
            }

            // Check aliases
            const aliases = FIELD_ALIASES[field.key] || [];
            for (const alias of aliases) {
                const score = similarity(header, alias);
                if (score > bestMatch.score && score > 0.6) {
                    bestMatch = { field: field.key, score };
                }
            }

            // Check similarity with field label
            const labelScore = similarity(header, field.label);
            if (labelScore > bestMatch.score && labelScore > 0.6) {
                bestMatch = { field: field.key, score: labelScore };
            }
        }

        if (bestMatch.score > 0.6) {
            mapping[header] = bestMatch.field;
        }
    }

    return mapping;
}

/**
 * Apply mapping to raw data
 */
export function applyMapping(
    data: Record<string, any>[],
    mapping: Record<string, string>
): Record<string, any>[] {
    return data.map((row) => {
        const mapped: Record<string, any> = {};
        for (const [sourceKey, targetKey] of Object.entries(mapping)) {
            if (row[sourceKey] !== undefined) {
                mapped[targetKey] = row[sourceKey];
            }
        }
        return mapped;
    });
}
