"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Apparition au défilement de la page d'accueil, en CSS (`edu-enter-up`,
 * `edu-stagger` de globals.css) : remplace framer-motion, qui chargeait
 * ~117 Ko sur la page publique pour quelques fondus.
 *
 * Le contenu reste VISIBLE par défaut (rendu serveur, sans JavaScript, robots) :
 * il n'est masqué qu'une fois le composant monté, et seulement s'il est hors
 * de l'écran — rien ne clignote au chargement. `prefers-reduced-motion`
 * neutralise l'animation (bloc global de globals.css).
 */
type Phase = "static" | "hidden" | "shown";

/** Vrai une fois l'élément entré dans la fenêtre (une seule fois). */
export function useInViewOnce<T extends Element>(rootMargin = "0px") {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const element = ref.current;
        if (!element || inView) return;
        if (typeof IntersectionObserver === "undefined") {
            setInView(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [inView, rootMargin]);
    return { ref, inView };
}

export function Reveal({
    as = "div",
    children,
    className,
    style,
    delay = 0,
    dy = 20,
    duration = 500,
    stagger = false,
    labelledBy,
}: {
    as?: "div" | "section" | "article";
    /** `aria-labelledby` de l'élément rendu. */
    labelledBy?: string;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    /** Retard (ms). */
    delay?: number;
    /** Distance verticale de départ (px). */
    dy?: number;
    /** Durée (ms). */
    duration?: number;
    /** Les enfants directs entrent en cascade au lieu du bloc entier. */
    stagger?: boolean;
}) {
    const ref = useRef<HTMLElement | null>(null);
    const [phase, setPhase] = useState<Phase>("static");

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === "undefined") return;
        let first = true;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.some((entry) => entry.isIntersecting);
            if (first) {
                first = false;
                // Déjà à l'écran au chargement : affiché tel quel, sans animation
                if (visible) observer.disconnect();
                else setPhase("hidden");
                return;
            }
            if (visible) {
                setPhase("shown");
                observer.disconnect();
            }
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const hiddenClass = stagger ? "[&>*]:opacity-0" : "opacity-0";
    const shownClass = stagger ? "edu-stagger" : "edu-enter-up";
    const phaseClass = phase === "hidden" ? hiddenClass : phase === "shown" ? shownClass : "";
    return createElement(
        as,
        {
            ref,
            "aria-labelledby": labelledBy,
            className: [className, phaseClass].filter(Boolean).join(" ") || undefined,
            style: {
                ...style,
                "--edu-enter-dy": `${dy}px`,
                "--edu-enter-d": `${duration}ms`,
                "--edu-enter-delay": `${delay}ms`,
            } as CSSProperties,
        },
        children,
    );
}

/** Variables d'entrée CSS (`edu-enter-up`) pour un élément animé au premier affichage. */
export function enterStyle(dy: number, delay = 0, duration = 500, scale?: number): CSSProperties {
    return {
        "--edu-enter-dy": `${dy}px`,
        "--edu-enter-delay": `${delay}ms`,
        "--edu-enter-d": `${duration}ms`,
        ...(scale !== undefined ? { "--edu-enter-s": String(scale) } : {}),
    } as CSSProperties;
}
