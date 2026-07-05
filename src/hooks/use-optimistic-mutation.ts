"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import type { Key } from "swr";
import { toast } from "@/hooks/use-toast";

export interface OptimisticMutationOptions<TData, TVars> {
    /** Clé SWR du cache à mettre à jour de façon optimiste. */
    key: Key;
    /** Effectue la mutation serveur. Doit rejeter en cas d'échec (déclenche le rollback). */
    mutationFn: (vars: TVars) => Promise<unknown>;
    /**
     * Calcule le nouvel état du cache à partir de l'état courant et des variables.
     * Appelé immédiatement (optimiste) puis après succès serveur.
     */
    optimisticUpdate: (current: TData | undefined, vars: TVars) => TData;
    /** Toast de succès (optionnel). */
    successMessage?: string;
    /** Toast d'échec : message fixe ou dérivé de l'erreur. */
    errorMessage?: string | ((error: unknown) => string);
    /** Revalider depuis le serveur après la mutation (défaut true). */
    revalidate?: boolean;
}

export interface OptimisticMutationResult<TVars> {
    trigger: (vars: TVars) => Promise<void>;
    isMutating: boolean;
}

/**
 * Mutation optimiste au-dessus de SWR : met à jour l'UI immédiatement, effectue
 * la mutation serveur, et **annule automatiquement (rollback)** en cas d'échec,
 * avec un toast d'erreur. L'interface reste ainsi instantanée sans mentir sur
 * l'état réel des données.
 */
export function useOptimisticMutation<TData, TVars>(
    options: OptimisticMutationOptions<TData, TVars>,
): OptimisticMutationResult<TVars> {
    const { mutate } = useSWRConfig();
    const [isMutating, setIsMutating] = useState(false);

    const trigger = useCallback(
        async (vars: TVars) => {
            setIsMutating(true);
            try {
                await mutate(
                    options.key,
                    async (current: TData | undefined) => {
                        await options.mutationFn(vars);
                        return options.optimisticUpdate(current, vars);
                    },
                    {
                        optimisticData: (current: TData | undefined) =>
                            options.optimisticUpdate(current, vars),
                        rollbackOnError: true,
                        populateCache: true,
                        revalidate: options.revalidate ?? true,
                    },
                );
                if (options.successMessage) {
                    toast({ title: options.successMessage });
                }
            } catch (error) {
                const message =
                    typeof options.errorMessage === "function"
                        ? options.errorMessage(error)
                        : options.errorMessage;
                toast({
                    title: message || "L'opération a échoué. Réessaie.",
                    variant: "destructive",
                });
                throw error;
            } finally {
                setIsMutating(false);
            }
        },
        [mutate, options],
    );

    return { trigger, isMutating };
}
