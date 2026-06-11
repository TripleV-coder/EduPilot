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

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export const STEPS: { label: string; icon: IconName }[] = [
    { label: "Identité élève", icon: "users" },
    { label: "Famille", icon: "users" },
    { label: "Cursus & classe", icon: "school" },
    { label: "Documents", icon: "cards" },
    { label: "Paiement initial", icon: "money" },
];

export const PEDA_OPTIONS = [
    { id: "english_plus", label: "Anglais renforcé", sub: "4h / semaine", price: 40000 },
    { id: "lv2_german", label: "Allemand LV2", sub: "2h / semaine", price: 25000 },
    { id: "lv2_spanish", label: "Espagnol LV2", sub: "2h / semaine", price: 25000 },
    { id: "canteen", label: "Cantine", sub: "+ 35 000 FCFA / trim.", price: 35000 },
    { id: "transport", label: "Transport scolaire", sub: "+ 45 000 FCFA / trim.", price: 45000 },
    { id: "tutoring", label: "Soutien scolaire", sub: "Vendredi 16h", price: 15000 },
] as const;

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
    previousSchool: string;
    previousLevel: string;
    academicYearId: string;
    classId: string;
    admissionDate: string;
    options: Record<string, boolean>;
    // Step 5 — Paiement
    paymentMethod: "cash" | "mobile" | "bank" | "card";
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
    previousSchool: "",
    previousLevel: "",
    academicYearId: "",
    classId: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    options: {},
    paymentMethod: "mobile",
};

export const FR_AMOUNT = (n: number): string => n.toLocaleString("fr-FR");
