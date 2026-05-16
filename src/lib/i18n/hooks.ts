import { t } from "@/lib/i18n";

/**
 * Hook for using translations in client components.
 * Currently defaults to 'fr' locale.
 */
export function useTranslation() {
    return { t };
}
