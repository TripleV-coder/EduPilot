"use client";

import * as React from "react";

import { EduCommandPalette } from "./EduCommandPalette";

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
            <EduCommandPalette open={isOpen} onOpenChange={setIsOpen} />
        </CommandPaletteContext.Provider>
    );
}
