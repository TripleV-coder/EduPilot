export type ThemeValue = "light" | "dark" | "system";

/** Clé de stockage local du thème, lue avant le premier rendu (THEME_BOOT_SCRIPT). */
export const THEME_STORAGE_KEY = "edupilot-theme";

export function isThemeValue(value: unknown): value is ThemeValue {
    return value === "light" || value === "dark" || value === "system";
}

/**
 * Script inline exécuté dans le <head> du layout racine (avec le nonce CSP),
 * avant tout rendu : applique le thème mémorisé sans éclair clair→sombre, suit
 * la préférence du système en mode « system » et les changements faits dans un
 * autre onglet. Sans stockage disponible (navigation privée), il ne fait rien.
 */
// Clé écrite en littéral (aucune interpolation dans un script inline, alerte
// CodeQL js/bad-code-sanitization) ; un test vérifie qu'elle égale THEME_STORAGE_KEY.
export const THEME_BOOT_SCRIPT = `(function(){try{var k="edupilot-theme";var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var t=null;try{t=localStorage.getItem(k)}catch(e){}t=t||"system";document.documentElement.classList.toggle("dark",t==="dark"||(t==="system"&&m.matches))};a();m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})();`;

export function readStoredTheme(): ThemeValue | null {
    try {
        const value = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeValue(value) ? value : null;
    } catch {
        return null;
    }
}

export function applyTheme(theme: ThemeValue) {
    const root = document.documentElement;
    if (theme === "dark") {
        root.classList.add("dark");
        return;
    }
    if (theme === "light") {
        root.classList.remove("dark");
        return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
}

/** Applique le thème et le mémorise pour les prochains chargements de page. */
export function persistTheme(theme: ThemeValue) {
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Stockage indisponible : le thème vaut pour cette page seulement.
    }
    applyTheme(theme);
}
