"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/**
 * Perf (2026-09-18) : la palette de commandes était montée sur **chaque** page
 * du tableau de bord alors qu'elle ne s'ouvre qu'au Ctrl+K. Son code (et le
 * catalogue de navigation qu'elle embarque) était donc téléchargé et exécuté
 * par tout le monde, y compris sur un téléphone en réseau lent, pour une
 * fonction que la plupart des gens n'utilisent jamais.
 *
 * Elle est désormais chargée à la première ouverture, puis reste montée. Le
 * raccourci, le contexte et le comportement sont inchangés.
 */
const EduCommandPalette = dynamic(
    () => import("./EduCommandPalette").then((m) => m.EduCommandPalette),
    { ssr: false },
);

type CommandPaletteContextValue = {
    open: () => void;
    close: () => void;
    toggle: () => void;
    isOpen: boolean;
};

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(
    null,
);

export function useCommandPalette(): CommandPaletteContextValue {
    const ctx = React.useContext(CommandPaletteContext);
    if (!ctx) {
        return { open: () => {}, close: () => {}, toggle: () => {}, isOpen: false };
    }
    return ctx;
}

export function CommandPaletteProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    // Une fois ouverte, la palette reste montée : pas de second chargement.
    const [everOpened, setEverOpened] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) setEverOpened(true);
    }, [isOpen]);

    const open = React.useCallback(() => setIsOpen(true), []);
    const close = React.useCallback(() => setIsOpen(false), []);
    const toggle = React.useCallback(() => setIsOpen((prev) => !prev), []);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                const target = e.target as HTMLElement | null;
                const tag = target?.tagName?.toLowerCase();
                if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
                    // allow native behavior in editors / inputs
                    if (!(e.metaKey || e.ctrlKey)) return;
                }
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const value = React.useMemo(
        () => ({ open, close, toggle, isOpen }),
        [open, close, toggle, isOpen],
    );

    return (
        <CommandPaletteContext.Provider value={value}>
            {children}
            {everOpened ? <EduCommandPalette open={isOpen} onOpenChange={setIsOpen} /> : null}
        </CommandPaletteContext.Provider>
    );
}
