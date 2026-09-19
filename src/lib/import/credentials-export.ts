import type { ExportData } from "@/lib/utils/export";

/**
 * Identifiants provisoires renvoyés une seule fois par un import (M1) : un
 * mot de passe unique par compte, à transmettre aux titulaires, qui devront
 * le changer à la première connexion.
 */
export interface ImportCredential {
    row: number;
    email: string;
    firstName: string;
    lastName: string;
    provisionalPassword: string;
}

function isCredential(value: unknown): value is ImportCredential {
    if (!value || typeof value !== "object") return false;
    const c = value as Record<string, unknown>;
    return (
        typeof c.row === "number" &&
        typeof c.email === "string" &&
        typeof c.firstName === "string" &&
        typeof c.lastName === "string" &&
        typeof c.provisionalPassword === "string"
    );
}

/** Lit `credentials` à la racine de la réponse d'un import (entrées mal formées ignorées). */
export function readImportCredentials(result: unknown): ImportCredential[] {
    const list = (result as { credentials?: unknown } | null)?.credentials;
    return Array.isArray(list) ? list.filter(isCredential) : [];
}

const slug = (label: string) =>
    label
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** Données du fichier CSV (l'échappement, formules comprises, est fait par exportToCSV). */
export function buildCredentialsExport(credentials: ImportCredential[], typeLabel: string): ExportData {
    return {
        title: `identifiants-provisoires-${slug(typeLabel)}`,
        headers: ["Ligne du fichier", "Nom", "Prénom", "Email", "Mot de passe provisoire"],
        rows: credentials.map((c) => [c.row, c.lastName, c.firstName, c.email, c.provisionalPassword]),
    };
}
