"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils/error-message";

/**
 * Règles de conservation d'un établissement (Lot 6) — chargement et mise à jour.
 * La présentation reste dans la page (règle 9).
 */
export interface RetentionPlanItem {
    dataType: string;
    label: string;
    months: number;
    isActive: boolean;
    action: "deactivate" | "anonymize" | "delete" | "report";
    /** Nombre d'éléments que la purge traiterait aujourd'hui, avec cette durée. */
    affected: number;
    supported: boolean;
}

export function useRetentionPolicies() {
    const [items, setItems] = useState<RetentionPlanItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savingType, setSavingType] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch("/api/compliance/retention");
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Chargement impossible");
            setItems(((await res.json()) as { data: RetentionPlanItem[] }).data);
        } catch (e) {
            setError(getErrorMessage(e));
            setItems([]);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    /** Enregistre une règle puis recharge l'aperçu : les effectifs dépendent de la durée. */
    const update = useCallback(
        async (dataType: string, changes: { months?: number; isActive?: boolean }) => {
            setSavingType(dataType);
            try {
                const res = await fetch("/api/compliance/retention", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dataType, ...changes }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Enregistrement impossible");
                await load();
                return { ok: true as const };
            } catch (e) {
                return { ok: false as const, message: getErrorMessage(e) };
            } finally {
                setSavingType(null);
            }
        },
        [load],
    );

    return { items, error, savingType, reload: load, update };
}
