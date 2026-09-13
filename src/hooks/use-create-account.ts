"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { getErrorMessage } from "@/lib/utils/error-message";

type SubmitOutcome = { ok: true } | { ok: false; error: string };

/**
 * Logique de création d'un compte par un tiers (écrans « Ajouter un
 * enseignant », « Nouvel utilisateur ») ; la présentation reste dans la page.
 *
 * Le serveur génère un mot de passe provisoire unique quand l'auteur n'en
 * choisit pas (N31) et le renvoie une seule fois : il est exposé ici pour
 * être affiché et transmis au titulaire, qui devra le changer (M1).
 */
export function useCreateAccount({ endpoint, revalidatePrefix }: { endpoint: string; revalidatePrefix: string }) {
    const { mutate } = useSWRConfig();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [provisionalPassword, setProvisionalPassword] = useState<string | null>(null);

    const submit = useCallback(
        async (payload: unknown): Promise<SubmitOutcome> => {
            setLoading(true);
            setError(null);
            setSuccess(false);
            setProvisionalPassword(null);
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const first = Array.isArray(data?.details) ? data.details[0] : null;
                    throw new Error(
                        Array.isArray(first?.path) && first?.message
                            ? `${first.path.join(".")}: ${first.message}`
                            : data?.error || "Une erreur est survenue lors de l'enregistrement",
                    );
                }

                setProvisionalPassword(typeof data?.provisionalPassword === "string" ? data.provisionalPassword : null);
                setSuccess(true);
                void mutate((key) => typeof key === "string" && key.startsWith(revalidatePrefix));
                return { ok: true };
            } catch (err) {
                const message = getErrorMessage(err);
                setError(message);
                return { ok: false, error: message };
            } finally {
                setLoading(false);
            }
        },
        [endpoint, revalidatePrefix, mutate],
    );

    /** Erreur de saisie détectée par l'écran avant l'envoi. */
    const fail = useCallback((message: string) => setError(message), []);

    const reset = useCallback(() => {
        setSuccess(false);
        setProvisionalPassword(null);
        setError(null);
    }, []);

    return { loading, error, success, provisionalPassword, submit, fail, reset };
}
