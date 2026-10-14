"use client";

import { useSyncExternalStore } from "react";

const KEY = "edupilot-lang";

function readLang(): "fr" | "en" {
    if (typeof window === "undefined") return "fr";
    return window.localStorage.getItem(KEY) === "en" ? "en" : "fr";
}

/** Langue d'interface choisie dans Réglages (lue au chargement de la page). */
export function useUiLang(): "fr" | "en" {
    return useSyncExternalStore(
        (onChange) => {
            window.addEventListener("storage", onChange);
            return () => window.removeEventListener("storage", onChange);
        },
        readLang,
        () => "fr",
    );
}

export function pick(lang: "fr" | "en", fr: string, en: string): string {
    return lang === "en" ? en : fr;
}

export function rememberUiLang(language: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, language === "en" ? "en" : "fr");
}
