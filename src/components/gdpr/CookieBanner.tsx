"use client";

/**
 * Banner de consentement cookies / RGPD
 *
 * Affiché lors de la première visite. Stocke le consentement en localStorage.
 * EduPilot n'utilise que des cookies de session nécessaires → bouton unique "Accepter".
 * Le refus n'est pas proposé car les cookies sont strictement nécessaires au fonctionnement.
 *
 * Usage : <CookieBanner /> dans le layout racine (src/app/layout.tsx)
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "edupilot_cookie_consent";
const CONSENT_VERSION = "1"; // Incrémenter pour forcer un nouveau consentement

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

    /* eslint-disable react-hooks/set-state-in-effect -- must read localStorage in effect */
    useEffect(() => {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored !== CONSENT_VERSION) { setVisible(true); }
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    function accept() {
        localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-label="Consentement cookies"
            aria-live="polite"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
        >
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Texte */}
                <div className="flex-1 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">Cookies &amp; confidentialité —</span>{" "}
                    EduPilot utilise uniquement des cookies de session strictement nécessaires au fonctionnement
                    de l&apos;authentification. Aucun cookie publicitaire ou de tracking.{" "}
                    <Link href="/privacy" className="text-orange-500 hover:underline">
                        En savoir plus
                    </Link>
                </div>

                {/* Actions */}
                <div className="flex gap-3 shrink-0">
                    <Link
                        href="/privacy"
                        className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                    >
                        Politique de confidentialité
                    </Link>
                    <button
                        onClick={accept}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                    >
                        J&apos;accepte
                    </button>
                </div>
            </div>
        </div>
    );
}
