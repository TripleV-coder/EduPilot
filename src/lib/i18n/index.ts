import fr from "@/lib/i18n/locales/fr.json";

export type TranslationFn = (key: string, data?: Record<string, unknown>) => string;

const translations: Record<string, any> = { fr };

export const t: TranslationFn = (key: string, data?: Record<string, unknown>) => {
    // Traverse the JSON object (e.g., "api.issues.forbidden")
    const keys = key.split(".");
    let value: any = translations["fr"]; // Default to FR for now

    for (const k of keys) {
        if (value && value[k]) {
            value = value[k];
        } else {
            return key; // Return key if not found
        }
    }

    if (typeof value !== "string") return key;

    // Replace variables like {entity}
    if (data) {
        Object.entries(data).forEach(([k, v]) => {
            value = value.replace(`{${k}}`, String(v));
        });
    }

    return value;
};
