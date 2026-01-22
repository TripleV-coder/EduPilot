"use client";

import { useEffect, useCallback } from "react";

// ============================================
// TYPES
// ============================================

interface ShortcutHandler {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: (e: KeyboardEvent) => void;
    description?: string;
}

// ============================================
// KEYBOARD SHORTCUTS HOOK
// ============================================

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                // Only allow certain shortcuts in inputs (like Cmd+S)
                const isAllowedInInput = shortcuts.some(
                    s => s.key.toLowerCase() === e.key.toLowerCase() &&
                        (s.ctrl === e.ctrlKey || s.meta === e.metaKey) &&
                        ["s", "k"].includes(e.key.toLowerCase())
                );
                if (!isAllowedInInput) return;
            }

            for (const shortcut of shortcuts) {
                const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase();
                const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey || shortcut.meta;
                const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey || shortcut.ctrl;
                const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
                const altMatch = shortcut.alt ? e.altKey : !e.altKey;

                // For Cmd+K / Ctrl+K type shortcuts, check either ctrl or meta
                const modifierMatch = shortcut.ctrl || shortcut.meta
                    ? (shortcut.ctrl && e.ctrlKey) || (shortcut.meta && e.metaKey)
                    : true;

                if (keyMatch && modifierMatch && shiftMatch && altMatch) {
                    e.preventDefault();
                    shortcut.handler(e);
                    break;
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [shortcuts]);
}

// ============================================
// GLOBAL SHORTCUTS COMPONENT
// ============================================

export function useGlobalShortcuts() {
    const shortcuts: ShortcutHandler[] = [
        // Cmd+S / Ctrl+S - Save (handled by forms)
        {
            key: "s",
            ctrl: true,
            meta: true,
            handler: (e) => {
                // Dispatch save event for forms to handle
                window.dispatchEvent(new CustomEvent("keyboard-save"));
            },
            description: "Sauvegarder",
        },
        // Escape - Close modals/dropdowns
        {
            key: "Escape",
            handler: () => {
                // Dispatch escape event
                window.dispatchEvent(new CustomEvent("keyboard-escape"));
            },
            description: "Fermer",
        },
        // Ctrl+Tab - Next tab (handled by browser, but we can add custom logic)
        // ? ? - Show shortcuts help
        {
            key: "?",
            shift: true,
            handler: () => {
                window.dispatchEvent(new CustomEvent("show-shortcuts-help"));
            },
            description: "Afficher l'aide",
        },
    ];

    useKeyboardShortcuts(shortcuts);
}

// ============================================
// SAVE SHORTCUT HOOK (for forms)
// ============================================

export function useSaveShortcut(onSave: () => void) {
    useEffect(() => {
        const handleSave = () => onSave();
        window.addEventListener("keyboard-save", handleSave);
        return () => window.removeEventListener("keyboard-save", handleSave);
    }, [onSave]);
}

// ============================================
// ESCAPE SHORTCUT HOOK (for modals)
// ============================================

export function useEscapeShortcut(onEscape: () => void) {
    useEffect(() => {
        const handleEscape = () => onEscape();
        window.addEventListener("keyboard-escape", handleEscape);
        return () => window.removeEventListener("keyboard-escape", handleEscape);
    }, [onEscape]);
}
