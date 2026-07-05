"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseAutoSaveOptions<T> {
    /** Valeur courante du formulaire, surveillée pour déclencher la sauvegarde. */
    data: T;
    /** Effectue la sauvegarde. Doit rejeter en cas d'échec pour passer en état "error". */
    onSave: (data: T) => Promise<void>;
    /** Délai de debounce en ms après la dernière modification (défaut 1000). */
    delay?: number;
    /**
     * Active l'auto-save. Passer `false` tant que les données ne sont pas
     * hydratées (ex. chargement SWR) évite de sauvegarder un état vide au montage.
     * La transition false→true recale la référence sans déclencher de sauvegarde.
     */
    enabled?: boolean;
    /** Retourne false pour bloquer la sauvegarde (données invalides). Reste "dirty". */
    validate?: (data: T) => boolean;
    /** Comparaison d'égalité (défaut : JSON.stringify). */
    equals?: (a: T, b: T) => boolean;
}

export interface UseAutoSaveResult {
    status: AutoSaveStatus;
    lastSavedAt: Date | null;
    error: string | null;
    /** Force la sauvegarde immédiate (annule le debounce). */
    saveNow: () => void;
    /** Recale la référence sur les données courantes sans sauvegarder. */
    resync: () => void;
    isOnline: boolean;
}

function defaultEquals<T>(a: T, b: T): boolean {
    if (a === b) return true;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

/**
 * Sauvegarde automatique debouncée pour formulaires idempotents.
 *
 * Garanties :
 *  - ne sauvegarde pas au montage / à l'hydratation (via `enabled`) ;
 *  - garde anti-course : une réponse périmée n'écrase pas un envoi plus récent ;
 *  - offline-aware : diffère la sauvegarde jusqu'au retour en ligne ;
 *  - validation optionnelle avant chaque envoi.
 */
export function useAutoSave<T>({
    data,
    onSave,
    delay = 1000,
    enabled = true,
    validate,
    equals = defaultEquals,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
    const [status, setStatus] = useState<AutoSaveStatus>("idle");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(
        typeof navigator === "undefined" ? true : navigator.onLine,
    );

    // Dernier état confirmé comme sauvegardé (référence de comparaison).
    const baselineRef = useRef<T>(data);
    // Numéro de séquence : identifie le dernier envoi lancé (anti-course).
    const seqRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dataRef = useRef<T>(data);
    const onSaveRef = useRef(onSave);
    const validateRef = useRef(validate);
    const equalsRef = useRef(equals);
    const enabledRef = useRef(enabled);
    const prevEnabledRef = useRef(enabled);
    // Vrai tant que le premier passage à enabled=true n'a pas recalé la baseline.
    const hydratedRef = useRef(enabled);

    dataRef.current = data;
    onSaveRef.current = onSave;
    validateRef.current = validate;
    equalsRef.current = equals;
    enabledRef.current = enabled;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const runSave = useCallback(async () => {
        clearTimer();
        if (!enabledRef.current) return;

        const snapshot = dataRef.current;
        if (equalsRef.current(snapshot, baselineRef.current)) {
            setStatus((s) => (s === "error" ? s : "idle"));
            return;
        }
        if (validateRef.current && !validateRef.current(snapshot)) {
            // Données invalides : on reste en attente, sans envoi ni erreur bruyante.
            setStatus("dirty");
            return;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            // Hors ligne : la sauvegarde reprendra à l'événement `online`.
            setStatus("dirty");
            return;
        }

        const seq = ++seqRef.current;
        setStatus("saving");
        setError(null);
        try {
            await onSaveRef.current(snapshot);
            if (seq !== seqRef.current) return; // un envoi plus récent l'a supplanté
            baselineRef.current = snapshot;
            setLastSavedAt(new Date());
            // Si l'utilisateur a encore modifié depuis le snapshot, on repart "dirty".
            if (equalsRef.current(dataRef.current, snapshot)) {
                setStatus("saved");
            } else {
                setStatus("dirty");
            }
        } catch (err) {
            if (seq !== seqRef.current) return;
            setStatus("error");
            setError(err instanceof Error ? err.message : "Échec de la sauvegarde");
        }
    }, [clearTimer]);

    const saveNow = useCallback(() => {
        void runSave();
    }, [runSave]);

    const resync = useCallback(() => {
        clearTimer();
        baselineRef.current = dataRef.current;
        seqRef.current++;
        setStatus("idle");
        setError(null);
    }, [clearTimer]);

    // Suivi en ligne / hors ligne : flush au retour du réseau.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const onOnline = () => {
            setIsOnline(true);
            if (!equalsRef.current(dataRef.current, baselineRef.current)) {
                void runSave();
            }
        };
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [runSave]);

    // Déclenchement debouncé sur changement de données.
    useEffect(() => {
        // Transition enabled false→true : recale la baseline sans sauvegarder.
        if (enabled && (!prevEnabledRef.current || !hydratedRef.current)) {
            baselineRef.current = data;
            hydratedRef.current = true;
            prevEnabledRef.current = enabled;
            setStatus("idle");
            return;
        }
        prevEnabledRef.current = enabled;

        if (!enabled) return;
        if (equals(data, baselineRef.current)) {
            // Retour à l'état sauvegardé (ex. annulation) : plus rien à enregistrer.
            setStatus((s) => (s === "error" || s === "saving" ? s : "idle"));
            return;
        }

        setStatus("dirty");
        clearTimer();
        timerRef.current = setTimeout(() => {
            void runSave();
        }, delay);

        return clearTimer;
        // `equals`/`runSave` sont stables (module-level / useCallback) ; on ne
        // surveille que les données réelles pour éviter des reprogrammations.
    }, [data, enabled, delay]);

    // Nettoyage au démontage.
    useEffect(() => clearTimer, [clearTimer]);

    return { status, lastSavedAt, error, saveNow, resync, isOnline };
}
