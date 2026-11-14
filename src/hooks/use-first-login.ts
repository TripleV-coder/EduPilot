"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOutAndPurge } from "@/lib/pwa/sign-out";

/**
 * Logique de l'écran /first-login (présentation dans la page).
 *
 * - `token`   : ouvert par un lien d'activation, vérifié auprès du serveur ;
 * - `session` : compte créé par un tiers, connecté avec son mot de passe
 *               provisoire et confiné ici par le middleware (M1) ;
 * - `invalid` : lien refusé (expiré, déjà utilisé, compte activé…) ou ni
 *               lien ni obligation de changement ;
 * - `loading` : session ou lien en cours de vérification.
 */
export type FirstLoginMode = "loading" | "token" | "session" | "invalid";

interface TokenCheck {
    status: "checking" | "valid" | "invalid";
    /** Faux pour un lien émis par la direction : aucun mot de passe provisoire. */
    requiresTempPassword: boolean;
    message: string | null;
    firstName: string | null;
}

const CHECKING: TokenCheck = { status: "checking", requiresTempPassword: true, message: null, firstName: null };

export interface FirstLoginValues {
    /** Absent pour un lien émis par la direction (aucun mot de passe provisoire). */
    currentPassword?: string;
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
    const [check, setCheck] = useState<TokenCheck>(CHECKING);

    // Le lien est vérifié dès l'ouverture : un lien expiré ou déjà utilisé est
    // annoncé tout de suite, pas après la saisie des mots de passe.
    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        setCheck(CHECKING);
        fetch(`/api/auth/first-login?token=${encodeURIComponent(token)}`, { signal: controller.signal })
            .then(async (response) => {
                const body = (await response.json().catch(() => ({}))) as {
                    error?: string;
                    requiresTempPassword?: boolean;
                    user?: { firstName?: string };
                };
                if (controller.signal.aborted) return;
                if (!response.ok) {
                    setCheck({
                        status: "invalid",
                        requiresTempPassword: true,
                        message: body.error || "Ce lien d'activation n'est pas valide.",
                        firstName: null,
                    });
                    return;
                }
                setCheck({
                    status: "valid",
                    requiresTempPassword: body.requiresTempPassword !== false,
                    message: null,
                    firstName: body.user?.firstName ?? null,
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setCheck({
                    status: "invalid",
                    requiresTempPassword: true,
                    message: "Connexion au serveur impossible : rechargez la page dans un instant.",
                    firstName: null,
                });
            });
        return () => controller.abort();
    }, [token]);

    const mode: FirstLoginMode = token
        ? check.status === "checking"
            ? "loading"
            : check.status === "valid"
                ? "token"
                : "invalid"
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
                if (mode === "session") await signOutAndPurge({ redirect: false });

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

    return {
        mode,
        isLoading,
        error,
        isSuccess,
        submit,
        requiresTempPassword: mode === "token" ? check.requiresTempPassword : true,
        invalidMessage: token ? check.message : null,
        firstName: mode === "token" ? check.firstName : null,
    };
}
