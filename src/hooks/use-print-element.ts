"use client";

import { useCallback, type RefObject } from "react";

/**
 * Imprime UN élément de la page (ou l'enregistre en PDF via la boîte
 * d'impression) — remplace le paquet `react-to-print` (2026-11-07).
 *
 * Le temps de l'impression :
 *  - une copie de l'élément est placée dans `#edupilot-print-root`, en fin de
 *    document : elle garde classes et styles en ligne, et les feuilles de
 *    style de la page s'y appliquent telles quelles (pas d'iframe à recopier) ;
 *  - une feuille temporaire masque tout le reste (`display: none`, donc
 *    aucune page blanche), fixe le format A4 sans marge et met chaque
 *    `.bulletin-page` sur sa propre page ;
 *  - le titre du document devient `documentTitle` : c'est le nom proposé
 *    pour le PDF.
 * Tout est rétabli après l'impression (`afterprint`, et au retour de
 * `window.print()` pour les navigateurs qui bloquent jusque-là).
 */
const ROOT_ID = "edupilot-print-root";
const STYLE_ID = "edupilot-print-style";

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  body > *:not(#${ROOT_ID}) { display: none !important; }
  #${ROOT_ID} { display: block !important; }
  #${ROOT_ID} .bulletin-a4 { box-shadow: none !important; margin: 0 auto !important; }
  #${ROOT_ID} .bulletin-page { break-after: page; page-break-after: always; }
  #${ROOT_ID} .bulletin-page:last-child { break-after: auto; page-break-after: auto; }
  #${ROOT_ID} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@media screen { #${ROOT_ID} { display: none; } }
`;

export function printElement(element: HTMLElement, documentTitle?: string): void {
    const previousTitle = document.title;
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.appendChild(element.cloneNode(true));
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = PRINT_CSS;

    let restored = false;
    const restore = () => {
        if (restored) return;
        restored = true;
        root.remove();
        style.remove();
        document.title = previousTitle;
        window.removeEventListener("afterprint", restore);
    };

    document.getElementById(ROOT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.head.appendChild(style);
    document.body.appendChild(root);
    if (documentTitle) document.title = documentTitle;
    window.addEventListener("afterprint", restore);
    try {
        window.print();
    } finally {
        // Chrome et Firefox bloquent jusqu'à la fermeture de la boîte : on
        // rétablit au tour suivant (après `afterprint` s'il arrive).
        setTimeout(restore, 0);
    }
}

/** Fonction d'impression liée à une référence ; sans effet si l'élément n'est pas monté. */
export function usePrintElement(ref: RefObject<HTMLElement | null>, documentTitle?: string): () => void {
    return useCallback(() => {
        if (ref.current) printElement(ref.current, documentTitle);
    }, [ref, documentTitle]);
}
