"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

/**
 * Logique de l'écran /first-login (présentation dans la page).
 *
 * - `token`   : ouvert par un lien de première connexion ;
 * - `session` : compte créé par un tiers, connecté avec son mot de passe
 *               provisoire et confiné ici par le middleware (M1) ;
 * - `invalid` : ni lien ni obligation de changement ;
 * - `loading` : session en cours de lecture.
 */
export type FirstLoginMode = "loading" | "token" | "session" | "invalid";

export interface FirstLoginValues {
    currentPassword: string;
    newPassword: string;
}

export function useFirstLogin({
    token,
    redirectDelayMs = 3000,
}: {
    token: string | null | undefined;
    redirectDelayMs?: number;
}) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const mode: FirstLoginMode = token
        ? "token"
        : status === "loading"
            ? "loading"
            : session?.user?.mustChangePassword === true
                ? "session"
                : "invalid";

    useEffect(() => () => {
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
    }, []);

    const submit = useCallback(
        async (values: FirstLoginValues) => {
            if (mode !== "token" && mode !== "session") {
                setError("Le lien d'accès est invalide ou manquant.");
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch("/api/auth/first-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(mode === "token" ? { token, ...values } : values),
                });
                const result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    setError(result?.error || "Une erreur est survenue.");
                    return;
                }

                // Le serveur a invalidé la session en cours (passwordChangedAt) :
                // elle est fermée ici, la reconnexion se fait avec le nouveau mot de passe.
                if (mode === "session") await signOut({ redirect: false });

                setIsSuccess(true);
                redirectTimer.current = setTimeout(() => router.push("/login?firstLogin=1"), redirectDelayMs);
            } catch {
                setError("Erreur de connexion au serveur.");
            } finally {
                setIsLoading(false);
            }
        },
        [mode, token, router, redirectDelayMs],
    );

    return { mode, isLoading, error, isSuccess, submit };
}
