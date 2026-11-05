"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Erreur du layout racine : remplace tout le document (ni styles globaux, ni
 * polices, ni thème ne sont chargés ici), d'où les styles en ligne. Sans ce
 * fichier, Next affichait sa page brute en anglais et l'erreur ne remontait pas
 * au suivi des erreurs.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="fr">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    background: "#f8fafc",
                    color: "#0f172a",
                    padding: 16,
                }}
            >
                <title>Erreur — EduPilot</title>
                <main role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
                    <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>EduPilot a rencontré un problème</h1>
                    <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 20px", color: "#475569" }}>
                        L&apos;application n&apos;a pas pu s&apos;afficher. Vos données ne sont pas perdues.
                        Réessayez ; si le problème continue, contactez l&apos;administration de l&apos;école.
                    </p>
                    <button
                        type="button"
                        onClick={() => retry()}
                        style={{
                            minHeight: 44,
                            padding: "0 20px",
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#ffffff",
                            background: "#0369a1",
                            border: "none",
                            borderRadius: 10,
                            cursor: "pointer",
                        }}
                    >
                        Réessayer
                    </button>
                </main>
            </body>
        </html>
    );
}
