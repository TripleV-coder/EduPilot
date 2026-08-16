import fr from "@/lib/i18n/locales/fr.json";

export type TranslationFn = (key: string, data?: Record<string, unknown>) => string;

type TranslationNode = string | string[] | { [key: string]: TranslationNode };

const translations = {
  fr: fr as unknown as TranslationNode,
};

export const t: TranslationFn = (key, data) => {
  const keys = key.split(".");
  let value: TranslationNode | undefined = translations.fr;

  for (const k of keys) {
    if (value && typeof value === "object" && !Array.isArray(value) && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }

  if (typeof value === "string") {
    if (data) {
      return Object.entries(data).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        value
      );
    }
    return value;
  }

  return key;
};
