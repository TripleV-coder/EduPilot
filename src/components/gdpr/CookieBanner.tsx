"use client";

/**
 * Banner de consentement cookies / RGPD
 *
 * Affiché lors de la première visite. Stocke le consentement en localStorage.
 * EduPilot n'utilise que des cookies de session nécessaires → simple information, bouton « J'ai compris ».
 * Le refus n'est pas proposé car les cookies sont strictement nécessaires au fonctionnement.
 *
 * Usage : <CookieBanner /> dans le layout racine (src/app/layout.tsx)
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "edupilot_cookie_consent";
const CONSENT_VERSION = "1"; // Incrémenter pour forcer un nouveau consentement

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

     
    useEffect(() => {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored !== CONSENT_VERSION) { setVisible(true); }
    }, []);
     

    // Hauteur publiée (--consent-banner-h) tant que le bandeau est affiché : la
    // coque de l'application et les barres fixées en bas se placent au-dessus.
    // Sans cela il masquait « Enregistrer l'appel » et la navigation mobile.
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = ref.current;
        if (!visible || !node) return;
        const root = document.documentElement;
        const publish = () => root.style.setProperty("--consent-banner-h", `${Math.ceil(node.getBoundingClientRect().height)}px`);
        publish();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
        observer?.observe(node);
        return () => {
            observer?.disconnect();
            root.style.removeProperty("--consent-banner-h");
        };
    }, [visible]);

    function accept() {
        localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div
            ref={ref}
            role="region"
            aria-labelledby="cookie-banner-title"
            aria-live="polite"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
        >
            {/*
              * Une seule ligne, y compris en 390 px : les cookies sont strictement
              * nécessaires, il s'agit d'une information et non d'un choix. L'ancien
              * bandeau (3 lignes de texte + 2 liens) occupait un tiers de l'écran
              * mobile sur chaque page jusqu'au clic.
              */}
            <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5">
                <p className="flex-1 text-[13px] leading-snug text-gray-600">
                    <span id="cookie-banner-title" className="font-medium text-gray-800">Cookies de session uniquement</span>
                    <span className="hidden sm:inline"> : nécessaires à la connexion, aucun suivi ni publicité</span>.{" "}
                    <Link href="/privacy" className="whitespace-nowrap text-orange-700 underline hover:text-orange-800">
                        En savoir plus
                    </Link>
                </p>
                <button
                    onClick={accept}
                    className="touch-target shrink-0 whitespace-nowrap rounded-md bg-orange-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                >
                    J&apos;ai compris
                </button>
            </div>
        </div>
    );
}
