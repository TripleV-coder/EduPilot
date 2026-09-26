import type { IconName } from "@/components/edu";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export type ClassOption = { id: string; name: string; classLevelId?: string };
export type ClassLevelOption = { id: string; name: string; code?: string };
export type AcademicYearOption = { id: string; name: string; isCurrent?: boolean };
export type FeeOption = {
    id: string;
    name: string;
    amount: number | string;
    classLevelCode: string | null;
};

export type StepIndex = 0 | 1 | 2 | 3;

export const STEPS: { label: string; icon: IconName }[] = [
    { label: "Identité élève", icon: "users" },
    { label: "Famille", icon: "users" },
    { label: "Cursus & classe", icon: "school" },
    { label: "Documents", icon: "cards" },
];

export type FormState = {
    // Step 1 — Identité
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    matricule: string;
    dateOfBirth: string;
    gender: "" | "MALE" | "FEMALE";
    birthPlace: string;
    nationality: string;
    address: string;
    // Step 2 — Famille
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string;
    parentRelation: string;
    // Step 3 — Cursus
    academicYearId: string;
    classId: string;
    admissionDate: string;
};

export const INITIAL_FORM: FormState = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    matricule: "",
    dateOfBirth: "",
    gender: "",
    birthPlace: "",
    nationality: "Béninoise",
    address: "",
    parentFirstName: "",
    parentLastName: "",
    parentPhone: "",
    parentRelation: "Père",
    academicYearId: "",
    classId: "",
    admissionDate: new Date().toISOString().slice(0, 10),
};

export const FR_AMOUNT = (n: number): string => n.toLocaleString("fr-FR");
