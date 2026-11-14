"use client";

import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

/**
 * Un seul système de notifications à l'écran : sonner (monté dans le layout
 * racine). Ce module garde l'API historique `toast({ title, description,
 * variant })` utilisée par une quarantaine d'écrans ; il n'y a plus de second
 * empilement Radix, au style et à la position différents.
 */
export interface ToastOptions {
    title?: ReactNode;
    description?: ReactNode;
    variant?: "default" | "destructive";
    /** Bouton d'action du toast (ex. « Voir la liste »). */
    action?: { label: string; onClick: () => void };
    /** Durée d'affichage en millisecondes. */
    duration?: number;
}

export function toast({ title, description, variant, action, duration }: ToastOptions = {}) {
    const message = title ?? description ?? (variant === "destructive" ? "Une erreur est survenue." : "");
    const options = { description: title ? description : undefined, action, duration };
    const id = variant === "destructive" ? sonner.error(message, options) : sonner(message, options);
    return { id, dismiss: () => sonner.dismiss(id) };
}

export function useToast() {
    return { toast, dismiss: (id?: string | number) => sonner.dismiss(id) };
}
