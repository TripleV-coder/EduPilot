export type SupportedImportType = "STUDENTS" | "TEACHERS" | "CLASSES" | "PARENTS";

export const IMPORT_TYPE_LABELS: Record<SupportedImportType, string> = {
    STUDENTS: "élèves",
    TEACHERS: "enseignants",
    CLASSES: "classes",
    PARENTS: "parents",
};
