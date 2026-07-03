export type ThemeValue = "light" | "dark" | "system";

const STORAGE_KEY = "edupilot-theme";

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

export function readStoredTheme(): ThemeValue {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
    }
    return "system";
}

export function persistTheme(theme: ThemeValue) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
}

export function toggleLightDark(): ThemeValue {
    const isDark = document.documentElement.classList.contains("dark");
    const next: ThemeValue = isDark ? "light" : "dark";
    persistTheme(next);
    return next;
}
